import { Router } from 'express'
import { login, register } from '../controllers/authController.ts'
import { validateBody } from '../middleware/validation.ts'
import { insertUserSchema } from '../db/schema.ts'
import zod from 'zod'

const router = Router()

const loginSchema = zod.object({
  email: zod.email(),
  password: zod.string().min(1),
})

router.post('/register', validateBody(insertUserSchema), register)

router.post('/login', validateBody(loginSchema), login)

export default router
