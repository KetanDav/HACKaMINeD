import { createContext, useContext, useState, useEffect } from 'react'
import api, { getOrCreateSession } from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Ensure session exists
    getOrCreateSession()

    // Try to restore user from token
    const token = localStorage.getItem('fs_token')
    const saved = localStorage.getItem('fs_user')
    if (token && saved) {
      try {
        setUser(JSON.parse(saved))
      } catch {}
    }
    setLoading(false)
  }, [])

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password })
    const { access_token, user: u } = res.data
    localStorage.setItem('fs_token', access_token)
    localStorage.setItem('fs_user', JSON.stringify(u))
    setUser(u)
    return u
  }

  const register = async (email, password) => {
    const session = getOrCreateSession()
    const res = await api.post('/auth/register', { email, password, session_token: session })
    const { access_token, user: u } = res.data
    localStorage.setItem('fs_token', access_token)
    localStorage.setItem('fs_user', JSON.stringify(u))
    setUser(u)
    return u
  }

  const logout = () => {
    localStorage.removeItem('fs_token')
    localStorage.removeItem('fs_user')
    setUser(null)
  }

  const refreshUser = async () => {
    try {
      const res = await api.get('/auth/me')
      localStorage.setItem('fs_user', JSON.stringify(res.data))
      setUser(res.data)
    } catch {}
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
