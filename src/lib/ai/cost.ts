// Cost accounting for Phase 4 AI calls. Money is tracked in paise (1/100 INR)
// as integers — consistent with usage_log.cost_inr_paise — to avoid float drift.

// USD→INR conversion for cost estimates. Approximate; the dashboard is an
// awareness tool, not an invoice. Bump if the rate drifts materially.
export const INR_PER_USD = 88

// Per-million-token USD pricing. Keep model IDs in sync with MODELS in anthropic.ts.
export const PRICING: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5-20251001': { input: 1.0, output: 5.0 },
  'claude-sonnet-4-5': { input: 3.0, output: 15.0 },
}

// Cache reads bill at ~0.1× the input rate.
const CACHE_READ_MULTIPLIER = 0.1

export function costInrPaise(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens = 0,
): number {
  const p = PRICING[model]
  if (!p) return 0
  const usd =
    (inputTokens * p.input +
      outputTokens * p.output +
      cacheReadTokens * p.input * CACHE_READ_MULTIPLIER) /
    1_000_000
  return Math.round(usd * INR_PER_USD * 100)
}

export function formatPaise(paise: number | null | undefined): string {
  return '₹' + ((paise ?? 0) / 100).toFixed(2)
}

// Rough cost preview for a Layer-1 insights run (one Haiku call).
// ~2000 output tokens is typical for the structured response.
export function estimateInsightsPaise(
  model: string,
  approxInputTokens: number,
  approxOutputTokens = 2000,
): number {
  return costInrPaise(model, approxInputTokens, approxOutputTokens)
}
