-- Objective clusters: groups semantically similar findings across interviews
-- within a participant type (doctor/patient/survivor).

CREATE TABLE IF NOT EXISTS objective_clusters (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type        interview_type NOT NULL,             -- doctor | patient | survivor | other
  objective   text NOT NULL,                       -- objective_1 | objective_2 | objective_3
  category    text NOT NULL,                       -- facilitator | barrier
  cluster_name text NOT NULL,                      -- LLM-generated human-readable name
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_obj_clusters_type ON objective_clusters(type);
CREATE INDEX idx_obj_clusters_obj  ON objective_clusters(objective);

-- Link each finding to its cluster (nullable — unclustered until clustering runs).
ALTER TABLE objective_findings
  ADD COLUMN cluster_id uuid REFERENCES objective_clusters(id) ON DELETE SET NULL;

CREATE INDEX idx_obj_findings_cluster ON objective_findings(cluster_id);

-- Track clustering runs so we know when to re-cluster.
CREATE TABLE IF NOT EXISTS objective_cluster_runs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type           interview_type NOT NULL UNIQUE,   -- one run per participant type
  llm_model      text,
  cost_inr_paise integer,
  finding_count  integer NOT NULL DEFAULT 0,
  cluster_count  integer NOT NULL DEFAULT 0,
  generated_at   timestamptz NOT NULL DEFAULT now()
);

-- RLS (matches existing pattern)
ALTER TABLE objective_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE objective_cluster_runs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'auth_objective_clusters') THEN
    CREATE POLICY auth_objective_clusters ON objective_clusters FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'auth_objective_cluster_runs') THEN
    CREATE POLICY auth_objective_cluster_runs ON objective_cluster_runs FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
