import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Shield, LogOut, LayoutDashboard } from 'lucide-react'

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <nav className="border-b border-carbon-700 bg-carbon-900/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-acid flex items-center justify-center">
            <Shield size={16} className="text-carbon-950" />
          </div>
          <span className="font-display font-bold text-white text-lg tracking-tight">
            Fraud<span className="text-acid">Scan</span>
          </span>
        </Link>

        <div className="flex items-center gap-6">
          <Link to="/scan" className="text-sm text-gray-400 hover:text-white transition-colors">
            Scan Doc
          </Link>
          <Link to="/pricing" className="text-sm text-gray-400 hover:text-white transition-colors">
            Pricing
          </Link>

          {user ? (
            <div className="flex items-center gap-3">
              <Link to="/dashboard" className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-acid transition-colors">
                <LayoutDashboard size={14} />
                Dashboard
              </Link>
              <div className="h-4 w-px bg-carbon-600" />
              <span className="text-xs text-gray-500 font-mono">
                {user.scans_used}/{user.scans_limit === 999999 ? '∞' : user.scans_limit} scans
              </span>
              <button
                onClick={() => { logout(); navigate('/') }}
                className="text-gray-500 hover:text-danger transition-colors"
              >
                <LogOut size={15} />
              </button>
            </div>
          ) : (
            <Link to="/auth" className="bg-acid text-carbon-950 text-sm font-display font-bold px-4 py-1.5 rounded hover:bg-acid-dim transition-colors">
              Sign In
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}
