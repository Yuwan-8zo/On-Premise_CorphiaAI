"""
從標誌（frontend/public/favicon.svg）產生所有點陣圖：改了標誌或文字時重跑 python make_images.py

  desktop/splash.png                   桌面版的啟動畫面
  desktop/corphia.ico                  桌面版 exe 的圖示
  frontend/public/icon-192.png 等      手機「加入主畫面」的圖示

標誌只有一個來源：favicon.svg（形狀和介面裡的 CorphiaLogoPaths 一樣）。這裡不另外畫一份。

啟動畫面：

需要 playwright 和 Pillow（開發用的電腦才需要，打包後的程式不需要）。

兩個重點：
  1. 解析度：程式宣告自己會處理高解析度螢幕（app.manifest），Windows 就不會把這張圖硬拉大弄糊，
     圖有幾個像素就顯示幾個像素。所以圖要畫得夠大（大小由下面的 SCALE 決定）：960×540，在 200% 的螢幕上是 480×270 的大小、每個點都是實的。
  2. 圓角：打包工具的啟動畫面只支援「完全透明」或「完全不透明」，半透明的邊緣會變成一圈雜色，
     所以圓角外面用完全透明、邊緣不做柔邊（解析度高，看不出鋸齒）。
"""
from __future__ import annotations

import io
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
# 整張圖的大小只改這個倍率，裡面的圖示、文字、圓角都跟著等比例放大
SCALE = 1.5
WIDTH, HEIGHT = round(640 * SCALE), round(360 * SCALE)
RADIUS = round(52 * SCALE)   # 圓角（大圓角，和介面的卡片同一個風格）
# 玻璃的外觀（《Liquid Glass 元件規範》的材質：白 15% 的底色、上下最亮並沿圓弧漸弱的光邊、兩側只有一條細線）。
# 這是一張靜態圖，做不到真的半透明和背景模糊，所以底色用「白 15% 疊在視窗底色上」算出來的實色。
BACKDROP = (24, 24, 26)          # 視窗底色 #18181a
GLASS_TINT = 0.05                # 規範是白 15%，但整張實色的卡片用 15% 會太淺（使用者要求調深）；5% 只比視窗底色亮一點
CARD = "#%02x%02x%02x" % tuple(round(c + (255 - c) * GLASS_TINT) for c in BACKDROP)
EDGE_WIDTH = round(1.5 * SCALE)  # 光邊的粗細
EDGE_BRIGHT, EDGE_DIM = 0.62, 0.10   # 光邊：上下緣最亮、兩側最暗（白的不透明度）

svg = (HERE.parent / "frontend" / "public" / "favicon.svg").read_text(encoding="utf-8")
# 圖示本身有深色圓底：放在玻璃卡片上時拿掉，只留 C 和星芒
logo = "\n".join(line for line in svg.splitlines() if "<rect" not in line)
assert logo != svg
html = f"""<style>
html,body{{margin:0;width:{WIDTH}px;height:{HEIGHT}px;background:transparent}}
.card{{position:relative;width:{WIDTH}px;height:{HEIGHT}px;box-sizing:border-box;border-radius:{RADIUS}px;background:{CARD};
display:grid;place-items:center;font-family:"Microsoft JhengHei","Noto Sans TC",system-ui,sans-serif;color:#fff}}
/* 光邊：一圈漸層只留在邊框的位置（中間挖掉）。上下最亮，往兩側沿著圓弧暗下去 */
.card::before{{content:"";position:absolute;inset:0;border-radius:inherit;padding:{EDGE_WIDTH}px;
background:linear-gradient(180deg, rgba(255,255,255,{EDGE_BRIGHT}) 0%, rgba(255,255,255,{EDGE_DIM}) 26%,
rgba(255,255,255,{EDGE_DIM}) 74%, rgba(255,255,255,{EDGE_BRIGHT * 0.7}) 100%);
-webkit-mask:linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude}}
.box{{display:flex;flex-direction:column;align-items:center;gap:{18 * SCALE}px}}
svg{{width:{128 * SCALE}px;height:{128 * SCALE}px;display:block;margin-bottom:-{14 * SCALE}px}}
b{{font-size:{32 * SCALE}px;font-weight:600;letter-spacing:.02em}} span{{font-size:{19 * SCALE}px;color:rgba(255,255,255,.62)}}
</style><div class="card"><div class="box">{logo}<b>Corphia AI</b><span>正在開啟…</span></div></div>"""

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": WIDTH, "height": HEIGHT})
    page.set_content(html)
    card = Image.open(io.BytesIO(page.screenshot(omit_background=True))).convert("RGBA")
    browser.close()

# 透明度只留 0 和 255（見上面第 2 點）：圓角外面完全透明，裡面完全不透明。
# 邊緣那一圈半透明的點先疊到視窗底色上再變成不透明，才不會出現雜色
solid = Image.new("RGBA", card.size, BACKDROP + (255,))
solid.alpha_composite(card)
solid.putalpha(card.getchannel("A").point(lambda a: 255 if a >= 128 else 0))
card = solid
card.save(HERE / "splash.png")
print("已產生", HERE / "splash.png", card.size)


# ── 圖示 ─────────────────────────────────────────────────────────────────────
PUBLIC = HERE.parent / "frontend" / "public"
ICO_SIZES = [16, 20, 24, 32, 40, 48, 64, 128, 256]


def render_logo(page, size: int, source: str, transparent: bool) -> Image.Image:
    page.set_viewport_size({"width": size, "height": size})
    page.set_content(f'<style>html,body{{margin:0;background:transparent}}svg{{display:block;width:{size}px;height:{size}px}}</style>{source}')
    return Image.open(io.BytesIO(page.screenshot(omit_background=transparent))).convert("RGBA")


square = svg.replace('rx="12"', 'rx="0"')  # 滿版方形：系統會自己裁成圓或圓角方（手機的自適應圖示、iOS 主畫面）
assert square != svg
with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    for size in (192, 512):
        render_logo(page, size, svg, transparent=True).save(PUBLIC / f"icon-{size}.png")
    render_logo(page, 512, square, transparent=False).save(PUBLIC / "icon-maskable-512.png")
    render_logo(page, 180, square, transparent=False).save(PUBLIC / "apple-touch-icon.png")
    # exe 圖示：每個尺寸各自從向量圖畫（不是把大圖縮小），小尺寸才清楚
    frames = [render_logo(page, size, svg, transparent=True) for size in ICO_SIZES]
    browser.close()
frames[-1].save(HERE / "corphia.ico", format="ICO", append_images=frames[:-1], sizes=[(s, s) for s in ICO_SIZES])
print("已產生圖示：", ", ".join(["icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png", "corphia.ico"]))
