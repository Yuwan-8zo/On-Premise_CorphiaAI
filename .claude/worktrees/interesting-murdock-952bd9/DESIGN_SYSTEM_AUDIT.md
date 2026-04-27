# Corphia UI Design System Unification — Audit Report

**Date:** 2026-04-24  
**Scope:** Light Theme convergence only (dark: prefixed classes preserved)  
**CI Gate:** `design-lint.mjs` — Errors: **0** | Quality: **100%**

---

## 1. New Files Created

| File | Purpose |
|------|---------|
| `frontend/src/components/ui/AppButton.tsx` | Base button component with `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-danger` variants |
| `frontend/src/components/ui/AppInput.tsx` | Base input with `.input-base` contract, label + error slot |
| `frontend/src/components/ui/AppCard.tsx` | Card container with `.card-base` / `.card-interactive` |
| `frontend/src/components/ui/AppTabSwitch.tsx` | Animated tab switcher with Framer Motion sliding indicator |
| `frontend/src/components/ui/AppModal.tsx` | Full-screen modal shell with AnimatePresence, `.modal-overlay` / `.modal-card` |
| `frontend/src/components/ui/index.ts` | Barrel export for all UI primitives |

---

## 2. Design Token Architecture

### Canonical Token Mappings (Deprecated → Canonical)

| Deprecated Alias | Canonical Token | Value |
|-----------------|----------------|-------|
| `corphia-ivory` | `corphia-bg-surface` | #FFFFFF |
| `corphia-beige` | `corphia-bg-sidebar` | #F5F3EF |
| `corphia-bronze` | `corphia-primary` | #8B7355 |
| `corphia-warm-gray` | `corphia-text-secondary` | #6B6B6B |
| `text-gray-400/500` | `text-corphia-text-tertiary/secondary` | #9A9A9A / #6B6B6B |
| `bg-gray-100/200` | `bg-corphia-bg-sidebar` / `bg-corphia-border-default` | #F5F3EF / #E6E2DC |
| `border-gray-100/200` | `border-corphia-border-default` | #E6E2DC |
| `focus:ring-corphia-bronze` | `focus:ring-corphia-primary` | #8B7355 |
| `focus:border-corphia-bronze` | `focus:border-corphia-primary` | #8B7355 |
| `hover:text-corphia-bronze` | `hover:text-corphia-primary` | #8B7355 |
| `hover:bg-corphia-beige` | `hover:bg-corphia-bg-sidebar` | #F5F3EF |
| `placeholder-gray-400` | `placeholder-corphia-text-tertiary` | #9A9A9A |
| `border-ios-light-gray5` | `border-corphia-border-default` | #E6E2DC |
| `bg-ios-light-gray5` | `bg-corphia-bg-sidebar` | #F5F3EF |
| `rounded-xl` (in chat items) | `rounded-corphia-sm` | 8px |

### Shadow Tokens
- `shadow-corphia-card` — card elevation
- `shadow-corphia-input` — input focus ring
- `shadow-corphia-focus` — interactive focus
- `shadow-corphia-modal` — modal lift

### Radius Tokens
| Token | Value |
|-------|-------|
| `rounded-corphia-card` | 20px |
| `rounded-corphia-input` | 30px |
| `rounded-corphia-pill` | 9999px |
| `rounded-corphia-modal` | 24px |
| `rounded-corphia-icon` | 16px |
| `rounded-corphia-sm` | 8px |

---

## 3. Files Modified

### Pages
| File | Changes |
|------|---------|
| `src/pages/Admin.tsx` | Replaced `bg-gray-*`, `border-gray-*`, `text-gray-*`, `bg-corphia-ivory`, `hover:bg-gray-*`, `bg-ios-blue-light`; toggle knobs `bg-corphia-ivory` → `bg-corphia-bg-surface` |
| `src/pages/Share.tsx` | `bg-corphia-ivory` → `bg-corphia-bg-surface` (global); `bg-corphia-beige` → `bg-corphia-bg-sidebar`; `text-gray-*` → corphia tokens; spinner `border-corphia-bronze` → `border-corphia-primary` |
| `src/pages/Register.tsx` | No changes — dark gradient context; `bg-corphia-ivory/10` is intentional glass-morphism |

