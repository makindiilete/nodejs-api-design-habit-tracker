import { Router } from 'express'
import zod, { z } from 'zod'
import { validateBody, validateParams } from '../middleware/validation.ts'
import { authenticateToken } from '../middleware/auth.ts'
import { insertHabitSchema } from '../db/schema.ts'
import { createHabit, getHabits } from '../controllers/habitController.ts'

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

router.get('/', getHabits)

router.get('/:id', (req, res) => {
  res.send({ message: 'Got one habit' })
})

router.post('/', validateBody(insertHabitSchema), createHabit)

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

export default router
