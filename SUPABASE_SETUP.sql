-- BRGY. TANOD S.O.S. - SUPABASE TACTICAL LINK SETUP
-- Run this in your Supabase SQL Editor to enable Real-time and fix "Tactical Link Errors"

-- 0. Enable extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================
-- 1. TABLES
-- =========================

CREATE TABLE IF NOT EXISTS public.report_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id TEXT,
    type TEXT,
    status TEXT,
    tanod_assigned TEXT,
    location_lat DOUBLE PRECISION,
    location_lng DOUBLE PRECISION,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    uid TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tanods (
    id TEXT PRIMARY KEY, -- Auth UID
    name TEXT,
    location_lat DOUBLE PRECISION,
    location_lng DOUBLE PRECISION,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    status TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.residents (
    id TEXT PRIMARY KEY,
    name TEXT,
    age INT,
    gender TEXT,
    mobile TEXT,
    address TEXT,
    house_number TEXT,
    street TEXT,
    location_lat DOUBLE PRECISION,
    location_lng DOUBLE PRECISION,
    status TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================
-- 2. REALTIME CONFIG (CRITICAL)
-- =========================

-- Enable REPLICA IDENTITY to send full data on updates
ALTER TABLE public.report_logs REPLICA IDENTITY FULL;
ALTER TABLE public.tanods REPLICA IDENTITY FULL;
ALTER TABLE public.residents REPLICA IDENTITY FULL;

-- Ensure Publication Membership
DO $$ 
BEGIN
    -- Create publication if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;

    -- Add tables if not already members
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'report_logs') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.report_logs;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'tanods') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.tanods;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'residents') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.residents;
    END IF;
END $$;

-- =========================
-- 3. RLS (ROW LEVEL SECURITY)
-- =========================

ALTER TABLE public.report_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tanods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.residents ENABLE ROW LEVEL SECURITY;

-- Drop safely
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public access to report_logs') THEN
        DROP POLICY "Public access to report_logs" ON public.report_logs;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public access to tanods') THEN
        DROP POLICY "Public access to tanods" ON public.tanods;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public access to residents') THEN
        DROP POLICY "Public access to residents" ON public.residents;
    END IF;
END $$;

-- Recreate policies (ALLOW ALL for demo environment)
CREATE POLICY "Public access to report_logs" ON public.report_logs FOR ALL USING (true);
CREATE POLICY "Public access to tanods" ON public.tanods FOR ALL USING (true);
CREATE POLICY "Public access to residents" ON public.residents FOR ALL USING (true);
