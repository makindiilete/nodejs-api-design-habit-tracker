import type { Request, Response } from 'express'
import { db } from '../db/connection.ts'
import { habits } from '../db/schema.ts'
import type { AuthenticatedRequest } from '../middleware/auth.ts'
import { eq } from 'drizzle-orm'

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
export const createHabit = async (req: AuthenticatedRequest, res: Response) => {
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
export const getHabits = async (req: AuthenticatedRequest, res: Response) => {
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
