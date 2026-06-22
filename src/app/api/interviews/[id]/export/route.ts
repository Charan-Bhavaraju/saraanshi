import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { interviews, transcripts, markers } from '@/db/schema'
import { and, eq, isNull } from 'drizzle-orm'
import type { TranscriptSegment, TranslationSegment, Marker } from '@/types/database'

type Format = 'txt' | 'txt-ts' | 'srt' | 'vtt' | 'docx' | 'docx-ts' | 'quotes'

function formatTimestamp(s: number, separator = ':'): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  const ms = Math.round((s - Math.floor(s)) * 1000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}${separator}${String(ms).padStart(3, '0')}`
}

function toTxt(segments: TranscriptSegment[]): string {
  const lines: string[] = []
  let currentSpeaker = ''
  for (const seg of segments) {
    if (seg.speaker !== currentSpeaker) {
      if (lines.length > 0) lines.push('')
      lines.push(`${seg.speaker}:`)
      currentSpeaker = seg.speaker
    }
    lines.push(seg.text)
  }
  return lines.join('\n')
}

function toTxtTs(segments: TranscriptSegment[]): string {
  return segments
    .map(seg => {
      const m = Math.floor(seg.start / 60)
      const s = Math.floor(seg.start % 60)
      return `[${m}:${String(s).padStart(2, '0')}] ${seg.speaker}: ${seg.text}`
    })
    .join('\n\n')
}

function toSrt(segments: TranscriptSegment[]): string {
  return segments
    .map((seg, i) => {
      const endTime = segments[i + 1]?.start ?? seg.end ?? seg.start + 5
      return [
        String(i + 1),
        `${formatTimestamp(seg.start, ',')} --> ${formatTimestamp(endTime, ',')}`,
        seg.text,
        '',
      ].join('\n')
    })
    .join('\n')
}

function toVtt(segments: TranscriptSegment[]): string {
  const cues = segments
    .map((seg, i) => {
      const endTime = segments[i + 1]?.start ?? seg.end ?? seg.start + 5
      return [
        `${formatTimestamp(seg.start, '.')} --> ${formatTimestamp(endTime, '.')}`,
        seg.text,
        '',
      ].join('\n')
    })
    .join('\n')
  return `WEBVTT\n\n${cues}`
}

function toQuotes(quoteMarkers: Marker[]): string {
  if (quoteMarkers.length === 0) return 'No quotes marked.'
  return quoteMarkers
    .map((m, i) => {
      const lines = [`[${i + 1}] ${m.excerpt ?? '(no excerpt)'}`]
      if (m.note) lines.push(`Note: ${m.note}`)
      if ((m.tags ?? []).length > 0) lines.push(`Tags: ${(m.tags ?? []).join(', ')}`)
      return lines.join('\n')
    })
    .join('\n\n')
}

async function toDocx(
  participantCode: string | null | undefined,
  segments: TranscriptSegment[],
): Promise<Uint8Array> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Document, Paragraph, TextRun, HeadingLevel, Packer } = require('docx')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const children: any[] = []

  children.push(
    new Paragraph({
      text: participantCode ?? 'Interview Transcript',
      heading: HeadingLevel.HEADING_1,
    }),
    new Paragraph({ text: '' }),
  )

  let currentSpeaker = ''
  for (const seg of segments) {
    if (seg.speaker !== currentSpeaker) {
      currentSpeaker = seg.speaker
      children.push(
        new Paragraph({
          children: [new TextRun({ text: seg.speaker, bold: true, size: 20 })],
          spacing: { before: 240 },
        }),
      )
    }
    children.push(
      new Paragraph({
        children: [new TextRun({ text: seg.text, size: 22 })],
        spacing: { after: 80 },
      }),
    )
  }

  const doc = new Document({ sections: [{ properties: {}, children }] })
  return new Uint8Array(await Packer.toBuffer(doc))
}

async function toDocxTs(
  participantCode: string | null | undefined,
  segments: TranscriptSegment[],
): Promise<Uint8Array> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Document, Paragraph, TextRun, HeadingLevel, Packer } = require('docx')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const children: any[] = []

  children.push(
    new Paragraph({
      text: participantCode ?? 'Interview Transcript',
      heading: HeadingLevel.HEADING_1,
    }),
    new Paragraph({ text: '' }),
  )

  for (const seg of segments) {
    const m = Math.floor((seg.start ?? 0) / 60)
    const s = Math.floor((seg.start ?? 0) % 60)
    const ts = `[${m}:${String(s).padStart(2, '0')}]`
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: `${ts} `, size: 18, color: '8A929C' }),
          new TextRun({ text: `${seg.speaker}: `, bold: true, size: 20 }),
          new TextRun({ text: seg.text ?? '', size: 22 }),
        ],
        spacing: { after: 100 },
      }),
    )
  }

  const doc = new Document({ sections: [{ properties: {}, children }] })
  return new Uint8Array(await Packer.toBuffer(doc))
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const format = (req.nextUrl.searchParams.get('format') ?? 'txt') as Format
  const includeHidden = req.nextUrl.searchParams.get('includeHidden') === 'true'
  const useTranslation = req.nextUrl.searchParams.get('lang') === 'en'

  const [interview] = await db
    .select({ participantCode: interviews.participantCode, metadata: interviews.metadata })
    .from(interviews)
    .where(and(eq(interviews.id, id), isNull(interviews.deletedAt)))
    .limit(1)

  if (!interview) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const speakerMap = (interview.metadata as { speakerMap?: Record<string, string> } | null)?.speakerMap ?? {}

  const [transcript] = await db
    .select({ segments: transcripts.segments, translationSegments: transcripts.translationSegments })
    .from(transcripts)
    .where(and(eq(transcripts.interviewId, id), eq(transcripts.isCurrent, true)))
    .limit(1)

  const allSegments = (transcript?.segments as TranscriptSegment[] | null) ?? []
  const filtered = includeHidden ? allSegments : allSegments.filter(s => !s.hidden)

  // Build translation lookup if exporting in English
  const translationMap: Record<number, string> = {}
  if (useTranslation) {
    const tSegs = (transcript?.translationSegments as TranslationSegment[] | null) ?? []
    for (const t of tSegs) translationMap[t.segmentIdx] = t.enText
  }

  // Apply speaker labels and optionally swap text with English translation
  const segments = filtered.map((s, i) => {
    const trueIdx = allSegments.indexOf(s)
    return {
      ...s,
      speaker: speakerMap[s.speaker] ?? s.speaker,
      text: useTranslation ? (translationMap[trueIdx] ?? s.text) : s.text,
    }
  })

  const slug = interview.participantCode ?? id.slice(0, 8)
  const langSuffix = useTranslation ? '-en' : ''

  if (format === 'quotes') {
    const quoteMarkers = await db
      .select()
      .from(markers)
      .where(and(eq(markers.interviewId, id), isNull(markers.deletedAt), eq(markers.type, 'quote')))
    const body = toQuotes(quoteMarkers)
    return new NextResponse(body, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${slug}-quotes.txt"`,
      },
    })
  }

  if (format === 'docx' || format === 'docx-ts') {
    const buf = format === 'docx-ts'
      ? await toDocxTs(interview.participantCode, segments)
      : await toDocx(interview.participantCode, segments)
    return new Response(buf.buffer as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${slug}-transcript${langSuffix}.docx"`,
      },
    })
  }

  const textMap: Record<string, () => string> = {
    txt: () => toTxt(segments),
    'txt-ts': () => toTxtTs(segments),
    srt: () => toSrt(segments),
    vtt: () => toVtt(segments),
  }

  const fn = textMap[format]
  if (!fn) return NextResponse.json({ error: 'Unknown format' }, { status: 400 })

  const extMap: Record<string, string> = { txt: 'txt', 'txt-ts': 'txt', srt: 'srt', vtt: 'vtt' }
  const body = fn()
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="${slug}-transcript${langSuffix}.${extMap[format]}"`,
    },
  })
}
