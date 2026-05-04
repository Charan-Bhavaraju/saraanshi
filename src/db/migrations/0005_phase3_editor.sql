-- Migration 0005: Phase 3 transcript editor
-- Run in Supabase SQL editor before deploying Phase 3 code.

-- 1. Markers table
CREATE TABLE IF NOT EXISTS markers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id uuid NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
  transcript_id uuid REFERENCES transcripts(id),
  segment_idx int NOT NULL,
  char_start int,
  char_end int,
  start_seconds numeric,
  end_seconds numeric,
  type text NOT NULL,
  excerpt text,
  note text,
  tags text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now() NOT NULL,
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS markers_interview_idx ON markers(interview_id) WHERE deleted_at IS NULL;

-- 2. Segment-level translation column on transcripts
-- Stores [{segmentIdx, enText, confidence}]
ALTER TABLE transcripts ADD COLUMN IF NOT EXISTS translation_segments jsonb;
