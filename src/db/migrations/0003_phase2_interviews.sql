-- Phase 2: Interview pipeline tables
-- Run with: DIRECT_URL=... DATABASE_URL=$DIRECT_URL npx drizzle-kit push

CREATE TYPE "public"."interview_type" AS ENUM('patient', 'doctor', 'other');
CREATE TYPE "public"."interview_language" AS ENUM('en', 'te', 'mixed');
CREATE TYPE "public"."interview_status" AS ENUM(
  'draft', 'uploading', 'uploaded', 'transcribing',
  'transcribed', 'reviewed', 'analyzed'
);

CREATE TABLE IF NOT EXISTS "interviews" (
  "id"                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "contact_id"           UUID REFERENCES "contacts"("id"),
  "type"                 "interview_type" NOT NULL DEFAULT 'other',
  "participant_code"     TEXT,
  "conducted_at"         TIMESTAMPTZ,
  "location"             TEXT,
  "language"             "interview_language" NOT NULL DEFAULT 'mixed',
  "duration_seconds"     INT,
  "audio_r2_key"         TEXT,
  "audio_size_bytes"     BIGINT,
  "status"               "interview_status" NOT NULL DEFAULT 'draft',
  "consent_recorded_at"  TIMESTAMPTZ,
  "context_notes"        TEXT,
  "metadata"             JSONB,
  "created_at"           TIMESTAMPTZ NOT NULL DEFAULT now(),
  "deleted_at"           TIMESTAMPTZ
);

CREATE UNIQUE INDEX interviews_participant_code_unique
  ON interviews (participant_code)
  WHERE participant_code IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS "transcripts" (
  "id"                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "interview_id"            UUID NOT NULL REFERENCES "interviews"("id"),
  "version"                 INT NOT NULL DEFAULT 1,
  "is_current"              BOOLEAN NOT NULL DEFAULT TRUE,
  "language"                "interview_language" NOT NULL DEFAULT 'mixed',
  "segments"                JSONB,
  "full_text"               TEXT,
  "word_count"              INT,
  "raw_provider_response"   JSONB,
  "english_translation"     TEXT,
  "created_at"              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Full-text search index on transcripts
CREATE INDEX transcripts_fts_idx
  ON transcripts USING gin (to_tsvector('english', coalesce(full_text, '')));

CREATE TABLE IF NOT EXISTS "usage_log" (
  "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "interview_id"    UUID REFERENCES "interviews"("id"),
  "provider"        TEXT NOT NULL,
  "operation"       TEXT NOT NULL,
  "audio_seconds"   INT,
  "cost_inr_paise"  INT,
  "request_id"      TEXT,
  "created_at"      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotency: prevent double-billing on retry
CREATE UNIQUE INDEX usage_log_request_id_unique
  ON usage_log (request_id)
  WHERE request_id IS NOT NULL;

-- Enable Supabase Realtime on interviews so client can subscribe to status changes
ALTER PUBLICATION supabase_realtime ADD TABLE interviews;

-- Basic RLS: authenticated users own all rows (single-user app)
ALTER TABLE interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth users full access" ON interviews
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth users full access" ON transcripts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth users full access" ON usage_log
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
