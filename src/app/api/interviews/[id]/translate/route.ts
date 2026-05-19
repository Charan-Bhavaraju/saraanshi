import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { interviews, transcripts } from '@/db/schema'
import { and, eq, isNull } from 'drizzle-orm'
import type { TranscriptSegment, TranslationSegment } from '@/types/database'

export const maxDuration = 60

const BATCH_SIZE = 40
// Run up to 5 batches in parallel — reduces a 300-segment transcript
// from ~8 sequential calls (~56s) to 2 parallel rounds (~14s)
const CONCURRENCY = 5
const VALID_CONFIDENCE = new Set(['high', 'medium', 'low'])

async function translateBatch(
  client: { messages: { create: (opts: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }>; stop_reason: string }> } },
  batch: Array<{ idx: number; text: string }>,
): Promise<TranslationSegment[]> {
  const prompt = `Translate these Telugu-English interview segments to English for medical research. Return ONLY a JSON array — no markdown, no explanation.

Input: ${JSON.stringify(batch)}

Output format: [{"idx":0,"enText":"...","confidence":"high|medium|low"}]
Rules:
- Already-English segments: return as-is with confidence "high"
- Preserve clinical/medical terms and direct speech
- confidence: high=clear, medium=partial mix, low=unclear`

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [
      { role: 'user', content: prompt },
      { role: 'assistant', content: '[' },
    ],
  })

  if (message.stop_reason === 'max_tokens') {
    throw new Error(`Batch hit max_tokens (${batch.length} segments, first idx ${batch[0]?.idx})`)
  }

  const rawText = message.content[0]?.type === 'text' ? message.content[0].text.trim() : ''
  const raw = ('[' + rawText).replace(/```$/, '').trim()

  let parsed: Array<{ idx: unknown; enText: unknown; confidence: unknown }>
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error(`JSON parse failed for batch starting at idx ${batch[0]?.idx}: ${raw.slice(0, 100)}`)
  }

  if (!Array.isArray(parsed)) throw new Error('Response is not an array')

  return parsed
    .filter(p => typeof p.idx === 'number' && typeof p.enText === 'string' && p.enText.length > 0)
    .map(p => ({
      segmentIdx: p.idx as number,
      enText: (p.enText as string).trim(),
      confidence: (VALID_CONFIDENCE.has(p.confidence as string) ? p.confidence : 'medium') as TranslationSegment['confidence'],
    }))
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Translation not configured' }, { status: 503 })
  }

  const [interview] = await db
    .select({ id: interviews.id })
    .from(interviews)
    .where(and(eq(interviews.id, id), isNull(interviews.deletedAt)))
    .limit(1)

  if (!interview) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [transcript] = await db
    .select({ id: transcripts.id, segments: transcripts.segments })
    .from(transcripts)
    .where(and(eq(transcripts.interviewId, id), eq(transcripts.isCurrent, true)))
    .limit(1)

  if (!transcript) return NextResponse.json({ error: 'No transcript' }, { status: 404 })

  const allSegments = (transcript.segments as TranscriptSegment[] | null) ?? []
  const segmentsToTranslate = allSegments
    .map((s, i) => ({ idx: i, text: s.text.trim() }))
    .filter(s => !allSegments[s.idx]?.hidden && s.text.length > 0)

  if (segmentsToTranslate.length === 0) return NextResponse.json({ segments: [] })

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { default: Anthropic } = require('@anthropic-ai/sdk')
    const client = new Anthropic({ apiKey }) as {
      messages: {
        create: (opts: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }>; stop_reason: string }>
      }
    }

    const batches: Array<typeof segmentsToTranslate> = []
    for (let i = 0; i < segmentsToTranslate.length; i += BATCH_SIZE) {
      batches.push(segmentsToTranslate.slice(i, i + BATCH_SIZE))
    }

    // Process in parallel windows — all batches in a window fire at once,
    // then the next window starts. Keeps total time proportional to
    // ceil(batches/CONCURRENCY) × per-batch latency instead of batches × latency.
    const allResults: TranslationSegment[] = []
    for (let i = 0; i < batches.length; i += CONCURRENCY) {
      const window = batches.slice(i, i + CONCURRENCY)
      const windowResults = await Promise.all(window.map(b => translateBatch(client, b)))
      allResults.push(...windowResults.flat())
    }

    return NextResponse.json({ segments: allResults })
  } catch (err) {
    console.error('[translate] error:', err)
    return NextResponse.json({ error: 'Translation failed' }, { status: 500 })
  }
}
