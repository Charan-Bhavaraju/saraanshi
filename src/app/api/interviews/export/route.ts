import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { interviews, transcripts, contacts } from '@/db/schema'
import { and, eq, isNull, inArray } from 'drizzle-orm'
import type { TranscriptSegment, TranslationSegment } from '@/types/database'

export const maxDuration = 60

const TYPE_LABELS: Record<string, string> = {
  patient: 'Patient', doctor: 'Doctor', survivor: 'Survivor', other: 'Other',
}
const LANG_LABELS: Record<string, string> = {
  en: 'English', te: 'Telugu', hi: 'Hindi', mixed: 'Mixed',
}

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtTs(s: number): string {
  const m = Math.floor(s / 60)
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

type IV = {
  id: string
  participantCode: string | null
  type: string
  language: string
  status: string
  conductedAt: Date | null
  contactName: string | null
  speakerMap: Record<string, string>
  segs: TranscriptSegment[]
  trans: TranslationSegment[]
}

function prepSegs(
  iv: IV,
  useTranslation: boolean,
  includeHidden: boolean,
): Array<{ speaker: string; text: string; start: number }> {
  const transMap: Record<number, string> = {}
  for (const t of iv.trans) transMap[t.segmentIdx] = t.enText

  return iv.segs
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => includeHidden || !s.hidden)
    .map(({ s, i }) => ({
      speaker: iv.speakerMap[s.speaker] ?? s.speaker,
      text: (useTranslation ? (transMap[i] ?? s.text ?? '') : (s.text ?? '')).trim(),
      start: s.start ?? 0,
    }))
    .filter(({ text }) => text.length > 0)
}

function header(iv: IV, n: number): string {
  const code = iv.participantCode ?? iv.id.slice(0, 8)
  const type = TYPE_LABELS[iv.type] ?? iv.type
  const contact = iv.contactName ? ` · ${iv.contactName}` : ''
  return `[${n}] ${code} — ${type}${contact}`
}

function meta(iv: IV): string {
  return [
    fmtDate(iv.conductedAt),
    LANG_LABELS[iv.language] ?? iv.language,
    iv.status.charAt(0).toUpperCase() + iv.status.slice(1),
  ].join(' · ')
}

// ── Text formats ────────────────────────────────────────────────────────────

function toTxt(ivs: IV[], useTranslation: boolean, includeHidden: boolean): string {
  const div = '═'.repeat(60)
  const lines = [
    'INTERVIEW ARCHIVE',
    `Generated: ${fmtDate(new Date())}  ·  ${ivs.length} interviews`,
    '',
  ]
  ivs.forEach((iv, n) => {
    const segs = prepSegs(iv, useTranslation, includeHidden)
    lines.push(div, header(iv, n + 1), meta(iv), '')
    if (segs.length === 0) { lines.push('(no transcript)', ''); return }
    let curSpk = ''
    for (const seg of segs) {
      if (seg.speaker !== curSpk) {
        if (curSpk) lines.push('')
        lines.push(`${seg.speaker}:`)
        curSpk = seg.speaker
      }
      lines.push(seg.text)
    }
    lines.push('')
  })
  return lines.join('\n')
}

function toTxtTs(ivs: IV[], useTranslation: boolean, includeHidden: boolean): string {
  const div = '─'.repeat(60)
  const lines = [
    'INTERVIEW ARCHIVE',
    `Generated: ${fmtDate(new Date())}  ·  ${ivs.length} interviews`,
    '',
  ]
  ivs.forEach((iv, n) => {
    const segs = prepSegs(iv, useTranslation, includeHidden)
    lines.push(div, header(iv, n + 1), meta(iv), '')
    if (segs.length === 0) { lines.push('(no transcript)', ''); return }
    for (const seg of segs) {
      lines.push(`[${fmtTs(seg.start)}] ${seg.speaker}: ${seg.text}`)
    }
    lines.push('')
  })
  return lines.join('\n')
}

// ── DOCX ────────────────────────────────────────────────────────────────────

