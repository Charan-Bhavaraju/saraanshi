# Saaranshi — research companion for Sravya's breast-cancer study

> *Saaranshi (సారాంశం)* — Telugu/Sanskrit for "essence" or "summary." A working name; rename freely.

A field-to-thesis tool covering lead management, scheduling, multilingual interview transcription, and AI-assisted thematic analysis. Built for one researcher, one study, one academic year — not a SaaS. Every architectural choice optimizes for that.

---

## 1. Context and goals

Sravya is conducting a qualitative cross-sectional study at IIPHG on the breast-cancer patient care pathway in Hyderabad, Telangana. Population: women 30+ at any stage of the care journey, plus oncologists. Primary data: in-depth semi-structured interviews (~30 min each, 30–50 total based on saturation), recorded in **English, Telugu, or code-mixed** (Hyderabadi Telugu speakers routinely switch within a sentence). Method: verbatim transcription, translation where needed, thematic analysis.

Three things make this hard with off-the-shelf tools:

1. **Telugu transcription quality.** Whisper handles Telugu but fumbles code-mixing and Telangana dialect. Most "transcription apps" are English-only.
2. **The pipeline is messy across phases.** Recruiting, scheduling, recording, transcribing, coding, and writing each have their own tools (Excel, Google Calendar, Otter, NVivo, Word). Context lives in five places.
3. **Patient PII is everywhere.** Audio of a woman discussing her cancer diagnosis is among the most sensitive data the research can produce. The IEC will care about this; so should we.

The goal isn't to replace NVivo for serious thematic analysis — it's to remove friction from the parts that drain her time so she can spend more time *thinking* about the data.

### What "done" looks like
- She opens the app on her phone outside Apollo Hospital, taps a contact, marks the interview as completed, and uploads the audio. Done before her auto rickshaw arrives.
- A week later, she has 10 transcripts she's reviewed and corrected, with timestamped markers on the moments that mattered.
- A month later, she's chatting with an AI that has full context of all her transcripts, helping her draft the findings section of her dissertation.

---

## 2. Users and jobs

There's one user. But she has different jobs depending on where she is.

| Context | Device | Primary jobs |
|---|---|---|
| At a hospital lobby | Phone | Find the contact, log a call attempt, set a follow-up |
| In a doctor's office during interview | Phone | Audio record (or use external recorder), reference interview guide, jot timestamps |
| Sitting at home reviewing | Laptop | Upload audio, transcribe, edit transcript, mark important quotes |
| Doing analysis | Laptop | Code segments, query across interviews, draft findings |
| Late evening planning tomorrow | Phone | Check tomorrow's tasks, see who to call |

The interface needs to feel like one tool with five modes, not five tools. Mobile first for everything except the transcript editor and analysis workspace, which are unapologetically desktop.

---

## 3. Tech stack

I'm picking boring, well-known, free-tier-generous services. The unsexy answer is the right one when one person has to maintain it for 12 months.

