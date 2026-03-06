import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 120000, // 2min for AI analysis
})

// Inject auth token and session token on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('fs_token')
  const session = localStorage.getItem('fs_session')

  if (token) config.headers['Authorization'] = `Bearer ${token}`
  if (session) config.headers['X-Session-Token'] = session

  return config
})

// Handle 402 (upgrade required) globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 402) {
      window.dispatchEvent(new CustomEvent('upgrade-required', {
        detail: err.response.data.detail
      }))
    }
    return Promise.reject(err)
  }
)

export default api

// Session management helpers
export const getOrCreateSession = () => {
  let session = localStorage.getItem('fs_session')
  if (!session) {
    session = crypto.randomUUID()
    localStorage.setItem('fs_session', session)
  }
  return session
}

export const clearSession = () => {
  localStorage.removeItem('fs_session')
  localStorage.removeItem('fs_token')
  localStorage.removeItem('fs_user')
}
