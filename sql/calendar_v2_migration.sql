-- ============================================
-- CALENDAR V2 MIGRATION
-- Features: Cancel Events, TyS button, Smart Messaging Roles
-- Date: 2026-03-19
-- ============================================

-- 1. Add status column to calendar_events (active/cancelled)
ALTER TABLE calendar_events 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'cancelled'));

-- 2. Add requires_tys column (like requires_coffee)
ALTER TABLE calendar_events 
ADD COLUMN IF NOT EXISTS requires_tys BOOLEAN DEFAULT false;

-- 3. Add role column to notification_contacts
ALTER TABLE notification_contacts 
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'general' CHECK (role IN ('general', 'cocina', 'tys'));

-- 4. Update existing contacts to have 'general' role
UPDATE notification_contacts SET role = 'general' WHERE role IS NULL;

-- 5. Index for faster filtering by status
CREATE INDEX IF NOT EXISTS idx_calendar_events_status ON calendar_events(status);

-- 6. Index for notification contacts by role
CREATE INDEX IF NOT EXISTS idx_notification_contacts_role ON notification_contacts(role);
