import { describe, it, expect } from 'vitest'
import { chunkSegments } from './chunking'

function words(n: number): string {
  return Array.from({ length: n }, (_, i) => `w${i}`).join(' ')
}

describe('chunkSegments', () => {
  it('returns one chunk when under the target size', () => {
    const chunks = chunkSegments([{ start: 0, end: 10, text: words(50) }])
    expect(chunks).toHaveLength(1)
    expect(chunks[0].chunkIdx).toBe(0)
    expect(chunks[0].startSeconds).toBe(0)
    expect(chunks[0].endSeconds).toBe(10)
    expect(chunks[0].content.split(' ')).toHaveLength(50)
  })

  it('produces overlapping windows for long input', () => {
    // 350 words, target 200, overlap 50 → step 150 → windows at 0 and 150.
    // The 150-window reaches the end (150+200 ≥ 350) so the loop stops; together
    // the two windows cover all 350 words with a 50-word overlap.
    const chunks = chunkSegments([{ start: 0, end: 100, text: words(350) }])
    expect(chunks.length).toBe(2)
    expect(chunks[0].content.startsWith('w0 ')).toBe(true)
    expect(chunks[1].content.startsWith('w150 ')).toBe(true)
    expect(chunks[1].content.endsWith(' w349')).toBe(true) // last word covered
  })

  it('covers trailing words when the final partial window is needed', () => {
    // 360 words → windows at 0, 150, 300 (300-window is partial: 60 words)
    const chunks = chunkSegments([{ start: 0, end: 100, text: words(360) }])
    expect(chunks.length).toBe(3)
    expect(chunks[2].content.startsWith('w300 ')).toBe(true)
    expect(chunks[2].content.endsWith(' w359')).toBe(true)
  })

  it('maps timestamps from the originating segments', () => {
    const chunks = chunkSegments(
      [
        { start: 0, end: 5, text: words(120) },
        { start: 5, end: 9, text: words(120) },
      ],
      { targetWords: 200, overlapWords: 50 },
    )
    // first window spans both segments → start 0, end 9
    expect(chunks[0].startSeconds).toBe(0)
    expect(chunks[0].endSeconds).toBe(9)
  })

  it('skips empty/whitespace segments', () => {
    const chunks = chunkSegments([
      { start: 0, end: 1, text: '   ' },
      { start: 1, end: 2, text: 'hello world' },
    ])
    expect(chunks).toHaveLength(1)
    expect(chunks[0].content).toBe('hello world')
    expect(chunks[0].startSeconds).toBe(1)
  })

  it('returns nothing for empty input', () => {
    expect(chunkSegments([])).toEqual([])
  })
})
