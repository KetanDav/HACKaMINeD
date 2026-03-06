import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Shield, AlertTriangle, CheckCircle, XCircle, ChevronDown, ChevronUp, Download, Plus } from 'lucide-react'
import api from '../lib/api'

const SEVERITY_CONFIG = {
  LOW: { color: 'text-safe', bg: 'bg-safe/10', border: 'border-safe/30', label: 'Low Risk' },
  MEDIUM: { color: 'text-caution', bg: 'bg-caution/10', border: 'border-caution/30', label: 'Medium Risk' },
  HIGH: { color: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/30', label: 'High Risk' },
  CRITICAL: { color: 'text-danger', bg: 'bg-danger/10', border: 'border-danger/30', label: 'Critical' },
}

const RECOMMENDATION_CONFIG = {
  'PROCEED': { color: 'text-safe', bg: 'bg-safe/10', border: 'border-safe/30', icon: CheckCircle },
  'PROCEED WITH CAUTION': { color: 'text-caution', bg: 'bg-caution/10', border: 'border-caution/30', icon: AlertTriangle },
  'VERIFY MANUALLY': { color: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/30', icon: AlertTriangle },
  'DO NOT PROCEED': { color: 'text-danger', bg: 'bg-danger/10', border: 'border-danger/30', icon: XCircle },
}

function TrustScoreRing({ score }) {
  const size = 160
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  const color = score >= 70 ? '#3AFF8C' : score >= 40 ? '#FFE066' : score >= 20 ? '#FFB347' : '#FF4545'

  const [animated, setAnimated] = useState(true)

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background ring */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="#21262D" strokeWidth="10"
        />
        {/* Score ring */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          className="trust-ring"
          style={{
            strokeDasharray: circumference,
            strokeDashoffset: animated ? offset : circumference,
            transition: 'stroke-dashoffset 1.5s cubic-bezier(0.4,0,0.2,1)',
            transform: 'rotate(-90deg)',
            transformOrigin: 'center'
          }}
        />
      </svg>
      <div className="absolute text-center">
        <span className="font-display font-black text-4xl" style={{ color }}>{score}</span>
        <p className="text-gray-500 text-xs mt-0.5">/ 100</p>
      </div>
    </div>
  )
}

function FlagCard({ flag }) {
  const [open, setOpen] = useState(false)
  const sev = SEVERITY_CONFIG[flag.severity] || SEVERITY_CONFIG.MEDIUM

  return (
    <div className={`border rounded-xl overflow-hidden ${sev.border} ${sev.bg}`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 flex items-center gap-3 text-left"
      >
        <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${sev.bg} ${sev.color} border ${sev.border}`}>
          {flag.severity}
        </span>
        <span className={`text-sm font-medium flex-1 ${sev.color}`}>
          {flag.type.replace(/_/g, ' ')}
        </span>
        <span className="text-xs text-gray-500 mr-2 font-mono">{flag.confidence}%</span>
        {open ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
      </button>
      {open && (
        <div className="px-4 pb-3 border-t border-white/5">
          <p className="text-gray-300 text-sm mt-2 leading-relaxed">{flag.detail}</p>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 bg-carbon-900 rounded-full h-1.5">
              <div
                className="h-1.5 rounded-full transition-all"
                style={{ width: `${flag.confidence}%`, backgroundColor: flag.confidence > 80 ? '#FF4545' : flag.confidence > 60 ? '#FFB347' : '#B5FF3A' }}
              />
            </div>
            <span className="text-xs text-gray-500 font-mono">{flag.confidence}% confidence</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ReportPage() {
  const { scanId } = useParams()
  const [report, setReport] = useState(null)
  const [meta, setMeta] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get(`/report/${scanId}`)
        if (res.data.status === 'processing') {
          setTimeout(load, 2000)
          return
        }
        setReport(res.data.report)
        setMeta({ filename: res.data.original_filename, created_at: res.data.created_at })
        setLoading(false)
      } catch (err) {
        setError('Could not load report.')
        setLoading(false)
      }
    }
    load()
  }, [scanId])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-96 gap-4 relative z-10">
        <div className="w-12 h-12 border-2 border-acid border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-400 font-mono text-sm">Loading report...</p>
      </div>
    )
  }

  if (error || !report) {
    return (
      <div className="max-w-lg mx-auto text-center pt-20 relative z-10">
        <p className="text-danger mb-4">{error || 'Report not found'}</p>
        <Link to="/scan" className="text-acid hover:underline">← Back to scanner</Link>
      </div>
    )
  }

  const rec = RECOMMENDATION_CONFIG[report.recommendation] || RECOMMENDATION_CONFIG['VERIFY MANUALLY']
  const RecIcon = rec.icon
  const overallSev = SEVERITY_CONFIG[report.severity] || SEVERITY_CONFIG.MEDIUM

  return (
    <main className="max-w-3xl mx-auto px-4 pt-10 pb-24 relative z-10 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-gray-500 text-sm font-mono mb-1">{meta?.filename || 'Document'}</p>
          <h1 className="font-display font-extrabold text-3xl text-white">Fraud Analysis Report</h1>
        </div>
        <Link to="/scan" className="flex items-center gap-2 text-sm text-acid hover:text-acid-dim transition-colors font-medium">
          <Plus size={16} /> New Scan
        </Link>
      </div>

      {/* Main score card */}
      <div className="bg-carbon-800 border border-carbon-700 rounded-2xl p-8 mb-6">
        <div className="flex flex-col md:flex-row items-center gap-8">
          <TrustScoreRing score={report.trust_score} />

          <div className="flex-1 text-center md:text-left">
            <p className="text-gray-400 text-sm mb-1 font-mono">Document Type</p>
            <h2 className="font-display font-bold text-2xl text-white mb-4">{report.document_type}</h2>

            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border ${rec.bg} ${rec.border} ${rec.color} mb-4`}>
              <RecIcon size={18} />
              <span className="font-display font-bold text-lg">{report.recommendation}</span>
            </div>

            <p className="text-gray-400 text-sm leading-relaxed">{report.summary}</p>
          </div>

          <div className="text-center">
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-mono font-bold ${overallSev.bg} ${overallSev.border} ${overallSev.color}`}>
              {overallSev.label}
            </div>
            <p className="text-gray-600 text-xs mt-1">{report.flags.length} flag{report.flags.length !== 1 ? 's' : ''} found</p>
          </div>
        </div>
      </div>

      {/* Flags */}
      {report.flags.length > 0 ? (
        <div className="space-y-3 mb-6">
          <h3 className="font-display font-bold text-lg text-white">
            Detected Flags ({report.flags.length})
          </h3>
          {report.flags
            .sort((a, b) => {
              const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
              return (order[a.severity] || 3) - (order[b.severity] || 3)
            })
            .map((flag, i) => <FlagCard key={i} flag={flag} />)
          }
        </div>
      ) : (
        <div className="bg-safe/5 border border-safe/30 rounded-xl p-6 text-center mb-6">
          <CheckCircle size={32} className="text-safe mx-auto mb-2" />
          <p className="text-safe font-display font-bold text-lg">No Issues Detected</p>
          <p className="text-gray-400 text-sm">This document appears authentic.</p>
        </div>
      )}

      {/* CTA */}
      <div className="bg-carbon-800 border border-acid/20 rounded-2xl p-6 text-center">
        <Shield size={24} className="text-acid mx-auto mb-3" />
        <h3 className="font-display font-bold text-white text-lg mb-2">Need more scans?</h3>
        <p className="text-gray-400 text-sm mb-4">Get 50 scans/month on Starter or unlimited on Pro.</p>
        <Link
          to="/pricing"
          className="inline-flex items-center gap-2 bg-acid text-carbon-950 font-display font-bold px-6 py-3 rounded-xl hover:bg-acid-dim transition-colors"
        >
          View Plans
        </Link>
      </div>
    </main>
  )
}
