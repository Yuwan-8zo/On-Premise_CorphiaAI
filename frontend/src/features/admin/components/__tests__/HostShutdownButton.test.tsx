/**
 * HostShutdownButton：管理後台的「關閉主機服務」
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}))

const shutdownHost = vi.fn()
vi.mock('@/api/system', () => ({ systemApi: { shutdownHost: () => shutdownHost() } }))

const showConfirm = vi.fn()
vi.mock('@/store/uiStore', () => ({
  useUIStore: (pick: (s: { showConfirm: typeof showConfirm }) => unknown) => pick({ showConfirm }),
}))

const toastAdd = vi.fn()
const toastError = vi.fn()
vi.mock('@/store/toastStore', () => ({ useToastStore: { getState: () => ({ add: toastAdd, error: toastError }) } }))

import HostShutdownButton, { isHostPage } from '@/features/admin/components/HostShutdownButton'

beforeEach(() => {
  shutdownHost.mockReset()
  showConfirm.mockReset()
  toastAdd.mockReset()
  toastError.mockReset()
})

describe('isHostPage', () => {
  it.each(['localhost', '127.0.0.1', '[::1]'])('%s 是主機本機', (host) => {
    expect(isHostPage(host)).toBe(true)
  })

  it.each(['192.168.1.10', 'corphia.local', 'localhost.evil.test', ''])('%s 不是', (host) => {
    expect(isHostPage(host)).toBe(false)
  })
})

describe('HostShutdownButton', () => {
  // 測試環境的網址是 localhost，等於在主機本機
  it('按下去先確認，確認後才真的關，並告訴使用者可以關掉視窗', async () => {
    shutdownHost.mockResolvedValue(undefined)
    render(<HostShutdownButton />)
    await userEvent.click(screen.getByRole('button', { name: 'admin.shutdown.button' }))

    expect(shutdownHost).not.toHaveBeenCalled()
    expect(showConfirm).toHaveBeenCalledWith('admin.shutdown.confirm', expect.any(Function), 'admin.shutdown.hint')

    await showConfirm.mock.calls[0][1]()
    expect(shutdownHost).toHaveBeenCalledTimes(1)
    expect(toastAdd).toHaveBeenCalledWith('admin.shutdown.stopping', 'info', expect.any(Number))
    expect(await screen.findByRole('button', { name: 'admin.shutdown.stoppingShort' })).toBeDisabled()
  })

  it('關閉失敗：顯示原因，按鈕恢復可以再按', async () => {
    shutdownHost.mockRejectedValue(new Error('只能在主機本機關閉服務'))
    render(<HostShutdownButton />)
    await userEvent.click(screen.getByRole('button'))
    await showConfirm.mock.calls[0][1]()
    expect(toastError).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'admin.shutdown.button' })).toBeEnabled()
  })
})
