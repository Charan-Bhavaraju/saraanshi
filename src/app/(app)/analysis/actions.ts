'use server'

import { db } from '@/db'
import {
  focusPoints,
  themes,
  themeCodes,
  themeSuggestions,
  clusterWatermark,
  interviews,
} from '@/db/schema'
import { and, eq, isNull, sql, inArray, count } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { callJSON, MODELS } from '@/lib/ai/anthropic'
import { THEME_NAMING_SYSTEM, buildThemeNamingUser, MAX_TOKENS } from '@/lib/ai/prompts'
import type { ThemeCreatedBy } from '@/types/database'

// ─── View A: suggested themes (clustering) ───

export type SuggestedTheme = {
  id: string
  name: string | null
  memberCount: number
  interviewCount: number
  examplePhrases: string[]
}

const THRESHOLD = (() => {
  const v = Number(process.env.CLUSTER_SIMILARITY_THRESHOLD)
  return Number.isFinite(v) && v > 0 && v < 1 ? v : 0.78
})()

const MIN_CLUSTER_SIZE = 3

function isMultiWord(name: string): boolean {
  return name.trim().split(/\s+/).filter(Boolean).length >= 2
}

// Names a cluster with one tiny Haiku call. Rejects single-word names and
// retries once; falls back to joining example phrases if it still won't comply.
async function nameCluster(phrases: string[]): Promise<{ name: string; definition: string | null }> {
  const user = buildThemeNamingUser(phrases)
  for (let attempt = 0; attempt < 2; attempt++) {
    const system =
      attempt === 0
        ? THEME_NAMING_SYSTEM
        : `${THEME_NAMING_SYSTEM}\n\nYour previous name was a single word, which is INVALID. Return a 2-5 WORD name.`
    try {
      const { data } = await callJSON<{ name?: string; definition?: string }>({
        model: MODELS.haiku,
        system,
        user,
        operation: 'theme_naming',
        prime: '{',
        maxTokens: MAX_TOKENS.themeNaming,
      })
      const name = (data.name ?? '').trim()
      if (name && isMultiWord(name)) return { name, definition: data.definition?.trim() ?? null }
    } catch {
      break
    }
  }
  return { name: phrases.slice(0, 2).join(' & '), definition: null }
}

// Disjoint-set union over focus-point ids.
function buildClusters(ids: string[], edges: Array<[string, string]>): string[][] {
  const parent = new Map<string, string>(ids.map(id => [id, id]))
  function find(x: string): string {
    let root = x
    while (parent.get(root) !== root) root = parent.get(root)!
    // path compression
    let cur = x
    while (parent.get(cur) !== root) {
      const next = parent.get(cur)!
      parent.set(cur, root)
      cur = next
    }
    return root
  }
  function union(a: string, b: string) {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent.set(ra, rb)
  }
  for (const [a, b] of edges) union(a, b)

  const groups = new Map<string, string[]>()
  for (const id of ids) {
    const root = find(id)
    const g = groups.get(root) ?? []
    g.push(id)
    groups.set(root, g)
  }
  return [...groups.values()]
}

async function countOpenFocusPoints(): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(focusPoints)
    .where(
      and(
        isNull(focusPoints.dismissedAt),
        isNull(focusPoints.promotedToThemeId),
        sql`${focusPoints.embedding} IS NOT NULL`,
      ),
    )
  return row?.n ?? 0
}

async function cachedSuggestions(): Promise<SuggestedTheme[]> {
  const rows = await db
    .select()
    .from(themeSuggestions)
    .where(eq(themeSuggestions.dismissed, false))
    .orderBy(sql`${themeSuggestions.interviewCount} DESC`)
  return rows.map(r => ({
    id: r.id,
    name: r.suggestedName,
    memberCount: r.memberFocusPointIds.length,
    interviewCount: r.interviewCount,
    examplePhrases: (r.examplePhrases as string[] | null) ?? [],
  }))
}

