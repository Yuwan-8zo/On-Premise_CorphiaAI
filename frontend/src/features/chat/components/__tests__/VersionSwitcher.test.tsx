/**
 * VersionSwitcher：對話分支的「‹ 2/3 ›」
 */
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

import VersionSwitcher from '@/features/chat/components/VersionSwitcher'

describe('VersionSwitcher', () => {
  it('只有一版、或目前這則不在清單裡：不顯示', () => {
    const { container, rerender } = render(<VersionSwitcher ids={['a']} currentId="a" onSwitch={() => {}} />)
    expect(container).toBeEmptyDOMElement()
    rerender(<VersionSwitcher ids={['a', 'b']} currentId="temp-1" onSwitch={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('顯示第幾版，按左右切到前一版／後一版', async () => {
    const onSwitch = vi.fn()
    render(<VersionSwitcher ids={['a', 'b', 'c']} currentId="b" onSwitch={onSwitch} />)
    expect(screen.getByText('2/3')).toBeInTheDocument()
    await userEvent.click(screen.getByLabelText('ui.message.prevVersion'))
    await userEvent.click(screen.getByLabelText('ui.message.nextVersion'))
    expect(onSwitch.mock.calls).toEqual([['a'], ['c']])
  })

  it('第一版不能再往前、最後一版不能再往後', () => {
    const { rerender } = render(<VersionSwitcher ids={['a', 'b']} currentId="a" onSwitch={() => {}} />)
    expect(screen.getByLabelText('ui.message.prevVersion')).toBeDisabled()
    expect(screen.getByLabelText('ui.message.nextVersion')).toBeEnabled()
    rerender(<VersionSwitcher ids={['a', 'b']} currentId="b" onSwitch={() => {}} />)
    expect(screen.getByLabelText('ui.message.nextVersion')).toBeDisabled()
  })

  it('正在生成時兩邊都不能按', () => {
    render(<VersionSwitcher ids={['a', 'b', 'c']} currentId="b" onSwitch={() => {}} disabled />)
    expect(screen.getByLabelText('ui.message.prevVersion')).toBeDisabled()
    expect(screen.getByLabelText('ui.message.nextVersion')).toBeDisabled()
  })
})
