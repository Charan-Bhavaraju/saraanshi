'use server'

import { db } from '@/db'
import { themes, themeCodes, focusPoints } from '@/db/schema'
import { sql } from 'drizzle-orm'
import { embed, toVectorLiteral } from '@/lib/ai/gemini'

export type CodingTheme = { id: string; name: string; color: string | null }

export async function listThemesForCoding(): Promise<CodingTheme[]> {
  return db.select({ id: themes.id, name: themes.name, color: themes.color }).from(themes).orderBy(themes.name)
}

export async function createThemeForCoding(name: string): Promise<CodingTheme> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Theme name required')
  const [t] = await db
    .insert(themes)
    .values({ name: trimmed, createdBy: 'user', color: '#0E5C5C' })
    .returning({ id: themes.id, name: themes.name, color: themes.color })
  return t
}

// Code a selected passage to one or more themes (one theme_code per theme).
export async function codePassage(input: {
  interviewId: string
  segmentIdx: number
  excerpt: string
  themeIds: string[]
  memo?: string | null
}): Promise<{ coded: number }> {
  const { interviewId, segmentIdx, excerpt, themeIds, memo } = input
  if (themeIds.length === 0) return { coded: 0 }
  await db.insert(themeCodes).values(
    themeIds.map(themeId => ({
      themeId,
      interviewId,
      segmentIdx,
      excerpt,
      memo: memo ?? null,
    })),
  )
  return { coded: themeIds.length }
}

// Suggest other themes a passage may fit, by embedding the excerpt and finding
// the nearest promoted focus points (which carry a theme). Async, non-blocking
// in the UI. Returns at most 3 themes not already applied.
export async function suggestThemesForExcerpt(
  excerpt: string,
  excludeThemeIds: string[] = [],
): Promise<CodingTheme[]> {
  const text = excerpt.trim()
  if (text.length < 8) return []

  let literal: string
  try {
    literal = toVectorLiteral(await embed(text, 'SEMANTIC_SIMILARITY'))
  } catch {
    return [] // no GEMINI_API_KEY / embedding failure — skip silently
  }

  const rows = (await db.execute(sql`
    SELECT t.id, t.name, t.color, MIN(fp.embedding <=> ${literal}::vector) AS dist
    FROM focus_points fp
    JOIN themes t ON t.id = fp.promoted_to_theme_id
    WHERE fp.embedding IS NOT NULL
    GROUP BY t.id, t.name, t.color
    ORDER BY dist ASC
    LIMIT 8
  `)) as unknown as Array<{ id: string; name: string; color: string | null; dist: number | string }>

  const exclude = new Set(excludeThemeIds)
  return rows
    .filter(r => !exclude.has(r.id) && 1 - Number(r.dist) >= 0.55) // cosine sim >= 0.55
    .slice(0, 3)
    .map(r => ({ id: r.id, name: r.name, color: r.color }))
}
