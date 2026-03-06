import { Link } from 'react-router-dom'
import { X, Zap } from 'lucide-react'

export default function UpgradeModal({ open, reason, onClose }) {
  if (!open) return null

  const isAnon = reason?.signup_required
  const isLimit = reason?.upgrade_required

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-carbon-800 border border-acid/30 rounded-2xl p-8 max-w-sm w-full shadow-2xl animate-fade-up">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white">
          <X size={18} />
        </button>

        <div className="w-12 h-12 bg-acid/10 rounded-xl flex items-center justify-center mb-4">
          <Zap size={24} className="text-acid" />
        </div>

        <h2 className="font-display font-bold text-2xl text-white mb-2">
          {isAnon ? 'Create Free Account' : 'Scan Limit Reached'}
        </h2>
        <p className="text-gray-400 text-sm mb-6">
          {reason?.message || 'Upgrade your plan to continue scanning.'}
        </p>

        <div className="space-y-3">
          {isAnon ? (
            <Link
              to="/auth"
              onClick={onClose}
              className="block w-full text-center bg-acid text-carbon-950 font-display font-bold py-3 rounded-xl hover:bg-acid-dim transition-colors"
            >
              Sign Up Free — 3 Scans/Month
            </Link>
          ) : (
            <Link
              to="/pricing"
              onClick={onClose}
              className="block w-full text-center bg-acid text-carbon-950 font-display font-bold py-3 rounded-xl hover:bg-acid-dim transition-colors"
            >
              View Upgrade Plans
            </Link>
          )}
          <button
            onClick={onClose}
            className="block w-full text-center text-gray-500 text-sm hover:text-gray-300 transition-colors"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  )
}
