/**
 * Prisma connection: the Prisma version of `connection.ts`. Import `prisma` anywhere to run queries.
 *
 * - `PrismaClient` — the typed client built by `npx prisma generate` from `schema.prisma`
 *   (into `./generated/prisma`). Re-run generate after every schema change.
 * - `new PrismaPg({ connectionString })` — Prisma 7 talks to Postgres through a driver adapter;
 *   this one uses the same `pg` driver as Drizzle, with its own connection pool.
 * - `remember('prisma', ...)` — caches the client on globalThis, so `node --watch` reloads
 *   reuse it instead of opening a new pool on every save.
 *
 * Full explanation: docs/14-prisma-schema-and-relations.md → "Wiring it up".
 */
import { PrismaPg } from '@prisma/adapter-pg'
import { remember } from '@epic-web/remember'
import { PrismaClient } from './generated/prisma/client.ts'
import env from '../../env.ts'

const createPrismaClient = () =>
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
  })

export const prisma = remember('prisma', createPrismaClient)
