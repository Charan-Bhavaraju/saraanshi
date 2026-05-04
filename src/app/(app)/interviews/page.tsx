import { db } from '@/db'
import { interviews, contacts } from '@/db/schema'
import { isNull, desc, inArray } from 'drizzle-orm'
import Link from 'next/link'
import type { InterviewWithContact } from '@/types/database'

export const dynamic = 'force-dynamic'

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  draft:        { label: 'Draft',        bg: '#F5F1E9', color: '#8A929C' },
  uploading:    { label: 'Uploading',    bg: '#F5EBD3', color: '#B8842A' },
  uploaded:     { label: 'Uploaded',     bg: '#F5EBD3', color: '#B8842A' },
  transcribing: { label: 'Transcribing', bg: '#F5EBD3', color: '#B8842A' },
  transcribed:  { label: 'Transcribed',  bg: '#E2EEEC', color: '#0E5C5C' },
  reviewed:     { label: 'Reviewed',     bg: '#E0E5DA', color: '#4A5C3A' },
  analyzed:     { label: 'Analyzed',     bg: '#EFEAF8', color: '#5A3F8F' },
}

const LANG_LABELS: Record<string, string> = { en: 'English', te: 'Telugu', mixed: 'Mixed' }

async function getInterviews(): Promise<InterviewWithContact[]> {
  const rows = await db
    .select()
    .from(interviews)
    .where(isNull(interviews.deletedAt))
    .orderBy(desc(interviews.conductedAt), desc(interviews.createdAt))

  if (rows.length === 0) return []

  const contactIds = [...new Set(rows.flatMap(r => r.contactId ? [r.contactId] : []))]
  const allContacts = contactIds.length > 0
    ? await db.select({
        id: contacts.id,
        displayName: contacts.displayName,
        organization: contacts.organization,
        type: contacts.type,
      }).from(contacts).where(inArray(contacts.id, contactIds))
    : []

  const contactMap = Object.fromEntries(allContacts.map(c => [c.id, c]))

  return rows.map(r => ({
    ...r,
    contact: r.contactId ? contactMap[r.contactId] ?? null : null,
  }))
}

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return ''
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default async function InterviewsPage() {
  const allInterviews = await getInterviews()

  const stats = {
    total: allInterviews.length,
    transcribed: allInterviews.filter(i => ['transcribed', 'reviewed', 'analyzed'].includes(i.status)).length,
    inProgress: allInterviews.filter(i => ['uploading', 'uploaded', 'transcribing'].includes(i.status)).length,
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 pb-20">
      {/* Header */}
      <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
        <div>
          <h1
            className="text-4xl tracking-tight"
            style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, letterSpacing: '-0.02em' }}
          >
            Interviews
          </h1>
          <p className="mt-1.5 text-sm" style={{ color: '#8A929C' }}>
            {stats.total === 0
              ? 'No interviews yet — start with your first one'
              : `${stats.transcribed} transcribed · ${stats.inProgress > 0 ? `${stats.inProgress} in progress · ` : ''}${stats.total} total`}
          </p>
        </div>
        <Link
          href="/interviews/new"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
          style={{ background: '#0E5C5C', color: '#FFFFFF', border: '1px solid #0E5C5C' }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          New interview
        </Link>
      </div>

      {allInterviews.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col gap-2">
          {allInterviews.map(interview => (
            <InterviewRow key={interview.id} interview={interview} />
          ))}
        </div>
      )}
    </div>
  )
}

function InterviewRow({ interview }: { interview: InterviewWithContact }) {
  const cfg = STATUS_CONFIG[interview.status] ?? STATUS_CONFIG.draft

  return (
    <Link
      href={`/interviews/${interview.id}`}
      className="flex items-center gap-4 px-5 py-4 rounded-[14px] transition-all group hover:bg-[#FAFAF8]"
      style={{ border: '1px solid #ECE6D9' }}
    >
      {/* Participant code */}
      <div
        className="shrink-0 rounded-lg flex items-center justify-center"
        style={{
          background: '#E2EEEC',
          minWidth: 56,
          height: 40,
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          fontWeight: 500,
          color: '#0E5C5C',
          padding: '0 8px',
        }}
      >
        {interview.participantCode ?? '—'}
      </div>

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <p className="text-sm font-medium" style={{ color: '#1A1F2C' }}>
            {interview.contact?.displayName ?? 'Unknown participant'}
          </p>
          {interview.contact?.organization && (
            <span className="text-xs" style={{ color: '#8A929C' }}>· {interview.contact.organization}</span>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {interview.conductedAt && (
            <span className="text-xs" style={{ color: '#8A929C' }}>{formatDate(interview.conductedAt)}</span>
          )}
          <span
            className="text-xs px-1.5 py-0.5 rounded"
            style={{ background: '#F5F1E9', color: '#4A5263', fontFamily: 'var(--font-mono)', fontSize: 10 }}
          >
            {LANG_LABELS[interview.language]}
          </span>
          {interview.durationSeconds && (
            <span className="text-xs" style={{ color: '#8A929C' }}>{formatDuration(interview.durationSeconds)}</span>
          )}
          {interview.location && (
            <span className="text-xs truncate max-w-[200px]" style={{ color: '#8A929C' }}>
              {interview.location}
            </span>
          )}
        </div>
      </div>

      {/* Status badge */}
      <span
        className="shrink-0 text-xs font-medium px-2.5 py-1 rounded-full uppercase"
        style={{ background: cfg.bg, color: cfg.color, letterSpacing: '0.04em', fontSize: 10 }}
      >
        {cfg.label}
      </span>

      {/* Arrow */}
      <svg className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M5 2l5 5-5 5" stroke="#8A929C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div
        className="flex items-center justify-center rounded-full"
        style={{ width: 56, height: 56, background: '#F5F1E9' }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M12 2a2 2 0 100 4 2 2 0 000-4zM7 8h10v10a2 2 0 01-2 2H9a2 2 0 01-2-2V8z" stroke="#B5BBC4" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M9 12h6M9 15h4" stroke="#B5BBC4" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </div>
      <div className="text-center">
        <p className="text-sm font-medium mb-1" style={{ color: '#4A5263' }}>No interviews yet</p>
        <p className="text-xs leading-relaxed" style={{ color: '#8A929C' }}>
          Create your first interview record, upload audio,<br />and get a transcript back.
        </p>
      </div>
      <Link
        href="/interviews/new"
        className="mt-2 px-4 py-2 rounded-xl text-sm font-medium"
        style={{ background: '#0E5C5C', color: '#FFFFFF' }}
      >
        Create first interview
      </Link>
    </div>
  )
}
