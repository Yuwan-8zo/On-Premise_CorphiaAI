# Corphia 前端設計規範

> 依據：使用者的設計研究範本「北海道雪見六日」（液態玻璃、同心大圓角、Apple 膠囊按鈕）。
> 原則：**照範本做，不自行揣測或另加效果**；能用通用類別／元件就不要在元件裡另寫一長串樣式。

## 1. 檔案分工

| 檔案 | 放什麼 |
|---|---|
| `design-system/tokens.js` | 唯一的設計數值來源：品牌色（6 種固定強調色，預設藍 `#0A68E4`）、圓角、字級 |
| `styles/colors.css` | 淺色／深色的底色、文字色、強調色變數 |
| `styles/snow.css` | 全站共用的元件類別（本文件第 3 節）。依主題拆在 `styles/snow/*.css`（foundation 基礎、controls 按鈕與對話框、glass 玻璃、lens／lens-controls 放大鏡元件、settings、chat、dock、admin、system-colors、layout、duo…），`snow.css` 只負責照順序載入，**順序不要調換** |
| `styles/motion.css` | 動畫：換頁 `.page-in`（搭配 `lib/usePageDirection`，方向照順序）等 |
| `lib/motionPresets.ts` | 動畫參數：規範的兩條曲線 `EASE_DECEL`／`EASE_SPRING`、對話框進出 `dialogBackdrop`／`dialogSheet` |
| `components/ui/DialogShell.tsx` | 所有對話框共用的外殼：遮罩、置中、進出動畫、Esc、放到最上層。新對話框一律用它，不要自己寫 |
| `components/snow/icons.tsx` | 全站唯一的圖示庫：Apple SF Symbols「Regular」風格（自行繪製）。24 格、線寬 1.8（圖示鈕內 1.6）、圓頭圓角、矩形大圓角、點用實心小圓。新增圖示用檔內的 `rr()`（圓角矩形）、`circ()`（圓）輔助函式 |
| `components/ui/*` | 共用元件（第 4 節） |

## 2. 必守規則

- **顏色**：只用變數（`text-text-primary`、`text-accent`、`bg-[var(--chip)]`…），不寫死色碼。強調色只有固定 6 種，沒有自由配色。
- **字型**：思源黑體（已打包，離線可用）。
- **尺寸用像素**：根字級小於 16px，`w-9`、`top-4` 這類 rem 尺寸會比預期小；對齊、同心一律寫 `[px]`。
- **同心圓**：內層圓角 ＝ 外層圓角 − 內距（最小 10）。膠囊放進圓角容器時，內距要讓兩者同心。
- **懸停不變化**：懸停時不改底色、不改文字色、不位移、不改透明度；只有按下時縮 0.97～0.98。
- **玻璃**：卡片／對話框／彈出選單＝半透明＋模糊＋光邊；控制元件（圓鈕、按鈕群、次要按鈕、膠囊、輸入列、分段切換）＝範本 Dock 按鈕同款「玻璃色底＋模糊 12＋光邊」；提示泡泡＝玻璃色底＋光邊、不模糊。**不加飽和度**（範本規定）。光邊亮線顏色照範本由背景色推算（深色：`oklch(from 背景 0.6 c×1.4 h)`）。唯一例外：淺色模式下卡片裡的輸入列／分段切換用淡墨色（白玻璃放白卡片會看不見）。
- **不做大範圍懸停重繪**（例如 `*:hover`）：會讓玻璃卡片在顯示卡繪圖時留下殘影。
- **深色模式**：品牌色當文字會自動提亮；元件 `style` 裡要用品牌色文字時用 `var(--accent-ink)`、錯誤色用 `var(--danger-ink)`。
- **系統色當文字**：用 `text-[var(--ink-red)]`…（淺色模式自動換成白底看得清楚的加深版）；`--sys-*` 只用在圖示底色、進度條等非文字。
- **文字**：介面文字走 i18n（`zh-TW`／`en-US`／`ja-JP` 三份都要補）。

## 3. 通用類別（`styles/snow.css`）

