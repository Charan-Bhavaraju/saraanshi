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

  const segments = (transcript.segments as TranscriptSegment[] | null) ?? []
  if (segments.length === 0) return NextResponse.json({ segments: [] })

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { default: Anthropic } = require('@anthropic-ai/sdk')
    const client = new Anthropic({ apiKey }) as {
      messages: {
        create: (opts: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }> }>
      }
    }

    // Send all segments in one call to preserve context for code-mixed speech
    const segmentsJson = segments.map((s, i) => ({ idx: i, text: s.text }))
    const prompt = `You are translating Telugu-English code-mixed interview segments to English for medical research.

Segments to translate (JSON array):
${JSON.stringify(segmentsJson, null, 2)}

Rules:
- If a segment is already English, return it as-is with confidence "high"
- Preserve clinical and medical terminology
- Keep participant quotes as direct speech
- Return JSON array matching: [{ "idx": number, "enText": string, "confidence": "high" | "medium" | "low" }]
- Confidence: high = clear language, medium = partial translation needed, low = unclear/ambiguous
- Return ONLY the JSON array, no other text`

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = message.content[0]?.type === 'text' ? message.content[0].text.trim() : '[]'
    const parsed = JSON.parse(raw) as Array<{ idx: number; enText: string; confidence: string }>

    const result: TranslationSegment[] = parsed.map(p => ({
      segmentIdx: p.idx,
      enText: p.enText,
      confidence: (['high', 'medium', 'low'].includes(p.confidence) ? p.confidence : 'medium') as TranslationSegment['confidence'],
    }))

    return NextResponse.json({ segments: result })
  } catch (err) {
    console.error('[translate] Claude error:', err)
    return NextResponse.json({ error: 'Translation failed' }, { status: 500 })
  }
}
