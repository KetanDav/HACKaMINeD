# 🔍 FraudScan
### AI-Powered Business Document Fraud Detection for Indian SMBs

> Detect fake invoices, forged GST certificates, and tampered KYC documents in under 30 seconds.

---

## 🏗️ Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                     FRONTEND (React)                     │
│    Upload UI → Scan Animation → Trust Score Dashboard    │
│    Anonymous sessions (localStorage) → Auth merge        │
└─────────────────────┬────────────────────────────────────┘
                      │ REST API
┌─────────────────────▼────────────────────────────────────┐
│                  BACKEND (FastAPI)                        │
│                                                          │
│  /upload  →  /scan/{id}  →  /report/{id}                 │
│  /auth/register  →  /auth/login  →  /auth/me             │
│  /payments/create-order  →  /payments/verify             │
│  /webhook/razorpay                                       │
└────┬──────────────┬──────────────┬───────────────────────┘
     │              │              │
┌────▼─────┐  ┌─────▼──────┐  ┌───▼──────────────────────┐
│ Supabase │  │ Claude API │  │ Razorpay (Test Mode)       │
│ Postgres │  │ Sonnet 4   │  │ Webhooks + Subscriptions  │
│ Storage  │  │ Vision+Text│  └──────────────────────────┘
└──────────┘  └────────────┘
```

### 4-Layer Fraud Detection Pipeline

```
Layer 1: PDF Metadata Forensics     → pypdf (creation/modification dates, editor software)
Layer 2: AI Visual Forensics        → Claude Vision (copy-paste artifacts, layout anomalies)
Layer 3: Indian Data Validation     → regex + checksums (GST, PAN, IFSC, invoice math)
Layer 4: AI Pattern Intelligence    → Claude text (suspicious wording, format anomalies)
```

---

## ⚙️ Quick Start (Local)

### Prerequisites
- Python 3.11+
- Node.js 20+
- Tesseract OCR (`brew install tesseract` / `apt-get install tesseract-ocr`)
- Supabase account (free tier works)
- Anthropic API key
- Razorpay test account

### 1. Clone & Setup Environment

```bash
git clone <repo>
cd fraudscan

# Backend
cd backend
cp .env.example .env
# Fill in all keys in .env

pip install -r requirements.txt

# Frontend
cd ../frontend
npm install
```

### 2. Setup Supabase

1. Create a new Supabase project
2. Go to SQL Editor → paste contents of `backend/schema.sql` → Run
3. Go to Storage → Create bucket named `documents` (set to private)
4. Copy your Project URL, anon key, and service_role key to `.env`

### 3. Setup Razorpay

1. Create account at razorpay.com
2. Go to Settings → API Keys → Generate Test Keys
3. Copy Key ID and Key Secret to `.env`
4. Go to Webhooks → Add webhook:
   - URL: `http://your-domain/api/webhook/razorpay`
   - Events: `payment.captured`, `payment.failed`, `order.paid`
   - Copy webhook secret to `.env`

### 4. Run

```bash
# Terminal 1 - Backend
cd backend
uvicorn app.main:app --reload --port 8000

# Terminal 2 - Frontend
cd frontend
npm run dev
```

Open: http://localhost:5173

### 5. Docker (Alternative)

```bash
cp backend/.env.example backend/.env
# Fill in backend/.env

docker-compose up --build
```

---

## 📁 Project Structure

```
fraudscan/
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI app + CORS
│   │   ├── core/
│   │   │   ├── config.py           # Pydantic settings
│   │   │   ├── database.py         # Supabase clients
│   │   │   └── security.py         # JWT + session tokens
│   │   ├── api/
│   │   │   ├── upload.py           # POST /upload
│   │   │   ├── scan.py             # POST /scan/{id} — 4-layer pipeline
│   │   │   ├── report.py           # GET /report/{id}
│   │   │   ├── auth.py             # Register/Login/Me + session merge
│   │   │   ├── payments.py         # Razorpay order creation + verify
│   │   │   └── webhook.py          # Razorpay webhook handler
│   │   ├── models/
│   │   │   └── schemas.py          # Pydantic models
│   │   └── services/
│   │       ├── claude_service.py   # AI fraud detection engine
│   │       └── document_service.py # PDF metadata + data validation
│   ├── schema.sql                  # Supabase migrations
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx                 # Router + global upgrade modal
│   │   ├── pages/
│   │   │   ├── LandingPage.jsx     # Hero + features
│   │   │   ├── ScanPage.jsx        # Upload + scan animation (core UX)
│   │   │   ├── ReportPage.jsx      # Trust Score dashboard
│   │   │   ├── DashboardPage.jsx   # Scan history
│   │   │   ├── AuthPage.jsx        # Login/Register
│   │   │   └── PricingPage.jsx     # Razorpay checkout
│   │   ├── components/
│   │   │   ├── Navbar.jsx
│   │   │   └── UpgradeModal.jsx    # Auto-triggered on limit reached
│   │   ├── hooks/
│   │   │   └── useAuth.jsx         # Auth context + session merge
│   │   └── lib/
│   │       └── api.js              # Axios + interceptors
│   ├── Dockerfile
│   └── package.json
│
└── docker-compose.yml
```

