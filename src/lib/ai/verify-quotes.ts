// Post-processing applied to AI responses. Any substantial quoted string must
// match verbatim against the actual transcript segments; quotes that don't are
// replaced with a placeholder so fabricated/paraphrased "quotes" can never reach
// the researcher unflagged. Pure function — no I/O.

const PLACEHOLDER = '[claim removed — quote not verifiable]'

// Quotes shorter than this are treated as scare-quotes / emphasis, not verbatim
// transcript citations, and are left untouched (avoids stripping words like "cost").
const MIN_QUOTE_CHARS = 25

// Matches text inside straight ("...") or curly (“...”) double quotes.
const QUOTE_RE = /[“"]([^“”"]+)[”"]/g

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim()
}

export type VerifyResult = {
  text: string
  // Number of substantial quotes that failed verbatim verification (and were stripped).
  removed: number
  // Number of substantial quotes that were checked.
  checked: number
}

export function verifyQuotes(
  response: string,
  segmentTexts: Array<string | null | undefined>,
  opts: { minChars?: number } = {},
): VerifyResult {
  const minChars = opts.minChars ?? MIN_QUOTE_CHARS
  const haystack = normalize(segmentTexts.filter(Boolean).join(' '))

  let removed = 0
  let checked = 0

  const text = response.replace(QUOTE_RE, (match, inner: string) => {
    const quote = inner.trim()
    if (quote.length < minChars) return match // emphasis, not a citation — leave it
    checked++
    if (haystack.includes(normalize(quote))) return match // verbatim — keep
    removed++
    return PLACEHOLDER
  })

  return { text, removed, checked }
}

export { PLACEHOLDER as QUOTE_PLACEHOLDER }
