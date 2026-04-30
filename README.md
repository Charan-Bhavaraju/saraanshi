# Saaranshi

Research companion for Sravya's breast-cancer care pathway study at IIPHG, Hyderabad.

**Phase 1 scope:** Auth, contacts CRUD with kanban, tasks CRUD with today view, PWA shell.

---

## Quick start

```bash
pnpm install
cp .env.local.example .env.local   # fill in your values
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). The app redirects to `/login`.

---

## Environment variables

See `.env.local.example` for the full list with comments. For Phase 1 you need:

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase dashboard → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → Settings → API |
| `DATABASE_URL` | Supabase dashboard → Settings → Database → Connection string (Session mode, port 5432) |

---

## Database setup

Run `src/db/migrations/0000_initial.sql` in the **Supabase SQL editor** (Project → SQL Editor → New query).

This migration:
- Creates `contacts` and `tasks` tables with enums
- Enables Row Level Security with a simple "authenticated can do all" policy
- Sets up pgsodium Transparent Column Encryption on `contacts.real_name`

> **Note:** After running the migration, Supabase auto-creates a `decrypted_contacts` view. The app reads from this view when revealing a contact's real name (contact detail screen → "Show real name" button).

### Supabase Auth setup

1. Go to Supabase dashboard → Authentication → Providers → Email
2. Enable **Magic Link** (disable password sign-in — we don't use it)
3. Set **Site URL** to your Vercel deployment URL (or `http://localhost:3000` for dev)
4. Add `http://localhost:3000/auth/callback` to **Redirect URLs** (and your Vercel URL)

---

## Project structure

```
src/
├── app/
│   ├── (auth)/login/          # Magic-link login screen
│   ├── (app)/                 # Protected routes (requires auth)
│   │   ├── layout.tsx         # App shell: header + tab nav
│   │   ├── today/             # Dashboard: stats + task preview
│   │   ├── contacts/          # Contacts list + kanban + CRUD
│   │   └── tasks/             # Today view + sections + FAB
│   └── auth/callback/         # Supabase OAuth callback handler
├── components/
│   ├── AppHeader.tsx          # Sticky header with brand + nav + user pill
│   └── providers.tsx          # TanStack Query provider
├── db/
│   ├── schema/                # Drizzle ORM schema (contacts + tasks)
│   └── migrations/            # SQL migrations — run in Supabase SQL editor
├── lib/
│   ├── supabase/              # Browser + server Supabase clients
│   └── validations/           # Zod schemas for contacts and tasks
└── middleware.ts              # Route protection + session refresh
```

---

## Deploy to Vercel

```bash
vercel --prod
```

Set the same environment variables in Vercel dashboard → Project → Settings → Environment Variables.

After deploying:
1. Update Supabase Auth → **Site URL** to your Vercel URL
2. Add the Vercel URL + `/auth/callback` to **Redirect URLs**

---

## Install as PWA

**Android (Chrome):** Open the app → three-dot menu → "Add to Home screen"

**iPhone (Safari):** Open the app → Share button → "Add to Home Screen"

The app uses a service worker to cache the shell for offline access. Data operations require connectivity.

---

## What's in Phase 1

- Magic-link authentication (no password)
- Contacts: add/edit/archive, list view (mobile default) and kanban view (desktop default), search + filter by type
- Contact detail page with real-name reveal (encrypted at rest via pgsodium)
- Tasks: add/edit/archive, today/tomorrow/later sections, mark-done checkbox, FAB quick-add
- Today dashboard: stat cards + task preview + interview placeholder
- PWA: installable, service worker, offline shell

## What's NOT in Phase 1

- Interview recording / upload
- Transcription (Sarvam AI integration)
- Transcript editor
- Analysis workspace (Claude API)
- Push notifications / reminders
- CSV import
- Themes, markers, consent form generator

---

## Tech stack

Next.js 16 · React 19 · TypeScript 5 · Tailwind CSS v4 · Supabase (Postgres + Auth + RLS) · Drizzle ORM · pgsodium TCE · TanStack Query · Zustand · Zod · Vercel

Supabase project region: `ap-southeast-1` (Singapore)
