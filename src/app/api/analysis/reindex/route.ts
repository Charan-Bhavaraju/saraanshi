import { NextRequest, NextResponse } from 'next/server'
import { deleteAllChunks, getIndexableInterviews, indexInterview } from '@/lib/rag/indexing'

export const maxDuration = 300 // 5 min — re-indexing can be slow

// SSE stream: optionally delete all chunks, then re-index interviews one by one.
// ?mode=continue  → skip delete, only index interviews without chunks (or stale)
// ?mode=full      → delete all chunks first, then re-index everything (default)
export async function POST(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get('mode') ?? 'full'
  const force = mode === 'full'
  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      function send(data: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        if (force) {
          // Step 1: delete all existing chunks
          send({ phase: 'deleting', message: 'Deleting existing chunks…' })
          const { deleted } = await deleteAllChunks()
          send({ phase: 'deleted', deleted })
        }

        // Step 2: get all indexable interviews
        const interviews = await getIndexableInterviews()
        const total = interviews.length
        send({ phase: 'indexing', total, completed: 0, totalChunks: 0 })

        // Step 3: index each interview, streaming progress
        let completed = 0
        let totalChunks = 0
        let indexed = 0
        for (let idx = 0; idx < interviews.length; idx++) {
          // Pause 2s between interviews to stay under Gemini free-tier rate limit (100 req/min)
          if (idx > 0) await new Promise(r => setTimeout(r, 2000))
          const iv = interviews[idx]
          const r = await indexInterview(iv.id, { force })
          completed++
          if (!r.skipped) {
            indexed++
            totalChunks += r.chunks
          }
          send({
            phase: 'indexing',
            total,
            completed,
            indexed,
            totalChunks,
            current: iv.participantCode ?? iv.id,
            currentChunks: r.chunks,
            skipped: r.skipped,
          })
        }

        send({ phase: 'done', total: completed, indexed, totalChunks })
      } catch (err) {
        send({ phase: 'error', message: err instanceof Error ? err.message : 'Unknown error' })
      } finally {
        controller.close()
      }
    },
  })

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
    },
  })
}
