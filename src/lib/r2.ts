import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// Singleton: reused across warm serverless invocations (same pattern as DB client)
const globalForR2 = globalThis as unknown as { _r2?: S3Client }

function getR2Client(): S3Client {
  if (!globalForR2._r2) {
    globalForR2._r2 = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID!}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    })
  }
  return globalForR2._r2
}

const BUCKET = process.env.R2_BUCKET_NAME ?? 'saaranshi-audio'

// R2 key convention: audio/YYYY/MM/<participant_code>-<timestamp>.<ext>
export function buildR2Key(participantCode: string, filename: string): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const ts = now.getTime()
  const ext = filename.split('.').pop() ?? 'audio'
  const slug = participantCode.toLowerCase().replace(/[^a-z0-9]/g, '-')
  return `audio/${yyyy}/${mm}/${slug}-${ts}.${ext}`
}

// Generate a presigned PUT URL for direct client → R2 upload.
// expiresIn: seconds the URL remains valid (default 1 hour — enough for any upload)
export async function presignUpload(
  r2Key: string,
  contentType: string,
  expiresIn = 3600,
): Promise<string> {
  const client = getR2Client()
  const cmd = new PutObjectCommand({
    Bucket: BUCKET,
    Key: r2Key,
    ContentType: contentType,
    // Server-side encryption is Cloudflare R2 default — no extra flag needed
  })
  return getSignedUrl(client, cmd, { expiresIn })
}

// Generate a presigned GET URL for secure audio playback.
// Short-lived by design — never expose public audio URLs.
// expiresIn default: 3600s (1 hr — enough for a full review session)
export async function presignDownload(r2Key: string, expiresIn = 3600): Promise<string> {
  const client = getR2Client()
  const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: r2Key })
  return getSignedUrl(client, cmd, { expiresIn })
}
