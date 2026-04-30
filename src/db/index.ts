import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// Reuse the client across hot-reloads in dev and across invocations in prod.
// Transaction-mode pgbouncer requires prepare:false and max:1 per serverless function.
const globalForDb = globalThis as unknown as { _pgClient?: postgres.Sql }

const client = globalForDb._pgClient ?? postgres(process.env.DATABASE_URL!, {
  prepare: false,
  max: 1,
  idle_timeout: 20,
  connect_timeout: 10,
})

if (process.env.NODE_ENV !== 'production') globalForDb._pgClient = client

export const db = drizzle(client, { schema })
