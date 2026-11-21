/**
 * 讓多行文字的框剛好包住字（右邊不留一大塊空白）
 *
 *   瀏覽器決定框寬的方式：先用「整句排成一行」的寬度，超過上限就停在上限；
 *   字換行之後，框還是上限那麼寬，第一行右邊就空一大塊。
 *   做法：先把寬度放回自動（由 CSS 的 max-width、text-wrap: balance 排好行），
 *   量出最長那一行的寬度，再把框設成「最長一行＋左右內距」。
 *   框正在縮放動畫（transform: scale）時量到的是縮放後的寬度，要除回縮放比例。
 */
export function fitTextWidth(el: HTMLElement | null) {
    if (!el) return
    el.style.width = ''
    if (!el.textContent?.trim()) return
    const range = document.createRange()
    range.selectNodeContents(el)
    const lines = Array.from(range.getClientRects())
    if (lines.length < 2) return // 一行的時候框本來就剛好
    const box = el.getBoundingClientRect()
    const scale = el.offsetWidth ? box.width / el.offsetWidth : 1
    const widest = Math.max(...lines.map((r) => r.width)) / (scale || 1)
    const cs = getComputedStyle(el)
    const padX = Number.parseFloat(cs.paddingLeft) + Number.parseFloat(cs.paddingRight)
    const borderX = Number.parseFloat(cs.borderLeftWidth) + Number.parseFloat(cs.borderRightWidth)
    // 多 1px：量到的寬度有小數，四捨五入後可能少一點點而讓最後一個字掉到下一行
    el.style.width = `${Math.ceil(widest + padX + borderX) + 1}px`
}
