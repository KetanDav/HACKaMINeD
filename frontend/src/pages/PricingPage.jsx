import { useState } from 'react'
import { Check, Zap, Crown, Shield } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import api from '../lib/api'

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '₹0',
    period: 'forever',
    icon: Shield,
    scans: '3 scans/month',
    features: ['Invoice scanning', 'Trust Score report', 'GST validation', 'Basic fraud flags'],
    cta: 'Get Started Free',
    highlight: false
  },
  {
    id: 'starter',
    name: 'Starter',
    price: '₹499',
    period: '/month',
    icon: Zap,
    scans: '50 scans/month',
    features: ['Everything in Free', '50 scans/month', 'All document types', 'PDF report export', 'Priority processing'],
    cta: 'Upgrade to Starter',
    highlight: true
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '₹1,499',
    period: '/month',
    icon: Crown,
    scans: 'Unlimited scans',
    features: ['Everything in Starter', 'Unlimited scans', 'Bulk upload API', 'Webhook integration', 'API access', 'White-label reports'],
    cta: 'Upgrade to Pro',
    highlight: false
  }
]

export default function PricingPage() {
  const { user, refreshUser } = useAuth()
  const navigate = useNavigate()
  const [loading, setPlanLoading] = useState(null)

  const handleUpgrade = async (planId) => {
    if (!user) {
      navigate('/auth?next=/pricing')
      return
    }

    if (planId === 'free') {
      navigate('/scan')
      return
    }

    setPlanLoading(planId)

    try {
      const orderRes = await api.post('/payments/create-order', { plan: planId })
      const { order_id, amount, currency, key_id } = orderRes.data

      const options = {
        key: key_id,
        amount,
        currency,
        name: 'FraudScan',
        description: `${planId.charAt(0).toUpperCase() + planId.slice(1)} Plan`,
        order_id,
        prefill: {
          email: user.email,
        },
        theme: { color: '#B5FF3A' },
        handler: async (response) => {
          try {
            await api.post('/payments/verify', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            })
            await refreshUser()
            navigate('/dashboard')
          } catch {
            alert('Payment verification failed. Contact support.')
          }
        },
        modal: {
          ondismiss: () => setPlanLoading(null)
        }
      }

      const rzp = new window.Razorpay(options)
      rzp.on('payment.failed', (resp) => {
        alert(`Payment failed: ${resp.error.description}`)
        setPlanLoading(null)
      })
      rzp.open()

    } catch (err) {
      console.error(err)
      setPlanLoading(null)
    }
  }

  return (
    <main className="max-w-5xl mx-auto px-4 pt-16 pb-24 relative z-10">
      <div className="text-center mb-14">
        <h1 className="font-display font-extrabold text-5xl text-white mb-4">
          Simple, Honest <span className="text-acid">Pricing</span>
        </h1>
        <p className="text-gray-400 text-lg">Start free. Upgrade when you need more scans.</p>
        <p className="text-gray-600 text-sm mt-2 font-mono">Razorpay test mode — use card 4111 1111 1111 1111</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {PLANS.map((plan) => {
          const Icon = plan.icon
          const isCurrentPlan = user?.plan_type === plan.id
          const isLoading = loading === plan.id

          return (
            <div
              key={plan.id}
              className={`
                relative rounded-2xl border p-7 flex flex-col transition-all
                ${plan.highlight
                  ? 'border-acid bg-acid/5 shadow-[0_0_40px_rgba(181,255,58,0.1)]'
                  : 'border-carbon-700 bg-carbon-800'
                }
              `}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-acid text-carbon-950 text-xs font-display font-bold px-3 py-1 rounded-full">
                    MOST POPULAR
                  </span>
                </div>
              )}

              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${plan.highlight ? 'bg-acid' : 'bg-carbon-700'}`}>
                  <Icon size={20} className={plan.highlight ? 'text-carbon-950' : 'text-gray-400'} />
                </div>
                <div>
                  <h2 className="font-display font-bold text-white text-xl">{plan.name}</h2>
                  <p className="text-gray-500 text-xs">{plan.scans}</p>
                </div>
              </div>

              <div className="mb-6">
                <span className="font-display font-extrabold text-4xl text-white">{plan.price}</span>
                <span className="text-gray-500 text-sm">{plan.period}</span>
              </div>

              <ul className="space-y-2.5 mb-8 flex-1">
                {plan.features.map(f => (
                  <li key={f} className="flex items-center gap-2.5">
                    <Check size={15} className="text-acid flex-shrink-0" />
                    <span className="text-gray-300 text-sm">{f}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleUpgrade(plan.id)}
                disabled={isCurrentPlan || isLoading}
                className={`
                  w-full py-3 rounded-xl font-display font-bold transition-all
                  ${isCurrentPlan
                    ? 'bg-carbon-700 text-gray-500 cursor-default'
                    : plan.highlight
                      ? 'bg-acid text-carbon-950 hover:bg-acid-dim'
                      : 'border border-carbon-600 text-white hover:border-acid/50 hover:text-acid'
                  }
                `}
              >
                {isCurrentPlan ? 'Current Plan' : isLoading ? 'Processing...' : plan.cta}
              </button>
            </div>
          )
        })}
      </div>

      <p className="text-center text-gray-600 text-sm mt-8">
        All plans include GST validation, trust scoring, and fraud flag detection.
        Payments powered by Razorpay (test mode).
      </p>
    </main>
  )
}
