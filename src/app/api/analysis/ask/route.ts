import { NextRequest, NextResponse } from 'next/server'
import { embed, toVectorLiteral } from '@/lib/ai/gemini'
import { retrieveChunks } from '@/lib/rag/indexing'
import { getClient, MODELS } from '@/lib/ai/anthropic'
import { logUsage } from '@/lib/ai/usage'
import { costInrPaise } from '@/lib/ai/cost'
import { RAG_SYSTEM, MAX_TOKENS } from '@/lib/ai/prompts'

export const maxDuration = 120

const TOP_K = 40
const SUB_QUERY_K = 15

function mmss(s: number): string {
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

// Streaming protocol: the FIRST line of the body is a JSON object
// {"sources":[...]} (with full chunk content, for client-side quote
// verification), followed by '\n', then the streamed answer text.
export async function POST(req: NextRequest) {
  let question = ''
  let subQueries: string[] = []
  try {
    const body = await req.json()
    question = (body?.question ?? '').toString().trim()
    if (Array.isArray(body?.subQueries)) {
      subQueries = body.subQueries.map((q: unknown) => String(q).trim()).filter(Boolean)
    }
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }
  if (!question) return NextResponse.json({ error: 'Empty question' }, { status: 400 })

  if (!process.env.ANTHROPIC_API_KEY || !process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'AI not configured' }, { status: 503 })
  }

  // Multi-query retrieval: if subQueries provided, embed each separately,
  // retrieve SUB_QUERY_K per sub-query, then deduplicate by chunkId.
  // This prevents a single blended embedding from missing niche sub-themes.
  type Chunk = Awaited<ReturnType<typeof retrieveChunks>>[number]
  let retrieved: Chunk[]

  if (subQueries.length > 0) {
    const seen = new Set<string>()
    const all: Chunk[] = []
    for (const sq of subQueries) {
      const vec = await embed(sq, 'RETRIEVAL_QUERY')
      const hits = await retrieveChunks(toVectorLiteral(vec), SUB_QUERY_K)
      for (const h of hits) {
        if (!seen.has(h.chunkId)) {
          seen.add(h.chunkId)
          all.push(h)
        }
      }
    }
    retrieved = all
  } else {
    const queryVec = await embed(question, 'RETRIEVAL_QUERY')
    retrieved = await retrieveChunks(toVectorLiteral(queryVec), TOP_K)
  }

  const sources = retrieved.map(r => ({
    chunkId: r.chunkId,
    interviewId: r.interviewId,
    participantCode: r.participantCode,
    startSeconds: r.startSeconds,
    preview: r.content.slice(0, 180),
    content: r.content,
  }))

  const encoder = new TextEncoder()
  const sourcesLine = JSON.stringify({ sources }) + '\n'

  // Nothing indexed / nothing relevant — answer without spending on Claude.
  if (retrieved.length === 0) {
    return new NextResponse(
      sourcesLine +
        'No indexed passages matched this question. Make sure interviews are reviewed and the corpus is indexed (Analysis → Ask the corpus → Index).',
      { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
    )
  }

  const contextBlocks = retrieved
    .map(r => `[${r.participantCode ?? '?'} · ${mmss(r.startSeconds)}]\n${r.content}`)
    .join('\n\n')
  const userPrompt = `Transcript passages (given in retrieval-relevance order — re-sort per your instructions before citing):\n\n${contextBlocks}\n\nQuestion: ${question}`

  type StreamClient = {
    messages: {
      stream: (opts: Record<string, unknown>) => AsyncIterable<{
        type: string
        delta?: { type: string; text?: string }
      }> & { finalMessage: () => Promise<{ id?: string; usage?: Record<string, number> }> }
    }
  }
  const client = getClient() as unknown as StreamClient

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode(sourcesLine))
      try {
        const ms = client.messages.stream({
          model: MODELS.sonnet,
          max_tokens: MAX_TOKENS.rag,
          system: [{ type: 'text', text: RAG_SYSTEM, cache_control: { type: 'ephemeral' } }],
          messages: [{ role: 'user', content: userPrompt }],
        })

        for await (const ev of ms) {
          if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta' && ev.delta.text) {
            controller.enqueue(encoder.encode(ev.delta.text))
          }
        }

        const final = await ms.finalMessage()
        const u = final.usage ?? {}
        await logUsage({
          provider: 'anthropic',
          operation: 'rag_chat',
          model: MODELS.sonnet,
          inputTokens: u.input_tokens ?? 0,
          outputTokens: u.output_tokens ?? 0,
          costInrPaise: costInrPaise(
            MODELS.sonnet,
            u.input_tokens ?? 0,
            u.output_tokens ?? 0,
            u.cache_read_input_tokens ?? 0,
          ),
          requestId: final.id ?? null,
        })
      } catch (err) {
        console.error('[ask] stream error', err)
        controller.enqueue(encoder.encode('\n\n[The answer could not be generated. Please try again.]'))
      } finally {
        controller.close()
      }
    },
  })

  return new NextResponse(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
