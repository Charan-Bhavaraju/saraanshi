import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { themes, themeCodes, interviews } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { callText, MODELS } from '@/lib/ai/anthropic'
import { FINDINGS_SYSTEM, MAX_TOKENS } from '@/lib/ai/prompts'
import { redact } from '@/lib/ai/redaction'
import { buildContactRedactionEntries } from '@/lib/ai/redaction-db'

export const maxDuration = 60

async function toDocx(themeName: string, body: string): Promise<Uint8Array> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Document, Paragraph, TextRun, HeadingLevel, Packer } = require('docx')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const children: any[] = [
    new Paragraph({ text: themeName, heading: HeadingLevel.HEADING_1 }),
    new Paragraph({ text: '' }),
  ]
  for (const para of body.split(/\n{2,}/)) {
    const trimmed = para.trim()
    if (!trimmed) continue
    children.push(new Paragraph({ children: [new TextRun({ text: trimmed, size: 22 })], spacing: { after: 160 } }))
  }
  const doc = new Document({ sections: [{ properties: {}, children }] })
  return new Uint8Array(await Packer.toBuffer(doc))
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'AI not configured' }, { status: 503 })
  }

  const [theme] = await db.select().from(themes).where(eq(themes.id, id)).limit(1)
  if (!theme) return NextResponse.json({ error: 'Theme not found' }, { status: 404 })

  const codes = await db
    .select({
      excerpt: themeCodes.excerpt,
      segmentIdx: themeCodes.segmentIdx,
      interviewId: themeCodes.interviewId,
      participantCode: interviews.participantCode,
      contactId: interviews.contactId,
      conductedAt: interviews.conductedAt,
    })
    .from(themeCodes)
    .leftJoin(interviews, eq(themeCodes.interviewId, interviews.id))
    .where(eq(themeCodes.themeId, id))

  if (codes.length === 0) {
    return NextResponse.json({ error: 'No coded passages for this theme yet' }, { status: 400 })
  }

  // Redact each excerpt with its own interview's contact context (manual-coded
  // excerpts are raw transcript text and may contain real names).
  const entriesCache = new Map<string, Awaited<ReturnType<typeof buildContactRedactionEntries>>>()
  const lines: string[] = []
  for (const c of codes.sort((a, b) => (a.conductedAt?.toISOString() ?? '').localeCompare(b.conductedAt?.toISOString() ?? ''))) {
    if (!c.excerpt) continue
    const key = c.interviewId
    if (!entriesCache.has(key)) {
      entriesCache.set(key, await buildContactRedactionEntries(c.contactId, c.participantCode))
    }
    const redacted = redact(c.excerpt, entriesCache.get(key)!).text
    lines.push(`[${c.participantCode ?? '?'}] ${redacted}`)
  }

  const user = `Theme: ${theme.name}
Definition: ${theme.definition ?? '(none provided)'}

Coded passages (anonymized):
${lines.join('\n')}

Draft the findings subsection.`

  let draft: string
  try {
    const result = await callText({
      model: MODELS.sonnet,
      system: FINDINGS_SYSTEM,
      user,
      operation: 'findings_draft',
      maxTokens: MAX_TOKENS.findings,
    })
    draft = result.text
  } catch (err) {
    console.error('[findings] generation failed', err)
    return NextResponse.json({ error: 'Draft generation failed' }, { status: 500 })
  }

  const buf = await toDocx(theme.name, draft)
  const slug = theme.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 40) || 'theme'
  return new Response(buf.buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="findings-${slug}.docx"`,
    },
  })
}
