-- Migration 0004: pre-phase-3 cleanup
-- Run in Supabase SQL editor (or psql) before deploying the corresponding code.
--
-- IMPORTANT: Must be run in two passes because Postgres requires ALTER TYPE ... ADD VALUE
-- to be committed before the new enum value can be used in any DML statement.
--
-- PASS 1: run these two lines first, then click Run.
ALTER TYPE contact_status ADD VALUE IF NOT EXISTS 'no_reply';
ALTER TYPE interview_status ADD VALUE IF NOT EXISTS 'created';

-- PASS 2: after pass 1 succeeds, run these two lines.
-- UPDATE contacts SET status = 'no_reply' WHERE status = 'no_response';
-- UPDATE interviews SET status = 'created' WHERE status = 'draft';
