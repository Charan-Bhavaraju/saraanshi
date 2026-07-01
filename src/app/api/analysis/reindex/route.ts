import { NextResponse } from 'next/server'
import { deleteAllChunks, getIndexableInterviews, indexInterview } from '@/lib/rag/indexing'

export const maxDuration = 300 // 5 min — re-indexing can be slow

// SSE stream: delete all chunks, then re-index each interview one by one,
// sending progress events so the client can show a real progress bar.
export async function POST() {
  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      function send(data: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        // Step 1: delete all existing chunks
        send({ phase: 'deleting', message: 'Deleting existing chunks…' })
        const { deleted } = await deleteAllChunks()
        send({ phase: 'deleted', deleted })

        // Step 2: get all indexable interviews
        const interviews = await getIndexableInterviews()
        const total = interviews.length
        send({ phase: 'indexing', total, completed: 0, totalChunks: 0 })

        // Step 3: index each interview, streaming progress
        let completed = 0
        let totalChunks = 0
        for (const iv of interviews) {
          const r = await indexInterview(iv.id, { force: true })
          completed++
          totalChunks += r.chunks
          send({
            phase: 'indexing',
            total,
            completed,
            totalChunks,
            current: iv.participantCode ?? iv.id,
            currentChunks: r.chunks,
          })
        }

        send({ phase: 'done', total: completed, totalChunks })
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
