-- VoiceDesk simple schema (NO RLS version)
-- 1 user = 1 business
-- Run as one script in Supabase SQL Editor

create extension if not exists pgcrypto;

-- =========================================================
-- 1) Core business profile
-- =========================================================
create table if not exists public.business_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  business_name text not null,
  category text not null check (category in ('doctor', 'hotel', 'salon', 'other')),
  city text,
  phone text,
  timezone text not null default 'UTC',
  system_prompt text,
  plan_status text not null default 'draft'
    check (plan_status in ('draft', 'pending_payment', 'active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- 2) Structured data (services + business facts)
-- =========================================================
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid not null references public.business_profiles(id) on delete cascade,
  name text not null,
  price numeric(10,2) not null default 0,
  duration_min int not null default 30,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_facts (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid not null references public.business_profiles(id) on delete cascade,
  fact_key text not null,
  fact_value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_profile_id, fact_key)
);

-- =========================================================
-- 3) Unstructured KB (policy/faq/manual from uploaded docs)
-- =========================================================
create table if not exists public.kb_documents (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid not null references public.business_profiles(id) on delete cascade,
  title text,
  file_name text not null,
  mime_type text,
  storage_path text not null, -- e.g. user_id/uuid-file.pdf
  document_kind text not null default 'general'
    check (document_kind in ('general', 'policy', 'faq', 'manual', 'pricing')),
  status text not null default 'uploaded'
    check (status in ('uploaded', 'processing', 'ready', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.kb_chunks (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid not null references public.business_profiles(id) on delete cascade,
  document_id uuid not null references public.kb_documents(id) on delete cascade,
  chunk_index int not null,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

-- =========================================================
-- 4) Feature toggles (MCP action tools)
-- =========================================================
create table if not exists public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid not null unique references public.business_profiles(id) on delete cascade,
  book_appointment_enabled boolean not null default false,
  reschedule_enabled boolean not null default false,
  appointment_lookup_enabled boolean not null default false,
  whatsapp_enabled boolean not null default false,
  custom_flags jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- 5) Appointment slots
-- =========================================================
create table if not exists public.appointment_slots (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid not null references public.business_profiles(id) on delete cascade,
  slot_date date not null,
  slot_time time not null,
  status text not null default 'free' check (status in ('free', 'booked')),
  customer_name text,
  customer_phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_profile_id, slot_date, slot_time)
);

-- =========================================================
-- 6) Billing
-- =========================================================
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid not null references public.business_profiles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id text not null unique,
  provider text not null default 'cashfree',
  amount numeric(10,2) not null,
  currency text not null default 'INR',
  tier int not null check (tier between 1 and 4),
  status text not null default 'PENDING'
    check (status in ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED')),
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- 7) Telephony allocation (3-number pool support)
-- =========================================================
create table if not exists public.telephony_allocations (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid not null unique references public.business_profiles(id) on delete cascade,
  twilio_account_label text not null,
  phone_number text not null unique,
  status text not null default 'assigned' check (status in ('assigned', 'released')),
  allocated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Optional pool table (preload your 3 numbers)
create table if not exists public.telephony_pool (
  id uuid primary key default gen_random_uuid(),
  twilio_account_label text not null,
  phone_number text not null unique,
  is_assigned boolean not null default false,
  assigned_business_profile_id uuid references public.business_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- =========================================================
-- 8) Call logs / dashboard analytics
-- =========================================================
create table if not exists public.call_logs (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid not null references public.business_profiles(id) on delete cascade,
  call_sid text unique,
  from_number text,
  to_number text,
  duration_sec int,
  status text,
  intent_summary text,
  created_at timestamptz not null default now()
);

-- =========================================================
-- 9) Demo (anonymous) sessions
-- =========================================================
create table if not exists public.guest_sessions (
  id uuid primary key default gen_random_uuid(),
  session_token_hash text not null unique,
  sample_type text not null default 'demo-barber',
  custom_context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  migrated_to_user_id uuid references auth.users(id) on delete set null,
  migrated_to_business_profile_id uuid references public.business_profiles(id) on delete set null
);

