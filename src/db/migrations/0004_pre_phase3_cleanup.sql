-- Migration 0004: pre-phase-3 cleanup
-- Run in Supabase SQL editor (or psql) before deploying the corresponding code.

-- 1. Add 'no_reply' to contact_status enum
--    (no_response stays for backward-compat; existing rows keep their value)
ALTER TYPE contact_status ADD VALUE IF NOT EXISTS 'no_reply';

-- 2. Migrate existing no_response contacts to no_reply
UPDATE contacts SET status = 'no_reply' WHERE status = 'no_response';

-- 3. Add 'created' to interview_status enum
ALTER TYPE interview_status ADD VALUE IF NOT EXISTS 'created';

-- 4. Migrate existing draft interviews to created
UPDATE interviews SET status = 'created' WHERE status = 'draft';
