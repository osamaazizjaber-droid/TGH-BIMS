-- ============================================================
-- TGH BIMS: Update Project Indicators Table
-- Execute this single SQL line in your Supabase SQL Editor:
-- ============================================================

ALTER TABLE project_indicators ADD COLUMN IF NOT EXISTS activity_type TEXT;
