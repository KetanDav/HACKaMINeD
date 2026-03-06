-- FraudScan Database Schema
-- Run this in Supabase SQL Editor

-- Sessions table (anonymous users)
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  converted_to_user UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  plan_type TEXT NOT NULL DEFAULT 'free' CHECK (plan_type IN ('free', 'starter', 'pro')),
  scans_used INTEGER NOT NULL DEFAULT 0,
  scans_limit INTEGER NOT NULL DEFAULT 3,
  razorpay_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scans table
CREATE TABLE IF NOT EXISTS scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  session_token TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'complete', 'failed')),
  file_path TEXT,
  file_type TEXT,
  original_filename TEXT,
  document_type TEXT,
  trust_score INTEGER CHECK (trust_score BETWEEN 0 AND 100),
  severity TEXT CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  flags_json TEXT,  -- JSON array of FraudFlag objects
  recommendation TEXT,
  summary TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  razorpay_order_id TEXT UNIQUE,
  razorpay_payment_id TEXT,
  plan TEXT NOT NULL CHECK (plan IN ('starter', 'pro')),
  amount INTEGER NOT NULL, -- in paise
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'captured', 'failed', 'refunded')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_scans_user_id ON scans(user_id);
CREATE INDEX IF NOT EXISTS idx_scans_session_token ON scans(session_token);
CREATE INDEX IF NOT EXISTS idx_scans_created_at ON scans(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token);

-- Function to increment scan count atomically
CREATE OR REPLACE FUNCTION increment_scan_count(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE users SET scans_used = scans_used + 1, updated_at = NOW()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Supabase Storage bucket for documents
-- Run in Supabase Dashboard > Storage > Create bucket named "documents" (private)

-- Row Level Security (basic - service key bypasses)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (used by backend)
CREATE POLICY "service_role_all" ON users FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON scans FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON payments FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON sessions FOR ALL TO service_role USING (true);
