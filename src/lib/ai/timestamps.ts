// Normalize timestamps returned by the AI into seconds.
// The AI may return:
//   - A number in seconds (correct): 125
//   - A string like "2:05" or "58:55" (m:ss format)
//   - A number that looks like m*100+ss (e.g. 5855 for 58:55)

function parseOne(v: unknown): number | null {
  if (typeof v === 'number') {
    if (!Number.isFinite(v) || v < 0) return null
    return Math.floor(v)
  }
  if (typeof v === 'string') {
    const trimmed = v.trim().replace(/s$/i, '')
    // "2:05" or "58:55"
    const parts = trimmed.match(/^(\d+):(\d{1,2})$/)
    if (parts) return Number(parts[1]) * 60 + Number(parts[2])
    const n = Number(trimmed)
    if (Number.isFinite(n) && n >= 0) return Math.floor(n)
  }
  return null
}

export function normalizeTimestamps(raw: unknown): number[] {
  if (!Array.isArray(raw)) return []
  return raw.map(parseOne).filter((v): v is number => v !== null)
}
