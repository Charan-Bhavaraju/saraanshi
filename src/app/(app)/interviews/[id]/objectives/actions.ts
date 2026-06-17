'use server'

import { db } from '@/db'
import {
  interviews,
  transcripts,
  objectiveFindings,
  objectiveRuns,
} from '@/db/schema'
import { and, eq, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { callJSON, MODELS } from '@/lib/ai/anthropic'
import { estimateInsightsPaise } from '@/lib/ai/cost'
import { redact } from '@/lib/ai/redaction'
import { buildContactRedactionEntries } from '@/lib/ai/redaction-db'
import { OBJECTIVES_SYSTEM, buildObjectivesUser, MAX_TOKENS } from '@/lib/ai/prompts'
import type {
  TranscriptSegment,
  TranslationSegment,
  ReflectionSource,
} from '@/types/database'
import type { Objective, FindingCategory } from '@/db/schema/analysis'

// Shape the Haiku call must return (see OBJECTIVES_SYSTEM).
type FindingItem = {
  label: string
  excerpt?: string
  timestamps?: number[]
  rationale?: string
}

type ObjectivesResponse = {
  objective_1: { facilitators: FindingItem[]; barriers: FindingItem[] }
  objective_2: { facilitators: FindingItem[]; barriers: FindingItem[] }
  objective_3: { facilitators: FindingItem[]; barriers: FindingItem[] }
}

// Lean, client-serializable views.
export type ObjectiveFindingView = {
  id: string
  objective: Objective
  category: FindingCategory
  label: string
  excerpt: string | null
  rationale: string | null
  timestamps: number[]
}

export type ObjectiveRunView = {
  sourceUsed: ReflectionSource
  generatedAt: string | null
  costInrPaise: number | null
} | null

export type ObjectivesData = {
  run: ObjectiveRunView
  findings: ObjectiveFindingView[]
}

// Picks the source text for a segment per the chosen analysis source.
function pickText(
  seg: TranscriptSegment,
  enText: string | undefined,
  source: ReflectionSource,
): string {
  switch (source) {
    case 'raw':
      return (seg.originalText ?? seg.text).trim()
    case 'translation':
      return (enText ?? seg.text).trim()
    case 'mixed':
      return [seg.text.trim(), enText?.trim()].filter(Boolean).join(' / ')
    case 'cleaned':
    default:
      return seg.text.trim()
  }
}

async function loadObjectives(interviewId: string): Promise<ObjectivesData> {
  const [run] = await db
    .select()
    .from(objectiveRuns)
    .where(eq(objectiveRuns.interviewId, interviewId))
    .limit(1)

  const findings = await db
    .select({
      id: objectiveFindings.id,
      objective: objectiveFindings.objective,
      category: objectiveFindings.category,
      label: objectiveFindings.label,
      excerpt: objectiveFindings.excerpt,
      rationale: objectiveFindings.rationale,
      timestamps: objectiveFindings.timestamps,
    })
    .from(objectiveFindings)
    .where(eq(objectiveFindings.interviewId, interviewId))
    .orderBy(objectiveFindings.createdAt)

  return {
    run: run
      ? {
          sourceUsed: run.sourceUsed,
          generatedAt: run.generatedAt?.toISOString() ?? null,
          costInrPaise: run.costInrPaise,
        }
      : null,
    findings: findings.map(f => ({
      id: f.id,
      objective: f.objective,
      category: f.category,
      label: f.label,
      excerpt: f.excerpt,
      rationale: f.rationale,
      timestamps: (f.timestamps as number[] | null) ?? [],
    })),
  }
}

// Read-only fetch for the page's initial render.
export async function getObjectives(interviewId: string): Promise<ObjectivesData> {
  return loadObjectives(interviewId)
}

// The exact request that would be sent, for preview/inspection.
export type ObjectivesRequest = {
  system: string
  user: string
  model: string
  segmentCount: number
  redactionCount: number
  estimatedPaise: number
  segmentStarts: number[]
}

// Builds the exact (already-redacted) prompt. Shared by preview and generate.
async function buildObjectivesRequest(
  interviewId: string,
  source: ReflectionSource,
): Promise<ObjectivesRequest> {
  const [interview] = await db
    .select({
      id: interviews.id,
      contactId: interviews.contactId,
      participantCode: interviews.participantCode,
      status: interviews.status,
      metadata: interviews.metadata,
    })
    .from(interviews)
    .where(and(eq(interviews.id, interviewId), isNull(interviews.deletedAt)))
    .limit(1)

  if (!interview) throw new Error('Interview not found')
  if (!['reviewed', 'analyzed'].includes(interview.status)) {
    throw new Error('Objectives extraction is available once the interview is reviewed')
  }

  const [transcript] = await db
    .select({ segments: transcripts.segments, translationSegments: transcripts.translationSegments })
    .from(transcripts)
    .where(and(eq(transcripts.interviewId, interviewId), eq(transcripts.isCurrent, true)))
    .limit(1)

  const allSegments = (transcript?.segments as TranscriptSegment[] | null) ?? []
  if (allSegments.length === 0) throw new Error('No transcript to analyze')

  const translationByIdx = new Map<number, string>()
  for (const t of (transcript?.translationSegments as TranslationSegment[] | null) ?? []) {
    translationByIdx.set(t.segmentIdx, t.enText)
  }

  const contactEntries = await buildContactRedactionEntries(
    interview.contactId,
    interview.participantCode,
  )

  const speakerMap =
    (interview.metadata as { speakerMap?: Record<string, string> } | null)?.speakerMap ?? {}

  let redactionCount = 0
  const redactedSegments: Array<{ start: number; speaker: string; text: string }> = []
  allSegments.forEach((seg, idx) => {
    if (seg.hidden) return
    const raw = pickText(seg, translationByIdx.get(idx), source)
    if (!raw) return
    const r = redact(raw, contactEntries)
    redactionCount += r.count
    redactedSegments.push({
      start: seg.start,
      speaker: speakerMap[seg.speaker] ?? seg.speaker,
      text: r.text,
    })
  })

  if (redactedSegments.length === 0) throw new Error('No analyzable content in transcript')

  const user = buildObjectivesUser(redactedSegments)
  const approxTokens = Math.ceil((OBJECTIVES_SYSTEM.length + user.length) / 4)

  return {
    system: OBJECTIVES_SYSTEM,
    user,
    model: MODELS.haiku,
    segmentCount: redactedSegments.length,
    redactionCount,
    estimatedPaise: estimateInsightsPaise(MODELS.haiku, approxTokens, 3500),
    segmentStarts: redactedSegments.map(s => s.start),
  }
}

// PREVIEW ONLY — builds and redacts the prompt but never hits the LLM.
export async function previewObjectivesPrompt(
  interviewId: string,
  source: ReflectionSource,
): Promise<ObjectivesRequest> {
  return buildObjectivesRequest(interviewId, source)
}

const VALID_OBJECTIVES = new Set<Objective>(['objective_1', 'objective_2', 'objective_3'])
const VALID_CATEGORIES = new Set<FindingCategory>(['facilitator', 'barrier'])

// Layer 1b: one Haiku call → persist objective findings.
export async function generateObjectiveFindings(
  interviewId: string,
  source: ReflectionSource,
): Promise<ObjectivesData> {
  const req = await buildObjectivesRequest(interviewId, source)

  const { data, model, costInrPaise } = await callJSON<ObjectivesResponse>({
    model: req.model,
    system: req.system,
    user: req.user,
    operation: 'objectives',
    interviewId,
    prime: '{',
    maxTokens: MAX_TOKENS.objectives,
  })

  // Flatten the nested response into rows.
  const rows: Array<{
    interviewId: string
    objective: Objective
    category: FindingCategory
    label: string
    excerpt: string | null
    rationale: string | null
    timestamps: number[]
  }> = []

  for (const objKey of ['objective_1', 'objective_2', 'objective_3'] as const) {
    if (!VALID_OBJECTIVES.has(objKey)) continue
    const obj = data[objKey]
    if (!obj) continue
    for (const catKey of ['facilitators', 'barriers'] as const) {
      const category: FindingCategory = catKey === 'facilitators' ? 'facilitator' : 'barrier'
      if (!VALID_CATEGORIES.has(category)) continue
      const items = obj[catKey] ?? []
      for (const item of items) {
        if (!item.label?.trim()) continue
        rows.push({
          interviewId,
          objective: objKey,
          category,
          label: item.label.trim(),
          excerpt: item.excerpt?.trim() ?? null,
          rationale: item.rationale?.trim() ?? null,
          timestamps: Array.isArray(item.timestamps) ? item.timestamps : [],
        })
      }
    }
  }

  // Replace prior findings for this interview.
  await db
    .delete(objectiveFindings)
    .where(eq(objectiveFindings.interviewId, interviewId))

  if (rows.length > 0) {
    await db.insert(objectiveFindings).values(rows)
  }

  // Upsert the run record.
  await db
    .insert(objectiveRuns)
    .values({
      interviewId,
      sourceUsed: source,
      llmModel: model,
      costInrPaise,
    })
    .onConflictDoUpdate({
      target: objectiveRuns.interviewId,
      set: {
        sourceUsed: source,
        llmModel: model,
        costInrPaise,
        generatedAt: new Date(),
      },
    })

  revalidatePath(`/interviews/${interviewId}`)
  return loadObjectives(interviewId)
}
