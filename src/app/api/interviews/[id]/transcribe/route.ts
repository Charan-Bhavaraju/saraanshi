import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/db'
import { interviews, transcripts, usageLog } from '@/db/schema'
import { and, eq, isNull } from 'drizzle-orm'
import { presignDownload } from '@/lib/r2'
import { getSarvamProvider } from '@/lib/transcription/sarvam'
import type { InterviewLanguage } from '@/types/database'

// Allow up to 60s — Sarvam processes 30-min audio in ~30-50s typically.
// If this times out the status stays 'transcribing' and Sravya can retry.
export const maxDuration = 60

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // Load interview
  const [interview] = await db
    .select()
    .from(interviews)
    .where(and(eq(interviews.id, id), isNull(interviews.deletedAt)))
    .limit(1)

  if (!interview) return NextResponse.json({ error: 'Interview not found' }, { status: 404 })
  if (!interview.audioR2Key) return NextResponse.json({ error: 'No audio uploaded yet' }, { status: 400 })

  if (interview.status === 'transcribed') {
    return NextResponse.json({ message: 'Already transcribed' })
  }

  // Idempotency: if already transcribing but no transcript yet, allow retry
  // Check if there's a recent usage_log entry with a requestId (means job was submitted)
  // For simplicity: just allow re-submission — duplicates are blocked by DB unique index on request_id

  // Mark as transcribing
  await db
    .update(interviews)
    .set({ status: 'transcribing' })
    .where(eq(interviews.id, id))

  try {
    // Generate a 2-hour presigned GET URL — long enough for Sarvam to fetch and process
    const audioUrl = await presignDownload(interview.audioR2Key, 7200)

    const provider = getSarvamProvider()
    const result = await provider.transcribe({
      audioUrl,
      language: (interview.language ?? 'mixed') as InterviewLanguage,
      // Set true in production once Sarvam zero-retention is confirmed on your account
      zeroRetention: false,
    })

    // Deactivate any existing current transcript
    await db
      .update(transcripts)
      .set({ isCurrent: false })
      .where(eq(transcripts.interviewId, id))

    // Insert new transcript
    await db.insert(transcripts).values({
      interviewId: id,
      version: 1,
      isCurrent: true,
      language: (interview.language ?? 'mixed') as InterviewLanguage,
      segments: result.segments,
      fullText: result.fullText,
      wordCount: result.wordCount,
      rawProviderResponse: result.rawResponse as Record<string, unknown>,
    })

    // Update interview: status + duration if we got it from the transcript
    await db
      .update(interviews)
      .set({
        status: 'transcribed',
        durationSeconds: result.durationSeconds > 0
          ? Math.ceil(result.durationSeconds)
          : interview.durationSeconds,
      })
      .where(eq(interviews.id, id))

    // Log cost for Sravya's usage tracking
    // Guard against duplicate request_id with ON CONFLICT DO NOTHING via the unique index
    try {
      await db.insert(usageLog).values({
        interviewId: id,
        provider: provider.name,
        operation: 'transcription',
        audioSeconds: Math.ceil(result.durationSeconds),
        costInrPaise: result.estimatedCostInrPaise,
        requestId: result.requestId,
      })
    } catch {
      // Duplicate requestId — idempotent, ignore
    }

    return NextResponse.json({ status: 'transcribed', wordCount: result.wordCount })
  } catch (err) {
    // Revert status to 'uploaded' so Sravya can retry
    await db
      .update(interviews)
      .set({ status: 'uploaded' })
      .where(eq(interviews.id, id))

    const message = err instanceof Error ? err.message : 'Transcription failed'
    console.error('[transcribe]', id, message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
