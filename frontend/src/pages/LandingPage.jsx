import { Link } from 'react-router-dom'
import { Shield, Zap, Eye, FileSearch, ArrowRight, CheckCircle } from 'lucide-react'

export default function LandingPage() {
  return (
    <main className="relative z-10">
      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 border border-acid/30 rounded-full px-4 py-1.5 mb-8 bg-acid/5">
          <span className="w-2 h-2 rounded-full bg-acid animate-pulse" />
          <span className="text-acid text-sm font-mono">AI-powered • Real-time • India-specific</span>
        </div>

        <h1 className="font-display font-extrabold text-5xl md:text-7xl text-white leading-tight mb-6">
          Stop Fake Documents<br />
          <span className="text-acid">Before They Cost You</span>
        </h1>

        <p className="text-gray-400 text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
          Upload any invoice, GST certificate, or KYC document.
          Our AI scans for tampering, forgery, and fraud in under 30 seconds.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/scan"
            className="inline-flex items-center gap-2 bg-acid text-carbon-950 font-display font-bold text-lg px-8 py-4 rounded-lg hover:bg-acid-dim transition-all animate-pulse-acid"
          >
            Scan a Document Free
            <ArrowRight size={20} />
          </Link>
          <Link
            to="/pricing"
            className="inline-flex items-center gap-2 border border-carbon-600 text-gray-300 font-display text-lg px-8 py-4 rounded-lg hover:border-acid/50 hover:text-white transition-all"
          >
            View Plans
          </Link>
        </div>

        <p className="text-gray-600 text-sm mt-4">No signup required • 1 free scan • No credit card</p>
      </section>

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-4 py-20 border-t border-carbon-700">
        <h2 className="font-display font-bold text-3xl text-center mb-16 text-white">
          Value in <span className="text-acid">3 interactions</span>
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { step: '01', icon: FileSearch, title: 'Upload Document', desc: 'Drop your PDF, invoice, GST cert or KYC doc. No account needed.' },
            { step: '02', icon: Eye, title: 'AI Analyzes', desc: '4-layer scan: metadata forensics, visual analysis, data validation, pattern detection.' },
            { step: '03', icon: Shield, title: 'Get Trust Score', desc: 'Instant fraud report with Trust Score, severity flags, and clear recommendation.' },
          ].map(({ step, icon: Icon, title, desc }) => (
            <div key={step} className="bg-carbon-800 border border-carbon-700 rounded-xl p-6 relative overflow-hidden group hover:border-acid/40 transition-colors">
              <span className="font-mono text-5xl font-bold text-carbon-700 absolute top-4 right-4 group-hover:text-acid/20 transition-colors">{step}</span>
              <div className="w-10 h-10 bg-acid/10 rounded-lg flex items-center justify-center mb-4">
                <Icon size={20} className="text-acid" />
              </div>
              <h3 className="font-display font-bold text-white text-lg mb-2">{title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Detection capabilities */}
      <section className="max-w-6xl mx-auto px-4 py-20 border-t border-carbon-700">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="font-display font-bold text-3xl text-white mb-6">
              Catches What Humans Miss
            </h2>
            <div className="space-y-3">
              {[
                'GST number validity against govt format',
                'PDF metadata tampering detection',
                'Invoice math inconsistencies',
                'Font & layout anomalies',
                'PAN number checksum validation',
                'Duplicate invoice detection',
                'Suspicious round number patterns',
                'Signature presence verification',
              ].map(item => (
                <div key={item} className="flex items-center gap-3">
                  <CheckCircle size={16} className="text-acid flex-shrink-0" />
                  <span className="text-gray-300 text-sm">{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-carbon-900 border border-carbon-700 rounded-xl p-6 font-mono text-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-danger" />
              <div className="w-3 h-3 rounded-full bg-warning" />
              <div className="w-3 h-3 rounded-full bg-safe" />
              <span className="text-gray-500 ml-2 text-xs">fraud_report.json</span>
            </div>
            <pre className="text-xs leading-relaxed overflow-auto">
{`{
  "document_type": "GST Certificate",
  "trust_score": 23,
  "severity": "CRITICAL",
  "flags": [
    {
      "type": "METADATA_TAMPERING",
      "detail": "PDF edited 14 days after creation",
      "severity": "HIGH",
      "confidence": 94
    },
    {
      "type": "GST_INVALID", 
      "detail": "GSTIN not found in registry",
      "severity": "CRITICAL",
      "confidence": 99
    }
  ],
  "recommendation": "DO NOT PROCEED"
}`}
            </pre>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-4 py-20 border-t border-carbon-700 text-center">
        <h2 className="font-display font-bold text-4xl text-white mb-4">
          Ready to <span className="text-acid">verify your first document?</span>
        </h2>
        <p className="text-gray-400 mb-8">Free. Instant. No signup required.</p>
        <Link
          to="/scan"
          className="inline-flex items-center gap-2 bg-acid text-carbon-950 font-display font-bold text-lg px-10 py-4 rounded-lg hover:bg-acid-dim transition-all"
        >
          Start Scanning Now <ArrowRight size={20} />
        </Link>
      </section>
    </main>
  )
}
