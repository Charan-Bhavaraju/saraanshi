-- Migration 0008: Phase 4 — AI-assisted qualitative analysis
-- Run in the Supabase SQL editor before deploying Phase 4 code.
-- Adds pgvector, the three-layer analysis tables, and extends usage_log.

-- ─── 0. Extension ───
CREATE EXTENSION IF NOT EXISTS vector;

-- ─── 1. Extend usage_log (do NOT recreate — it already exists from Phase 2) ───
-- Phase 2/3 already use: provider, operation (text), audio_seconds, cost_inr_paise, request_id.
-- Phase 4 adds token accounting for Claude/Gemini calls.
ALTER TABLE usage_log ADD COLUMN IF NOT EXISTS model text;
ALTER TABLE usage_log ADD COLUMN IF NOT EXISTS input_tokens int;
ALTER TABLE usage_log ADD COLUMN IF NOT EXISTS output_tokens int;

-- ─── 2. Re-chunking trigger: hash of segment texts at last index time ───
-- Compared on each index run; re-chunk only when segment content changed.
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS chunk_source_hash text;
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS last_chunked_at timestamptz;

-- ─── 3. Layer 1 — per-interview analysis ───
CREATE TABLE IF NOT EXISTS interview_reflections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id uuid UNIQUE NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
  source_used text NOT NULL,              -- 'cleaned' | 'raw' | 'translation' | 'mixed'
  summary text,
  notable_moments jsonb,                  -- [{ seconds, reason }]
  open_questions jsonb,                   -- [string]
  user_reflection text,                   -- hers, not AI
  generated_at timestamptz DEFAULT now(),
  last_user_edit_at timestamptz,
  llm_model text,
  cost_inr_paise int
);

CREATE TABLE IF NOT EXISTS focus_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id uuid NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
  phrase text NOT NULL,
  rationale text,
  confidence text NOT NULL,               -- 'high' | 'medium' | 'low'
  timestamps jsonb,                       -- [seconds]
  embedding vector(768),
  promoted_to_theme_id uuid,              -- FK added after themes table exists (below)
  dismissed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS themes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  parent_id uuid REFERENCES themes(id),
  definition text,
  color text,
  created_by text NOT NULL DEFAULT 'user', -- 'user' | 'cluster'
  created_at timestamptz DEFAULT now()
);

ALTER TABLE focus_points
  DROP CONSTRAINT IF EXISTS focus_points_theme_fk;
ALTER TABLE focus_points
  ADD CONSTRAINT focus_points_theme_fk
  FOREIGN KEY (promoted_to_theme_id) REFERENCES themes(id);

CREATE TABLE IF NOT EXISTS theme_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_id uuid NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
  interview_id uuid NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
  focus_point_id uuid REFERENCES focus_points(id), -- set when promoted from a focus point
  segment_idx int,                                 -- nullable for manual codes
  excerpt text,
  memo text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transcript_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id uuid NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
  chunk_idx int NOT NULL,
  content text NOT NULL,
  start_seconds numeric,
  end_seconds numeric,
  embedding vector(768),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS analysis_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  scope jsonb,                            -- { interview_ids: [], theme_ids: [] }
  messages jsonb,                         -- [{ role, content, sources? }]
  created_at timestamptz DEFAULT now()
);

-- ─── 4. Layer 2 cluster cache (re-cluster only when focus-point count changes) ───
-- One row per surviving cluster from the most recent clustering run.
CREATE TABLE IF NOT EXISTS theme_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_focus_point_ids uuid[] NOT NULL,
  interview_count int NOT NULL DEFAULT 0,
  suggested_name text,
  example_phrases jsonb,                  -- [string] — a few representative phrases
  dismissed boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Single-row watermark: the open focus-point count at the last clustering run.
CREATE TABLE IF NOT EXISTS cluster_watermark (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  open_focus_point_count int NOT NULL DEFAULT 0,
  computed_at timestamptz DEFAULT now()
);

-- ─── 5. Indexes ───
-- Vector (HNSW, cosine) for similarity search & clustering.
CREATE INDEX IF NOT EXISTS focus_points_embedding_idx
  ON focus_points USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS transcript_chunks_embedding_idx
  ON transcript_chunks USING hnsw (embedding vector_cosine_ops);

-- Supporting B-tree indexes.
CREATE INDEX IF NOT EXISTS focus_points_open_idx
  ON focus_points(interview_id)
  WHERE dismissed_at IS NULL AND promoted_to_theme_id IS NULL;
CREATE INDEX IF NOT EXISTS focus_points_interview_idx ON focus_points(interview_id);
CREATE INDEX IF NOT EXISTS theme_codes_theme_idx ON theme_codes(theme_id);
CREATE INDEX IF NOT EXISTS theme_codes_interview_idx ON theme_codes(interview_id);
CREATE INDEX IF NOT EXISTS themes_parent_idx ON themes(parent_id);
CREATE INDEX IF NOT EXISTS transcript_chunks_interview_idx ON transcript_chunks(interview_id);

-- ─── 6. RLS — single-user app: authenticated user can manage everything ───
ALTER TABLE interview_reflections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage interview_reflections"
  ON interview_reflections FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE focus_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage focus_points"
  ON focus_points FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE themes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage themes"
  ON themes FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE theme_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage theme_codes"
  ON theme_codes FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE transcript_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage transcript_chunks"
  ON transcript_chunks FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE analysis_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage analysis_sessions"
  ON analysis_sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE theme_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage theme_suggestions"
  ON theme_suggestions FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE cluster_watermark ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage cluster_watermark"
  ON cluster_watermark FOR ALL TO authenticated USING (true) WITH CHECK (true);
