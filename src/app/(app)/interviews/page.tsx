export const dynamic = 'force-dynamic'

import { db } from '@/db'
import { interviews, contacts } from '@/db/schema'
import { isNull, desc, inArray } from 'drizzle-orm'
import Link from 'next/link'
import type { InterviewWithContact } from '@/types/database'
import InterviewListClient from './_components/InterviewListClient'
import BulkExportButton from './_components/BulkExportButton'

// Bust immediately via revalidatePath('/interviews') in server actions; 30s TTL as safety-net
export const revalidate = 30

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

export default async function InterviewsPage() {
  const allInterviews = await getInterviews().catch(() => [] as Awaited<ReturnType<typeof getInterviews>>)

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
        <div className="flex items-center gap-2">
          {stats.transcribed > 0 && (
            <BulkExportButton hasAnyTranslation={stats.transcribed > 0} />
          )}
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
      </div>

      {allInterviews.length === 0 ? (
        <EmptyState />
      ) : (
        <InterviewListClient interviews={allInterviews} />
      )}
    </div>
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
