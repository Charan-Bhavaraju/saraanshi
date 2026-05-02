import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { presignUpload, buildR2Key } from '@/lib/r2'

const ALLOWED_TYPES = new Set([
  'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/m4a',
  'audio/wav', 'audio/webm', 'audio/ogg', 'audio/aac',
  'audio/x-m4a', 'video/mp4', // .mp4 videos often contain audio interviews
])

export async function GET(req: NextRequest) {
  // Auth guard
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const filename = searchParams.get('filename')
  const contentType = searchParams.get('contentType')
  const participantCode = searchParams.get('participantCode') ?? 'unknown'

  if (!filename || !contentType) {
    return NextResponse.json({ error: 'filename and contentType are required' }, { status: 400 })
  }

  if (!ALLOWED_TYPES.has(contentType.toLowerCase())) {
    return NextResponse.json({ error: `Content type "${contentType}" not allowed` }, { status: 400 })
  }

  const r2Key = buildR2Key(participantCode, filename)
  const presignedUrl = await presignUpload(r2Key, contentType, 3600)

  return NextResponse.json({ presignedUrl, r2Key })
}
