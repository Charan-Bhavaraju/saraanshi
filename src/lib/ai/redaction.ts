// Pre-processing applied to ALL text before it leaves the system to any model.
// Replaces participant real names and known hospital names with codes, so no
// directly-identifying PII reaches a third-party API. Pure functions only —
// callers fetch decrypted names (from the decrypted_contacts view) and build
// the entry list, then pass text through redactText.

export type RedactionEntry = {
  // Literal string to match (case-insensitive, whole-token). NOT a regex.
  pattern: string
  // What to substitute in its place, e.g. '[P-007]' or '[HOSPITAL-1]'.
  replacement: string
}

// Common Hyderabad / Telangana cancer-care facilities. Longer, more-specific
// names must precede their shorter forms so "MNJ Cancer Hospital" is replaced
// as a whole before the bare "MNJ" entry can match.
export const DEFAULT_HOSPITAL_ALIASES: RedactionEntry[] = [
  { pattern: 'MNJ Institute of Oncology', replacement: '[HOSPITAL-1]' },
  { pattern: 'MNJ Cancer Hospital', replacement: '[HOSPITAL-1]' },
  { pattern: 'MNJ', replacement: '[HOSPITAL-1]' },
  { pattern: 'Basavatarakam Indo American Cancer Hospital', replacement: '[HOSPITAL-2]' },
  { pattern: 'Basavatarakam', replacement: '[HOSPITAL-2]' },
  { pattern: 'Apollo Cancer Centre', replacement: '[HOSPITAL-3]' },
  { pattern: 'Apollo', replacement: '[HOSPITAL-3]' },
  { pattern: 'Yashoda', replacement: '[HOSPITAL-4]' },
  { pattern: 'NIMS', replacement: '[HOSPITAL-5]' },
  { pattern: 'Osmania General Hospital', replacement: '[HOSPITAL-6]' },
  { pattern: 'Osmania', replacement: '[HOSPITAL-6]' },
  { pattern: 'Gandhi Hospital', replacement: '[HOSPITAL-7]' },
  { pattern: 'KIMS', replacement: '[HOSPITAL-8]' },
  { pattern: 'Care Hospital', replacement: '[HOSPITAL-9]' },
  { pattern: 'Omega Hospital', replacement: '[HOSPITAL-10]' },
]

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Build redaction entries from decrypted participant names. For each contact we
// redact the full name AND each individual name token of length >= 3 (people are
// often referred to by first name alone in transcripts), all mapping to the same
// participant code.
export function buildNameEntries(
  contacts: Array<{ realName: string | null | undefined; code: string }>,
): RedactionEntry[] {
  const entries: RedactionEntry[] = []
  for (const c of contacts) {
    const name = c.realName?.trim()
    if (!name) continue
    const replacement = `[${c.code}]`
    entries.push({ pattern: name, replacement })
    for (const token of name.split(/\s+/)) {
      if (token.length >= 3) entries.push({ pattern: token, replacement })
    }
  }
  return entries
}

// Replace every entry's pattern in `text`. Matching is case-insensitive and
// avoids partial-word hits in Latin script (so "Apollo" does not match inside
// "Apollonia"). Entries are applied longest-pattern-first to prevent a short
// alias from clobbering a longer one. Returns the redacted text and a count of
// substitutions made.
export function redactText(
  text: string,
  entries: RedactionEntry[],
): { text: string; count: number } {
  if (!text) return { text, count: 0 }

  // Dedupe and sort longest-first so specific names win over their substrings.
  const seen = new Set<string>()
  const ordered = entries
    .filter(e => {
      if (!e.pattern || seen.has(e.pattern.toLowerCase())) return false
      seen.add(e.pattern.toLowerCase())
      return true
    })
    .sort((a, b) => b.pattern.length - a.pattern.length)

  let result = text
  let count = 0
  for (const entry of ordered) {
    // (?<![A-Za-z0-9]) ... (?![A-Za-z0-9]) gives whole-token matching for Latin
    // script while still matching names adjacent to Telugu/Devanagari characters.
    const re = new RegExp(
      `(?<![A-Za-z0-9])${escapeRegExp(entry.pattern)}(?![A-Za-z0-9])`,
      'gi',
    )
    result = result.replace(re, () => {
      count++
      return entry.replacement
    })
  }
  return { text: result, count }
}

// Convenience: redact against participant names + the default hospital list.
export function redact(
  text: string,
  contacts: Array<{ realName: string | null | undefined; code: string }>,
  extraEntries: RedactionEntry[] = [],
): { text: string; count: number } {
  const entries = [
    ...buildNameEntries(contacts),
    ...DEFAULT_HOSPITAL_ALIASES,
    ...extraEntries,
  ]
  return redactText(text, entries)
}
