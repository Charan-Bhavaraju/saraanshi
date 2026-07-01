import { createHash } from 'node:crypto'
import { db } from '@/db'
import { interviews, transcripts, transcriptChunks } from '@/db/schema'
import { and, eq, isNull, inArray, count, sql } from 'drizzle-orm'
import { embedBatch } from '@/lib/ai/gemini'
import { redact } from '@/lib/ai/redaction'
import { buildContactRedactionEntries } from '@/lib/ai/redaction-db'
import { chunkSegments } from '@/lib/ai/chunking'
import type { TranscriptSegment, TranslationSegment } from '@/types/database'

const INDEXABLE = ['reviewed', 'analyzed'] as const

// Hash of the cleaned (non-hidden) segment texts — change-detection for re-index.
function sourceHash(segments: TranscriptSegment[], translationMap: Map<number, string>): string {
  const basis = segments
    .filter(s => !s.hidden)
    .map((s, i) => translationMap.get(i) ?? s.text)
    .join('')
  return createHash('sha256').update(basis).digest('hex')
}

export type IndexResult = { interviewId: string; chunks: number; skipped: boolean }

// Chunk → redact → embed → store. Idempotent: skips when the segment content
// hasn't changed since the last run (unless force). Redacts before embedding AND
// storing, so the stored chunk text (used later in RAG prompts) carries no PII.
export async function indexInterview(
  interviewId: string,
  opts: { force?: boolean } = {},
): Promise<IndexResult> {
  const [interview] = await db
    .select({
      id: interviews.id,
      contactId: interviews.contactId,
      participantCode: interviews.participantCode,
      status: interviews.status,
      chunkSourceHash: interviews.chunkSourceHash,
    })
    .from(interviews)
    .where(and(eq(interviews.id, interviewId), isNull(interviews.deletedAt)))
    .limit(1)

  if (!interview || !INDEXABLE.includes(interview.status as (typeof INDEXABLE)[number])) {
    return { interviewId, chunks: 0, skipped: true }
  }

  const [transcript] = await db
    .select({ segments: transcripts.segments, translationSegments: transcripts.translationSegments })
    .from(transcripts)
    .where(and(eq(transcripts.interviewId, interviewId), eq(transcripts.isCurrent, true)))
    .limit(1)

  const segments = (transcript?.segments as TranscriptSegment[] | null) ?? []
  if (segments.length === 0) return { interviewId, chunks: 0, skipped: true }

  // Build a lookup from segment index → English translation text.
  const translationMap = new Map<number, string>()
  const translationSegs = (transcript?.translationSegments as TranslationSegment[] | null) ?? []
  for (const ts of translationSegs) {
    if (ts.enText?.trim()) translationMap.set(ts.segmentIdx, ts.enText)
  }

  const hash = sourceHash(segments, translationMap)
  if (!opts.force && hash === interview.chunkSourceHash) {
    return { interviewId, chunks: 0, skipped: true }
  }

  const entries = await buildContactRedactionEntries(interview.contactId, interview.participantCode)
  // Prefer English translation per-segment; fall back to cleaned transcript text.
  const redactedSegments = segments
    .filter(s => !s.hidden && s.text?.trim())
    .map((s, i) => {
      const sourceText = translationMap.get(i) ?? s.text
      return { start: s.start, end: s.end, text: redact(sourceText, entries).text }
    })

  const chunks = chunkSegments(redactedSegments)

  // Replace any existing chunks for this interview.
  await db.delete(transcriptChunks).where(eq(transcriptChunks.interviewId, interviewId))

  if (chunks.length > 0) {
    const embeddings = await embedBatch(chunks.map(c => c.content), 'RETRIEVAL_DOCUMENT')
    await db.insert(transcriptChunks).values(
      chunks.map((c, i) => ({
        interviewId,
        chunkIdx: c.chunkIdx,
        content: c.content,
        startSeconds: String(c.startSeconds),
        endSeconds: String(c.endSeconds),
        embedding: embeddings[i],
      })),
    )
  }

  await db
    .update(interviews)
    .set({ chunkSourceHash: hash, lastChunkedAt: new Date() })
    .where(eq(interviews.id, interviewId))

  return { interviewId, chunks: chunks.length, skipped: false }
}

// Index every reviewed/analyzed interview that is new or stale.
export async function indexAllReviewed(): Promise<{ indexedInterviews: number; totalChunks: number }> {
  const reviewed = await db
    .select({ id: interviews.id })
    .from(interviews)
    .where(and(inArray(interviews.status, [...INDEXABLE]), isNull(interviews.deletedAt)))

  let indexedInterviews = 0
  let totalChunks = 0
  for (const iv of reviewed) {
    const r = await indexInterview(iv.id)
    if (!r.skipped) {
      indexedInterviews++
      totalChunks += r.chunks
    }
  }
  return { indexedInterviews, totalChunks }
}

export type IndexStatus = {
  reviewedInterviews: number
  indexedInterviews: number
  totalChunks: number
  stale: boolean
}

export async function getIndexStatus(): Promise<IndexStatus> {
  const [reviewedRow] = await db
    .select({ n: count() })
    .from(interviews)
    .where(and(inArray(interviews.status, [...INDEXABLE]), isNull(interviews.deletedAt)))

  const [chunkRow] = await db.select({ n: count() }).from(transcriptChunks)

  const indexedRows = await db
    .selectDistinct({ id: transcriptChunks.interviewId })
    .from(transcriptChunks)

  // Stale if some reviewed interviews have no chunks, or have a changed hash.
  const [staleRow] = await db
    .select({ n: count() })
    .from(interviews)
    .where(
      and(
        inArray(interviews.status, [...INDEXABLE]),
        isNull(interviews.deletedAt),
        isNull(interviews.chunkSourceHash),
      ),
    )

  const reviewedInterviews = reviewedRow?.n ?? 0
  return {
    reviewedInterviews,
    indexedInterviews: indexedRows.length,
    totalChunks: chunkRow?.n ?? 0,
    stale: (staleRow?.n ?? 0) > 0,
  }
}

// Retrieve the top-K chunks for a query embedding (cosine distance via pgvector).
export type RetrievedChunk = {
  chunkId: string
  interviewId: string
  participantCode: string | null
  startSeconds: number
  content: string
}

export async function retrieveChunks(queryLiteral: string, k = 20): Promise<RetrievedChunk[]> {
  const rows = (await db.execute(sql`
    SELECT tc.id, tc.content, tc.start_seconds, tc.interview_id, i.participant_code
    FROM transcript_chunks tc
    JOIN interviews i ON i.id = tc.interview_id
    WHERE i.deleted_at IS NULL
    ORDER BY tc.embedding <=> ${queryLiteral}::vector
    LIMIT ${k}
  `)) as unknown as Array<{
    id: string
    content: string
    start_seconds: string | number | null
    interview_id: string
    participant_code: string | null
  }>

  return rows.map(r => ({
    chunkId: r.id,
    interviewId: r.interview_id,
    participantCode: r.participant_code,
    startSeconds: Number(r.start_seconds) || 0,
    content: r.content,
  }))
}
