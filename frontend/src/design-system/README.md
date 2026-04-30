# Corphia 設計系統

> **單一資料來源（Single Source of Truth）**
>
> 整個 App 的設計變數（圓角、字級、主題色、品牌色）只在 `tokens.js` 一個檔裡定義。
> 改一個地方，整個 App 跟著變。

## 架構

```
frontend/src/design-system/
├── tokens.js     ← 唯一定義來源（純 JS，所以 tailwind config 跟 TS 都讀得到）
├── index.ts      ← TS 入口；做型別封裝 + re-export
└── README.md     ← 你正在看的這份
```

```
                   ┌─── tailwind.config.js  (從 tokens.js 拿 borderRadius / fontSize)
  tokens.js ───────┤
                   └─── design-system/index.ts  ─── React/TS 程式碼
                                                    (THEME_COLORS / BRAND / RADIUS / FONT_SIZE)
```

任何一個 `.tsx` 要用顏色或字串值：

```tsx
import { THEME_COLORS, BRAND } from '@/design-system'

document.documentElement.style.background = THEME_COLORS.darkBg
const buttonColor = BRAND.bronze
```

任何一個 `.tsx` 要用 Tailwind class：

```tsx
<div className="rounded-cv-lg text-body-lg bg-bg-surface text-text-primary">
```

---

## 圓角 Border Radius

| Token (Tailwind class) | 值 | 用途 |
|---|---|---|
| `rounded-pill` | 9999px | 按鈕、chip、avatar、pill 標籤 |
| `rounded-cv-xs` | 6px | 小元件、tooltip |
| `rounded-cv-sm` | 10px | input、密集 chip |
| `rounded-cv-md` | 14px | 中型卡片、按鈕群組 |
| `rounded-cv-lg` | 20px | 主卡片（**全站最常用**） |
| `rounded-cv-xl` | 24px | modal、drawer 頂層容器 |
| `rounded-cv-2xl` | 32px | Hero / 大型視覺區塊 |

> 為什麼用 `cv-` 前綴：避免跟 Tailwind 內建 `rounded-r-` (右側圓角) 衝突。

```tsx
// ❌ 舊：硬編碼，每處可能不一樣
<div className="rounded-[20px]">

// ✅ 新：用 token
<div className="rounded-cv-lg">
```

---

## 字級 Font Size

每個 token 都已綁定合理的 line-height，不用再寫 `leading-*`。

| Token (Tailwind class) | 大小 / 行高 | 用途 |
|---|---|---|
| `text-caption` | 12 / 16 | 微標籤、tooltip、metadata |
| `text-body-sm` | 13 / 18 | 次要說明文字 |
| `text-body` | 14 / 20 | 主要內文 |
| `text-body-lg` | 16 / 24 | 強調內文、input |
| `text-title-sm` | 18 / 24 | 區塊標題 |
| `text-title` | 22 / 28 | 頁面標題、卡片大標 |
| `text-display` | 36 / 44 | Hero 標題 |

```tsx
// ❌ 舊：八種大小亂湊
<p className="text-[11px]">  <p className="text-[13px]">
<p className="text-[15px]">  <p className="text-[15.5px]">

// ✅ 新：5 個 token 蓋掉所有需求
<p className="text-caption">     <p className="text-body-sm">
<p className="text-body">        <p className="text-body-lg">
<p className="text-title">
```

---

## 顏色 Colors

定義方式不同（CSS variable + Tailwind semantic）：

### 在 Tailwind className 用 — semantic 名稱
```tsx
<div className="bg-bg-base text-text-primary border-border-subtle">
<button className="bg-accent text-white hover:bg-accent-hover">
```

| 用途 | className |
|---|---|
| 主背景 | `bg-bg-base`, `bg-bg-main`, `bg-bg-surface`, `bg-bg-elevated` |
| 文字 | `text-text-primary`, `text-text-secondary`, `text-text-muted`, `text-text-disabled` |
| 邊框 | `border-border-subtle`, `border-border-strong` |
| 強調 | `text-accent`, `bg-accent`, `border-accent`，可加透明度 `bg-accent/10` |

### 在 JS 字串用（meta theme-color、html.style.background…）
```tsx
import { THEME_COLORS, BRAND } from '@/design-system'

THEME_COLORS.darkBg        // '#202022'
THEME_COLORS.darkSurface   // '#28282A'
THEME_COLORS.lightBg       // '#F6F4F0'
THEME_COLORS.lightSurface  // '#F2EFEA'
THEME_COLORS.darkBgGradient

BRAND.bronze       // '#896E53'
BRAND.bronzeHover  // '#6F5943'
BRAND.bronzeActive // '#574537'
```

---

## 紀律守則

1. **`.tsx` 不寫 hex 色碼**（除非是 disabled 灰、red-500 之類的 utility 色）。需要顏色字串值就 `import { THEME_COLORS, BRAND } from '@/design-system'`。
2. **`.tsx` 不寫 `rounded-[20px]` / `text-[15px]` 之類的硬編碼數值**。用 token。
3. **修一個值要影響全 App**：去 `tokens.js` 改，HMR 會自動把所有地方更新。
4. **新增 token 三步驟**：
   - 在 `tokens.js` 加新 entry
   - 視需要在 `index.ts` 補型別
   - 更新本 README 對照表
5. **Modal 用 `rounded-cv-xl`，主卡片用 `rounded-cv-lg`，按鈕／pill 用 `rounded-pill`**。這三個就涵蓋 80% 的元件。
6. **內文一律 `text-body` 或 `text-body-lg`**。標題 `text-title-sm` / `text-title`。

---

## 後續清理 TODO

- [ ] `frontend/src/components/chat/*` 底下還有許多 `text-[15px]` 之類的硬編碼
- [ ] 統一陰影使用：目前各頁混用 `shadow-sm` / `shadow-md` / `dark:shadow-none`，需訂規則
- [ ] 整理 spacing：考慮加 `p-x-section / p-x-card` 之類的語意 spacing

---

## 對照（哪些檔已經換成 token）

完成第一波 `rounded-[20px]` → `rounded-cv-lg` 替換的檔案：

- `frontend/src/pages/{Login,Register,Chat,Documents,Admin,Share}.tsx`
- `frontend/src/components/chat/{ChatHeader,ChatModals,ChatSidebar,MessageBubble,SourceCitations}.tsx`
- `frontend/src/components/ui/{SettingsModal,GuideSection,AboutSection,ConfirmModal}.tsx`

字級 token (`text-caption / text-body / ...`) 與 `text-[Npx]` 替換尚未進行 — 留待下一波清理。