// Recompute clusters from scratch, regenerate names, replace the cache, and
// bump the watermark. Only called when the open focus-point count has changed.
async function recluster(openCount: number): Promise<SuggestedTheme[]> {
  const open = await db
    .select({ id: focusPoints.id, phrase: focusPoints.phrase, interviewId: focusPoints.interviewId })
    .from(focusPoints)
    .where(
      and(
        isNull(focusPoints.dismissedAt),
        isNull(focusPoints.promotedToThemeId),
        sql`${focusPoints.embedding} IS NOT NULL`,
      ),
    )

  const byId = new Map(open.map(f => [f.id, f]))
  const ids = open.map(f => f.id)

  // Cosine-similarity edges via pgvector ( <=> is cosine distance ).
  const edgeRows = (await db.execute(sql`
    SELECT a.id AS a_id, b.id AS b_id
    FROM focus_points a
    JOIN focus_points b ON a.id < b.id
    WHERE a.dismissed_at IS NULL AND a.promoted_to_theme_id IS NULL AND a.embedding IS NOT NULL
      AND b.dismissed_at IS NULL AND b.promoted_to_theme_id IS NULL AND b.embedding IS NOT NULL
      AND (1 - (a.embedding <=> b.embedding)) >= ${THRESHOLD}
  `)) as unknown as Array<{ a_id: string; b_id: string }>

  const edges: Array<[string, string]> = edgeRows.map(e => [e.a_id, e.b_id])
  const clusters = buildClusters(ids, edges).filter(c => c.length >= MIN_CLUSTER_SIZE)

  // Rebuild the cache.
  await db.delete(themeSuggestions)

  const results: SuggestedTheme[] = []
  for (const memberIds of clusters) {
    const members = memberIds.map(id => byId.get(id)!).filter(Boolean)
    const phrases = members.map(m => m.phrase)
    const interviewCount = new Set(members.map(m => m.interviewId)).size
    const { name } = await nameCluster(phrases)
    const examplePhrases = phrases.slice(0, 4)

    const [row] = await db
      .insert(themeSuggestions)
      .values({
        memberFocusPointIds: memberIds,
        interviewCount,
        suggestedName: name,
        examplePhrases,
      })
      .returning({ id: themeSuggestions.id })

    results.push({ id: row.id, name, memberCount: memberIds.length, interviewCount, examplePhrases })
  }

  // Update single-row watermark.
  const [wm] = await db.select({ id: clusterWatermark.id }).from(clusterWatermark).limit(1)
  if (wm) {
    await db
      .update(clusterWatermark)
      .set({ openFocusPointCount: openCount, computedAt: new Date() })
      .where(eq(clusterWatermark.id, wm.id))
  } else {
    await db.insert(clusterWatermark).values({ openFocusPointCount: openCount })
  }

  return results.sort((a, b) => b.interviewCount - a.interviewCount)
}

// Read-only — returns whatever is cached, never triggers an LLM call. Used for
// the initial page render so navigating to Analysis is free and instant.
export async function getCachedSuggestedThemes(): Promise<SuggestedTheme[]> {
  return cachedSuggestions()
}

export type ClusterStatus = {
  openCount: number
  lastClusteredCount: number | null
  stale: boolean
}

// Whether clustering is out of date relative to the open focus-point set.
export async function getClusterStatus(): Promise<ClusterStatus> {
  const openCount = await countOpenFocusPoints()
  const [wm] = await db
    .select({ n: clusterWatermark.openFocusPointCount })
    .from(clusterWatermark)
    .limit(1)
  const lastClusteredCount = wm?.n ?? null
  const stale = lastClusteredCount === null ? openCount > 0 : lastClusteredCount !== openCount
  return { openCount, lastClusteredCount, stale }
}

// USER-INITIATED clustering run (the only path that spends on Haiku naming).
export async function recomputeSuggestedThemes(): Promise<SuggestedTheme[]> {
  return recluster(await countOpenFocusPoints())
}

// Promote a suggested cluster into a theme: create the theme, link every
// contributing focus point via a theme_code, and mark them promoted.
export async function promoteCluster(suggestionId: string): Promise<{ themeId: string }> {
  const [sug] = await db
    .select()
    .from(themeSuggestions)
    .where(eq(themeSuggestions.id, suggestionId))
    .limit(1)
  if (!sug) throw new Error('Suggestion not found')

  const memberIds = sug.memberFocusPointIds
  const members = await db
    .select({ id: focusPoints.id, interviewId: focusPoints.interviewId, phrase: focusPoints.phrase })
    .from(focusPoints)
    .where(inArray(focusPoints.id, memberIds))

  const [theme] = await db
    .insert(themes)
    .values({ name: sug.suggestedName ?? 'Untitled theme', createdBy: 'cluster' })
    .returning()

  if (members.length > 0) {
    await db.insert(themeCodes).values(
      members.map(m => ({
        themeId: theme.id,
        interviewId: m.interviewId,
        focusPointId: m.id,
        excerpt: m.phrase,
      })),
    )
    await db
      .update(focusPoints)
      .set({ promotedToThemeId: theme.id })
      .where(inArray(focusPoints.id, memberIds))
  }

  await db.update(themeSuggestions).set({ dismissed: true }).where(eq(themeSuggestions.id, suggestionId))

  revalidatePath('/analysis')
  return { themeId: theme.id }
}