async function toDocx(ivs: IV[], useTranslation: boolean, includeHidden: boolean): Promise<Uint8Array> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Document, Paragraph, TextRun, Packer } = require('docx')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const children: any[] = []

  // Cover
  children.push(
    new Paragraph({
      children: [new TextRun({ text: 'Interview Archive', bold: true, size: 52, color: '0E5C5C' })],
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [new TextRun({
        text: `${fmtDate(new Date())}  ·  ${ivs.length} interviews`,
        size: 22, color: '8A929C',
      })],
      spacing: { after: 600 },
    }),
  )

  ivs.forEach((iv, n) => {
    const segs = prepSegs(iv, useTranslation, includeHidden)
    const code = iv.participantCode ?? iv.id.slice(0, 8)
    const type = TYPE_LABELS[iv.type] ?? iv.type
    const contact = iv.contactName ? `  ·  ${iv.contactName}` : ''
    const wordCount = segs.reduce((acc, s) => acc + s.text.split(/\s+/).filter(Boolean).length, 0)

    // Page break before each interview after the first
    children.push(
      new Paragraph({
        pageBreakBefore: n > 0,
        children: [
          new TextRun({ text: code, bold: true, size: 40, color: '0E5C5C' }),
          new TextRun({ text: `  ${type}${contact}`, size: 28, color: '4A5263' }),
        ],
        spacing: { before: n === 0 ? 0 : 240, after: 80 },
      }),
    )

    // Meta line
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `${meta(iv)}  ·  ${segs.length} segments  ·  ${wordCount.toLocaleString()} words`,
            size: 18, color: '8A929C',
          }),
        ],
        spacing: { after: 280 },
      }),
    )

    if (segs.length === 0) {
      children.push(new Paragraph({
        children: [new TextRun({ text: 'No transcript available.', size: 20, color: 'B5BBC4', italics: true })],
        spacing: { after: 200 },
      }))
      return
    }

    let curSpk = ''
    for (const seg of segs) {
      if (seg.speaker !== curSpk) {
        curSpk = seg.speaker
        children.push(new Paragraph({
          children: [new TextRun({ text: seg.speaker, bold: true, size: 20, color: '1A1F2C' })],
          spacing: { before: 200, after: 60 },
        }))
      }
      children.push(new Paragraph({
        children: [new TextRun({ text: seg.text, size: 22, color: '4A5263' })],
        spacing: { after: 80 },
      }))
    }
  })

  const doc = new Document({ sections: [{ properties: {}, children }] })
  return new Uint8Array(await Packer.toBuffer(doc))
}

// ── Handler ─────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const format = (req.nextUrl.searchParams.get('format') ?? 'docx') as 'txt' | 'txt-ts' | 'docx'
  const includeHidden = req.nextUrl.searchParams.get('includeHidden') === 'true'
  const useTranslation = req.nextUrl.searchParams.get('lang') === 'en'
  const typeFilter = req.nextUrl.searchParams.get('type')

  // 3 queries: interviews, contacts, transcripts
  const rows = await db
    .select({
      id: interviews.id,
      participantCode: interviews.participantCode,
      type: interviews.type,
      language: interviews.language,
      status: interviews.status,
      conductedAt: interviews.conductedAt,
      contactId: interviews.contactId,
      metadata: interviews.metadata,
    })
    .from(interviews)
    .where(isNull(interviews.deletedAt))
    .orderBy(interviews.conductedAt)

  const filtered = typeFilter ? rows.filter(r => r.type === typeFilter) : rows
  if (filtered.length === 0) return NextResponse.json({ error: 'No interviews found' }, { status: 404 })

  const contactIds = [...new Set(filtered.flatMap(r => r.contactId ? [r.contactId] : []))]
  const allContacts = contactIds.length > 0
    ? await db.select({ id: contacts.id, displayName: contacts.displayName })
        .from(contacts).where(inArray(contacts.id, contactIds))
    : []
  const contactMap = Object.fromEntries(allContacts.map(c => [c.id, c.displayName]))

  const allTranscripts = filtered.length > 0
    ? await db
        .select({ interviewId: transcripts.interviewId, segments: transcripts.segments, translationSegments: transcripts.translationSegments })
        .from(transcripts)
        .where(and(eq(transcripts.isCurrent, true), inArray(transcripts.interviewId, filtered.map(r => r.id))))
    : []
  const transcriptMap = Object.fromEntries(allTranscripts.map(t => [t.interviewId, t]))

  const ivs: IV[] = filtered.map(r => {
    const t = transcriptMap[r.id]
    return {
      id: r.id,
      participantCode: r.participantCode,
      type: r.type,
      language: r.language,
      status: r.status,
      conductedAt: r.conductedAt,
      contactName: r.contactId ? (contactMap[r.contactId] ?? null) : null,
      speakerMap: (r.metadata as { speakerMap?: Record<string, string> } | null)?.speakerMap ?? {},
      segs: (t?.segments as TranscriptSegment[] | null) ?? [],
      trans: (t?.translationSegments as TranslationSegment[] | null) ?? [],
    }
  })

  const dateStr = new Date().toISOString().slice(0, 10)
  const suffix = useTranslation ? '-en' : ''

  if (format === 'docx') {
    const buf = await toDocx(ivs, useTranslation, includeHidden)
    return new Response(buf.buffer as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="interviews-archive${suffix}-${dateStr}.docx"`,
      },
    })
  }

  const body = format === 'txt-ts'
    ? toTxtTs(ivs, useTranslation, includeHidden)
    : toTxt(ivs, useTranslation, includeHidden)

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="interviews-archive${suffix}-${dateStr}.txt"`,
    },
  })
}
