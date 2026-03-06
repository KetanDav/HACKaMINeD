import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Shield, Eye, EyeOff, AlertCircle } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

export default function AuthPage() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const { login, register } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next') || '/dashboard'

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        if (password.length < 6) {
          setError('Password must be at least 6 characters')
          setLoading(false)
          return
        }
        await register(email, password)
      }
      navigate(next)
    } catch (err) {
      setError(err.response?.data?.detail || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="max-w-sm mx-auto px-4 pt-16 pb-24 relative z-10">
      <div className="text-center mb-8">
        <div className="w-14 h-14 bg-acid/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Shield size={28} className="text-acid" />
        </div>
        <h1 className="font-display font-extrabold text-3xl text-white mb-2">
          {mode === 'login' ? 'Welcome back' : 'Create account'}
        </h1>
        <p className="text-gray-500 text-sm">
          {mode === 'login'
            ? 'Sign in to access your scan history'
            : 'Get 3 free scans per month. No credit card.'}
        </p>
      </div>

      <div className="bg-carbon-800 border border-carbon-700 rounded-2xl p-6">
        {/* Mode toggle */}
        <div className="flex bg-carbon-900 rounded-xl p-1 mb-6">
          {['login', 'register'].map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(null) }}
              className={`flex-1 py-2 rounded-lg text-sm font-display font-medium transition-all ${mode === m ? 'bg-acid text-carbon-950' : 'text-gray-400 hover:text-white'}`}
            >
              {m === 'login' ? 'Sign In' : 'Sign Up'}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-gray-400 text-sm mb-1.5 block">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="you@company.com"
              className="w-full bg-carbon-900 border border-carbon-600 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-acid/50 transition-colors"
            />
          </div>

          <div>
            <label className="text-gray-400 text-sm mb-1.5 block">Password</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full bg-carbon-900 border border-carbon-600 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-acid/50 transition-colors pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-danger/10 border border-danger/30 rounded-xl px-3 py-2.5">
              <AlertCircle size={14} className="text-danger flex-shrink-0" />
              <p className="text-danger text-xs">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-acid text-carbon-950 font-display font-bold py-3 rounded-xl hover:bg-acid-dim transition-colors disabled:opacity-60"
          >
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        {mode === 'register' && (
          <p className="text-xs text-gray-600 text-center mt-4">
            Your anonymous scan history will be saved to your new account.
          </p>
        )}
      </div>

      <p className="text-center text-gray-600 text-sm mt-6">
        <Link to="/scan" className="text-acid hover:underline">← Back to scanner</Link>
      </p>
    </main>
  )
}
