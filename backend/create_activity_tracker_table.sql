-- ============================================================
-- TGH BIMS: Activity Tracker Table
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

CREATE TABLE IF NOT EXISTS activity_tracker (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_code         TEXT NOT NULL,
  activity_code        TEXT,
  group_code           TEXT,
  site_code            TEXT,
  activity_type        TEXT,
  activity_type_full   TEXT,
  staff_responsible    TEXT,
  location_name_en     TEXT,
  location_name_ar     TEXT,
  latitude             TEXT,
  longitude            TEXT,
  training_provider    TEXT,
  mov_link             TEXT,
  number_of_attendees  INTEGER DEFAULT 0,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast project-based lookups
CREATE INDEX IF NOT EXISTS idx_activity_tracker_project_code
  ON activity_tracker (project_code);

-- Enable Row Level Security (RLS) — allow all authenticated via service key
ALTER TABLE activity_tracker ENABLE ROW LEVEL SECURITY;

-- Policy: allow all operations for authenticated requests (service role bypasses RLS anyway)
CREATE POLICY "Allow all for service role" ON activity_tracker
  FOR ALL USING (true);