// Dismiss a suggested cluster — per the spec, this dismisses the underlying
// focus points so the grouping won't be re-suggested.
export async function dismissCluster(suggestionId: string): Promise<void> {
  const [sug] = await db
    .select({ memberFocusPointIds: themeSuggestions.memberFocusPointIds })
    .from(themeSuggestions)
    .where(eq(themeSuggestions.id, suggestionId))
    .limit(1)
  if (!sug) return

  if (sug.memberFocusPointIds.length > 0) {
    await db
      .update(focusPoints)
      .set({ dismissedAt: new Date() })
      .where(inArray(focusPoints.id, sug.memberFocusPointIds))
  }
  await db.update(themeSuggestions).set({ dismissed: true }).where(eq(themeSuggestions.id, suggestionId))

  revalidatePath('/analysis')
}

// ─── View B: theme tree ───

export type ThemeNode = {
  id: string
  name: string
  parentId: string | null
  definition: string | null
  color: string | null
  createdBy: ThemeCreatedBy
  codeCount: number
  interviewCount: number
}

export async function getThemes(): Promise<ThemeNode[]> {
  const allThemes = await db.select().from(themes).orderBy(themes.createdAt)
  const codes = await db
    .select({ themeId: themeCodes.themeId, interviewId: themeCodes.interviewId })
    .from(themeCodes)

  const counts = new Map<string, { codes: number; interviews: Set<string> }>()
  for (const c of codes) {
    const e = counts.get(c.themeId) ?? { codes: 0, interviews: new Set<string>() }
    e.codes++
    e.interviews.add(c.interviewId)
    counts.set(c.themeId, e)
  }

  return allThemes.map(t => ({
    id: t.id,
    name: t.name,
    parentId: t.parentId,
    definition: t.definition,
    color: t.color,
    createdBy: t.createdBy,
    codeCount: counts.get(t.id)?.codes ?? 0,
    interviewCount: counts.get(t.id)?.interviews.size ?? 0,
  }))
}

export type ThemeCodeView = {
  id: string
  excerpt: string | null
  memo: string | null
  participantCode: string | null
  interviewId: string
  segmentIdx: number | null
  conductedAt: string | null
}

export async function getThemeCodes(themeId: string): Promise<ThemeCodeView[]> {
  const rows = await db
    .select({
      id: themeCodes.id,
      excerpt: themeCodes.excerpt,
      memo: themeCodes.memo,
      interviewId: themeCodes.interviewId,
      segmentIdx: themeCodes.segmentIdx,
      participantCode: interviews.participantCode,
      conductedAt: interviews.conductedAt,
    })
    .from(themeCodes)
    .leftJoin(interviews, eq(themeCodes.interviewId, interviews.id))
    .where(eq(themeCodes.themeId, themeId))

  // Chronological: by interview date, then segment position.
  return rows
    .map(r => ({
      id: r.id,
      excerpt: r.excerpt,
      memo: r.memo,
      participantCode: r.participantCode,
      interviewId: r.interviewId,
      segmentIdx: r.segmentIdx,
      conductedAt: r.conductedAt?.toISOString() ?? null,
    }))
    .sort((a, b) => {
      const da = a.conductedAt ?? ''
      const db_ = b.conductedAt ?? ''
      if (da !== db_) return da < db_ ? -1 : 1
      return (a.segmentIdx ?? 0) - (b.segmentIdx ?? 0)
    })
}

export async function updateTheme(
  id: string,
  data: { name?: string; definition?: string | null; color?: string | null; parentId?: string | null },
): Promise<void> {
  // Guard against making a theme its own parent.
  if (data.parentId === id) data.parentId = null
  await db.update(themes).set(data).where(eq(themes.id, id))
  revalidatePath('/analysis')
}

export async function deleteTheme(id: string): Promise<void> {
  // Re-open any focus points promoted into this theme so they can re-cluster.
  await db.update(focusPoints).set({ promotedToThemeId: null }).where(eq(focusPoints.promotedToThemeId, id))
  // theme_codes cascade-delete via FK; child themes are re-parented to root.
  await db.update(themes).set({ parentId: null }).where(eq(themes.parentId, id))
  await db.delete(themes).where(eq(themes.id, id))
  revalidatePath('/analysis')
}

// ─── View C: saturation tracker ───

export type SaturationPoint = { label: string; count: number }

export async function getSaturationData(): Promise<SaturationPoint[]> {
  const rows = (await db.execute(sql`
    SELECT i.participant_code, i.conducted_at, i.created_at, COUNT(fp.id) AS n
    FROM interviews i
    JOIN focus_points fp ON fp.interview_id = i.id
    WHERE i.deleted_at IS NULL
    GROUP BY i.id, i.participant_code, i.conducted_at, i.created_at
    HAVING COUNT(fp.id) > 0
    ORDER BY i.conducted_at NULLS LAST, i.created_at
  `)) as unknown as Array<{ participant_code: string | null; n: number | string }>

  return rows.map((r, i) => ({
    label: r.participant_code ?? `#${i + 1}`,
    count: Number(r.n),
  }))
}
