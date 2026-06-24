/**
 * Backfill API — generates insights, objectives, and RAG embeddings.
 *
 * GET  /api/backfill                → audit (what's missing)
 * POST /api/backfill  {id, op}      → run ONE operation for ONE interview
 *
 * The client component calls POST in a loop so each request stays
 * well within Vercel's function timeout.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import {
  interviews,
  interviewReflections,
  objectiveRuns,
  transcriptChunks,
  transcripts,
} from '@/db/schema'
import { and, eq, isNull, inArray, count } from 'drizzle-orm'
import { generateInsights } from '@/app/(app)/interviews/[id]/insights/actions'
import { generateObjectiveFindings } from '@/app/(app)/interviews/[id]/objectives/actions'
import { indexInterview } from '@/lib/rag/indexing'
import type { TranslationSegment } from '@/types/database'

export const maxDuration = 120

const ELIGIBLE = ['reviewed', 'analyzed'] as const

export type AuditRow = {
  code: string
  id: string
  status: string
  insights: boolean
  objectives: boolean
  chunks: number
  hasTranslation: boolean
}

export type AuditResponse = {
  rows: AuditRow[]
  missing: { insights: number; objectives: number; embeddings: number }
}

// ── GET: audit ──────────────────────────────────────────────────────────────

export async function GET() {
  const eligible = await db
    .select({
      id: interviews.id,
      participantCode: interviews.participantCode,
      status: interviews.status,
    })
    .from(interviews)
    .where(and(inArray(interviews.status, [...ELIGIBLE]), isNull(interviews.deletedAt)))
    .orderBy(interviews.participantCode)

  const rows: AuditRow[] = []

  for (const iv of eligible) {
    const [ref] = await db
      .select({ id: interviewReflections.id })
      .from(interviewReflections)
      .where(eq(interviewReflections.interviewId, iv.id))
      .limit(1)

    const [obj] = await db
      .select({ id: objectiveRuns.id })
      .from(objectiveRuns)
      .where(eq(objectiveRuns.interviewId, iv.id))
      .limit(1)

    const [chk] = await db
      .select({ n: count() })
      .from(transcriptChunks)
      .where(eq(transcriptChunks.interviewId, iv.id))

    const [transcript] = await db
      .select({ translationSegments: transcripts.translationSegments })
      .from(transcripts)
      .where(and(eq(transcripts.interviewId, iv.id), eq(transcripts.isCurrent, true)))
      .limit(1)
    const tSegs = (transcript?.translationSegments as TranslationSegment[] | null) ?? []

    rows.push({
      code: iv.participantCode ?? iv.id.slice(0, 8),
      id: iv.id,
      status: iv.status,
      insights: !!ref,
      objectives: !!obj,
      chunks: chk?.n ?? 0,
      hasTranslation: tSegs.length > 0,
    })
  }

  const resp: AuditResponse = {
    rows,
    missing: {
      insights: rows.filter(r => !r.insights).length,
      objectives: rows.filter(r => !r.objectives).length,
      embeddings: rows.filter(r => r.chunks === 0).length,
    },
  }
  return NextResponse.json(resp)
}

// ── POST: run one operation for one interview ───────────────────────────────

type RunBody = {
  id: string
  op: 'insights' | 'objectives' | 'embeddings'
  hasTranslation: boolean
}

export async function POST(req: NextRequest) {
  const { id, op, hasTranslation } = (await req.json()) as RunBody
  const source = hasTranslation ? 'translation' : 'cleaned'

  try {
    switch (op) {
      case 'insights':
        await generateInsights(id, source as any)
        break
      case 'objectives':
        await generateObjectiveFindings(id, source as any)
        break
      case 'embeddings':
        await indexInterview(id, { force: true })
        break
    }
    return NextResponse.json({ ok: true, id, op })
  } catch (e) {
    // Fallback to cleaned if translation failed
    if (source === 'translation' && op !== 'embeddings') {
      try {
        if (op === 'insights') await generateInsights(id, 'cleaned')
        else await generateObjectiveFindings(id, 'cleaned')
        return NextResponse.json({ ok: true, id, op, fallback: true })
      } catch (e2) {
        return NextResponse.json(
          { ok: false, id, op, error: e2 instanceof Error ? e2.message : 'failed' },
          { status: 500 },
        )
      }
    }
    return NextResponse.json(
      { ok: false, id, op, error: e instanceof Error ? e.message : 'failed' },
      { status: 500 },
    )
  }
}
