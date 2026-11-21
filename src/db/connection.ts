/**
 * Database connection: one shared Postgres pool, wrapped by Drizzle.
 *
 * Import `db` anywhere to run queries. Connections are opened lazily,
 * on the first query, not when this file loads.
 *
 * Full explanation (pooling, Mongoose vs Postgres): docs/15-connection-pooling.md
 */
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema.ts'
import env, { isProd } from '../../env.ts'
import { remember } from '@epic-web/remember'

// A Pool keeps a few open connections and lends them out per query
// (pg default: up to 10). This is the pooling, not `remember`.
const createPool = () => {
  return new Pool({
    connectionString: env.DATABASE_URL,
  })
}

let client: Pool

if (isProd()) {
  // Production doesn't hot-reload, so create the pool once.
  client = createPool()
} else {
  // Dev hot-reloads on save. `remember` caches the pool on globalThis
  // so each reload reuses it instead of leaking a new one.
  client = remember('dbPool', () => createPool())
}

// Passing `schema` enables the relational API: db.query.<table>.findMany({ with })
export const db = drizzle({ client, schema })
