import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { Upload, FileText, Image, Loader, Shield, AlertCircle, X } from 'lucide-react'
import api, { getOrCreateSession } from '../lib/api'

const ACCEPTED_TYPES = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp']
}

const STAGES = [
  { id: 'metadata', label: 'Metadata forensics', duration: 800 },
  { id: 'visual', label: 'Visual pattern analysis', duration: 1200 },
  { id: 'validation', label: 'GST & PAN validation', duration: 600 },
  { id: 'intelligence', label: 'AI pattern intelligence', duration: 2000 },
]

export default function ScanPage() {
  const navigate = useNavigate()
  const [file, setFile] = useState(null)
  const [uploadId, setUploadId] = useState(null)
  const [phase, setPhase] = useState('idle') // idle | uploading | scanning | done | error
  const [activeStage, setActiveStage] = useState(0)
  const [completedStages, setCompletedStages] = useState([])
  const [error, setError] = useState(null)

  const onDrop = useCallback((accepted) => {
    if (accepted[0]) {
      setFile(accepted[0])
      setError(null)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
    onDropRejected: (files) => {
      const err = files[0]?.errors[0]
      if (err?.code === 'file-too-large') setError('File too large. Max size is 10MB.')
      else if (err?.code === 'file-invalid-type') setError('Please upload a PDF, JPG, PNG, or WEBP file.')
      else setError('File rejected. Please try again.')
    }
  })

  const runScan = async () => {
    if (!file) return
    setError(null)
    setPhase('uploading')
    setCompletedStages([])

    try {
      // Step 1: Upload
      const formData = new FormData()
      formData.append('file', file)
      const uploadRes = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      const id = uploadRes.data.upload_id

      // Save session token if returned
      if (uploadRes.data.session_token) {
        localStorage.setItem('fs_session', uploadRes.data.session_token)
      }

      setUploadId(id)
      setPhase('scanning')

      // Animate stages while scan runs
      const scanPromise = api.post(`/scan/${id}`)
      let stageIdx = 0

      const animateStages = async () => {
        for (let i = 0; i < STAGES.length; i++) {
          setActiveStage(i)
          await new Promise(r => setTimeout(r, STAGES[i].duration))
          setCompletedStages(prev => [...prev, STAGES[i].id])
        }
      }

      await Promise.all([scanPromise, animateStages()])
      setPhase('done')
      navigate(`/report/${id}`)

    } catch (err) {
      setPhase('error')
      const detail = err.response?.data?.detail
      if (typeof detail === 'object') {
        setError(detail.message || 'Scan failed')
      } else {
        setError(detail || 'Scan failed. Please try again.')
      }
    }
  }

  const reset = () => {
    setFile(null)
    setUploadId(null)
    setPhase('idle')
    setActiveStage(0)
    setCompletedStages([])
    setError(null)
  }

  return (
    <main className="max-w-2xl mx-auto px-4 pt-16 pb-24 relative z-10">
      <div className="text-center mb-10">
        <h1 className="font-display font-extrabold text-4xl text-white mb-3">
          Scan a Document
        </h1>
        <p className="text-gray-400">Upload any business document. Get fraud analysis in seconds.</p>
      </div>

      {/* Upload zone */}
      {phase === 'idle' && (
        <div className="space-y-6 animate-fade-up">
          <div
            {...getRootProps()}
            className={`
              relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all
              ${isDragActive
                ? 'border-acid bg-acid/5 scale-[1.02]'
                : file
                  ? 'border-acid/50 bg-acid/5'
                  : 'border-carbon-600 bg-carbon-800/50 hover:border-acid/40 hover:bg-carbon-800'
              }
            `}
          >
            <input {...getInputProps()} />

            {file ? (
              <div className="space-y-3">
                <div className="w-14 h-14 bg-acid/10 rounded-xl flex items-center justify-center mx-auto">
                  {file.type === 'application/pdf'
                    ? <FileText size={28} className="text-acid" />
                    : <Image size={28} className="text-acid" />
                  }
                </div>
                <div>
                  <p className="text-white font-medium">{file.name}</p>
                  <p className="text-gray-500 text-sm">{(file.size / 1024).toFixed(1)} KB · {file.type}</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); reset() }}
                  className="text-gray-500 hover:text-danger text-sm flex items-center gap-1 mx-auto transition-colors"
                >
                  <X size={14} /> Remove
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="w-14 h-14 bg-carbon-700 rounded-xl flex items-center justify-center mx-auto">
                  <Upload size={28} className={isDragActive ? 'text-acid' : 'text-gray-500'} />
                </div>
                <div>
                  <p className="text-white font-medium">
                    {isDragActive ? 'Drop it here' : 'Drop your document here'}
                  </p>
                  <p className="text-gray-500 text-sm">PDF, JPG, PNG, WEBP · Max 10MB</p>
                </div>
                <p className="text-acid/70 text-sm">or click to browse</p>
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-3 bg-danger/10 border border-danger/30 rounded-xl px-4 py-3">
              <AlertCircle size={16} className="text-danger flex-shrink-0" />
              <p className="text-danger text-sm">{error}</p>
            </div>
          )}

          <button
            onClick={runScan}
            disabled={!file}
            className={`
              w-full py-4 rounded-xl font-display font-bold text-lg transition-all
              ${file
                ? 'bg-acid text-carbon-950 hover:bg-acid-dim animate-pulse-acid'
                : 'bg-carbon-700 text-gray-500 cursor-not-allowed'
              }
            `}
          >
            <span className="flex items-center justify-center gap-2">
              <Shield size={20} />
              Analyze Document
            </span>
          </button>

          <p className="text-center text-gray-600 text-xs">
            1 free scan · No account required · Data processed securely
          </p>
        </div>
      )}

      {/* Scanning animation */}
      {(phase === 'uploading' || phase === 'scanning') && (
        <div className="bg-carbon-800 border border-carbon-700 rounded-2xl p-8 animate-fade-up">
          <div className="relative mb-8">
            {/* Document preview with scan line */}
            <div className="bg-carbon-900 rounded-xl border border-carbon-600 h-48 relative overflow-hidden scan-overlay flex items-center justify-center">
              <div className="text-center">
                {file?.type === 'application/pdf'
                  ? <FileText size={48} className="text-carbon-600 mx-auto mb-2" />
                  : <Image size={48} className="text-carbon-600 mx-auto mb-2" />
                }
                <p className="text-carbon-600 text-sm font-mono">{file?.name}</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {STAGES.map((stage, i) => {
              const done = completedStages.includes(stage.id)
              const active = activeStage === i && phase === 'scanning'
              return (
                <div key={stage.id} className={`flex items-center gap-3 transition-all ${done ? 'opacity-100' : active ? 'opacity-100' : 'opacity-30'}`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${done ? 'bg-acid' : active ? 'bg-acid/30' : 'bg-carbon-700'}`}>
                    {done
                      ? <span className="text-carbon-950 text-xs">✓</span>
                      : active
                        ? <Loader size={12} className="text-acid animate-spin" />
                        : null
                    }
                  </div>
                  <span className={`text-sm font-mono ${done ? 'text-acid' : active ? 'text-white' : 'text-gray-600'}`}>
                    {stage.label}
                  </span>
                  {active && <span className="text-acid text-xs animate-pulse">running...</span>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Error state */}
      {phase === 'error' && (
        <div className="text-center space-y-4 animate-fade-up">
          <div className="w-16 h-16 bg-danger/10 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle size={32} className="text-danger" />
          </div>
          <h2 className="font-display font-bold text-xl text-white">Scan Failed</h2>
          <p className="text-gray-400">{error}</p>
          <button onClick={reset} className="bg-acid text-carbon-950 font-bold px-6 py-3 rounded-xl hover:bg-acid-dim transition-colors font-display">
            Try Again
          </button>
        </div>
      )}
    </main>
  )
}
