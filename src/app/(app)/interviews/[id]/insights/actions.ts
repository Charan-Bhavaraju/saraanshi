'use server'

import { db } from '@/db'
import {
  interviews,
  transcripts,
  interviewReflections,
  focusPoints,
  themes,
  themeCodes,
  tasks,
} from '@/db/schema'
import { and, eq, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { callJSON, MODELS } from '@/lib/ai/anthropic'
import { estimateInsightsPaise } from '@/lib/ai/cost'
import { embedBatch } from '@/lib/ai/gemini'
import { redact } from '@/lib/ai/redaction'
import { buildContactRedactionEntries } from '@/lib/ai/redaction-db'
import { INSIGHTS_SYSTEM, buildInsightsUser, MAX_TOKENS } from '@/lib/ai/prompts'
import type {
  TranscriptSegment,
  TranslationSegment,
  ReflectionSource,
  Confidence,
  NotableMoment,
} from '@/types/database'

// Shape the Haiku call must return (see INSIGHTS_SYSTEM).
type InsightsResponse = {
  summary: string
  focus_points: Array<{
    phrase: string
    timestamps?: number[]
    confidence?: string
    rationale?: string
  }>
  notable_moments: Array<{ seconds: number; reason: string }>
  open_questions: string[]
}

// Lean, client-serializable views (no embedding vectors).
export type FocusPointView = {
  id: string
  phrase: string
  rationale: string | null
  confidence: Confidence
  timestamps: number[]
  promotedToThemeId: string | null
}

export type ReflectionView = {
  summary: string | null
  notableMoments: NotableMoment[]
  openQuestions: string[]
  userReflection: string | null
  sourceUsed: ReflectionSource
  generatedAt: string | null
  costInrPaise: number | null
} | null

export type InsightsData = {
  reflection: ReflectionView
  focusPoints: FocusPointView[]
}

const VALID_CONFIDENCE = new Set<Confidence>(['high', 'medium', 'low'])
function coerceConfidence(c: unknown): Confidence {
  return VALID_CONFIDENCE.has(c as Confidence) ? (c as Confidence) : 'medium'
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

async function loadInsights(interviewId: string): Promise<InsightsData> {
  const [reflection] = await db
    .select()
    .from(interviewReflections)
    .where(eq(interviewReflections.interviewId, interviewId))
    .limit(1)

  const fps = await db
    .select({
      id: focusPoints.id,
      phrase: focusPoints.phrase,
      rationale: focusPoints.rationale,
      confidence: focusPoints.confidence,
      timestamps: focusPoints.timestamps,
      promotedToThemeId: focusPoints.promotedToThemeId,
    })
    .from(focusPoints)
    .where(and(eq(focusPoints.interviewId, interviewId), isNull(focusPoints.dismissedAt)))
    .orderBy(focusPoints.createdAt)

  return {
    reflection: reflection
      ? {
          summary: reflection.summary,
          notableMoments: (reflection.notableMoments as NotableMoment[] | null) ?? [],
          openQuestions: (reflection.openQuestions as string[] | null) ?? [],
          userReflection: reflection.userReflection,
          sourceUsed: reflection.sourceUsed,
          generatedAt: reflection.generatedAt?.toISOString() ?? null,
          costInrPaise: reflection.costInrPaise,
        }
      : null,
    focusPoints: fps.map(f => ({
      id: f.id,
      phrase: f.phrase,
      rationale: f.rationale,
      confidence: f.confidence,
      timestamps: (f.timestamps as number[] | null) ?? [],
      promotedToThemeId: f.promotedToThemeId,
    })),
  }
}

// Read-only fetch for the page's initial render.
export async function getInsights(interviewId: string): Promise<InsightsData> {
  return loadInsights(interviewId)
}

// The exact request that would be sent for Layer 1, for preview/inspection.
export type InsightsRequest = {
  system: string
  user: string
  model: string
  segmentCount: number
  redactionCount: number
  estimatedPaise: number
  // Real (non-hidden) segment start times — used to ground notable-moment timestamps.
  segmentStarts: number[]
}

// Builds the exact (already-redacted) prompt for a Layer-1 run. Shared by the
// preview action and the real generate action so what you preview is byte-for-byte
// what gets sent. Does NOT call any model.
async function buildInsightsRequest(
  interviewId: string,
  source: ReflectionSource,
): Promise<InsightsRequest> {
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
    throw new Error('Insights are available once the interview is reviewed')
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

  // Build redaction entries: the participant's real name → their code, every
  // other contact's real name → [NAME], plus default hospital aliases.
  const contactEntries = await buildContactRedactionEntries(
    interview.contactId,
    interview.participantCode,
  )

  const speakerMap =
    (interview.metadata as { speakerMap?: Record<string, string> } | null)?.speakerMap ?? {}

  // Redact each segment individually so timestamps/speakers are preserved.
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

  const user = buildInsightsUser(redactedSegments)
  const approxTokens = Math.ceil((INSIGHTS_SYSTEM.length + user.length) / 4)

  return {
    system: INSIGHTS_SYSTEM,
    user,
    model: MODELS.haiku,
    segmentCount: redactedSegments.length,
    redactionCount,
    estimatedPaise: estimateInsightsPaise(MODELS.haiku, approxTokens),
    segmentStarts: redactedSegments.map(s => s.start),
  }
}

// A notable moment is kept only if its timestamp is within ±5s of a real
// segment start — drops hallucinated/estimated timestamps.
const GROUNDING_TOLERANCE_SECONDS = 5
function groundNotableMoments(
  moments: Array<{ seconds: number; reason: string }>,
  segmentStarts: number[],
): NotableMoment[] {
  return (moments ?? []).filter(
    m =>
      typeof m.seconds === 'number' &&
      segmentStarts.some(s => Math.abs(s - m.seconds) <= GROUNDING_TOLERANCE_SECONDS),
  )
}

// PREVIEW ONLY — builds and redacts the prompt but never hits the LLM. Lets you
// inspect exactly what would be sent before spending anything.
export async function previewInsightsPrompt(
  interviewId: string,
  source: ReflectionSource,
): Promise<InsightsRequest> {
  return buildInsightsRequest(interviewId, source)
}

// Layer 1: one Haiku call → persist reflection + focus points (+ embeddings).
export async function generateInsights(
  interviewId: string,
  source: ReflectionSource,
): Promise<InsightsData> {
  const req = await buildInsightsRequest(interviewId, source)

  const { data, model, costInrPaise } = await callJSON<InsightsResponse>({
    model: req.model,
    system: req.system,
    user: req.user,
    operation: 'insights',
    interviewId,
    prime: '{',
    maxTokens: MAX_TOKENS.insights,
  })

  // Drop notable moments whose timestamps aren't grounded in a real segment.
  const notableMoments = groundNotableMoments(data.notable_moments ?? [], req.segmentStarts)

  // Upsert the reflection (unique per interview).
  await db
    .insert(interviewReflections)
    .values({
      interviewId,
      sourceUsed: source,
      summary: data.summary ?? null,
      notableMoments,
      openQuestions: data.open_questions ?? [],
      llmModel: model,
      costInrPaise,
    })
    .onConflictDoUpdate({
      target: interviewReflections.interviewId,
      set: {
        sourceUsed: source,
        summary: data.summary ?? null,
        notableMoments,
        openQuestions: data.open_questions ?? [],
        generatedAt: new Date(),
        llmModel: model,
        costInrPaise,
      },
    })

  // Replace prior focus points that the user hasn't acted on. Promoted/dismissed
  // ones are preserved (they carry theme links or her explicit decision).
  await db
    .delete(focusPoints)
    .where(
      and(
        eq(focusPoints.interviewId, interviewId),
        isNull(focusPoints.promotedToThemeId),
        isNull(focusPoints.dismissedAt),
      ),
    )

  const points = (data.focus_points ?? []).filter(f => f.phrase?.trim())
  if (points.length > 0) {
    const embeddings = await embedBatch(
      points.map(f => f.phrase),
      'SEMANTIC_SIMILARITY',
    )
    await db.insert(focusPoints).values(
      points.map((f, i) => ({
        interviewId,
        phrase: f.phrase.trim(),
        rationale: f.rationale ?? null,
        confidence: coerceConfidence(f.confidence),
        timestamps: Array.isArray(f.timestamps) ? f.timestamps : [],
        embedding: embeddings[i],
      })),
    )
  }

  revalidatePath(`/interviews/${interviewId}`)
  return loadInsights(interviewId)
}

// Her plain reflection — no AI. Saved on blur (optimistic UI, no revalidate).
export async function saveReflection(interviewId: string, userReflection: string): Promise<void> {
  await db
    .update(interviewReflections)
    .set({ userReflection, lastUserEditAt: new Date() })
    .where(eq(interviewReflections.interviewId, interviewId))
}

// Promote a focus point to a theme: create the theme, link a theme_code, and
// mark the focus point promoted. She edits the theme name/definition afterward.
export async function promoteFocusPoint(focusPointId: string, interviewId: string) {
  const [fp] = await db
    .select()
    .from(focusPoints)
    .where(eq(focusPoints.id, focusPointId))
    .limit(1)
  if (!fp) throw new Error('Focus point not found')

  const [theme] = await db
    .insert(themes)
    .values({ name: fp.phrase, definition: fp.rationale, createdBy: 'user' })
    .returning()

  await db.insert(themeCodes).values({
    themeId: theme.id,
    interviewId,
    focusPointId,
    excerpt: fp.phrase,
  })

  await db
    .update(focusPoints)
    .set({ promotedToThemeId: theme.id })
    .where(eq(focusPoints.id, focusPointId))

  revalidatePath(`/interviews/${interviewId}`)
  return { themeId: theme.id }
}

// Dismiss a focus point (optimistic UI, no revalidate).
export async function dismissFocusPoint(focusPointId: string): Promise<void> {
  await db
    .update(focusPoints)
    .set({ dismissedAt: new Date() })
    .where(eq(focusPoints.id, focusPointId))
}

// Convert an open question into a follow-up task linked to the interview's contact.
export async function convertQuestionToTask(interviewId: string, question: string) {
  const [iv] = await db
    .select({ contactId: interviews.contactId })
    .from(interviews)
    .where(eq(interviews.id, interviewId))
    .limit(1)

  const [task] = await db
    .insert(tasks)
    .values({ title: question, contactId: iv?.contactId ?? null, status: 'todo' })
    .returning()

  revalidatePath('/tasks')
  revalidatePath('/today')
  return { taskId: task.id }
}
