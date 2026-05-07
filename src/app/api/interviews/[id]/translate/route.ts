import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { interviews, transcripts } from '@/db/schema'
import { and, eq, isNull } from 'drizzle-orm'
import type { TranscriptSegment, TranslationSegment } from '@/types/database'

// POST /api/interviews/[id]/translate
// Translates all segments to English using Claude (Sonnet).
// Gracefully degrades if ANTHROPIC_API_KEY is missing.
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
  // Only translate non-hidden segments to avoid wasting tokens
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

    const prompt = `Translate these Telugu-English interview segments to English for medical research. Return ONLY a JSON array — no markdown, no explanation.

Input: ${JSON.stringify(segmentsToTranslate)}

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
        // Prime the assistant response with "[" so it cannot emit markdown preamble
        { role: 'assistant', content: '[' },
      ],
    })

    if (message.stop_reason === 'max_tokens') {
      console.error('[translate] Hit max_tokens — response truncated')
      return NextResponse.json({ error: 'Translation too long' }, { status: 500 })
    }

    const rawText = message.content[0]?.type === 'text' ? message.content[0].text.trim() : ''
    // Prepend the primed "[" and strip any trailing code fence the model may add
    const raw = ('[' + rawText).replace(/```$/, '').trim()

    let parsed: Array<{ idx: unknown; enText: unknown; confidence: unknown }>
    try {
      parsed = JSON.parse(raw)
    } catch {
      console.error('[translate] JSON parse failed, raw:', raw.slice(0, 200))
      return NextResponse.json({ error: 'Translation parse error' }, { status: 500 })
    }

    if (!Array.isArray(parsed)) {
      console.error('[translate] Response is not an array')
      return NextResponse.json({ error: 'Translation parse error' }, { status: 500 })
    }

    const VALID_CONFIDENCE = new Set(['high', 'medium', 'low'])
    const result: TranslationSegment[] = parsed
      .filter(p => typeof p.idx === 'number' && typeof p.enText === 'string' && p.enText.length > 0)
      .map(p => ({
        segmentIdx: p.idx as number,
        enText: (p.enText as string).trim(),
        confidence: (VALID_CONFIDENCE.has(p.confidence as string) ? p.confidence : 'medium') as TranslationSegment['confidence'],
      }))

    return NextResponse.json({ segments: result })
  } catch (err) {
    console.error('[translate] Claude error:', err)
    return NextResponse.json({ error: 'Translation failed' }, { status: 500 })
  }
}
