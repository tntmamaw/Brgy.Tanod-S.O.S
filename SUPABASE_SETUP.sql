-- BRGY. TANOD S.O.S. - SUPABASE TACTICAL LINK SETUP
-- Run this in your Supabase SQL Editor to enable Real-time and fix "Tactical Link Errors"

-- 1. Ensure report_logs table
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

-- 2. Ensure tanods table
CREATE TABLE IF NOT EXISTS public.tanods (
    id TEXT PRIMARY KEY, -- Using Auth UID as ID
    name TEXT,
    location_lat DOUBLE PRECISION,
    location_lng DOUBLE PRECISION,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    status TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Ensure residents table
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

-- 4. Enable Realtime Publication (Idempotent)
-- Checks if publication exists, then adds tables only if they aren't members
DO $$
BEGIN
    -- Ensure publication exists
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;

    -- Add report_logs if not already member
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'report_logs'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.report_logs;
    END IF;

    -- Add tanods if not already member
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'tanods'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.tanods;
    END IF;
END $$;

-- 5. Row Level Security Policies
-- In a production app, restrict this to authenticated users. 
-- For the AI Studio demo environment, we enable simple policies.

ALTER TABLE public.report_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tanods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.residents ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts if re-running
DROP POLICY IF EXISTS "Public access to report_logs" ON public.report_logs;
DROP POLICY IF EXISTS "Public access to tanods" ON public.tanods;
DROP POLICY IF EXISTS "Public access to residents" ON public.residents;

CREATE POLICY "Public access to report_logs" ON public.report_logs FOR ALL USING (true);
CREATE POLICY "Public access to tanods" ON public.tanods FOR ALL USING (true);
CREATE POLICY "Public access to residents" ON public.residents FOR ALL USING (true);
