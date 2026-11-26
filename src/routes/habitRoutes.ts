import { Router } from 'express'
import zod, { z } from 'zod'
import { validateBody, validateParams } from '../middleware/validation.ts'
import { authenticateToken } from '../middleware/auth.ts'
import { insertHabitSchema, updateHabitSchema } from '../db/schema.ts'
import {
  createHabitBasic,
  createHabitWithTags,
  getHabits,
  getHabitsWithTags,
  updateHabit,
} from '../controllers/habitController.ts'
import { updateHabitPrisma } from '../controllers/habitController.prisma.ts'

/** Router for `/api/habits`. Every route below needs a logged-in user. */
const router = Router()

/**
 * Protects every habit route with `authenticateToken`.
 *
 * - `router.use(...)` — runs the middleware for every route on this router only,
 *   so it no longer depends on `app.use(authenticateToken)` in `server.ts`.
 * - Must sit above the routes: Express runs middleware in the order it is added.
 * - No token or a bad token → 401/403 before any habit handler runs.
 * - Valid token → `req.user` is set and the request moves on to the route.
 */

// router.use(authenticateToken)

const createHabitSchema = z.object({
  name: z.string(),
})

const completeHabitParamsSchema = z.object({
  id: z.string().max(3), //id 1212 will fail because the characters cannot be more than 3
})

/** `:id` must be a UUID, so a bad id gets a 400 instead of a Postgres error (500). */
const habitIdParamsSchema = z.object({
  id: z.uuid(),
})

/** GET /api/habits — list the logged-in user's habits (newest first), each with its tags. */
router.get('/', getHabitsWithTags)

router.get('/:id', (req, res) => {
  res.send({ message: 'Got one habit' })
})

/** POST /api/habits — validate the body with `insertHabitSchema`, then create the habit. */
router.post('/', validateBody(insertHabitSchema), createHabitWithTags)

router.delete('/:id', (req, res) => {
  res.status(204).send({ message: 'Deleted an habit' })
})

router.post(
  '/:id/complete',
  validateParams(completeHabitParamsSchema),
  validateBody(createHabitSchema),
  (req, res) => {
    const habitId = req.params.id
    res.status(201).send({ message: `Completed Habit ${habitId}` })
  },
)

/**
 * PATCH /api/habits/:id — check the id and the body, then update the habit (and replace its tags if `tagIds` is sent).
 * Middleware runs left to right: a 400 from either validator stops the request before the controller.
 */
router.patch(
  '/:id',
  validateParams(habitIdParamsSchema),
  validateBody(updateHabitSchema),
  updateHabitPrisma,
)

export default router
