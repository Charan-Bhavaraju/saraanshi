import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const globalForDb = globalThis as unknown as { _pgClient?: postgres.Sql }

const isDev = process.env.NODE_ENV !== 'production'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set — add it to Vercel Environment Variables')
}

const client = globalForDb._pgClient ?? postgres(process.env.DATABASE_URL, {
  prepare: false,
  // 3 connections per serverless instance: enough for concurrent page queries without
  // overwhelming Supabase's pgbouncer (transaction mode — no session state needed)
  max: isDev ? 5 : 3,
  idle_timeout: 20,
  connect_timeout: 8,
})

if (process.env.NODE_ENV !== 'production') globalForDb._pgClient = client

export const db = drizzle(client, { schema })
