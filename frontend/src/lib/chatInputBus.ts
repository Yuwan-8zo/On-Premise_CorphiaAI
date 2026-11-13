/**
 * 從畫面上別的地方把文字放進聊天輸入框（例如「把執行結果交給 AI」）
 *
 * 訊息裡的元件離輸入框很遠（中間隔著好幾層），用瀏覽器的事件傳，不用把函式一層一層往下帶。
 * 只是把字接到輸入框後面，不會自動送出——使用者看過、可以改，再自己按送出。
 */
const EVENT = 'corphia:append-input'

export function appendToChatInput(text: string): void {
    window.dispatchEvent(new CustomEvent<string>(EVENT, { detail: text }))
}

/** 註冊接收的一方（輸入框所在的地方）；回傳取消註冊的函式 */
export function onAppendToChatInput(handler: (text: string) => void): () => void {
    const listener = (event: Event) => handler((event as CustomEvent<string>).detail)
    window.addEventListener(EVENT, listener)
    return () => window.removeEventListener(EVENT, listener)
}
