/**
 * useDismiss：選單、對話框共用的「點外面或按 Esc 關閉」
 *
 * - 疊在一起的層：按一次 Esc 只關最後打開的那一層
 * - 裡面的欄位已經用掉這次 Esc（preventDefault）就不關
 * - 點在「裡面」不關、點外面才關；outside: false 時只聽 Esc
 */

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { useRef } from 'react'
import { useDismiss } from '../useDismiss'

function Layer({ open, onClose, outside = true }: { open: boolean; onClose: () => void; outside?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useDismiss(open, onClose, [ref], { outside })
  return open ? <div ref={ref} data-testid="inside">內容</div> : null
}

const esc = () => fireEvent.keyDown(document, { key: 'Escape' })

describe('useDismiss', () => {
  it('按 Esc 關閉', () => {
    const close = vi.fn()
    render(<Layer open onClose={close} />)
    esc()
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('疊兩層：一次 Esc 只關上面那一層，關掉後才輪到下面', () => {
    const closeBottom = vi.fn()
    const closeTop = vi.fn()
    const view = render(<><Layer open onClose={closeBottom} outside={false} /><Layer open={false} onClose={closeTop} outside={false} /></>)
    // 後開的那一層在上面
    view.rerender(<><Layer open onClose={closeBottom} outside={false} /><Layer open onClose={closeTop} outside={false} /></>)
    esc()
    expect(closeTop).toHaveBeenCalledTimes(1)
    expect(closeBottom).not.toHaveBeenCalled()
    // 上面那層關掉之後，下一次 Esc 才是下面那層的
    view.rerender(<><Layer open onClose={closeBottom} outside={false} /><Layer open={false} onClose={closeTop} outside={false} /></>)
    esc()
    expect(closeBottom).toHaveBeenCalledTimes(1)
    expect(closeTop).toHaveBeenCalledTimes(1)
  })

  it('裡面的欄位已經用掉這次 Esc 就不關', () => {
    const close = vi.fn()
    render(<Layer open onClose={close} />)
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    event.preventDefault()
    document.dispatchEvent(event)
    expect(close).not.toHaveBeenCalled()
  })

  it('點在裡面不關，點外面才關', () => {
    const close = vi.fn()
    const view = render(<Layer open onClose={close} />)
    fireEvent.mouseDown(view.getByTestId('inside'))
    expect(close).not.toHaveBeenCalled()
    fireEvent.mouseDown(document.body)
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('outside: false 時點外面不關（由遮罩自己處理），Esc 照常', () => {
    const close = vi.fn()
    render(<Layer open onClose={close} outside={false} />)
    fireEvent.mouseDown(document.body)
    expect(close).not.toHaveBeenCalled()
    esc()
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('沒開的時候不會有反應，關掉之後也不會殘留', () => {
    const close = vi.fn()
    const view = render(<Layer open={false} onClose={close} />)
    esc()
    view.rerender(<Layer open onClose={close} />)
    view.rerender(<Layer open={false} onClose={close} />)
    esc()
    expect(close).not.toHaveBeenCalled()
  })
})
