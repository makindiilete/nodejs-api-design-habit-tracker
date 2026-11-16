import { Router } from 'express'

export const router = Router()

router.get('/', (req, res) => {
  res.send({ message: 'Users' })
})

router.get('/:id', (req, res) => {
  const userId = req.params.id
  res.send({ message: `Get a user with id ${userId}` })
})

router.put('/:id', (req, res) => {
  res
    .status(201)
    .send({ message: `Updated a user with the id ${req.params.id}` })
})

router.delete('/:id', (req, res) => {
  const userId = req.params.id
  res.status(204).send(`Deleted user with id ${userId}`)
})
