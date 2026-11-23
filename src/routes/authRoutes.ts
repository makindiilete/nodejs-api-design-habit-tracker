import { Router } from 'express'
import {
  login,
  refreshAccessToken,
  register,
} from '../controllers/authController.ts'
import { validateBody } from '../middleware/validation.ts'
import { insertUserSchema } from '../db/schema.ts'
import zod from 'zod'
import { authenticateRefreshToken } from '../middleware/auth.ts'

const router = Router()

/**
 * Body rules for `POST /login`, enforced by {@link validateBody} before {@link login} runs.
 *
 * - `zod.email()` — must be a valid email address.
 * - `zod.string().min(1)` — password must be present; strength rules belong to sign-up only.
 */
const loginSchema = zod.object({
  email: zod.email(),
  password: zod.string().min(1),
})

const refreshTokenSchema = zod.object({
  refreshToken: zod.string().min(1),
})

router.post('/register', validateBody(insertUserSchema), register)

router.post('/login', validateBody(loginSchema), login)

router.post(
  '/refresh',
  validateBody(refreshTokenSchema),
  authenticateRefreshToken,
  refreshAccessToken,
)

export default router
