import { costInrPaise } from './cost'
import { logUsage, type UsageOperation } from './usage'

// Model IDs. Sonnet 4.5 for chat/findings, Haiku 4.5 for structured extraction.
// NOTE: both are pre-4.6 models, which still support the assistant-prefill trick
// used by callJSON. Bumping either to claude-sonnet-4-6 / claude-haiku-4-5 (4.6+)
// would 400 on the prefilled assistant turn — switch to output_config.format then.
export const MODELS = {
  haiku: 'claude-haiku-4-5-20251001',
  sonnet: 'claude-sonnet-4-5',
} as const

type Usage = {
  input_tokens?: number
  output_tokens?: number
  cache_read_input_tokens?: number
  cache_creation_input_tokens?: number
}

type Message = {
  id?: string
  content: Array<{ type: string; text?: string }>
  stop_reason: string | null
  usage?: Usage
}

type AnthropicClient = {
  messages: { create: (opts: Record<string, unknown>) => Promise<Message> }
}

// Constructs the Anthropic client. ZERO DATA RETENTION is configured at the
// ORG level in the Anthropic console — there is no per-request ZDR header. The
// defaultHeaders seam below is left for any future beta headers; redaction
// (lib/ai/redaction.ts) is our actual PII defense before any call.
export function getClient(): AnthropicClient {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { default: Anthropic } = require('@anthropic-ai/sdk')
  return new Anthropic({ apiKey }) as AnthropicClient
}

// Extracts the first balanced JSON value from `raw`, scanning from the opening
// delimiter to its match and discarding any trailing prose/markdown. Handles both
// object ('{') and array ('[') forms and ignores delimiters inside strings.
export function extractBalanced(raw: string, open: '{' | '[' = '{'): string {
  const close = open === '{' ? '}' : ']'
  const s = raw.replace(/```(?:json)?/gi, '')
  const start = s.indexOf(open)
  if (start === -1) throw new Error(`No '${open}' found in model output`)

  let depth = 0
  let inStr = false
  let esc = false
  for (let i = start; i < s.length; i++) {
    const ch = s[i]
    if (inStr) {
      if (esc) esc = false
      else if (ch === '\\') esc = true
      else if (ch === '"') inStr = false
      continue
    }
    if (ch === '"') inStr = true
    else if (ch === open) depth++
    else if (ch === close) {
      depth--
      if (depth === 0) return s.slice(start, i + 1)
    }
  }
  throw new Error('Unbalanced JSON in model output')
}

type CallJSONOpts = {
  model: string
  system: string
  user: string
  operation: UsageOperation
  // '{' for an object response (default), '[' for an array. Prepended to the
  // assistant turn to force JSON and used as the balance delimiter.
  prime?: '{' | '['
  maxTokens?: number
  interviewId?: string | null
  // Cache the (stable) system prompt for ~90% cheaper repeat calls. On by default.
  cacheSystem?: boolean
}

export type CallJSONResult<T> = {
  data: T
  model: string
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  costInrPaise: number
}

// One structured JSON call. Primes the assistant turn with the opening delimiter,
// reads the response, extracts the balanced JSON value, logs usage+cost, and
// returns the parsed object plus token/cost detail (so callers can persist cost).
// Throws on max_tokens truncation or parse failure.
export async function callJSON<T>(opts: CallJSONOpts): Promise<CallJSONResult<T>> {
  const {
    model,
    system,
    user,
    operation,
    prime = '{',
    maxTokens = 4096,
    interviewId = null,
    cacheSystem = true,
  } = opts

  const client = getClient()
  const message = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system: cacheSystem
      ? [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }]
      : system,
    messages: [
      { role: 'user', content: user },
      { role: 'assistant', content: prime },
    ],
  })

  if (message.stop_reason === 'max_tokens') {
    throw new Error(`Response hit max_tokens (${maxTokens}) for operation ${operation}`)
  }

  const body = message.content[0]?.type === 'text' ? message.content[0].text ?? '' : ''
  const json = extractBalanced(prime + body, prime)

  const u = message.usage ?? {}
  const inputTokens = u.input_tokens ?? 0
  const outputTokens = u.output_tokens ?? 0
  const cacheReadTokens = u.cache_read_input_tokens ?? 0
  const cost = costInrPaise(model, inputTokens, outputTokens, cacheReadTokens)

  await logUsage({
    interviewId,
    provider: 'anthropic',
    operation,
    model,
    inputTokens,
    outputTokens,
    costInrPaise: cost,
    requestId: message.id ?? null,
  })

  return {
    data: JSON.parse(json) as T,
    model,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    costInrPaise: cost,
  }
}

type CallTextOpts = {
  model: string
  system: string
  user: string
  operation: UsageOperation
  maxTokens?: number
  interviewId?: string | null
  cacheSystem?: boolean
}

export type CallTextResult = {
  text: string
  model: string
  inputTokens: number
  outputTokens: number
  costInrPaise: number
}

// One prose (non-JSON) call — for findings drafting. Caches the system prompt,
// logs usage+cost, and returns the assistant's text.
export async function callText(opts: CallTextOpts): Promise<CallTextResult> {
  const {
    model,
    system,
    user,
    operation,
    maxTokens = 2048,
    interviewId = null,
    cacheSystem = true,
  } = opts

  const client = getClient()
  const message = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system: cacheSystem
      ? [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }]
      : system,
    messages: [{ role: 'user', content: user }],
  })

  const text = message.content
    .filter(b => b.type === 'text')
    .map(b => b.text ?? '')
    .join('')
    .trim()

  const u = message.usage ?? {}
  const inputTokens = u.input_tokens ?? 0
  const outputTokens = u.output_tokens ?? 0
  const cost = costInrPaise(model, inputTokens, outputTokens, u.cache_read_input_tokens ?? 0)

  await logUsage({
    interviewId,
    provider: 'anthropic',
    operation,
    model,
    inputTokens,
    outputTokens,
    costInrPaise: cost,
    requestId: message.id ?? null,
  })

  return { text, model, inputTokens, outputTokens, costInrPaise: cost }
}
