import type { Request, Response } from 'express'
import { db } from '../db/connection.ts'
import {
  habits,
  type HabitTag,
  habitTags,
  type Tag,
  tags,
} from '../db/schema.ts'
import type { AuthenticatedRequest } from '../middleware/auth.ts'
import { desc, eq } from 'drizzle-orm'

/** One `habits_tags` row with its tag loaded (what `with: { tag: true }` returns). */
type HabitTagWithTag = HabitTag & { tag: Tag }

/**
 * POST handler: creates a habit for the logged-in user.
 *
 * - `db.insert(habits)` — Drizzle: start an `INSERT INTO habits` query.
 * - `.values({...})` — the row to insert: body fields picked by name, plus `userId` from the token.
 * - `.returning()` — Postgres `RETURNING *`: sends back the saved row, including the
 *   database-made `id`, defaults and timestamps. Always an array, hence `const [habit]`.
 *
 * @param {AuthenticatedRequest} req - `req.user` set by `authenticateToken`; body already checked by `insertHabitSchema`.
 * @param {Response} res - Express response object.
 * @returns {Promise<void>} Sends 201 `{ message, habit }`, or 500 `{ message }` on failure.
 */
export const createHabitBasic = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const [habit] = await db
      .insert(habits)
      // Fields are picked by name, not `...req.body`, so only columns we chose can be written.
      .values({
        frequency: req.body.frequency,
        name: req.body.name,
        // From the verified token, never the body: otherwise a client could create
        // habits for another user just by sending their id (IDOR).
        // `!` is safe: authenticateToken has already rejected requests without a user.
        userId: req.user!.id,
        description: req.body.description,
        isActive: req.body.isActive,
        targetCount: req.body.targetCount,
      })
      .returning()
    res.status(201).json({ message: 'Habit created successfully', habit })
  } catch (error) {
    console.log(error)
    res.status(500).json({ message: 'Failed to create habit' })
  }
}

/**
 * POST handler: creates a habit for the logged-in user and links it to existing tags.
 * Checks every tag id first, then saves the habit and its `habits_tags` rows in one transaction.
 * Full explanation: docs/20-async-map-and-get-habits-with-tags.md
 *
 * @param {AuthenticatedRequest} req - `req.user` set by `authenticateToken`; body checked by `validateBody`.
 * @param {Response} res - Express response object.
 * @returns {Promise<void>} Sends 201 `{ message, newHabit }`, 400 `{ message }` for an unknown tag, or 500 `{ message }` on failure.
 */
export const createHabitWithTags = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const { name, description, frequency, targetCount, isActive, tagIds } =
      req.body
    // check for invalid tags first and return
    if (tagIds && tagIds.length > 0) {
      // The callback is async, so .map gives back one Promise per tag id.
      // Promise.all waits for all of them and gives back the found tags, in order.
      const tagsFromDb = await Promise.all(
        tagIds.map(async (t: string) => {
          const [tagFromDb] = await db.select().from(tags).where(eq(tags.id, t))
          // undefined when no row in the tags table has this id
          return tagFromDb
        }),
      )
      // Send the 400 once, here, after every lookup has finished.
      const hasInvalidTag = tagsFromDb.some((tag) => tag === undefined)
      if (hasInvalidTag) {
        res.status(400).json({ message: 'Invalid tag' })
        return
      }
    }
    //Transaction to insert habits with valid tags.. Tags that gets here are valid
    const result = await db.transaction(async (tx) => {
      //first insert habit
      const [createdHabit] = await tx
        .insert(habits)
        .values({
          name,
          description,
          frequency,
          targetCount,
          isActive,
          // From the token, never the body, so no one can create habits for another user.
          userId: req.user!.id,
        })
        .returning()
      // Tags are optional, so only link them when some were sent.
      if (tagIds && tagIds.length > 0) {
        // One habits_tags row per tag id, all inserted with one awaited query.
        const habitTagRows = tagIds.map((t: string) => ({
          habitId: createdHabit.id,
          tagId: t,
        }))
        await tx.insert(habitTags).values(habitTagRows)
      }
      // Whatever the callback returns becomes `result`.
      return createdHabit
    })
    res.status(201).json({
      message: 'Habit with tag(s) created successfully',
      newHabit: result,
    })
  } catch (error) {
    console.log('Server error creating habit with tags ', error)
    res.status(500).json({ message: 'Something went wrong, please try again' })
  }
}

/**
 * GET handler: lists every habit that belongs to the logged-in user.
 *
 * - `db.select().from(habits)` — Drizzle: start a `SELECT * FROM habits` query.
 * - `.where(eq(habits.userId, req.user!.id))` — `eq` builds a parameterised `WHERE user_id = $1`,
 *   so users only ever see their own habits. Resolves to an array of rows.
 *
 * @param {AuthenticatedRequest} req - `req.user` set by `authenticateToken`.
 * @param {Response} res - Express response object.
 * @returns {Promise<void>} Sends 200 `{ habits }` (may be `[]`), or 500 `{ message }` on failure.
 */
export const getHabits = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    // Filter by the token's user id, never a query/body value, so no one can list another user's habits.
    const userHabits = await db
      .select()
      .from(habits)
      .where(eq(habits.userId, req.user!.id))
    // An empty list is still 200, not 404: the collection exists, this user just has no habits yet.
    res.status(200).json({ habits: userHabits })
  } catch (error) {
    console.log(error)
    res
      .status(500)
      .json({ message: 'Something went wrong, please try again later' })
  }
}

/**
 * Turns a habit's `habits_tags` rows into a plain list of tags (keeps only each row's `tag`).
 * Sample input and output: docs/20-async-map-and-get-habits-with-tags.md
 *
 * @param {HabitTagWithTag[]} habitTags - One habit's link rows, each with its `tag` loaded.
 * @returns {Tag[]} The tags only, in the same order (`[]` when the habit has no tags).
 */
const getTagsFromHabitTags = (habitTags: HabitTagWithTag[]): Tag[] => {
  return habitTags.map((habitTag) => habitTag.tag)
}

/**
 * GET handler: lists the logged-in user's habits, newest first, each with its tags.
 * Full explanation: docs/20-async-map-and-get-habits-with-tags.md
 *
 * @param {AuthenticatedRequest} req - `req.user` set by `authenticateToken`.
 * @param {Response} res - Express response object.
 * @returns {Promise<void>} Sends 200 `{ habits }` (may be `[]`), or 500 `{ message }` on failure.
 */
export const getHabitsWithTags = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const userHabitsWithTags = await db.query.habits.findMany({
      // habits table: keep only the logged-in user's rows
      where: eq(habits.userId, req.user!.id),
      // for each habit, get its habits_tags rows; for each of those, get its row from tags
      with: {
        habitTags: {
          with: {
            tag: true,
          },
        },
      },
      // newest habit first
      orderBy: [desc(habits.createdAt)],
    })
    console.log('All users habit returned - ', userHabitsWithTags)

    // Add a flat `tags` list to each habit and hide the nested `habitTags`
    // (res.json leaves out keys set to undefined).
    const transformedHabits = userHabitsWithTags.map((habit) => ({
      ...habit,
      tags: getTagsFromHabitTags(habit.habitTags),
      habitTags: undefined,
    }))

    res.status(200).json({ habits: transformedHabits })
  } catch (error) {
    console.log(error)
    res.status(500).json({ message: 'Something went wrong, please try again' })
  }
}
