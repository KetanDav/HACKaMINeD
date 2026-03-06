import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import LandingPage from './pages/LandingPage'
import ScanPage from './pages/ScanPage'
import ReportPage from './pages/ReportPage'
import DashboardPage from './pages/DashboardPage'
import AuthPage from './pages/AuthPage'
import PricingPage from './pages/PricingPage'
import Navbar from './components/Navbar'
import UpgradeModal from './components/UpgradeModal'
import { useState, useEffect } from 'react'
import './index.css'

export default function App() {
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [upgradeReason, setUpgradeReason] = useState(null)

  useEffect(() => {
    const handler = (e) => {
      setUpgradeReason(e.detail)
      setUpgradeOpen(true)
    }
    window.addEventListener('upgrade-required', handler)
    return () => window.removeEventListener('upgrade-required', handler)
  }, [])

  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-carbon-950 noise">
          <Navbar />
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/scan" element={<ScanPage />} />
            <Route path="/report/:scanId" element={<ReportPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/pricing" element={<PricingPage />} />
          </Routes>
          <UpgradeModal open={upgradeOpen} reason={upgradeReason} onClose={() => setUpgradeOpen(false)} />
        </div>
      </BrowserRouter>
    </AuthProvider>
  )
}
