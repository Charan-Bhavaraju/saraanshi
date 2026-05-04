import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/db'
import { interviews, transcripts, usageLog } from '@/db/schema'
import { and, eq, isNull, desc } from 'drizzle-orm'
import { getSarvamProvider } from '@/lib/transcription/sarvam'
import type { InterviewLanguage } from '@/types/database'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const [interview] = await db
    .select()
    .from(interviews)
    .where(and(eq(interviews.id, id), isNull(interviews.deletedAt)))
    .limit(1)

  if (!interview) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (interview.status === 'transcribed') {
    console.log(`[transcription-status] Already transcribed  interview=${id}`)
    return NextResponse.json({ jobState: 'Completed' })
  }

  if (interview.status !== 'transcribing') {
    console.log(`[transcription-status] Unexpected status=${interview.status}  interview=${id}`)
    return NextResponse.json({ jobState: interview.status })
  }

  const meta = interview.metadata as { sarvamJobId?: string } | null
  const jobId = meta?.sarvamJobId
  if (!jobId) {
    console.error(`[transcription-status] No job ID on record  interview=${id}`)
    return NextResponse.json({ error: 'No batch job ID on record' }, { status: 400 })
  }

  console.log(`[transcription-status] Polling  interview=${id}  job_id=${jobId}`)

  try {
    const provider = getSarvamProvider()
    const result = await provider.checkBatchJob(jobId)

    if (!result) {
      return NextResponse.json({ jobState: 'Running' })
    }

    console.log(`[transcription-status] Saving transcript  interview=${id}  segments=${result.segments.length}  words=${result.wordCount}  cost=₹${(result.estimatedCostInrPaise / 100).toFixed(2)}`)

    const [maxVersionRow] = await db
      .select({ version: transcripts.version })
      .from(transcripts)
      .where(eq(transcripts.interviewId, id))
      .orderBy(desc(transcripts.version))
      .limit(1)
    const nextVersion = (maxVersionRow?.version ?? 0) + 1

    await db
      .update(transcripts)
      .set({ isCurrent: false })
      .where(eq(transcripts.interviewId, id))

    await db.insert(transcripts).values({
      interviewId: id,
      version: nextVersion,
      isCurrent: true,
      language: (interview.language ?? 'mixed') as InterviewLanguage,
      segments: result.segments,
      fullText: result.fullText,
      wordCount: result.wordCount,
      rawProviderResponse: result.rawResponse,
    })

    await db.update(interviews)
      .set({
        status: 'transcribed',
        durationSeconds: result.durationSeconds > 0
          ? result.durationSeconds
          : interview.durationSeconds,
      })
      .where(eq(interviews.id, id))

    console.log(`[transcription-status] Status → transcribed  interview=${id}`)

    try {
      await db.insert(usageLog).values({
        interviewId: id,
        provider: provider.name,
        operation: 'transcription',
        audioSeconds: result.durationSeconds,
        costInrPaise: result.estimatedCostInrPaise,
        requestId: result.requestId,
      })
    } catch {
      // Duplicate requestId on retry — safe to ignore
    }

    return NextResponse.json({ jobState: 'Completed' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Job check failed'
    // Only reset to 'uploaded' on confirmed Sarvam job failure, not transient errors.
    // Transient errors (network, API down) should keep status as 'transcribing' so
    // the poller retries without the user having to re-submit (wasting credits).
    const isJobFailure = message.includes('batch job failed')
    if (isJobFailure) {
      await db.update(interviews).set({ status: 'uploaded' }).where(eq(interviews.id, id))
      console.error(`[transcription-status] Job failed — reset to uploaded  interview=${id}  ${message}`)
    } else {
      console.error(`[transcription-status] Transient error — keeping transcribing  interview=${id}  ${message}`)
    }
    return NextResponse.json(
      { error: message, jobState: isJobFailure ? 'Failed' : 'Running' },
      { status: 500 },
    )
  }
}
