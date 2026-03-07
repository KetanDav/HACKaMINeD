# Vercel + Twilio + Sarvam Setup (No ngrok)

This guide lets you run your VoiceDesk APIs on Vercel and connect Twilio directly to your Vercel URL.

## 1) Deploy to Vercel

## Option A: Vercel Dashboard (recommended)

1. Push this project to GitHub.
2. Go to Vercel dashboard.
3. Import your repo.
4. Set project root to `web`.
5. Deploy.

You will get a URL like:

- `https://your-project-name.vercel.app`

## Option B: Vercel CLII

1. Install CLI: `npm i -g vercel`
2. From `web` folder run: `vercel`
3. Follow prompts and deploy.

---

## 2) Environment Variables You Must Set in Vercel

Open:

- Vercel Project → Settings → Environment Variables

Add these variables:

### Required for telephony + TTS

- `APP_BASE_URL`
  - Value: your Vercel URL
  - Example: `https://your-project-name.vercel.app`
  - Source: Vercel deployment URL (Project → Domains)

- `SARVAM_API_KEY`
  - Value: your Sarvam API subscription key/token
  - Source: Sarvam dashboard/account API key page

- `SARVAM_API_BASE_URL`
  - Value: `https://api.sarvam.ai`
  - Source: Sarvam API docs

- `SARVAM_TTS_ENDPOINT`
  - Value: `/text-to-speech`
  - Source: Sarvam TTS API docs endpoint path

- `SARVAM_TTS_MODEL`
  - Value: `bulbul:v3`
  - Source: Sarvam model naming/docs

### Required for Tier-1 KB RAG

- `RUNTIME_DEFAULT_KB_ID`
  - Value: the `knowledgeBaseId` shown after onboarding completion
  - Source: your onboarding success screen in app

- `KB_DATA_DIR`
  - Optional in Vercel (leave empty for default)
  - Note: For production scale you should move KB storage to S3/Blob; local filesystem in serverless is not durable.

### Recommended runtime context defaults

- `RUNTIME_BUSINESS_NAME`
  - Value: your business display name
- `RUNTIME_OPENING_HOURS`
  - Value: e.g. `9 AM - 10 PM`
- `RUNTIME_BUSINESS_ADDRESS`
  - Value: e.g. `Ahmedabad`
- `RUNTIME_DEFAULT_ORDERS`
  - Value format: `123:out for delivery:today evening;456:processing:tomorrow`

### Twilio settings (for webhook/security or future API actions)

- `TWILIO_ACCOUNT_SID`
  - Source: Twilio Console Dashboard
- `TWILIO_AUTH_TOKEN`
  - Source: Twilio Console Dashboard
- `TWILIO_PHONE_NUMBER`
  - Source: Twilio Active Numbers list

### Existing app settings (if you use them)

- `DATABASE_URL`
  - Source: your database provider (Neon/Supabase/RDS etc.)
- `AI_PROVIDER_MODE`
  - Value: `external_free` (or `self_hosted` later)
- `OPENROUTER_API_KEY`, `EXTERNAL_FREE_MODEL`
  - Source: OpenRouter dashboard (if using free LLM routing)

---

## 3) Twilio Webhook URL Setup

In Twilio Active Numbers configuration, under Voice Configuration, set the webhook URL for "A Call Comes In" to:

- `POST https://your-project-name.vercel.app/api/telephony/twilio/voice`

The app will then route to:

- `/api/telephony/twilio/gather`
- `/api/telephony/twilio/sarvam-tts`

No ngrok required once this is on Vercel.

---

## 4) Important Production Note

Current Tier-1 KB ingestion stores uploaded files/chunks on local filesystem under app data directory. On Vercel serverless, filesystem is ephemeral and not persistent across invocations.

For reliable production behavior, migrate KB storage to:

- S3 (AWS) + index metadata in DB (recommended), or
- PostgreSQL for chunks + object storage for raw files.

---

## 5) Post-deploy smoke test

1. Open:

- `https://your-project-name.vercel.app/api/telephony/twilio/voice` (POST expected by Twilio)

2. In app, complete onboarding and copy `knowledgeBaseId`.

3. Set `RUNTIME_DEFAULT_KB_ID` in Vercel env and redeploy.

4. Call Twilio number and ask KB questions.
