import { Router } from 'express'

const router = Router()

router.post('/register', (req, res) => {
  res.status(201).send({ message: 'User signed up' })
})

router.post('/login', (req, res) => {
  res.send({ message: 'User logged in' })
})

export default router