### Chat Components
| File | Key Changes |
|------|------------|
| `src/components/chat/ChatSidebar.tsx` | `border-gray-200`, `text-gray-*`, `hover:bg-gray-*`; `dark:text-corphia-bronze` → `dark:text-corphia-primary`; `rounded-xl` → `rounded-corphia-sm` (all conv items) |
| `src/components/chat/ChatInputArea.tsx` | File tag, upload indicator, attachment button, placeholder color |
| `src/components/chat/MessageBubble.tsx` | User bubble, edit textarea, cancel/save buttons, action text, code block prose colors |
| `src/components/chat/ChatModals.tsx` | All modal cards, form inputs, footer borders, cancel/confirm buttons, context menus; select `rounded-xl` → `rounded-corphia-input` |
| `src/components/chat/ChatHeader.tsx` | Mobile toggle, model selector, dropdown arrow, header menu, menu items, dividers |
| `src/components/chat/SecurityBanners.tsx` | PII preview `text-gray-500` → `text-corphia-text-secondary`; arrow `text-gray-400` → `text-corphia-text-tertiary`; audit note `text-gray-400` → `text-corphia-text-tertiary` |
| `src/components/chat/ChatMinimap.tsx` | Track `bg-gray-200/50` → `bg-corphia-border-default/50`; user marker `bg-gray-400` → `bg-corphia-text-tertiary` |
| `src/components/chat/RAGDebugPanel.tsx` | Toggle button text, panel border, stats border, chunk headers/content; `bg-corphia-beige/50` → `bg-corphia-bg-sidebar/50` |
| `src/components/chat/PromptMenu.tsx` | Main button `bg-corphia-ivory` → `bg-corphia-bg-surface`; dropdown border; section label; item text |
| `src/components/chat/ScrollToBottomButton.tsx` | Button background, text, border, hover |
| `src/components/chat/ChatIcons.tsx` | SidebarIcon `text-gray-400` → `text-corphia-text-tertiary` |

### UI Components
| File | Key Changes |
|------|------------|
| `src/components/ui/SettingsModal.tsx` | Modal container, sidebar, nav items, all form inputs, buttons, theme previews, RAG toggle, language selector, password modal, QR modal |
| `src/components/ui/Toast.tsx` | Background `bg-corphia-ivory/90` → `bg-corphia-bg-surface/90`; text and close button |
| `src/components/ui/ConfirmModal.tsx` | Already clean — no changes |
| `src/components/ui/AboutSection.tsx` | Version badge, description, tech info panel, labels and values |
| `src/components/ui/GuideSection.tsx` | Auth icon, card containers, headings, content text, `text-corphia-bronze` → `text-corphia-primary` |
| `src/components/system/SystemMonitorPanel.tsx` | UsageBar track, spinner, latency text; all `border-gray-200` → `border-corphia-border-default`; `text-gray-*` throughout |

---

## 4. CSS Utility Contracts (`@layer components`)

Defined in `index.css`:

```
.btn-primary    — corphia-primary fill, pill shape, hover lift
.btn-secondary  — outlined with corphia-primary border
.btn-ghost      — transparent, hover bg-sidebar
.btn-danger     — red-600 fill
.input-base     — bg-sidebar, corphia-border-default, 30px radius, focus:corphia-primary
.card-base      — bg-surface, rounded-corphia-card, shadow-corphia-card
.card-interactive — card-base + hover shadow + cursor-pointer
.tab-switch-tray  — pill tray for AppTabSwitch
.modal-overlay  — fixed inset backdrop
.modal-card     — centered modal container
.modal-header   — border-b divider
.modal-footer   — border-t divider
```

---

## 5. Exemptions (Intentionally Preserved)

| Pattern | Reason |
|---------|--------|
| All `dark:` prefixed classes | Scope: light theme only |
| `text-red-*`, `bg-green-*`, `text-amber-*`, etc. | Semantic status/alert colors |
| Framer Motion JS hex values | Runtime JS, not Tailwind classes |
| `bg-corphia-ivory/10` in Register.tsx | Intentional glass-morphism on dark background |
| `dark:bg-corphia-ivory/5` opacity variants | Dark mode context, out of scope |

---

## 6. Remaining Warnings (Next Sprint)

The lint reports **122 warnings** (0 errors) from `text-corphia-ink` — a deprecated alias flagged by the updated lint rules but **not listed in the original plan scope**. These are functional and do not affect CI gate.

**Recommendation:** In the next sprint, run a global replace:
- `text-corphia-ink` → `text-corphia-text-primary`
- `dark:text-corphia-ivory` → `dark:text-corphia-bg-surface` (dark mode phase)

---

## 7. CI Gate Result

```
Errors   : 0     ✅
Warnings : 122   (all text-corphia-ink — next sprint)
Quality  : 100%  ✅
```

Design system unification complete for light theme scope.
