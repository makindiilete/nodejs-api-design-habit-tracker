import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  unique,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'

/*
 * HOW TO READ THIS FILE
 * - pgTable('name', …): the string is the REAL table name in Postgres.
 *   The exported variable (e.g. `habitTags`) is only the name used in code.
 * - Column keys (firstName) are for code; the strings ('first_name') are DB column names.
 * - Full explanation: docs/13-drizzle-relations-from-diagrams.md
 */

// ─────────────────────────────── TABLES ───────────────────────────────

/**
 * People who sign up.
 * Parent of `habits` (one user → many habits).
 * `password` stores a HASH, never the plain password.
 */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  username: varchar('username', { length: 50 }).unique().notNull(),
  password: varchar('password', { length: 255 }).notNull(),
  firstName: varchar('first_name'),
  lastName: varchar('last_name'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

/**
 * A habit a user wants to build (e.g. "Read 30 mins").
 * FK: `userId` → users.id. Deleting the user deletes their habits (cascade).
 * Parent of `entries` and `habitTags`.
 */
export const habits = pgTable('habits', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  frequency: varchar('frequency', { length: 20 }).notNull(), // 'daily' | 'weekly'
  targetCount: integer('target_count').default(1),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

/**
 * One row = one time a habit was completed (a "tick").
 * FK: `habitId` → habits.id. Deleting the habit deletes its entries (cascade).
 */
export const entries = pgTable('entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  habitId: uuid('habit_id')
    .references(() => habits.id, { onDelete: 'cascade' })
    .notNull(),
  completionDate: timestamp('completion_date').notNull().defaultNow(),
  note: text('note'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

/**
 * Shared labels (e.g. "Health") that can be attached to many habits.
 * No FK here: tags don't belong to one user, so they survive user deletion.
 */
export const tags = pgTable('tags', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 50 }).unique().notNull(),
  color: varchar('color', { length: 7 }).default('#6b7280'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

/**
 * LINK (bridge) TABLE: habits ↔ tags is many-to-many.
 * One row = "habit X has tag Y". `createdAt` = when the tag was attached.
 * The unique pair stops the same tag being attached to a habit twice.
 */
export const habitTags = pgTable(
  'habits_tags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    habitId: uuid('habit_id')
      .references(() => habits.id, { onDelete: 'cascade' })
      .notNull(),
    tagId: uuid('tag_id')
      .references(() => tags.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (t) => [unique().on(t.habitId, t.tagId)],
)

// ───────────────────────────── RELATIONS ──────────────────────────────
/*
 * relations() creates NOTHING in the database (that's .references() above).
 * It only powers queries like: db.query.habits.findMany({ with: { entries: true } })
 *
 * Rules:
 * - one(them, { fields, references }) → I OWN the FK column (writes the equation once)
 * - many(them)                        → THEY own an FK pointing at me (borrows their equation)
 * - one() = singular name, returns an object; many() = plural name, returns an array
 */

/** A user has many habits. (Equation lives in habitRelations.) */
export const userRelations = relations(users, ({ many }) => ({
  habits: many(habits),
}))

/**
 * A habit belongs to one user, and has many entries and many habitTags.
 * Owns the equation: habits.userId = users.id
 */
export const habitRelations = relations(habits, ({ one, many }) => ({
  user: one(users, {
    fields: [habits.userId],
    references: [users.id],
  }),
  entries: many(entries),
  habitTags: many(habitTags),
}))

/**
 * An entry belongs to one habit.
 * Owns the equation: entries.habitId = habits.id
 */
export const entriesRelations = relations(entries, ({ one }) => ({
  habit: one(habits, {
    fields: [entries.habitId],
    references: [habits.id],
  }),
}))

/**
 * A tag appears in many habitTags rows.
 * To get a tag's habits, go through the bridge: { habitTags: { with: { habit: true } } }
 */
export const tagsRelationships = relations(tags, ({ many }) => ({
  habitTags: many(habitTags),
}))

/**
 * Each bridge row points to one habit and one tag.
 * Owns both equations: habitTags.habitId = habits.id, habitTags.tagId = tags.id
 */
export const habitTagsRelationships = relations(habitTags, ({ one }) => ({
  habit: one(habits, {
    fields: [habitTags.habitId],
    references: [habits.id],
  }),
  tag: one(tags, {
    fields: [habitTags.tagId],
    references: [tags.id],
  }),
}))

// ─────────────────────────────── TYPES ────────────────────────────────
/*
 * TypeScript types generated FROM the tables, so they never drift from the schema.
 * $inferSelect = the shape of a row you READ from the DB (id, defaults, timestamps all present).
 * (Its sibling $inferInsert = the shape you WRITE: optional/defaulted columns become optional.)
 */

/** A row from `users`. Includes `password` (the hash): never send it in an API response. */
export type User = typeof users.$inferSelect
/** Shape for inserting into `users`; DB-defaulted columns (id, timestamps) are optional. */
export type NewUser = typeof users.$inferInsert
/** A row from `habits`. */
export type Habit = typeof habits.$inferSelect
/** A row from `entries` (one completion of a habit). */
export type Entry = typeof entries.$inferSelect
/** A row from `tags`. */
export type Tag = typeof tags.$inferSelect
/** A row from the `habits_tags` bridge table. */
export type HabitTag = typeof habitTags.$inferSelect

// ─────────────────────────── ZOD SCHEMAS ──────────────────────────────
/*
 * drizzle-zod turns each table into a Zod validator, so validation rules come from the schema
 * (types, NOT NULL, varchar lengths) instead of being written twice.
 * - createInsertSchema: validates data GOING IN (create). Columns with defaults (id, createdAt…) are optional.
 * - createSelectSchema: describes data COMING OUT (a full row). Every column is present.
 * Use with the validation middleware → docs/04-validation-middleware-zod.md
 */

/** Validates a new user (e.g. sign-up body). Extend it for rules like email format or password strength. */
export const insertUserSchema = createInsertSchema(users)
/** Shape of a full user row. Omit `password` before using it for responses. */
export const selectUserSchema = createSelectSchema(users)

/**
 * Validates a new habit from the client (e.g. POST /habits body).
 * - `name`: at least 1 character.
 * - `frequency`: 'daily' or 'weekly'; lowercased first, so 'Daily' is accepted.
 * - `targetCount`: at least 1.
 * - `.omit({...})` — removes `id`, `userId`, `createdAt`, `updatedAt`: the client cannot send them.
 *   Set `userId` on the server from the logged-in user (req.user.id).
 * - `.extend({ tagIds })` — lets the client attach tags in the same request that creates the habit.
 *   Why it's needed: `habits` has NO tag column. Habits and tags are many-to-many, linked only
 *   through the `habits_tags` join table (`habit_id` + `tag_id`, one row per habit–tag pair).
 *   So tags can't go into the `habits` insert. The client sends the chosen tags' ids as `tagIds`
 *   (e.g. ['<uuid of "Health">', '<uuid of "Morning">']), and `createHabit` inserts the habit
 *   first, then one `habits_tags` row per id, inside one transaction.
 *   `tagIds` must be added here because it isn't a `habits` column: `validateBody` replaces
 *   `req.body` with the parsed result, and Zod silently drops keys the schema doesn't know.
 *   `z.array(z.uuid()).optional()`: a habit can be created with no tags. See docs/18 and docs/19.
 */
export const insertHabitSchema = createInsertSchema(habits, {
  // `(s) => ...` REFINES the generated schema (keeps varchar(200), NOT NULL) and adds a rule.
  // A plain value (like `frequency` below) REPLACES the generated schema entirely.
  name: (s) => s.min(1),
  /*
   * z.preprocess(fn, schema) runs `fn` on the raw input BEFORE `schema` checks it.
   * Step 1: if the value is a string, lowercase it ('DAILY' → 'daily'); anything else passes through as-is.
   * Step 2: z.enum checks the result is exactly 'daily' or 'weekly'.
   * The lowercased value is what ends up in the parsed data and gets saved to the DB.
   * Non-strings (e.g. 5, null) are not changed, so z.enum rejects them with a normal validation error.
   */
  frequency: z.preprocess(
    (val) => (typeof val === 'string' ? val.toLowerCase() : val),
    z.enum(['daily', 'weekly']),
  ),
  targetCount: (s) => s.min(1),
})
  .omit({
    createdAt: true,
    userId: true,
    id: true,
    updatedAt: true,
  })
  .extend({
    tagIds: z.array(z.uuid()).optional(),
  })
/** Shape of a full habit row. */
export const selectHabitSchema = createSelectSchema(habits)

/** Validates a new tag (name required, color optional: defaults to gray). */
export const insertTagSchema = createInsertSchema(tags)
/** Shape of a full tag row. */
export const selectTagSchema = createSelectSchema(tags)

/** Validates a new entry (habitId required; completionDate defaults to now). */
export const insertEntriesSchema = createInsertSchema(entries)
/** Shape of a full entry row. */
export const selectEntriesSchema = createSelectSchema(entries)