create table if not exists public.guest_messages (
  id uuid primary key default gen_random_uuid(),
  guest_session_id uuid not null references public.guest_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  message text not null,
  intent text,
  tool_used text,
  created_at timestamptz not null default now()
);

-- =========================================================
-- 10) Optional onboarding draft
-- =========================================================
create table if not exists public.onboarding_drafts (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid not null unique references public.business_profiles(id) on delete cascade,
  current_step int not null default 0,
  draft_data jsonb not null default '{}'::jsonb,
  completed_steps jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- =========================================================
-- 11) Indexes
-- =========================================================
create index if not exists idx_services_business on public.services(business_profile_id);
create index if not exists idx_business_facts_business on public.business_facts(business_profile_id);
create index if not exists idx_kb_documents_business on public.kb_documents(business_profile_id);
create index if not exists idx_kb_documents_kind on public.kb_documents(document_kind);
create index if not exists idx_kb_chunks_business on public.kb_chunks(business_profile_id);
create index if not exists idx_kb_chunks_document on public.kb_chunks(document_id);
create index if not exists idx_slots_business_date on public.appointment_slots(business_profile_id, slot_date);
create index if not exists idx_payments_business on public.payments(business_profile_id);
create index if not exists idx_payments_user on public.payments(user_id);
create index if not exists idx_call_logs_business_created on public.call_logs(business_profile_id, created_at desc);
create index if not exists idx_guest_sessions_expires on public.guest_sessions(expires_at);
create index if not exists idx_guest_messages_session_created on public.guest_messages(guest_session_id, created_at);

-- =========================================================
-- 12) updated_at trigger
-- =========================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_business_profiles_updated_at on public.business_profiles;
create trigger trg_business_profiles_updated_at before update on public.business_profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_services_updated_at on public.services;
create trigger trg_services_updated_at before update on public.services
for each row execute function public.set_updated_at();

drop trigger if exists trg_business_facts_updated_at on public.business_facts;
create trigger trg_business_facts_updated_at before update on public.business_facts
for each row execute function public.set_updated_at();

drop trigger if exists trg_kb_documents_updated_at on public.kb_documents;
create trigger trg_kb_documents_updated_at before update on public.kb_documents
for each row execute function public.set_updated_at();

drop trigger if exists trg_feature_flags_updated_at on public.feature_flags;
create trigger trg_feature_flags_updated_at before update on public.feature_flags
for each row execute function public.set_updated_at();

drop trigger if exists trg_appointment_slots_updated_at on public.appointment_slots;
create trigger trg_appointment_slots_updated_at before update on public.appointment_slots
for each row execute function public.set_updated_at();

drop trigger if exists trg_payments_updated_at on public.payments;
create trigger trg_payments_updated_at before update on public.payments
for each row execute function public.set_updated_at();

drop trigger if exists trg_telephony_allocations_updated_at on public.telephony_allocations;
create trigger trg_telephony_allocations_updated_at before update on public.telephony_allocations
for each row execute function public.set_updated_at();

drop trigger if exists trg_onboarding_drafts_updated_at on public.onboarding_drafts;
create trigger trg_onboarding_drafts_updated_at before update on public.onboarding_drafts
for each row execute function public.set_updated_at();

-- =========================================================
-- 13) Storage bucket only (no storage RLS policies)
-- =========================================================
insert into storage.buckets (id, name, public)
values ('kb-files', 'kb-files', false)
on conflict (id) do nothing;

-- =========================================================
-- 14) Helpful view for unstructured policy content
-- =========================================================
create or replace view public.v_business_policy_chunks as
select
  d.business_profile_id,
  d.id as document_id,
  d.title,
  d.file_name,
  c.chunk_index,
  c.content,
  c.metadata,
  c.created_at
from public.kb_documents d
join public.kb_chunks c on c.document_id = d.id
where d.document_kind = 'policy';