---

## 🧪 Test Credentials (for judges)

**Razorpay Test Card:**
- Card: `4111 1111 1111 1111`
- Expiry: Any future date
- CVV: Any 3 digits
- OTP: `1234` (if prompted)

**Test Documents to upload:**
- Any PDF invoice from your email
- A screenshot of a GST certificate
- Any business document image

---

## 💰 Monetization Model

| Plan | Price | Scans | Features |
|------|-------|-------|----------|
| Free | ₹0 | 3/month | Basic scanning |
| Starter | ₹499/mo | 50/month | All doc types + PDF reports |
| Pro | ₹1,499/mo | Unlimited | API access + bulk upload + webhooks |

---

## 🎯 Hackathon Constraints Checklist

- ✅ **No Chatbot** — Claude runs invisibly, returns deterministic JSON
- ✅ **TTV < 3 interactions** — Upload → Scan → Report (no login needed)
- ✅ **Anonymous sessions** — localStorage session_token, merges on signup
- ✅ **Checkout flow** — Razorpay test mode with tier logic
- ✅ **Webhook tested** — `/api/webhook/razorpay` handles captured/failed/paid
- ✅ **Real users + DB entries** — Share with local shop owners / CA firms
- ✅ **Painkiller, not ERP** — One surgical thing: document fraud detection

---

## 🎤 Judge Demo Script (5 minutes)

### Minute 1 — The Problem
*"Every month, Indian SMBs lose crores to fake invoices, forged GST certificates, and tampered KYC docs. There's no affordable tool to verify them. That's FraudScan."*

### Minute 2 — Live Demo (Anonymous Flow)
1. Open http://localhost:5173
2. Click "Scan a Document Free" — **no signup**
3. Upload a PDF invoice
4. Show the scanning animation (4 layers running)
5. Show the Trust Score dashboard with flags

*"3 interactions. No account. Real value."*

### Minute 3 — Architecture Walkthrough
Point to the diagram and explain:
- *"4-layer pipeline: metadata forensics catches PDF tampering, Claude Vision detects visual anomalies, our regex engine validates Indian GST/PAN numbers, and Claude's pattern intelligence catches suspicious wording."*
- *"Claude returns deterministic JSON — no chatbot, pure backend reasoning engine."*

### Minute 4 — Payment Flow
1. Click Pricing → Upgrade to Starter
2. Show Razorpay modal opens
3. Enter test card `4111 1111 1111 1111`
4. Complete payment → show plan upgrades instantly
5. Open Supabase dashboard → show DB entry updated

*"Webhooks handle tier upgrades, failed payments, and edge cases."*

### Minute 5 — Business Case
*"Target: 63 million SMBs in India. Acquisition: share with local CA firms and shop owners. ₹499/month starter. Even at 1000 users = ₹5L MRR. The pain is real, the market is massive, and there's no affordable solution today."*

---

## 🔒 Security Notes

- Passwords: bcrypt hashed (never stored plain)
- JWTs: 7-day expiry, signed with 256-bit secret
- File uploads: type + size validated before processing
- Razorpay webhooks: HMAC-SHA256 signature verified
- Supabase: RLS enabled, service key only on backend
- User isolation: scans verified against user_id or session_token

---

## 📊 Expected AI Output Example

```json
{
  "document_type": "GST Certificate",
  "trust_score": 23,
  "severity": "CRITICAL",
  "flags": [
    {
      "type": "METADATA_TAMPERING",
      "detail": "PDF modified 14 days after creation. Creation: 2024-01-01, Modified: 2024-01-15",
      "severity": "HIGH",
      "confidence": 94
    },
    {
      "type": "GST_INVALID",
      "detail": "GSTIN 99AAPFU0939F1ZV has invalid state code: 99",
      "severity": "CRITICAL",
      "confidence": 99
    },
    {
      "type": "FONT_ANOMALY",
      "detail": "3 different fonts detected in the company name field — inconsistent with official documents",
      "severity": "MEDIUM",
      "confidence": 78
    }
  ],
  "recommendation": "DO NOT PROCEED",
  "summary": "This GST certificate shows multiple signs of tampering. The PDF was edited 14 days after creation, the GSTIN contains an invalid state code, and font inconsistencies suggest copy-paste manipulation. Do not accept this document."
}
```
