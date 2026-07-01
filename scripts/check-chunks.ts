import { db } from '@/db'
import { interviews, transcripts, transcriptChunks } from '@/db/schema'
import { sql, count, eq, and, isNull, inArray } from 'drizzle-orm'
import type { TranscriptSegment, TranslationSegment } from '@/types/database'

async function main() {
  // 1. Current chunk stats
  const [totals] = await db.select({
    totalChunks: count(),
    interviews: sql<number>`COUNT(DISTINCT interview_id)`,
  }).from(transcriptChunks)

  console.log(`\n=== Current Chunk Stats ===`)
  console.log(`Total chunks: ${totals.totalChunks}`)
  console.log(`Distinct interviews: ${totals.interviews}`)

  const wordStats = await db.execute(sql`
    SELECT
      AVG(array_length(string_to_array(content, ' '), 1))::int AS avg_words,
      MIN(array_length(string_to_array(content, ' '), 1)) AS min_words,
      MAX(array_length(string_to_array(content, ' '), 1)) AS max_words
    FROM transcript_chunks
  `) as unknown as Array<{ avg_words: number; min_words: number; max_words: number }>
  const ws = wordStats[0]
  console.log(`Avg/Min/Max words per chunk: ${ws.avg_words} / ${ws.min_words} / ${ws.max_words}`)

  // 2. Check how many interviews have translations
  const INDEXABLE = ['reviewed', 'analyzed'] as const
  const allTranscripts = await db
    .select({
      interviewId: transcripts.interviewId,
      participantCode: interviews.participantCode,
      language: transcripts.language,
      segmentCount: sql<number>`jsonb_array_length(COALESCE(${transcripts.segments}, '[]'::jsonb))`,
      translationCount: sql<number>`jsonb_array_length(COALESCE(${transcripts.translationSegments}, '[]'::jsonb))`,
      hasEnglishTranslation: sql<boolean>`${transcripts.englishTranslation} IS NOT NULL`,
    })
    .from(transcripts)
    .innerJoin(interviews, eq(interviews.id, transcripts.interviewId))
    .where(and(
      eq(transcripts.isCurrent, true),
      inArray(interviews.status, [...INDEXABLE]),
      isNull(interviews.deletedAt),
    ))

  console.log(`\n=== Translation Coverage ===`)
  console.log(`Total indexable interviews: ${allTranscripts.length}`)
  const withTranslation = allTranscripts.filter(t => t.translationCount > 0)
  const withoutTranslation = allTranscripts.filter(t => t.translationCount === 0)
  console.log(`With segment translations: ${withTranslation.length}`)
  console.log(`Without segment translations: ${withoutTranslation.length}`)

  for (const t of allTranscripts) {
    console.log(`  ${t.participantCode}: lang=${t.language}, segments=${t.segmentCount}, translationSegs=${t.translationCount}, fullEnglish=${t.hasEnglishTranslation}`)
  }

  // 3. Dry-run: pick one interview WITH translations and check the mapping
  if (withTranslation.length > 0) {
    const sample = withTranslation[0]
    console.log(`\n=== Dry-Run: ${sample.participantCode} ===`)

    const [tr] = await db
      .select({ segments: transcripts.segments, translationSegments: transcripts.translationSegments })
      .from(transcripts)
      .where(and(eq(transcripts.interviewId, sample.interviewId), eq(transcripts.isCurrent, true)))
      .limit(1)

    const segments = (tr?.segments as TranscriptSegment[] | null) ?? []
    const translationSegs = (tr?.translationSegments as TranslationSegment[] | null) ?? []

    console.log(`Segments: ${segments.length}`)
    console.log(`Translation segments: ${translationSegs.length}`)

    // Check what segmentIdx values look like
    const idxValues = translationSegs.slice(0, 10).map(ts => ts.segmentIdx)
    console.log(`First 10 translation segmentIdx values: ${JSON.stringify(idxValues)}`)

    // Build the map as indexing.ts does
    const translationMap = new Map<number, string>()
    for (const ts of translationSegs) {
      if (ts.enText?.trim()) translationMap.set(ts.segmentIdx, ts.enText)
    }
    console.log(`Translation map size: ${translationMap.size}`)

    // Show first 5 segments with/without translation
    console.log(`\nFirst 5 segments (origIdx → text vs translation):`)
    for (let i = 0; i < Math.min(5, segments.length); i++) {
      const s = segments[i]
      const en = translationMap.get(i)
      const chosen = en ?? s.text
      console.log(`  [${i}] hidden=${s.hidden ?? false}`)
      console.log(`    original: ${s.text?.slice(0, 80)}...`)
      console.log(`    translation: ${en ? en.slice(0, 80) + '...' : '(none)'}`)
      console.log(`    → will use: ${chosen.slice(0, 80)}...`)
    }
  }

  // 4. Sample 5 stored chunks — check language
  const samples = await db.execute(sql`
    SELECT tc.content, i.participant_code,
           array_length(string_to_array(tc.content, ' '), 1) AS word_count
    FROM transcript_chunks tc
    JOIN interviews i ON i.id = tc.interview_id
    ORDER BY RANDOM()
    LIMIT 5
  `) as unknown as Array<{ content: string; participant_code: string; word_count: number }>

  console.log(`\n=== Sample Stored Chunks (5 random) ===`)
  for (const s of samples) {
    console.log(`\n[${s.participant_code}] (${s.word_count} words):`)
    console.log(s.content.slice(0, 200) + (s.content.length > 200 ? '...' : ''))
  }

  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