### Frontend
- **Next.js 15** (App Router) + **TypeScript** + **Tailwind v4** + **shadcn/ui**
- **PWA** — installable on her home screen, offline shell with service worker, push notifications for reminders
- **TanStack Query** for server state, **Zustand** for transient UI state (don't reach for Redux)

Why Next.js: one codebase covers web, mobile-installable PWA, server actions, and API routes. Vercel deploy is a `git push`.

### Backend
- **Supabase** (Postgres + Auth + Row-Level Security + Realtime)

Postgres is the right database; Supabase is the right way to use Postgres without running it. RLS means even if the auth ever broke, data wouldn't leak. Built-in `pg_cron` handles reminder scheduling without a separate job runner.

### File storage
- **Cloudflare R2** for audio (S3-compatible, **no egress fees**, 10 GB free)

Supabase Storage works but charges egress. With 30–50 audio files at ~30 MB each that the transcription provider re-downloads, R2 saves real money over a year.

### Speech to text — the consequential pick
- **Sarvam AI (Saaras)** — Indian-language-first, supports Telugu + English with code-switching, speaker diarization, word-level timestamps

Why not the obvious choices:
- **Whisper API ($0.006/min)** — cheap, but Telugu accuracy on a Telangana accent is meaningfully worse, and code-switching causes hallucinated spans
- **ElevenLabs Scribe** — excellent multilingual ASR, near-human accuracy, but pricier and weaker on Indian dialects
- **Google Cloud STT** — fine, but the worst Indian-language accuracy in independent benchmarks

Sarvam was trained on Indian language data including Telugu dialects and is purpose-built for the bilingual reality of Indian conversation. For 30 interviews × 30 min each, transcription cost is in the single-digit dollars. The accuracy gain is worth it — the alternative is Sravya correcting transcripts by ear for hours.

**Fallback**: Build the transcription provider behind an interface so swapping to Whisper later costs an afternoon, not a week.

### LLM for analysis
- **Claude Sonnet 4.5** via Anthropic API for the analysis workspace

Long-context (handles full transcript corpus), good multilingual reasoning including Telugu, strong at qualitative work and academic writing. Anthropic's prompt caching feature reduces cost on repeated corpus queries dramatically.

### Hosting / deployment
- **Vercel** — Next.js native, generous free tier, automatic preview URLs
- **Supabase Free** (500 MB DB, 1 GB storage)
- **Cloudflare R2 Free** (10 GB storage, infinite egress)
- **Domain** (optional) via Cloudflare Registrar (~₹800/yr at cost)

### Tools that won't be in the build but worth naming
- **Sentry** free tier for error tracking — turn it on once, forget it
- **PostHog** free tier for usage analytics — only if you want to know what features she actually uses
- **Plausible** — not needed; this isn't a public site

---

## 4. Architecture decisions

### Single-tenant, password-protected, no multi-user
Sravya is the only user. A login screen with a strong password (or magic link) is enough. RLS is configured but trivial — there's one user. Don't build invitation flows, role permissions, or org structures.

### Server actions over REST
Next.js server actions for mutations, server components for reads. The few client-side fetches (live transcript editing, analysis chat streaming) use API routes. No separate backend service.

### Audio pipeline is async and idempotent
Upload → R2 → enqueue transcription job → poll Sarvam → write transcript to DB → notify UI via Supabase Realtime. If anything crashes mid-flight, the job retries. The user sees a status badge: `uploaded → transcribing → ready`.

### Background jobs via Supabase pg_cron + Edge Functions
For reminders ("call Dr Reddy at 3pm"): pg_cron runs every minute, finds due reminders, fires push notification. No need for a separate scheduler.

### Soft deletes only
She might "delete" a contact, change her mind a week later. Everything has `deleted_at`, hard delete is admin-only.

---

## 5. Data model

The schema below is the spine. Use Drizzle ORM or Supabase's typed client — whichever feels less like work.

```sql
-- People in the field: hospital admins, doctors, patients, gatekeepers
contacts (
  id              uuid pk,
  type            enum('hospital','doctor','receptionist','patient','other'),
  display_name    text,                    -- pseudonym for patients, real name otherwise
  real_name       text,                    -- encrypted; only stored when needed for follow-up
  organization    text,
  role            text,                    -- 'oncologist', 'head nurse', 'patient (Stage II)'
  phone           text,
  email           text,
  whatsapp        text,
  location        text,                    -- 'MNJ Cancer Hospital, Hyderabad'
  status          enum('lead','contacted','interested','scheduled',
                       'interviewed','declined','done'),
  parent_id       uuid references contacts,  -- patient -> referring doctor -> hospital
  notes           text,
  tags            text[],                  -- ['MNJ', 'Stage III', 'Telugu-speaker']
  consent_status  enum('not_yet','verbal','written','withdrawn') default 'not_yet',
  last_contact_at timestamptz,
  created_at      timestamptz default now(),
  deleted_at      timestamptz
)

-- Daily plan
tasks (
  id           uuid pk,
  title        text,
  description  text,
  contact_id   uuid references contacts,   -- 'Call Dr Reddy'
  location     text,                       -- 'Apollo Jubilee Hills'
  due_at       timestamptz,
  remind_at    timestamptz,                -- pg_cron picks these up
  reminded_at  timestamptz,
  status       enum('todo','done','snoozed','cancelled'),
  priority     smallint default 0,
  recurrence   text,                       -- iCal RRULE if needed
  completed_at timestamptz,
  created_at   timestamptz default now(),
  deleted_at   timestamptz
)

-- One row per interview session
interviews (
  id                uuid pk,
  contact_id        uuid references contacts,
  type              enum('patient','doctor'),
  participant_code  text unique,           -- 'P-007', 'D-003' — pseudonymous ID for thesis
  conducted_at      timestamptz,
  location          text,
  language          enum('en','te','mixed'),
  duration_seconds  int,
  audio_r2_key      text,                  -- 'audio/2026/04/p007-2026-04-28.m4a'
  audio_size_bytes  bigint,
  status            enum('uploading','uploaded','transcribing','transcribed',
                         'reviewed','analyzed'),
  consent_recorded_at timestamptz,
  context_notes     text,                  -- 'Husband present. Quiet voice. Cried at Q15.'
  metadata          jsonb,                 -- age, stage, treatment phase, specialty, etc.
  created_at        timestamptz default now(),
  deleted_at        timestamptz
)

-- One transcript per interview, with a version history
transcripts (
  id               uuid pk,
  interview_id     uuid references interviews,
  version          int default 1,
  is_current       boolean default true,
  language         enum('en','te','mixed'),
  segments         jsonb,                  -- [{start, end, speaker, text, edited, edited_by_human}]
  full_text        text,                   -- denormalized for full-text search
  word_count       int,
  raw_provider_response jsonb,             -- keep raw response for re-processing
  english_translation text,                -- AI-translated, human-reviewable
  created_at       timestamptz default now()
)
create index on transcripts using gin (to_tsvector('english', full_text));

-- Markers / quotes / highlights placed during review
markers (
  id           uuid pk,
  interview_id uuid references interviews,
  segment_idx  int,                        -- index into transcript.segments
  start_seconds float,
  end_seconds   float,
  excerpt       text,                      -- the highlighted text
  type          enum('quote','key_moment','question','memo','theme'),
  note          text,                      -- her thoughts in the moment
  theme_ids     uuid[],                    -- can tag with multiple themes
  created_at    timestamptz default now()
)

-- The qualitative coding scheme — themes she develops over time
themes (
  id          uuid pk,
  name        text,                        -- 'Financial barriers'
  parent_id   uuid references themes,      -- supports nested themes
  description text,                        -- definition / inclusion criteria
  color       text,
  created_at  timestamptz default now()
)

-- Saved AI analysis sessions
analysis_sessions (
  id          uuid pk,
  title       text,                        -- 'Comparing patient vs doctor on delays'
  scope       jsonb,                       -- which interviews/themes are in scope
  messages    jsonb,                       -- full chat history
  created_at  timestamptz default now()
)
```

### Encryption notes
- `contacts.real_name` is encrypted at rest using `pgsodium` with a key only the app server holds. Display always uses `display_name`. The audit log records when real names are read.
- Audio in R2 is server-side encrypted (default).
- Transcripts are not encrypted at rest (would break full-text search) — but they live in a single-tenant DB with RLS.
- All app traffic is HTTPS.

---

## 6. Feature spec

### 6.1 Contacts (lead pipeline)

The recruiting funnel is the unsung hard part of qualitative health research. She's going to talk to gatekeepers — hospital admin staff, oncologist secretaries — before she ever talks to a patient. Modeling that hierarchy explicitly saves chaos.

**Views**
- **Kanban** (default desktop): columns are statuses (`Lead → Contacted → Interested → Scheduled → Interviewed → Done`). Drag to move. Each card shows name, type pill, last-contact relative date.
- **List** (default mobile): grouped by status, sortable by last contact, filterable by type/tag.
- **Map** (optional, v2): pins on Hyderabad hospitals.

**Quick actions on a contact card**
- Tap phone → `tel:` link
- Tap WhatsApp → `wa.me/` deep link with pre-filled intro message templated from contact type
- Tap email → `mailto:` with templated intro
- "Log a call" → 1-tap creates a task entry timestamped now ("Called, no answer")

**Hierarchical relationships**
- A patient contact has a `parent_id` pointing to the referring doctor
- A doctor has `parent_id` pointing to the hospital
- The contact detail page shows: "Reached via Dr Reddy at MNJ Cancer Hospital"

**Funnel stats** (small dashboard widget)
- Total leads: 42
- In active conversation: 18
- Scheduled: 6
- Interviewed: 12 (target: 30+)
- Conversion rate: 28%

**Bulk import**
- CSV upload with column mapping. She can pull contacts from anywhere into the system in 30 seconds.

### 6.2 Tasks and reminders

Not a fancy task manager — a focused one. The tasks she'll actually create are: *call X, visit Y hospital, follow up with Z, prep questions for tomorrow's interview, transcribe interview from yesterday*.

**Today view** (the default tab on mobile)
- "What's due now" at the top
- "Later today" below
- "Tomorrow" preview at bottom

**Quick capture**
- Single text input + due date. No fields, no projects, no tags required. Adding a contact link is one tap.

**Reminders**
- Native push notifications on her installed PWA. Works even when the app isn't open. On iOS this requires the PWA to be installed to home screen — fine, expected behavior.
- pg_cron runs every minute and looks for `tasks where remind_at < now() and reminded_at is null`. Triggers Edge Function → web push.

**Location-aware** (v1.5)
- If a task has `location: 'Apollo Jubilee Hills'`, when she's near Apollo Jubilee Hills (geofence), the app reminds her of related tasks. PWA geolocation API. Optional, not P0.

**Calendar export**
- ICS feed she can subscribe to from Google Calendar. Read-only. Useful so the calendar shows her reminders alongside personal events without duplicating data entry.

### 6.3 Interview workflow + transcription engine — the heart of the app

This is where most of her time will go, so this is where the design has to be best.

#### 6.3.1 Pre-interview (mobile, "interview mode")
- One-tap starts a new `interview` record linked to a scheduled task / contact
- Shows the appropriate **interview guide** (patient or doctor variant) on screen
- Prominent **timer** (knows the consent script must come first)
- **Quick-note buttons** during interview: tap to mark a timestamp she'll want to revisit ("she got emotional", "code-switched here", "key insight"). Stores `[{ts: 12:34, label: 'emotional'}]` to attach later
- **Audio recording** built into the PWA — records on device, uploads in background. Or: she records with a separate device (Zoom H1, phone voice memo) and uploads later.

#### 6.3.2 Upload flow
- Drop file into `/interviews/[id]/upload` or pick from phone camera roll
- Direct upload to R2 with a presigned URL (no server middleman, no Vercel function timeouts)
- Progress bar with retry on flaky networks (very common in hospital wifi)
- Selectable language: `English`, `Telugu`, `Mixed (auto-detect)`
- Status flips to `transcribing`

#### 6.3.3 Transcription
- Server enqueues the file with Sarvam, requesting:
  - Speaker diarization (interviewer vs respondent)
  - Word-level timestamps
  - Code-switching detection
- Polling (or webhook if Sarvam supports it) brings the transcript back
- On completion, status flips to `transcribed` and a Realtime event pushes the editor open

#### 6.3.4 The transcript editor — what it looks like

This is the screen the mockup focuses on. Two-pane on desktop, stacked tabs on mobile.

**Left pane — audio**
- Custom waveform (using `wavesurfer.js`)
- Click anywhere on the waveform to seek
- Play / pause / 1× 1.25× 1.5× speed
- Keyboard: `Space` play/pause, `←/→` skip 5s, `Shift+←/→` skip word

**Right pane — transcript**
- Each segment is a small editable block: `[00:14] Sravya: "..."` and `[00:18] Respondent: "..."`
- Clicking a segment jumps audio to that timestamp
- The currently-playing segment is highlighted (auto-scroll follows playback, can be toggled off)
- Direct inline editing — no modal. Save-on-blur. Strikethrough shows original text on hover (provenance preserved)
- Speaker labels are editable (correct cases where diarization mislabeled)

**Markers** — the killer feature
- Select a span of text → toolbar appears → tag as `quote / key moment / theme / question`. Optionally write a memo (her thought right now)
- Hotkeys: `M` for marker, `Q` for quote, `T` to assign theme
- Marker pins appear in the waveform too, so she can see "where the action was" at a glance
- Right sidebar lists all markers in the interview, clickable, jump-to-position

**Translation pane** (Telugu interviews)
- Three-pane mode: audio | Telugu transcript | English translation
- Translation is generated by Claude with a "this is a clinical interview about breast cancer" prompt for medical-term fidelity
- Marked editable: she can correct translation, both versions are stored

**Export**
- TXT (clean, no timestamps)
- TXT with timestamps
- DOCX (formatted, anonymized — replaces real names with codes)
- SRT/VTT (if she wants to share clips with subtitles)
- "Quotes only" — just the marked-as-quote spans, suitable for findings drafts

### 6.4 Analysis workspace — AI-assisted thematic analysis

Thematic analysis the Braun & Clarke way is six phases: familiarization, generating codes, searching for themes, reviewing, defining, writing. The AI's job is to **accelerate familiarization and theme suggestion** without replacing her judgment, then to be a writing partner.

**Theme management**
- Sidebar list of themes with counts ("Financial barriers — 23 codes across 14 interviews")
- Drag-and-drop to organize hierarchies (parent themes, sub-themes)
- Click a theme → see every coded segment across every interview in chronological order

**AI interactions** (chat panel on the right)
- *"Suggest themes from interviews 1–10"* → Claude reads the transcripts in context, returns proposed themes with example excerpts. She accepts / edits / merges.
- *"Find every mention of 'family pressure' even if not coded"* → semantic search across full transcripts
- *"Compare what patients said about cost vs what doctors said about cost"* → cross-cutting analysis
- *"Draft the 'health system barriers' subsection of findings"* → produces a draft with embedded quotes (with participant codes), for her to revise
- All chats save as `analysis_sessions` so she can come back to them

**Critical guardrails on the AI**
- Always **cite the participant code and timestamp** for any quote it generates (`P-007 at 14:23`). She must be able to verify
- Never invent quotes. The system prompt forbids fabrication, and quoted text is constrained to actual transcript content
- Make it easy to disagree — every suggestion has thumbs up/down which trains nothing but signals to her she's the authority

**Writing assistant mode**
- Methods section auto-fills from interview metadata (sample size, average duration, demographics)
- References — `references` table holds her bibliography (the proposal already has 17), and Claude formats Vancouver-style citations as needed
- Word counts, section status checklist for the dissertation

### 6.5 Bonus features worth considering

#### 6.5.1 Consent form generator (recommended)
- Pulls participant info, generates the IEC-approved consent form (English + Telugu) as PDF
- E-signature via touch (or printed and signed offline)
- Stored against the interview record

#### 6.5.2 Daily research journal (recommended)
- One prompt at the end of each day: "What surprised you today?" / "What's nagging at you?"
- These reflexive memos are gold for the methods chapter and for theme refinement
- Tagged with date and any contacts/interviews involved

#### 6.5.3 Backup and export everything (highly recommended)
- One button: "Export entire research project"
- Produces a zip: contacts CSV, interviews CSV, transcripts as DOCX, audio files, themes/codes as JSON, analysis sessions as Markdown
- She runs this monthly. Insurance.

#### 6.5.4 Auto-redaction (consider for v2)
- Whenever the LLM sees transcripts, it gets a redacted version (real names → `[NAME]`, hospital names if she chooses)
- Reduces the surface area of PII flowing to third-party APIs

---

## 7. Privacy and ethics — non-negotiable

This deserves its own section because the data is health information about identifiable patients with cancer. Getting this wrong is worse than not building the tool.

### What the IEC will care about
- Where is audio stored? (R2, encrypted, server-side encryption keys managed by Cloudflare)
- Who has access? (Sravya only, password-protected, RLS enforced)
- How long is it retained? (Set a retention policy: e.g., audio deleted 6 months after thesis defense; transcripts retained anonymized for archive)
- Are third parties involved? (Sarvam AI processes audio; Anthropic processes transcripts. Both have data processing terms — check enterprise tier or zero-retention options.)
- How is consent documented? (`interviews.consent_recorded_at`, signed forms stored)
- Pseudonymization? (Yes — `participant_code` is the only ID used in analysis; `real_name` is encrypted and accessed only when needed for follow-up)

### Practical hardening
- All data at rest in encrypted databases / object storage
- HTTPS everywhere (Vercel does this automatically)
- Strong password + email magic link, optional WebAuthn / passkey
- No third-party trackers, no analytics that capture PII
- A simple **audit log** that records when transcripts and real names are accessed
- Routine `pg_dump` backups encrypted client-side and stored in her personal Google Drive (not in the same Cloudflare account)

### What to disclose in the consent form
The proposal's existing consent form covers audio recording. If you add AI-assisted transcription and analysis, the consent form should be updated to mention:
> *"Your interview audio will be processed by speech-recognition software (Sarvam AI) to produce a written transcript. The transcript may be analyzed using AI tools (Anthropic's Claude) to identify themes. Your name will not appear in transcripts or analysis."*

Sravya should run the updated consent form past her co-investigators and the IEC before fielding.

---

## 8. UX principles

A few that should guide every decision when this gets built:

1. **Phone-first for capture, laptop-first for thinking.** Don't try to make the analysis workspace work on a phone screen.
2. **One screen does one thing well.** No mega-pages. The contacts page is contacts. The transcript page is the transcript.
3. **Keystrokes for power.** Every action in the transcript editor should have a keyboard shortcut. She'll use this tool for hundreds of hours.
4. **Status is always visible.** Every async operation (upload, transcription) shows a clear status badge. Never silent failures.
5. **Make destructive actions hard.** Delete is soft. Hard delete requires confirmation typing the participant code.
6. **Prefer silence over chatter.** No congratulatory toasts after every save. No "tip of the day." She is busy.
7. **Trust the user's text.** Auto-correction stays off in transcript fields — Telugu-English code-mixed text gets mangled by autocomplete.

---

## 9. Cost breakdown

For the full study (estimated 50 interviews × 30 min average, 12 months runtime):

| Service | Tier | Estimated cost |
|---|---|---|
| Vercel | Hobby (free) | ₹0 |
| Supabase | Free | ₹0 |
| Cloudflare R2 | Free (10 GB) | ₹0 — corpus ~3 GB |
| Sarvam AI | Pay-as-you-go | ~₹500–800 total for all transcription |
| Anthropic Claude API | Pay-as-you-go | ~₹2,000–4,000 over 12 months for analysis |
| Domain (optional) | Cloudflare | ~₹800/yr |
| Sentry / PostHog | Free tier | ₹0 |
| **Total** | | **₹3,000–6,000 for the entire study** |

The single biggest cost driver is Claude analysis usage, and that's controllable — prompt caching cuts costs ~90% on repeated corpus queries.

---

## 10. Implementation roadmap

Build in vertical slices, not feature areas. Each slice should be deployable and useful on its own. Resist the temptation to "build the contacts page perfectly first."

### Phase 1 — bones (week 1–2)
- Next.js + Supabase + R2 + Vercel set up
- Auth (single user, magic link)
- Contacts CRUD with kanban view
- Tasks CRUD with today view
- PWA shell, installable

**Definition of done**: she can install on her phone, log in, add a contact, add a task. That alone replaces a page in her notebook.

### Phase 2 — interview pipeline (week 3–4)
- Interview record CRUD
- Audio upload to R2 (presigned URLs)
- Sarvam integration: enqueue, poll, save transcript
- Basic transcript viewer (read-only, with timestamps)

**Definition of done**: she can upload her first interview audio and get a transcript back.

### Phase 3 — transcript editor (week 5–6)
- Inline editing with save-on-blur
- Audio sync (click segment to seek, wavesurfer integration)
- Markers and memos
- Export to TXT/DOCX

**Definition of done**: she can review and clean up a transcript end-to-end without leaving the app.

### Phase 4 — analysis workspace (week 7–9)
- Themes CRUD
- Coding segments to themes
- Claude API integration with the corpus
- Chat-based theme suggestion and cross-interview queries
- Saved analysis sessions

**Definition of done**: she can ask "what do patients say about financial barriers" and get a real answer with verifiable citations.

### Phase 5 — polish + privacy (week 10)
- Audit logging
- Consent form generator
- Full export bundle
- Reminder push notifications
- Daily journal prompt

**Definition of done**: ready to put in front of the IEC if asked.

### Phase 6 — what you discover she needs (week 11–12 + ongoing)
She will use phases 1–4 and tell you what's missing. That feedback is more valuable than any feature you can pre-design. Leave room.

---

## 11. What I'd cut from v1

- Map view for contacts (cute, not essential)
- Recurring tasks (she has a finite-duration project)
- Multi-user / collaboration (this is single-user)
- Custom theme colors (use a default palette, move on)
- Real-time collaboration on transcripts (no one to collaborate with)
- Mobile transcript editor (desktop only is correct)
- Offline-first analysis (online-only is fine for analysis sessions)

---

## 12. Open questions to resolve before coding

1. Will she record audio inside the PWA, or with an external recorder she uploads later? (Affects mobile recording UX priority — I'd default to "external recorder" and add in-app recording in v2.)
2. Sarvam AI's Telugu accuracy — has she tested it on a sample of her interview style? (Worth a 30-second proof-of-concept transcription before committing.)
3. IEC has approved AI use of audio? (Likely needs explicit mention in the consent form. Confirm before fielding.)
4. What's her actual mobile device? (Affects PWA testing — iPhone with Safari is more constrained than Android with Chrome.)
5. Hospital wifi reliability — should the upload retry policy be aggressive? (Probably yes. Multi-day retries.)

---

*This document is a starting blueprint, not a contract. Build phase 1, learn what's wrong, adjust. The job is to help Sravya finish her dissertation, not to ship a product.*
