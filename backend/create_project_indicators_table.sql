-- ============================================================
-- TGH BIMS: Project Indicators Table
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

CREATE TABLE IF NOT EXISTS project_indicators (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_code          TEXT NOT NULL,
  indicator_description TEXT NOT NULL,
  target_value          INTEGER DEFAULT 0,
  achieved_target       INTEGER DEFAULT 0,
  bnf_type              TEXT,
  num_men               INTEGER DEFAULT 0,
  num_women             INTEGER DEFAULT 0,
  total_beneficiaries   INTEGER DEFAULT 0,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast project-based lookups
CREATE INDEX IF NOT EXISTS idx_project_indicators_project_code
  ON project_indicators (project_code);

-- Enable Row Level Security (RLS) — allow all authenticated via service key
ALTER TABLE project_indicators ENABLE ROW LEVEL SECURITY;

-- Policy: allow all operations for authenticated requests (service role bypasses RLS anyway)
CREATE POLICY "Allow all for service role" ON project_indicators
  FOR ALL USING (true);
