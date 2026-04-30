import { useAuthStore } from '../store/authStore'
import api from '../api/client'

export const bootstrapAuth = async () => {
  const { refreshToken, setAccessToken, clearAuth, setBootstrapped } = useAuthStore.getState()
  if (!refreshToken) {
    setBootstrapped(true)
    return
  }
  try {
    const response = await api.post('/auth/refresh', { refresh_token: refreshToken }, { timeout: 5000 })
    const newAccessToken = response.data.access_token
    setAccessToken(newAccessToken)
  } catch (error) {
    console.error('Failed to refresh token during bootstrap:', error)
    clearAuth()
  } finally {
    setBootstrapped(true)
  }
}
