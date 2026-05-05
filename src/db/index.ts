import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// Reuse the client across hot-reloads in dev and across invocations in prod.
// Transaction-mode pgbouncer requires prepare:false and max:1 per serverless function.
const globalForDb = globalThis as unknown as { _pgClient?: postgres.Sql }

const isDev = process.env.NODE_ENV !== 'production'

const client = globalForDb._pgClient ?? postgres(process.env.DATABASE_URL!, {
  prepare: false,
  // pgbouncer transaction mode works fine with a small pool; max:1 serializes
  // parallel Promise.all queries and causes stalls under any real load.
  max: isDev ? 5 : 3,
  idle_timeout: 30,
  connect_timeout: 15,
  // Override Supabase's aggressive statement_timeout (default is often 3-8s on free tier)
  connection: {
    statement_timeout: 30000, // 30 s — enough for cold-start parallel queries
  },
})

if (process.env.NODE_ENV !== 'production') globalForDb._pgClient = client

export const db = drizzle(client, { schema })
