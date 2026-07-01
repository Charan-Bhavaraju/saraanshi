// Splits transcript segments into overlapping word-windows for RAG indexing.
// ~80-word windows with ~20-word overlap for tight, quotable passages. Each chunk's start/end seconds are
// taken from the segments its first/last words came from (we have segment-level,
// not word-level, timestamps — close enough for "jump to this passage").
// Pure function — no I/O.

export type ChunkInput = { start: number; end: number; text: string }
export type Chunk = {
  chunkIdx: number
  content: string
  startSeconds: number
  endSeconds: number
}

export function chunkSegments(
  segments: ChunkInput[],
  opts: { targetWords?: number; overlapWords?: number } = {},
): Chunk[] {
  const target = opts.targetWords ?? 80
  const overlap = opts.overlapWords ?? 20
  const step = Math.max(1, target - overlap)

  // Flatten to words carrying their segment's timestamps.
  const words: Array<{ w: string; start: number; end: number }> = []
  for (const seg of segments) {
    const text = seg.text?.trim()
    if (!text) continue
    for (const w of text.split(/\s+/)) {
      if (w) words.push({ w, start: seg.start, end: seg.end })
    }
  }

  if (words.length === 0) return []

  const chunks: Chunk[] = []
  let idx = 0
  for (let i = 0; i < words.length; i += step) {
    const window = words.slice(i, i + target)
    if (window.length === 0) break
    chunks.push({
      chunkIdx: idx++,
      content: window.map(x => x.w).join(' '),
      startSeconds: window[0].start,
      endSeconds: window[window.length - 1].end,
    })
    if (i + target >= words.length) break // last window reached
  }
  return chunks
}
