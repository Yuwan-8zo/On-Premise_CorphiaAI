# Lottie 動畫資產

這個資料夾放從 [Iconly Pro Animations](https://web.iconly.pro/animations) 下載的
動畫 JSON 檔。每個檔案對應 UI 上一個關鍵互動點。

## 檔案命名規則

`<功能用途>.json`，全小寫、kebab-case。對應的 React import：

```tsx
import successAnim from '@/assets/lottie/check-success.json'
```

## 必要清單（Hybrid Strategy 8 個整合點）

| 檔名 | Iconly 建議搜尋詞 | 用途 | 觸發方式 |
|---|---|---|---|
| `splash-loader.json` | "loader" / "spinner" / "loading dots" | Splash 畫面正在啟動指示器 | loop |
| `ai-thinking.json` | "typing" / "three dots" / "ellipsis" | Chat AI 正在輸入回覆中 | loop |
| `toast-success.json` | "check" / "success" / "tick" | Toast 成功通知 | play-once |
| `toast-error.json` | "x" / "close" / "error" / "warning" | Toast 失敗通知 | play-once |
| `toast-info.json` | "info" / "exclamation" | Toast 一般資訊通知 | play-once |
| `confirm-warning.json` | "alert" / "warning triangle" | ConfirmModal 警告 icon | play-once |
| `login-loading.json` | "loader circle" / "spinner small" | 登入按鈕點下去 loading | loop |
| `notfound-mascot.json` | "404" / "ghost" / "lost" | NotFound 頁面大型 mascot | visible |

> **總大小目標**：8 個 JSON 加總 < 200KB（避免 bundle 暴漲）。
> Iconly Pro 動畫平均 5~15KB/個，應該綽綽有餘。

## 下載步驟

1. 登入 [web.iconly.pro/animations](https://web.iconly.pro/animations)（你的付費帳號）
2. 用上面表格的搜尋詞找對應 icon
3. 點 icon → 右側面板選擇：
   - 格式：**Lottie JSON**（不是 GIF 也不是 SVG）
   - 顏色：先選跟你 brand 接近的（古銅 `#B49466` 或主灰 `#1F1F22`）
4. 下載後**改檔名**符合上表，丟到這個資料夾
5. 告訴我哪個下載完了，我會接到對應的 UI 上

## 用法（給後續開發參考）

```tsx
import LottieIcon from '@/components/icons/LottieIcon'
import splashLoader from '@/assets/lottie/splash-loader.json'

<LottieIcon
    data={splashLoader}
    trigger="loop"
    size={64}
    aria-label="正在啟動"
/>
```

`trigger` 有四種：
- `loop` — 持續動（splash、AI thinking）
- `hover` — hover 才動（sidebar nav）
- `play-once` — mount 一次播完停（toast、confirm）
- `visible` — 滾到可見才播一次（NotFound mascot）

## 為什麼不全部換掉 lucide-react？

Lottie 動畫每個 5~50KB，runtime 還要播放迴圈。如果每個按鈕、每個列表 row、每個 status pill
都用 Lottie，bundle 會暴漲到 1MB+，CPU 也會持續燒（多個 render loop 同時跑）。

**業界做法**（Apple / Google / Vercel）：90% 用靜態 SVG，只在「**關鍵時刻**」用動畫——
loading、success、error、AI thinking、splash、CTA 確認回饋。

所以我們的策略是：
- **保留 lucide-react** 給靜態 icon（按鈕、列表、status badge 等）
- **只在 8 個關鍵點用 Lottie**（上面那張表）

這樣既有質感升級，又不犧牲效能。
