import os
import sys
import subprocess
import json

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.join(BASE_DIR, ".env")
STATE_PATH = os.path.join(BASE_DIR, ".engine_state.json")

def get_gpus():
    """偵測系統上所有的 GPU 顯示卡"""
    gpus = []
    if sys.platform == "win32":
        try:
            cmd = 'powershell "Get-CimInstance win32_VideoController | Select-Object -Property Name | ConvertTo-Json"'
            result = subprocess.run(cmd, capture_output=True, text=True, shell=True)
            if result.returncode == 0 and result.stdout.strip():
                gpu_data = json.loads(result.stdout)
                if isinstance(gpu_data, dict):
                    gpu_data = [gpu_data]
                for g in gpu_data:
                    name = g.get("Name", "")
                    if name:
                        gpus.append(name.strip())
        except Exception:
            pass
    elif sys.platform == "darwin":
        # 簡單判定 Mac (Apple Silicon 通常有整合 GPU)
        gpus.append("Apple M-Series/Intel Mac")
    else:
        # Linux 簡單支援 (暫時使用 lspci)
        try:
            cmd = 'lspci | grep -i vga'
            result = subprocess.run(cmd, capture_output=True, text=True, shell=True)
            if result.returncode == 0:
                lines = result.stdout.split('\n')
                for line in lines:
                    if line.strip():
                        gpus.append(line.strip())
        except Exception:
            pass

    return gpus

def determine_backend(gpus):
    """根據 GPU 型號判定最佳 Backend"""
    if sys.platform == "darwin":
        return "Metal" # Mac OS 預設 Metal
    
    if not gpus:
        return "CPU"
    
    for name in gpus:
        name_lower = name.lower()
        if "nvidia" in name_lower:
            return "CUDA"
        elif "intel" in name_lower or "arc" in name_lower:
            return "Vulkan"
        elif "amd" in name_lower or "radeon" in name_lower:
            return "Vulkan"
            
    return "CPU"

def set_env_variable(key, value):
    """覆寫或新增環境變數到 .env"""
    env_vars = {}
    if os.path.exists(ENV_PATH):
        with open(ENV_PATH, "r", encoding="utf-8") as f:
            for line in f:
                if "=" in line and not line.strip().startswith("#"):
                    k, v = line.strip().split("=", 1)
                    env_vars[k.strip()] = v.strip()
                    
    env_vars[key] = str(value)
    
    with open(ENV_PATH, "w", encoding="utf-8") as f:
        for k, v in env_vars.items():
            f.write(f"{k}={v}\n")

def check_and_optimize(force=False):
    gpus = get_gpus()
    backend = determine_backend(gpus)
    
    current_state = {
        "gpus": sorted(gpus),
        "backend": backend
    }
    
    # 檢查是否已最佳化
    if not force and os.path.exists(STATE_PATH):
        try:
            with open(STATE_PATH, "r", encoding="utf-8") as f:
                saved_state = json.load(f)
                # 若 GPU 組合與 Backend 目標一致，且曾成功或已記錄失敗，則不重複嘗試
                if saved_state.get("gpus") == current_state["gpus"] and saved_state.get("backend") == current_state["backend"]:
                    # 若先前已標記為失敗，則維持靜默跳過，不干擾使用者畫面
                    return False
        except Exception:
            pass
            
    print(f"\n[AI 引擎管家] 偵測到新的硬體環境！")
    print(f" -> 系統 GPUs: {', '.join(gpus) if gpus else 'None'}")
    print(f" -> 為您規劃最佳核心: {backend} 加速模式\n")
    
    # 執行模組重裝
    try:
        print("[1/2] 正在準備最新版本的 AI 引擎 (可能需要數分鐘，請耐心等候)...")
        # 確保在嘗試卸載之前不發生報錯停止
        subprocess.run([sys.executable, "-m", "pip", "uninstall", "-y", "llama-cpp-python"], 
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        
        install_cmd = [sys.executable, "-m", "pip", "install", "llama-cpp-python"]
        
        env = os.environ.copy()
        
        if backend == "CUDA":
            install_cmd.extend(["--extra-index-url", "https://abetlen.github.io/llama-cpp-python/whl/cu121"])
            set_env_variable("LLAMA_N_GPU_LAYERS", "-1")
            env["CMAKE_ARGS"] = "-DGGML_CUDA=on"
        elif backend == "Vulkan":
            install_cmd.extend(["--extra-index-url", "https://abetlen.github.io/llama-cpp-python/whl/vulkan"])
            set_env_variable("LLAMA_N_GPU_LAYERS", "-1")
            env["CMAKE_ARGS"] = "-DGGML_VULKAN=on"
        elif backend == "Metal":
            set_env_variable("LLAMA_N_GPU_LAYERS", "-1")
            env["CMAKE_ARGS"] = "-DGGML_METAL=on"
        else:
            # CPU Fallback
            install_cmd.extend(["--extra-index-url", "https://abetlen.github.io/llama-cpp-python/whl/cpu"])
            set_env_variable("LLAMA_N_GPU_LAYERS", "0")
            
        print(f"執行安裝指令: {' '.join(install_cmd)}")
        result = subprocess.run(install_cmd, env=env)
        
        if result.returncode == 0:
            print("[2/2] \033[92m核心優化成功！\033[0m")
            # 儲存狀態快取
            with open(STATE_PATH, "w", encoding="utf-8") as f:
                json.dump(current_state, f)
            return True
        else:
            print("\033[91m引擎自動切換失敗，保留預設狀態。\033[0m")
            # 記錄失敗狀態，避免下次無限重試
            current_state["failed"] = True
            with open(STATE_PATH, "w", encoding="utf-8") as f:
                json.dump(current_state, f)
            return False
            
    except Exception as e:
        print(f"\033[91m優化過程發生錯誤: {e}\033[0m")
        return False

if __name__ == "__main__":
    force_run = "--force" in sys.argv
    check_and_optimize(force=force_run)
