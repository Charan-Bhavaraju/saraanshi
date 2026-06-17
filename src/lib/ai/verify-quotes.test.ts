import { describe, it, expect } from 'vitest'
import { verifyQuotes, QUOTE_PLACEHOLDER } from './verify-quotes'

const SEGMENTS = [
  'The doctor told me the treatment would cost more than we could afford.',
  'My husband had to sell part of our land to pay for the chemotherapy.',
]

describe('verifyQuotes', () => {
  it('keeps a verbatim quote', () => {
    const r = verifyQuotes(
      'She said, "the treatment would cost more than we could afford".',
      SEGMENTS,
    )
    expect(r.text).toContain('the treatment would cost more than we could afford')
    expect(r.removed).toBe(0)
    expect(r.checked).toBe(1)
  })

  it('strips a fabricated quote', () => {
    const r = verifyQuotes(
      'She said, "I felt completely abandoned by the entire health system".',
      SEGMENTS,
    )
    expect(r.text).toContain(QUOTE_PLACEHOLDER)
    expect(r.removed).toBe(1)
    expect(r.checked).toBe(1)
  })

  it('tolerates whitespace and case differences for verbatim match', () => {
    const r = verifyQuotes(
      'The participant noted: "The   Treatment Would Cost More Than We Could Afford".',
      SEGMENTS,
    )
    expect(r.removed).toBe(0)
  })

  it('leaves short scare-quotes alone', () => {
    const r = verifyQuotes('The notion of "cost" came up repeatedly.', SEGMENTS)
    expect(r.text).toContain('"cost"')
    expect(r.removed).toBe(0)
    expect(r.checked).toBe(0)
  })

  it('handles curly/smart quotes', () => {
    const r = verifyQuotes(
      'She said, “I felt completely abandoned by the entire health system”.',
      SEGMENTS,
    )
    expect(r.text).toContain(QUOTE_PLACEHOLDER)
    expect(r.removed).toBe(1)
  })

  it('handles a mix: keeps the real one, strips the fake one', () => {
    const r = verifyQuotes(
      'First "my husband had to sell part of our land to pay for the chemotherapy" and then "the nurses were all secretly trained abroad".',
      SEGMENTS,
    )
    expect(r.checked).toBe(2)
    expect(r.removed).toBe(1)
    expect(r.text).toContain('my husband had to sell part of our land')
    expect(r.text).toContain(QUOTE_PLACEHOLDER)
  })
})
