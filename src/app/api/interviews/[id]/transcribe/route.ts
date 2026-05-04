import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/db'
import { interviews } from '@/db/schema'
import { and, eq, isNull } from 'drizzle-orm'
import { presignDownload } from '@/lib/r2'
import { getSarvamProvider } from '@/lib/transcription/sarvam'

export const maxDuration = 60

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  console.log(`[transcribe] POST  interview=${id}`)

  const [interview] = await db
    .select()
    .from(interviews)
    .where(and(eq(interviews.id, id), isNull(interviews.deletedAt)))
    .limit(1)

  if (!interview) return NextResponse.json({ error: 'Interview not found' }, { status: 404 })
  if (!interview.audioR2Key) return NextResponse.json({ error: 'No audio uploaded yet' }, { status: 400 })
  if (interview.status === 'transcribed') {
    console.log(`[transcribe] Already transcribed — skipping`)
    return NextResponse.json({ message: 'Already transcribed' })
  }

  await db.update(interviews).set({ status: 'transcribing' }).where(eq(interviews.id, id))
  console.log(`[transcribe] Status → transcribing  r2_key=${interview.audioR2Key}`)

  try {
    const audioUrl = await presignDownload(interview.audioR2Key, 7200)
    const provider = getSarvamProvider()

    console.log(`[transcribe] Submitting batch job...`)
    const { jobId } = await provider.submitBatchJob(audioUrl, interview.language ?? 'mixed', id)

    await db.update(interviews).set({
      metadata: { sarvamJobId: jobId },
    }).where(eq(interviews.id, id))

    console.log(`[transcribe] Job submitted  job_id=${jobId}  poll via /transcription-status`)
    return NextResponse.json({ status: 'transcribing', jobId })
  } catch (err) {
    await db.update(interviews).set({ status: 'uploaded' }).where(eq(interviews.id, id))
    const message = err instanceof Error ? err.message : 'Failed to submit transcription job'
    console.error(`[transcribe] ERROR  interview=${id}  ${message}`)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
