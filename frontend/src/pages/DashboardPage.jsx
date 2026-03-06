import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Shield, FileText, Plus, TrendingUp, AlertTriangle } from 'lucide-react'
import api from '../lib/api'

const SEV_COLORS = {
  LOW: 'text-safe', MEDIUM: 'text-caution', HIGH: 'text-warning', CRITICAL: 'text-danger'
}

export default function DashboardPage() {
  const { user, refreshUser } = useAuth()
  const navigate = useNavigate()
  const [scans, setScans] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { navigate('/auth'); return }
    const load = async () => {
      try {
        await refreshUser()
        const res = await api.get('/scans/history')
        setScans(res.data.scans || [])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const stats = {
    total: scans.length,
    flagged: scans.filter(s => ['HIGH', 'CRITICAL'].includes(s.severity)).length,
    safe: scans.filter(s => s.severity === 'LOW').length,
  }

  return (
    <main className="max-w-4xl mx-auto px-4 pt-10 pb-24 relative z-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display font-extrabold text-3xl text-white">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">{user?.email}</p>
        </div>
        <Link
          to="/scan"
          className="flex items-center gap-2 bg-acid text-carbon-950 font-display font-bold px-5 py-2.5 rounded-xl hover:bg-acid-dim transition-colors text-sm"
        >
          <Plus size={16} /> New Scan
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Plan', value: user?.plan_type?.toUpperCase() || 'FREE', icon: Shield, color: 'text-acid' },
          { label: 'Scans Used', value: `${user?.scans_used || 0}/${user?.scans_limit === 999999 ? '∞' : user?.scans_limit || 3}`, icon: FileText, color: 'text-white' },
          { label: 'Flagged', value: stats.flagged, icon: AlertTriangle, color: 'text-warning' },
          { label: 'Clean', value: stats.safe, icon: TrendingUp, color: 'text-safe' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-carbon-800 border border-carbon-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon size={14} className={color} />
              <span className="text-gray-500 text-xs">{label}</span>
            </div>
            <p className={`font-display font-bold text-xl ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Upgrade banner */}
      {user?.plan_type === 'free' && (
        <div className="bg-acid/5 border border-acid/20 rounded-xl px-5 py-4 flex items-center justify-between mb-6">
          <div>
            <p className="text-acid font-display font-bold">Upgrade for more scans</p>
            <p className="text-gray-400 text-sm">50 scans/mo on Starter, unlimited on Pro</p>
          </div>
          <Link to="/pricing" className="bg-acid text-carbon-950 font-display font-bold px-4 py-2 rounded-lg hover:bg-acid-dim text-sm transition-colors">
            Upgrade →
          </Link>
        </div>
      )}

      {/* Scan history */}
      <h2 className="font-display font-bold text-lg text-white mb-4">Recent Scans</h2>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : scans.length === 0 ? (
        <div className="text-center py-16 bg-carbon-800 rounded-2xl border border-carbon-700">
          <FileText size={40} className="text-carbon-600 mx-auto mb-3" />
          <p className="text-gray-400 mb-4">No scans yet</p>
          <Link to="/scan" className="text-acid hover:underline text-sm">Scan your first document →</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {scans.map(scan => (
            <Link
              key={scan.id}
              to={`/report/${scan.id}`}
              className="block bg-carbon-800 border border-carbon-700 rounded-xl px-5 py-4 hover:border-acid/30 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText size={18} className="text-gray-500" />
                  <div>
                    <p className="text-white text-sm font-medium">{scan.original_filename || 'Document'}</p>
                    <p className="text-gray-500 text-xs">{scan.document_type || '—'} · {new Date(scan.created_at).toLocaleDateString('en-IN')}</p>
                  </div>
                </div>
                <div className="text-right">
                  {scan.trust_score != null && (
                    <p className={`font-display font-bold text-lg ${SEV_COLORS[scan.severity] || 'text-white'}`}>
                      {scan.trust_score}<span className="text-gray-600 text-sm">/100</span>
                    </p>
                  )}
                  <p className={`text-xs font-mono ${SEV_COLORS[scan.severity] || 'text-gray-500'}`}>
                    {scan.severity || scan.status}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
