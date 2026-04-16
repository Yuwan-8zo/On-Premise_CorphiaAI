# 附錄 C：系統部署與基礎設施維運規範 (Deployment & DevOps Handbooks)

一份具備商業等級的企業應用系統，不僅要求程式碼本身無懈可擊，其部署彈性與硬體利用率亦是關鍵考量標準。本附錄旨在詳列 Corphia AI 系統於內部地端（On-Premise）機器正式上線的部署策略、環境變數宣告以及多平台加速引擎編譯指南。

## C.1 環境配置依賴與系統參數 (Environment Variables)

由於整個系統秉持「無狀態伺服器」的最高原則，所有的硬性配置（Hard-coded configs）街被抽離至系統隱密的 `.env` 環境變數文檔。我們採用 `pydantic-settings` 進行嚴格的型別校驗與轉換。

### C.1.1 `backend/.env` 規範與解析
```ini
# 核心密碼學金鑰配置 (強烈建議在生產環境採用 60 字元以上之隨機雜湊)
SECRET_KEY="corphia-enterprise-super-secret-key-do-not-leak"

# Postgres 資料庫連線字串 (DSN Format)
DATABASE_URL="postgresql+asyncpg://postgres:postgres@localhost:5432/corphia"

# 模型尋址與推論硬體設定
LLAMA_MODEL_PATH="Qwen2.5-7B-Instruct-Q5_K_M.gguf"
# 若為 CPU 模式則為 0；若支援 CUDA 且顯存 > 8GB，建議調為 99 全層卸載
LLAMA_N_GPU_LAYERS=0
```
當 `start.py` 或 API 嘗試讀取上述變數時，若發現 `LLAMA_N_GPU_LAYERS` 參數丟失，Pydantic 模組會直接在編譯階段拒絕發動並拋出 `ValidationError`，這防止了系統帶著殘缺設定上線的隱患（Fail-Fast）。

## C.2 跨平台模型硬體加速編譯指南 (Hardware Acceleration Compilation)

`llama-cpp-python` 為了達成最大極限之推論速度，強烈依賴所在主機的「預先編譯」。若以標準的 `pip install llama-cpp-python` 安裝，將只會獲得沒有 SIMD/AVX 指令級加速或是純依賴 CPU 開跑的最低效能版本（Baseline Throughput）。

為了將硬體的 C++/C 語言驅動層面發揮至 100%，系統維護人員必須依循以下官方文件延伸之編譯指南進行系統優化編譯：

### C.2.1 Windows / Linux + NVIDIA CUDA 加速
若伺服器具備 NVIDIA 高效能運算卡（如 RTX 4090 或 A100 Tensor Core GPU），模型能將 Transformer 神經網路層中的所有權重矩陣轉移給 CUDA Core 做極限平行點積運算。
**部署前置作業**：
1. 必須於作業系統層級安裝 `CUDA Toolkit` (建議 12.x+) 與對應的 `cuDNN`。
2. 確保 Visual Studio 2022 C++ Build Tools 或 `gcc/g++` 完整安裝（作為編譯掛載器）。
**命令編譯安裝**：
```bash
# 設定編譯旗標
$env:CMAKE_ARGS="-DGGML_CUDA=on"
# 使用清除緩存模式強制自源碼編譯並要求 C++ 掛載 CUDA 後端
pip install llama-cpp-python --upgrade --force-reinstall --no-cache-dir
```
部署完成後，將 `.env` 中的 `LLAMA_N_GPU_LAYERS` 提昇至 99，啟動伺服器後，將可觀察到 `llama_model_load: offloaded 32/32 layers to GPU` 字樣，推論速度將攀升十倍以上。

### C.2.2 跨平台通用方案：Vulkan API 加速
對於擁有不可預期硬體的終端部署環境（如擁有多種 AMD/Intel 內顯之辦公電腦），CUDA 並不適用。Corphia AI 的底層 C++ Binding 同樣支援跨平台開放式圖形指令集 **Vulkan**。
```bash
$env:CMAKE_ARGS="-DGGML_VULKAN=on"
pip install llama-cpp-python --upgrade --force-reinstall --no-cache-dir
```
Vulkan 能在多數無法建置 CUDA 生態的非伺服器級主機上，壓榨閒置 GPU 的剩餘算力，屬於相容性極高的商業級安全降級方案。

## C.3 Docker 容器化微服務部署 (Containerization Strategies)

為徹底解決環境衝突問題並實作 CI/CD 推播佈署，計畫於後續版本將前端、後端與 PostgreSQL 皆封裝至 Docker Image 中管理。我們提出以下的 `docker-compose.yml` 藍圖草案：

```yaml
version: '3.8'

services:
  db:
      image: pgvector/pgvector:pg15
      environment:
        POSTGRES_USER: postgres
        POSTGRES_PASSWORD: $DB_PASSWORD
        POSTGRES_DB: corphia
      volumes:
        - pgdata:/var/lib/postgresql/data
      expose:
        - "5432"

  backend:
      build: 
        context: ./backend
        dockerfile: Dockerfile
      volumes:
        # 持久化巨大的 GGUF 模型以避開臃腫的 Image size
        - ./ai_model:/app/ai_model 
      environment:
        DATABASE_URL: "postgresql+asyncpg://postgres:${DB_PASSWORD}@db:5432/corphia"
      ports:
        - "8000:8000"
      depends_on:
        - db
      # 針對未來 GPU 預留穿透通道 
      deploy:
        resources:
          reservations:
            devices:
              - driver: nvidia
                count: all
                capabilities: [gpu]

  frontend:
      build:
        context: ./frontend
        dockerfile: Dockerfile
      ports:
        - "5173:80"
      depends_on:
        - backend
        
volumes:
  pgdata:
```

### 容器化優化核心論點
1. **體積解耦**：模型 `.gguf` 單份動輒 5GB~7GB。絕不可隨意使用 `COPY` 指令將模型塞入 Image 壓縮層，否則不僅導致映像檔體積爆增、傳輸緩慢，更導致資源浪費。在上述 Compose 架構中，模型檔是以外部（Host）的 `./ai_model` `Volume mount` 至容器內，完美達成模型分離與服務本體的分治化。
2. **GPU Passthrough 能力**：若地端伺服器搭載了 GPU 集群，Docker 可藉由 `deploy.resources.reservations.devices` 輕易的將硬體設備「透通（Passthrough）」進入虛擬環境，使 `Llama-cpp` 無損發揮算力。這展現了軟體工程中高度抽象化卻不犧牲效能的極致藝術。
