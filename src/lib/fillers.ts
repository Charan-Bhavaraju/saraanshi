const FILLER_WORDS = new Set([
  // English
  'hmm', 'hm', 'hmm hmm', 'mm', 'mm hmm', 'mhm', 'mmm',
  'uh', 'uhh', 'um', 'umm', 'ah', 'ahh', 'oh', 'ohh',
  'eh', 'huh', 'ugh', 'ahem',
  'okay', 'ok', 'okay okay', 'ok ok',
  'yeah', 'yeah yeah', 'yep', 'yup',
  'right', 'right right', 'alright',
  'sure', 'fine',
  'yes', 'no',
  // Telugu (transliterated)
  'ha', 'haa', 'haaa', 'aa', 'aaa', 'oo', 'ooo', 'ao',
  'antey', 'ante', 'adi', 'idi',
  // Hindi (transliterated)
  'haan', 'han', 'haan haan',
  'acha', 'accha', 'achha',
  'theek', 'theek hai', 'theek theek',
  'bas', 'bas bas',
  'arre', 'are',
  'ji', 'ji ji', 'ji haan',
  'matlab',
])

export function isFillerSegment(text: string): boolean {
  const normalized = text
    .trim()
    .toLowerCase()
    .replace(/[.,!?…\-–—]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  // Filler segments are short — anything over 20 chars is likely real content
  if (normalized.length > 20) return false

  return FILLER_WORDS.has(normalized)
}
