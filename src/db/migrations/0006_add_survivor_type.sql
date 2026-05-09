-- Migration 0006: Add 'survivor' to contact_type and interview_type enums
-- Run in Supabase SQL editor before deploying.

ALTER TYPE contact_type ADD VALUE IF NOT EXISTS 'survivor';
ALTER TYPE interview_type ADD VALUE IF NOT EXISTS 'survivor';
