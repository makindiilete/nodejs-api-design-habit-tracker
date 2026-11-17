import { Router } from 'express'
import { z } from 'zod'
import { validateBody } from '../middleware/validation.ts'

const router = Router()

const createHabitSchema = z.object({
  name: z.string(),
})

router.get('/', (req, res) => {
  res.send({ message: 'Habits' })
})

router.get('/:id', (req, res) => {
  res.send({ message: 'Got one habit' })
})

router.post('/', validateBody(createHabitSchema), (req, res) => {
  res.status(201).send({ message: 'Created an habit' })
})

router.delete('/:id', (req, res) => {
  res.status(204).send({ message: 'Deleted an habit' })
})

router.post('/:id/complete', (req, res) => {
  const habitId = req.params.id
  res.status(201).send({ message: `Completed Habit ${habitId}` })
})

export default router
