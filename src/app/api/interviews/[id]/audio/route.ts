import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/db'
import { interviews } from '@/db/schema'
import { and, eq, isNull } from 'drizzle-orm'
import { presignDownload } from '@/lib/r2'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const [interview] = await db
    .select({ audioR2Key: interviews.audioR2Key })
    .from(interviews)
    .where(and(eq(interviews.id, id), isNull(interviews.deletedAt)))
    .limit(1)

  if (!interview?.audioR2Key) {
    return NextResponse.json({ error: 'No audio file for this interview' }, { status: 404 })
  }

  // 1-hour presigned GET URL — never expose the raw R2 object URL
  const audioUrl = await presignDownload(interview.audioR2Key, 3600)
  return NextResponse.json({ audioUrl, expiresIn: 3600 })
}