| 類別 | 用途 |
|---|---|
| `.paper` | 卡片、側欄、彈出選單、後台面板（玻璃＋光邊，圓角 25） |
| `.bg-accent-fill` | 強調色實底配白字時用（強調色加深 18%，白字對比 ≥ 4.5）；`.btn-primary` 已內建 |
| `.tag` + `.tag-accent` / `.tag-green` / `.tag-orange` / `.tag-red` | 標籤膠囊（高 24、圓角 12、12/16、語意色 30% 底＋主要文字色、不換行、無光邊） |
| `.paper-solid` | 加在 `.paper` 上：不透明浮層（97% 實底、不模糊），用在會蓋住內容的下拉選單 |
| `.paper-lg` | 加在 `.paper` 上：只在桌機顯示卡片外框（手機版裡面已經是膠囊時用，避免雙層框） |
| `.dialog-sheet` + `.dialog-title` / `.dialog-body` / `.dialog-actions` | 確認對話框（Apple Alert 版型） |
| `.btn` + `.btn-primary` / `.btn-secondary` / `.btn-danger` / `.btn-danger-solid`，尺寸 `.btn-lg` / `.btn-sm` | 文字按鈕（膠囊） |
| `.btn-icon`（50 圓鈕）、`.btn-icon-plain`（無玻璃）、`.is-current`（凹陷底盤） | 圖示按鈕；小號用 `!w-9 !h-9`（後台「回上一頁」的大小） |
| `.btn-group`、`.btn-group-36` | 多顆圖示鈕收在同一條玻璃膠囊 |
| `.glass-chip` | 玻璃小膠囊（狀態、標籤、來源列） |
| `.glass-field` | 液態玻璃輸入列（聊天輸入、登入欄位） |
| `.snow-well` / `.snow-field` | 卡片裡的淡色區塊／實色輸入框 |
| `.snow-row` + `.snow-row-icon` | 列表列（圖示方塊＋標題＋說明＋箭頭） |
| `.snow-tip` | 提示泡泡（由 `<Tooltip>` 使用，不要直接寫） |
| **`.menu-item`** + `.is-danger` / `.is-success` / `.is-selected`（品牌色實底）/ `.is-current`（強調色字，下拉選單的已選值） | **彈出選單的一列**（膠囊、圖示 18） |
| **`.menu-sep`** | **選單分隔線** |
| **`.nav-item`** + `.is-current` | **側欄導覽的一列**（膠囊；第一個子元素是圖示，選取時變品牌色） |

### 新增一個彈出選單

```tsx
<motion.div className="absolute right-0 top-full mt-2 w-[200px] paper overflow-hidden z-50 p-1.5">
    <LensMenu className="flex flex-col gap-0.5">
        <button className="menu-item" onClick={...}><Share /><span>分享</span></button>
        <div className="menu-sep" />
        <button className="menu-item is-danger" onClick={...}><Trash2 /><span>刪除</span></button>
    </LensMenu>
</motion.div>
```

### 新增一個側欄導覽

```tsx
<LensMenu className="space-y-1.5">
    {items.map((it) => (
        <button key={it.id} className={`nav-item ${active === it.id ? 'is-current' : ''}`} onClick={...}>
            <div>{it.icon}</div>
            <span>{it.label}</span>
        </button>
    ))}
</LensMenu>
```

## 4. 共用元件（`components/ui`）

| 元件 | 用途 |
|---|---|
| `GlassSegmented` | 分段切換（範本 Dock 放大鏡：長按放大、拖動、放開吸附）。登入／註冊、一般／專案、後台手機分頁 |
| `LensMenu` | **所有選單都要包**：長按 320ms 出現放大鏡、拖到想要的項目放開即選取；一般點擊照常。目前選取的項目要標 `.is-current`／`.is-selected`（獨立的底盤元素標 `data-lens-plate`），放大鏡出現時才會照範本隱藏底盤 |
| `Tooltip` | 提示泡泡：**只給純圖示按鈕**（複製、刪除…）或資料型提示（圖表數值、完整路徑）。已有文字的元件、返回／側欄開合等導覽鈕不加。選單打開時傳空字串可暫時隱藏 |
| `StyledSelect` | **所有下拉選擇都用它，不要用原生 `<select>`**：膠囊觸發鈕、不透明選單、長按放大鏡、自動往上／往下開 |
| `ConfirmModal` | 刪除等不可復原動作的確認框 |

## 5. 不要做的事

- 不要在元件裡重寫一長串按鈕／選單樣式 → 用第 3 節的類別。
- 不要用 lucide 或內嵌 SVG 圖示 → 用 `components/snow/icons.tsx`。
- 不要用 `rounded-cv-*`、`bg-bg-surface`、`border-border-subtle` 等舊寫法 → 用固定像素圓角、`var(--chip)`、`var(--paper-line)`。
- 不要加 `hover:` 樣式、`saturate`、自訂配色。
- 不要移除背景的波浪 SVG。

## 6. 2026-11-11 起新增的共用規範（照《Liquid Glass 元件規範》與 Apple 設計）

### 材質
- 全系統 Liquid Glass：`.paper`、`.dialog-sheet`＝玻璃＋模糊 24＋三層光邊；下拉選單等蓋在內容上的浮層用 `.paper-solid`（不透明）。
- 訊息氣泡、表格、提示泡泡＝`.glass-chip`／`.snow-tip`（玻璃＋模糊 12＋光邊）。
- 深色頁面底色＝主題色 6% 的深色調（`App.tsx` 計算），換主題色會跟著變。

