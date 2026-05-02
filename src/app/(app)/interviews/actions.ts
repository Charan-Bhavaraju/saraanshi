'use server'

import { db } from '@/db'
import { interviews, transcripts } from '@/db/schema'
import { InterviewCreateSchema, InterviewUpdateSchema, InterviewAudioSchema } from '@/lib/validations/interview'
import { eq, isNull, and } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

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
      status: 'draft',
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

  await db
    .update(interviews)
    .set({
      audioR2Key: parsed.audioR2Key,
      audioSizeBytes: parsed.audioSizeBytes,
      durationSeconds: parsed.durationSeconds ?? null,
      status: 'uploaded',
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
export async function suggestParticipantCode(type: 'patient' | 'doctor' | 'other'): Promise<string> {
  const prefix = type === 'patient' ? 'P' : type === 'doctor' ? 'D' : 'X'

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
