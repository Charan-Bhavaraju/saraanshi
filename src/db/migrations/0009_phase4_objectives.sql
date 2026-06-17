-- Phase 4: Objective-mapped findings (Layer 1b)
-- Extracts facilitators and barriers per study objective from each interview.

CREATE TABLE IF NOT EXISTS objective_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
  objective TEXT NOT NULL,
  category TEXT NOT NULL,
  label TEXT NOT NULL,
  excerpt TEXT,
  rationale TEXT,
  timestamps JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_objective_findings_interview ON objective_findings(interview_id);
CREATE INDEX IF NOT EXISTS idx_objective_findings_objective ON objective_findings(objective);

CREATE TABLE IF NOT EXISTS objective_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID NOT NULL UNIQUE REFERENCES interviews(id) ON DELETE CASCADE,
  source_used TEXT NOT NULL,
  llm_model TEXT,
  cost_inr_paise INTEGER,
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── RLS — single-user app: authenticated user can manage everything ───
ALTER TABLE objective_findings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage objective_findings"
  ON objective_findings FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE objective_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage objective_runs"
  ON objective_runs FOR ALL TO authenticated USING (true) WITH CHECK (true);
