import { logUsage } from './usage'

// Gemini gemini-embedding-001 via raw REST (no SDK dependency). 768 dimensions.
// Free tier — every call is still logged to usage_log at ₹0 for completeness.

const MODEL = 'models/gemini-embedding-001'
export const EMBEDDING_DIM = 768
const BASE = 'https://generativelanguage.googleapis.com/v1beta'
// batchEmbedContents accepts at most 100 requests per call.
const MAX_BATCH = 100

// taskType tunes the embedding for its use. SEMANTIC_SIMILARITY for focus-point
// clustering (Layer 2); RETRIEVAL_DOCUMENT for transcript chunks and
// RETRIEVAL_QUERY for the question (Layer 3 RAG).
export type EmbeddingTaskType =
  | 'SEMANTIC_SIMILARITY'
  | 'RETRIEVAL_DOCUMENT'
  | 'RETRIEVAL_QUERY'

function apiKey(): string {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY is not configured')
  return key
}

// Formats an embedding as a pgvector literal for use in raw SQL (the `<=>`
// operator and inserts into vector columns): [0.1,0.2,...].
export function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(',')}]`
}

export async function embed(
  text: string,
  taskType: EmbeddingTaskType = 'SEMANTIC_SIMILARITY',
): Promise<number[]> {
  const res = await fetch(`${BASE}/${MODEL}:embedContent?key=${apiKey()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      content: { parts: [{ text }] },
      taskType,
      outputDimensionality: EMBEDDING_DIM,
    }),
  })
  if (!res.ok) {
    throw new Error(`Gemini embed failed: ${res.status} ${await res.text()}`)
  }
  const json = (await res.json()) as { embedding?: { values?: number[] } }
  const values = json.embedding?.values
  if (!values || values.length === 0) throw new Error('Gemini returned no embedding')

  await logUsage({ provider: 'gemini', operation: 'embedding', model: MODEL, costInrPaise: 0 })
  return values
}

// Embeds many texts, chunking into requests of <= 100. Order is preserved.
export async function embedBatch(
  texts: string[],
  taskType: EmbeddingTaskType = 'SEMANTIC_SIMILARITY',
): Promise<number[][]> {
  if (texts.length === 0) return []
  const out: number[][] = []

  for (let i = 0; i < texts.length; i += MAX_BATCH) {
    const slice = texts.slice(i, i + MAX_BATCH)
    const res = await fetch(`${BASE}/${MODEL}:batchEmbedContents?key=${apiKey()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: slice.map(text => ({
          model: MODEL,
          content: { parts: [{ text }] },
          taskType,
          outputDimensionality: EMBEDDING_DIM,
        })),
      }),
    })
    if (!res.ok) {
      throw new Error(`Gemini batch embed failed: ${res.status} ${await res.text()}`)
    }
    const json = (await res.json()) as { embeddings?: Array<{ values?: number[] }> }
    const embeddings = json.embeddings ?? []
    if (embeddings.length !== slice.length) {
      throw new Error(`Gemini returned ${embeddings.length} embeddings for ${slice.length} inputs`)
    }
    for (const e of embeddings) {
      if (!e.values || e.values.length === 0) throw new Error('Gemini returned an empty embedding')
      out.push(e.values)
    }
  }

  // One log row per invocation (not per text) to keep usage_log readable.
  await logUsage({ provider: 'gemini', operation: 'embedding', model: MODEL, costInrPaise: 0 })
  return out
}
