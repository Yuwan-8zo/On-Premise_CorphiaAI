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
     圖有幾個像素就顯示幾個像素。所以圖要畫得夠大：640×360，在 200% 的螢幕上是 320×180 的大小、每個點都是實的。
  2. 圓角：打包工具的啟動畫面只支援「完全透明」或「完全不透明」，半透明的邊緣會變成一圈雜色，
     所以圓角外面用完全透明、邊緣不做柔邊（解析度高，看不出鋸齒）。
"""
from __future__ import annotations

import io
from pathlib import Path

from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
WIDTH, HEIGHT = 640, 360
RADIUS = 52          # 圓角（大圓角，和介面的卡片同一個風格）
CARD = "#1c1c1e"     # 卡片底色（介面的卡片色）
EDGE = "#3a3a3c"     # 一圈細邊，深色桌布上才分得出輪廓
EDGE_WIDTH = 2

svg = (HERE.parent / "frontend" / "public" / "favicon.svg").read_text(encoding="utf-8")
html = f"""<style>
html,body{{margin:0;width:{WIDTH}px;height:{HEIGHT}px;background:{CARD};display:grid;place-items:center;
font-family:"Microsoft JhengHei","Noto Sans TC",system-ui,sans-serif;color:#fff}}
.box{{display:flex;flex-direction:column;align-items:center;gap:22px}}
svg{{width:104px;height:104px;display:block}}
b{{font-size:32px;font-weight:600;letter-spacing:.02em}} span{{font-size:19px;color:#b6b6c0}}
</style><div class="box">{svg}<b>Corphia AI</b><span>正在開啟…</span></div>"""

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": WIDTH, "height": HEIGHT})
    page.set_content(html)
    content = Image.open(io.BytesIO(page.screenshot())).convert("RGBA")
    browser.close()

# 細邊：先畫一個邊色的圓角矩形，再蓋上小一圈的內容
card = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
draw = ImageDraw.Draw(card)
draw.rounded_rectangle((0, 0, WIDTH - 1, HEIGHT - 1), RADIUS, fill=EDGE)
inner = Image.new("L", (WIDTH, HEIGHT), 0)
ImageDraw.Draw(inner).rounded_rectangle(
    (EDGE_WIDTH, EDGE_WIDTH, WIDTH - 1 - EDGE_WIDTH, HEIGHT - 1 - EDGE_WIDTH), RADIUS - EDGE_WIDTH, fill=255)
card.paste(content, (0, 0), inner)
# 透明度只留 0 和 255（見上面第 2 點）
alpha = card.getchannel("A").point(lambda a: 255 if a >= 128 else 0)
card.putalpha(alpha)
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
