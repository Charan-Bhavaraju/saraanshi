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
  max: isDev ? 5 : 1,
  idle_timeout: 30,
  connect_timeout: 8,
  connection: {
    statement_timeout: 20000,
  },
})

if (process.env.NODE_ENV !== 'production') globalForDb._pgClient = client

export const db = drizzle(client, { schema })
