'use server'

import { db } from '@/db'
import { interviews, transcripts, markers } from '@/db/schema'
import { InterviewCreateSchema, InterviewUpdateSchema, InterviewAudioSchema } from '@/lib/validations/interview'
import { eq, isNull, and, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { TranslationSegment, MarkerInsert } from '@/types/database'
import { indexInterview } from '@/lib/rag/indexing'

export async function createInterview(input: z.infer<typeof InterviewCreateSchema>) {
  const parsed = InterviewCreateSchema.parse(input)

  const [interview] = await db
    .insert(interviews)
    .values({
      contactId: parsed.contactId ?? null,
      type: parsed.type,
      participantCode: parsed.participantCode ?? null,
      conductedAt: parsed.conductedAt ? new Date(parsed.conductedAt) : null,
      location: parsed.location ?? null,
      language: parsed.language,
      contextNotes: parsed.contextNotes ?? null,
      consentRecordedAt: parsed.consentRecordedAt ? new Date(parsed.consentRecordedAt) : null,
      status: 'created',
    })
    .returning()

  revalidatePath('/interviews')
  revalidatePath('/today')
  return interview
}

export async function updateInterview(input: z.infer<typeof InterviewUpdateSchema>) {
  const { id, ...data } = InterviewUpdateSchema.parse(input)

  const [interview] = await db
    .update(interviews)
    .set({
      ...data,
      conductedAt: data.conductedAt ? new Date(data.conductedAt) : undefined,
      consentRecordedAt: data.consentRecordedAt ? new Date(data.consentRecordedAt) : undefined,
    })
    .where(and(eq(interviews.id, id), isNull(interviews.deletedAt)))
    .returning()

  revalidatePath('/interviews')
  revalidatePath(`/interviews/${id}`)
  return interview
}

// Called by the client after a successful direct-to-R2 upload
export async function markAudioUploaded(input: z.infer<typeof InterviewAudioSchema>) {
  const parsed = InterviewAudioSchema.parse(input)

  // Invalidate old transcripts — they belong to the previous audio file
  await db
    .update(transcripts)
    .set({ isCurrent: false })
    .where(eq(transcripts.interviewId, parsed.id))

  // Preserve speakerMap but clear old Sarvam job ID so the poller can't resurface it
  const [row] = await db
    .select({ metadata: interviews.metadata })
    .from(interviews)
    .where(eq(interviews.id, parsed.id))
    .limit(1)
  const prev = (row?.metadata as Record<string, unknown> | null) ?? {}
  const { sarvamJobId: _dropped, ...metaWithoutJob } = prev as { sarvamJobId?: string } & Record<string, unknown>

  await db
    .update(interviews)
    .set({
      audioR2Key: parsed.audioR2Key,
      audioSizeBytes: parsed.audioSizeBytes,
      durationSeconds: parsed.durationSeconds ?? null,
      status: 'uploaded',
      metadata: metaWithoutJob,
    })
    .where(and(eq(interviews.id, parsed.id), isNull(interviews.deletedAt)))

  revalidatePath(`/interviews/${parsed.id}`)
  revalidatePath('/interviews')
}

export async function deleteInterview(id: string) {
  await db
    .update(interviews)
    .set({ deletedAt: new Date() })
    .where(eq(interviews.id, id))

  revalidatePath('/interviews')
  revalidatePath('/today')
}

// Auto-suggest next participant code based on interview type and existing count
export async function suggestParticipantCode(type: 'patient' | 'doctor' | 'survivor' | 'other'): Promise<string> {
  const prefix = type === 'patient' ? 'P' : type === 'doctor' ? 'D' : type === 'survivor' ? 'S' : 'X'

  const existing = await db
    .select({ participantCode: interviews.participantCode })
    .from(interviews)
    .where(isNull(interviews.deletedAt))

  const nums = existing
    .map(r => r.participantCode)
    .filter((c): c is string => c?.startsWith(prefix) ?? false)
    .map(c => parseInt(c.slice(prefix.length + 1), 10))
    .filter(n => !isNaN(n))

  const next = nums.length === 0 ? 1 : Math.max(...nums) + 1
  return `${prefix}-${String(next).padStart(3, '0')}`
}

// Persist speaker display names for an interview, keyed by Sarvam speaker ID.
// Merges into existing metadata so sarvamJobId is not overwritten.
export async function updateSpeakerMap(
  interviewId: string,
  speakerMap: Record<string, string>,
) {
  const [row] = await db
    .select({ metadata: interviews.metadata })
    .from(interviews)
    .where(and(eq(interviews.id, interviewId), isNull(interviews.deletedAt)))
    .limit(1)

  const existing = (row?.metadata as Record<string, unknown> | null) ?? {}
  await db
    .update(interviews)
    .set({ metadata: { ...existing, speakerMap } })
    .where(and(eq(interviews.id, interviewId), isNull(interviews.deletedAt)))
}

// --- Phase 3: Marker actions ---

export async function createMarker(input: Omit<MarkerInsert, 'id' | 'createdAt' | 'deletedAt'>) {
  const [marker] = await db
    .insert(markers)
    .values(input)
    .returning()

  // No revalidatePath — client applies optimistic update immediately.
  return marker
}

export async function deleteMarker(markerId: string, interviewId: string) {
  await db
    .update(markers)
    .set({ deletedAt: new Date() })
    .where(eq(markers.id, markerId))

  // No revalidatePath — client applies optimistic update immediately.
  void interviewId
}

export async function updateMarkerNote(
  markerId: string,
  interviewId: string,
  note: string,
  tags: string[],
) {
  const [marker] = await db
    .update(markers)
    .set({ note, tags })
    .where(and(eq(markers.id, markerId), isNull(markers.deletedAt)))
    .returning()

  // No revalidatePath — client applies optimistic update immediately.
  void interviewId
  return marker
}

export async function saveSegmentEdit(
  interviewId: string,
  transcriptId: string,
  segmentIdx: number,
  text: string,
) {
  const idx = Math.floor(Number(segmentIdx))
  if (!Number.isFinite(idx) || idx < 0) return
  // Safe: idx is a non-negative integer produced by our own JS, not from user input
  const idxRaw = sql.raw(String(idx))
  const pathRaw = sql.raw(`ARRAY['${String(idx)}']`)

  // Atomic jsonb_set — no read needed, safe under concurrent rapid edits.
  // Preserves originalText on the first human edit only (same logic as the old read-modify-write).
  // No revalidatePath: page is force-dynamic so users always get fresh data on next visit,
  // and the client applies optimistic updates immediately. Removing it prevents pool exhaustion
  // when edits happen faster than the pool (max 3) can serve the triggered re-renders.
  await db.execute(sql`
    UPDATE transcripts
    SET segments = jsonb_set(
      segments,
      ${pathRaw},
      (segments->${idxRaw}) || jsonb_build_object(
        'text', ${text}::text,
        'edited', true::bool,
        'editedByHuman', true::bool,
        'originalText', CASE
          WHEN (segments->${idxRaw}->>'editedByHuman')::boolean = true
          THEN segments->${idxRaw}->>'originalText'
          ELSE segments->${idxRaw}->>'text'
        END
      ),
      false
    )
    WHERE id = ${transcriptId}
  `)
  void interviewId
}

export async function hideSegment(
  interviewId: string,
  transcriptId: string,
  segmentIdx: number,
  hidden: boolean,
) {
  // Atomic jsonb_set — no read needed, safe under concurrent rapid clicks
  await db.execute(sql`
    UPDATE transcripts
    SET segments = jsonb_set(
      segments,
      ARRAY[${segmentIdx}::text],
      (COALESCE(segments->${segmentIdx}, '{}'::jsonb)) || jsonb_build_object('hidden', ${hidden}),
      false
    )
    WHERE id = ${transcriptId}
  `)
  // No revalidatePath — optimistic UI already reflects the change
  void interviewId
}

export async function setSegmentsHiddenBulk(
  interviewId: string,
  transcriptId: string,
  indices: number[],
  hidden: boolean,
) {
  if (indices.length === 0) return
  // Safe: indices are integers generated by our own JS, not from user input
  const arrLiteral = sql.raw(`ARRAY[${indices.map(n => Math.floor(Number(n))).join(',')}]::int[]`)
  const hiddenVal = sql.raw(hidden ? 'true' : 'false')
  await db.execute(sql`
    UPDATE transcripts
    SET segments = (
      SELECT jsonb_agg(
        CASE
          WHEN (t.ordinality - 1)::int = ANY(${arrLiteral})
          THEN t.elem || jsonb_build_object('hidden', ${hiddenVal}::boolean)
          ELSE t.elem
        END
        ORDER BY t.ordinality
      )
      FROM jsonb_array_elements(segments) WITH ORDINALITY t(elem, ordinality)
    )
    WHERE id = ${transcriptId}
  `)
  void interviewId
}

export async function markReviewed(interviewId: string) {
  await db
    .update(interviews)
    .set({ status: 'reviewed' })
    .where(and(eq(interviews.id, interviewId), isNull(interviews.deletedAt)))

  // Index the transcript for RAG (Layer 3). Best-effort — a failure here (e.g.
  // missing GEMINI_API_KEY) must not block marking the interview reviewed.
  try {
    await indexInterview(interviewId)
  } catch (err) {
    console.error('[markReviewed] RAG indexing failed', err)
  }

  revalidatePath(`/interviews/${interviewId}`)
  revalidatePath('/interviews')
}

export async function saveTranslation(
  transcriptId: string,
  interviewId: string,
  segments: TranslationSegment[],
) {
  await db
    .update(transcripts)
    .set({ translationSegments: segments })
    .where(eq(transcripts.id, transcriptId))

  // No revalidatePath — client applies optimistic updates; batched writes from
  // handleTranslationEdit mean the final flush always has the complete latest state.
  void interviewId
}

// --- Transcript fetch ---

// Fetch transcript for an interview (most recent current version)
export async function getTranscript(interviewId: string) {
  const [transcript] = await db
    .select()
    .from(transcripts)
    .where(
      and(
        eq(transcripts.interviewId, interviewId),
        eq(transcripts.isCurrent, true),
      ),
    )
    .orderBy(transcripts.version)
    .limit(1)

  return transcript ?? null
}
