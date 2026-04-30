-- ─────────────────────────────────────────────────────────────────────────────
-- Saaranshi — initial schema migration
-- Run this in the Supabase SQL editor (Project → SQL Editor → New query)
-- pgsodium encryption is in 0001_pgsodium_tce.sql — run that separately later
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Enums ─────────────────────────────────────────────────────────────────────

CREATE TYPE contact_type AS ENUM (
  'hospital', 'doctor', 'receptionist', 'patient', 'other'
);

CREATE TYPE contact_status AS ENUM (
  'lead', 'contacted', 'interested', 'scheduled',
  'interviewed', 'declined', 'done'
);

CREATE TYPE consent_status AS ENUM (
  'not_yet', 'verbal', 'written', 'withdrawn'
);

CREATE TYPE task_status AS ENUM (
  'todo', 'done', 'snoozed', 'cancelled'
);

-- ── contacts ──────────────────────────────────────────────────────────────────

CREATE TABLE contacts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type            contact_type NOT NULL DEFAULT 'other',
  display_name    text NOT NULL,
  real_name       text,          -- plaintext until 0001_pgsodium_tce.sql is run
  organization    text,
  role            text,
  phone           text,
  email           text,
  whatsapp        text,
  location        text,
  status          contact_status NOT NULL DEFAULT 'lead',
  parent_id       uuid REFERENCES contacts(id),
  notes           text,
  tags            text[],
  consent_status  consent_status NOT NULL DEFAULT 'not_yet',
  last_contact_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

CREATE INDEX contacts_status_idx ON contacts(status) WHERE deleted_at IS NULL;
CREATE INDEX contacts_type_idx   ON contacts(type)   WHERE deleted_at IS NULL;
CREATE INDEX contacts_parent_idx ON contacts(parent_id);

-- ── tasks ─────────────────────────────────────────────────────────────────────

CREATE TABLE tasks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL,
  description  text,
  contact_id   uuid REFERENCES contacts(id),
  location     text,
  due_at       timestamptz,
  remind_at    timestamptz,
  reminded_at  timestamptz,
  status       task_status NOT NULL DEFAULT 'todo',
  priority     smallint NOT NULL DEFAULT 0,
  recurrence   text,
  completed_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz
);

CREATE INDEX tasks_status_idx  ON tasks(status)  WHERE deleted_at IS NULL;
CREATE INDEX tasks_due_idx     ON tasks(due_at)  WHERE deleted_at IS NULL AND status = 'todo';
CREATE INDEX tasks_contact_idx ON tasks(contact_id);

-- ── Row Level Security ────────────────────────────────────────────────────────
-- Single-tenant: one authenticated user owns all data.

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated full access to contacts"
  ON contacts FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "authenticated full access to tasks"
  ON tasks FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
