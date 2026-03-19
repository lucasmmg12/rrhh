-- ============================================
-- CALENDAR V2.1 — Audit Log Table
-- Registra quién hizo qué en cada evento
-- Date: 2026-03-19
-- ============================================

CREATE TABLE IF NOT EXISTS calendar_event_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES calendar_events(id) ON DELETE SET NULL,
  action TEXT NOT NULL, -- 'created', 'updated', 'cancelled', 'deleted'
  user_email TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookups by event
CREATE INDEX IF NOT EXISTS idx_event_logs_event_id ON calendar_event_logs(event_id);
-- Index for lookups by user
CREATE INDEX IF NOT EXISTS idx_event_logs_user_email ON calendar_event_logs(user_email);
-- Index for chronological queries
CREATE INDEX IF NOT EXISTS idx_event_logs_created_at ON calendar_event_logs(created_at DESC);

-- Also add created_by and cancelled_by to the events table for quick reference
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS cancelled_by TEXT;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
