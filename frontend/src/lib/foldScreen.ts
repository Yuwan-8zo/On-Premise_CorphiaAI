/**
 * 偵測「打開的折疊手機橫拿」（例如 iPhone Duo），在 <html> 加上 fold-wide 標記，樣式由 snow.css 依這個標記套用。
 *
 * 判斷依據：觸控螢幕、橫拿，而且畫面寬度「比裝置回報的螢幕長邊還寬」。
 *   - 折疊手機打開後，裝置仍回報手機的螢幕尺寸（Duo：414 × 896），畫面卻有 951 寬 → 符合
 *   - 一般手機、iPad：畫面寬最多等於螢幕長邊 → 不符合；電腦不是觸控 → 不符合
 * 不用畫面高度：Safari 有網址列時和加入主畫面（全螢幕）時高度不同，兩種都要符合。
 * CSS 沒辦法比較「畫面寬」和「螢幕長邊」，所以用程式算。
 */
const CLASS = 'fold-wide'

function update() {
    const touch = window.matchMedia('(pointer: coarse)').matches
    const landscape = window.matchMedia('(orientation: landscape)').matches
    const screenLong = Math.max(window.screen.width, window.screen.height)
    document.documentElement.classList.toggle(CLASS, touch && landscape && window.innerWidth > screenLong)
}

export function watchFoldScreen() {
    if (typeof window === 'undefined') return
    update()
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
}
