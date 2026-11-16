import { Router } from 'express'

const router = Router()

router.get('/', (req, res) => {
  res.send({ message: 'Habits' })
})

router.get('/:id', (req, res) => {
  res.send({ message: 'Got one habit' })
})

router.post('/', (req, res) => {
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