### 有放大鏡的元件（共用 `components/ui/lensKit.ts`）
| 元件 | 檔案 | 用在 |
|---|---|---|
| 分段切換器（橫／直，`vertical`、`gap`） | `GlassSegmented.tsx` | 登入／註冊、一般／專案、收合側欄（右下選單尺寸 50／46／列距 53） |
| 直向分段（側欄導覽） | `GlassNav.tsx` | 設定、後台左側選單 |
| 切換開關 | `GlassSwitch.tsx` | 全站開關 |
| 玻璃選單鈕（右下選單邏輯） | `GlassDock.tsx` | 聊天頁右上「⋯」 |
- 鏡內只能出現頁面上已有的顏色；鏡內內容放大 1.12（`LENS_MAG`）。
- 時間表、肩的遮罩、挖洞都在 `lensKit.ts`，不要在元件裡另寫。

### 清單與表單（Apple 分組清單）
- 設定類頁面：`.set-page`／`.set-title`／`.set-section`／`.set-header`／`.set-group`／`.set-row`（`.has-icon`、`.set-row-btn`）／`.set-value`／`.set-chevron`／`.set-footer`／`.set-danger`（系統紅、置中）。
- 聊天側欄：`.side-header`／`.side-item`（`.is-current`）／`.side-children`（`.side-collapse` 展開動畫）。
- 對話裡的表格：`.md-table`（`<br>` 會變成換行、「- 」條列凸排）。
- 編輯訊息：`.msg-edit`（iMessage 編輯）。
- 對話框右上關閉鈕：`.dialog-close`（與對話框圓角同心）。

### 動畫（自動套用；`styles/base.css` 最後一段＋`design-system/tokens.js` 的 `motion`）
- CSS 變數：`--ease-out`（減速）、`--ease-sp`（彈性）；`--dur-press` 0.17s、`--dur-fade` 0.2s、`--dur-menu` 0.3s、`--dur-page` 0.42s。寫新動畫時只用這些變數。
- 全站預設：沒指定曲線的 `transition`／`animation` 自動用 `--ease-out`；舊變數 `--ease-apple`、`--ease-io` 也已指向規範曲線。
- 只用兩條曲線：減速 `cubic-bezier(.23,1,.32,1)`、彈性 `cubic-bezier(.32,.72,0,1)`；Tailwind 的 `ease-in`、`ease-in-out` 也已對到減速。
- 按壓 0.17 秒、舊頁淡出 0.2 秒、選單 0.3 秒、新頁 0.42 秒（位移 14）、進場從 0.95 開始。
- 系統「減少動態效果」時，`gsapMotion` 自動拿掉位移與縮放，只留淡入淡出。

### 文字與圖示
- 不用 emoji；不用全大寫加字距的小標籤（眉標），小標籤一律 12～13px、次要文字色。
- 圖表分類色用 `appleCategoryColors()`（Apple 系統色），不要用同一個顏色的深淺。
- 卡片標題下、頁面頂部列下、左右欄之間不畫分隔線；只有清單列之間保留 0.5px 細線。

## 數值不寫死（設計設定 tokens）

全站的間距、尺寸、圓角、字級、行高、模糊只在 `src/styles/tokens.css` 定義一次，元件與樣式檔一律引用：

- 兩個總開關：`--ui-unit`（版面單位：間距、尺寸、圓角、模糊）、`--type-unit`（文字單位：字級、行高），預設都是 1px；
  改它們整個介面一起縮放，也可以在媒體查詢裡依螢幕調整（自適應）
- 各級設定由單位乘出來，名稱裡的數字＝單位 1px 時的大小：`--sp-14`（間距）、`--sz-38`（尺寸）、`--r-21`（圓角）、
  `--fs-15`（字級）、`--lh-20`（行高）、`--blur-24`（模糊）；小數點寫成 d：`--fs-15d5`＝15.5
- 語意設定（`--space` 版面間距、`--r-card`、`--pad-card`、`--btn-h`…）在 `snow.css` 的 `:root`，同樣由單位乘出來
- Tailwind 寫法：`p-[var(--sp-14)]`、`gap-[var(--space)]`、`w-[var(--sz-38)]`、`rounded-[var(--r-21)]`、
  `leading-[var(--lh-20)]`；字級要加型別提示 `text-[length:var(--fs-15)]`（不加會被當成顏色）
- **不要**把新設定加進 `tailwind.config.js` 的 theme：正在跑的開發伺服器不會重讀，新 class 產生不出來
- 能推的用算的：例如同心圓角 `calc(var(--r-card) - var(--pad-card))`、四等分列高 `calc((100% - var(--space)) / 2)`
- 仍刻意保留像素的：陰影位移、0.5px 細線、媒體查詢斷點（媒體查詢不能用設定）
