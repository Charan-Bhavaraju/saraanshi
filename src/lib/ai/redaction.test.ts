import { describe, it, expect } from 'vitest'
import {
  redactText,
  buildNameEntries,
  redact,
  DEFAULT_HOSPITAL_ALIASES,
  type RedactionEntry,
} from './redaction'

describe('buildNameEntries', () => {
  it('creates entries for the full name and each token >= 3 chars', () => {
    const entries = buildNameEntries([{ realName: 'Lakshmi Devi', code: 'P-007' }])
    const patterns = entries.map(e => e.pattern)
    expect(patterns).toContain('Lakshmi Devi')
    expect(patterns).toContain('Lakshmi')
    expect(patterns).toContain('Devi')
    expect(entries.every(e => e.replacement === '[P-007]')).toBe(true)
  })

  it('skips short tokens and blank names', () => {
    const entries = buildNameEntries([
      { realName: 'Jo Li', code: 'P-001' },
      { realName: '', code: 'P-002' },
      { realName: null, code: 'P-003' },
    ])
    const patterns = entries.map(e => e.pattern)
    expect(patterns).toContain('Jo Li')
    expect(patterns).not.toContain('Jo') // 2 chars
    expect(patterns).not.toContain('Li') // 2 chars
    expect(patterns.filter(p => p.startsWith('P-'))).toHaveLength(0)
  })
})

describe('redactText', () => {
  const entries: RedactionEntry[] = [{ pattern: 'Lakshmi', replacement: '[P-007]' }]

  it('replaces a name with its code', () => {
    const { text, count } = redactText('I met Lakshmi yesterday.', entries)
    expect(text).toBe('I met [P-007] yesterday.')
    expect(count).toBe(1)
  })

  it('is case-insensitive', () => {
    const { text, count } = redactText('lakshmi and LAKSHMI', entries)
    expect(text).toBe('[P-007] and [P-007]')
    expect(count).toBe(2)
  })

  it('does not match inside other words', () => {
    const { text, count } = redactText('Apollonia is not Apollo', [
      { pattern: 'Apollo', replacement: '[H]' },
    ])
    expect(text).toBe('Apollonia is not [H]')
    expect(count).toBe(1)
  })

  it('applies longest pattern first (hospital aliases)', () => {
    const { text } = redactText('treated at MNJ Cancer Hospital downtown', DEFAULT_HOSPITAL_ALIASES)
    expect(text).toBe('treated at [HOSPITAL-1] downtown')
  })

  it('redacts the bare alias when it stands alone', () => {
    const { text } = redactText('went to MNJ for chemo', DEFAULT_HOSPITAL_ALIASES)
    expect(text).toBe('went to [HOSPITAL-1] for chemo')
  })

  it('returns zero count and original text when nothing matches', () => {
    const { text, count } = redactText('nothing to redact here', entries)
    expect(text).toBe('nothing to redact here')
    expect(count).toBe(0)
  })

  it('handles empty input', () => {
    expect(redactText('', entries)).toEqual({ text: '', count: 0 })
  })

  it('matches a name adjacent to non-Latin (Telugu) script', () => {
    const { text, count } = redactText('డాక్టర్ Lakshmi గారు', entries)
    expect(text).toContain('[P-007]')
    expect(count).toBe(1)
  })
})

describe('redact (full pipeline)', () => {
  it('redacts both participant names and hospital names in one pass', () => {
    const { text, count } = redact(
      'Lakshmi was referred from MNJ to Apollo.',
      [{ realName: 'Lakshmi', code: 'P-007' }],
    )
    expect(text).toBe('[P-007] was referred from [HOSPITAL-1] to [HOSPITAL-3].')
    expect(count).toBe(3)
  })
})
