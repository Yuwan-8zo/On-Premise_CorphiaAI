# Its Hover（地端整合）

圖示原始碼已 vendored 到此目錄，**執行時不依賴** `itshover.com` 或 shadcn CLI。

## 更新圖示（需暫時有網路）

```powershell
cd frontend
.\scripts\download-itshover-icons.ps1
node scripts/extract-itshover-icons.mjs
```

可在 `download-itshover-icons.ps1` 的 `$Icons` 陣列加入其他圖示名稱（見 `scripts/itshover-index.ts` 或 [itshover.com/icons](https://www.itshover.com/icons)）。

## 依賴

- `motion`（`motion/react`）— 已列入 `package.json`，地端 `npm ci` 即可。

## 使用

```tsx
import { GlobeIcon, ItshoverIcon } from '@/components/icons/itshover'

// 狀態顯示（側欄、KPI）
<ItshoverIcon icon={GlobeIcon} size={12} />

// 按鈕內（允許 hover 動畫）
<ItshoverIcon icon={CopyIcon} size={12} interactive />
```

圖示名稱可查 [itshover GitHub icons 目錄](https://github.com/itshover/itshover/tree/master/icons) 或執行 download 腳本時的 registry 檔名。

授權：MIT（與上游 itshover 相同）。
