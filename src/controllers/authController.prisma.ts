/**
 * PRISMA VERSION of authController.ts: same routes, same responses, written with Prisma.
 * Not wired into the routes; compare it side by side with the Drizzle file.
 */
import type { Request, Response } from 'express'
import { prisma } from '../db/prisma.ts'
import { hashPassword, comparePassword } from '../utils/passwords.ts'
import { generateRefreshToken, generateAccessToken } from '../utils/jwt.ts'
import type { AuthenticatedRequest } from '../middleware/auth.ts'

/** Body of POST /register. */
type RegisterBody = {
  email: string
  username: string
  password: string
  firstName?: string | null
  lastName?: string | null
}

/**
 * POST handler: creates a user and logs them in straight away.
 *
 * - {@link hashPassword} — swaps the plain password for a bcrypt hash before saving.
 * - `prisma.user.create({ data, select })` — `INSERT INTO users ... RETURNING ...`. Resolves to ONE
 *   object (not an array like Drizzle), so no `const [user]`.
 *   - `data` — the new row's values. Columns with defaults (`id`, `createdAt`) are filled by the database.
 *   - `select` — which columns to send back (`true` = include). Leaving out `password` means the
 *     hash never leaves the database. Without `select`, every column comes back.
 * - {@link generateAccessToken} / {@link generateRefreshToken} — sign the user's tokens.
 *
 * @param {Request} req - Body is a {@link RegisterBody}.
 * @param {Response} res - Express response object.
 * @returns {Promise<void>} Sends 201 `{ message, user, token, refreshToken }`, or 500 `{ message }` on failure.
 */
export const registerPrisma = async (
  req: Request<any, any, RegisterBody>,
  res: Response,
): Promise<void> => {
  try {
    const { email, username, password, firstName, lastName } = req.body
    const user = await prisma.user.create({
      data: {
        email,
        username,
        firstName,
        lastName,
        password: await hashPassword(password),
      },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        createdAt: true,
      },
    })
    const token = await generateAccessToken({
      id: user.id,
      email: user.email,
      username: user.username,
    })
    const refreshToken = await generateRefreshToken({ id: user.id })

    res.status(201).json({
      message: 'User created successfully',
      user,
      token,
      refreshToken,
    })
  } catch (e) {
    console.error('Registration error', e)
    res.status(500).json({ message: 'Failed to create user' })
  }
}

/**
 * POST handler: signs an existing user in and returns fresh tokens.
 *
 * - `prisma.user.findUnique({ where: { email } })` — `SELECT * FROM users WHERE email = $1 LIMIT 1`.
 *   - `findUnique` only accepts `@id` or `@unique` fields in `where` (`email` is `@unique`).
 *   - Resolves to the row, or `null` when no user has that email.
 * - {@link comparePassword} — bcrypt-checks the given password against the stored hash.
 * - Unknown email and wrong password both return the same 401, so attackers can't tell which emails exist.
 *
 * @param {Request} req - Body is `{ email, password }`, already checked by `loginSchema`.
 * @param {Response} res - Express response object.
 * @returns {Promise<Response>} 200 `{ message, user, token, refreshToken }` (no password),
 *   401 on bad credentials, or 500 on failure.
 */
export const loginPrisma = async (
  req: Request<any, any, { email: string; password: string }>,
  res: Response,
): Promise<Response> => {
  try {
    const user = await prisma.user.findUnique({
      where: { email: req.body.email },
    })
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }
    const isValidPassword = await comparePassword(
      req.body.password,
      user.password,
    )
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    const token = await generateAccessToken({
      id: user.id,
      email: user.email,
      username: user.username,
    })
    const refreshToken = await generateRefreshToken({ id: user.id })

    return res.status(200).json({
      message: 'Login Successful',
      user: {
        id: user.id,
        email: user.email,
        userName: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        createdAt: user.createdAt,
      },
      token,
      refreshToken,
    })
  } catch (error) {
    console.error('Login error:', error)
    return res.status(500).json({ message: 'Sign in failed' })
  }
}

/**
 * POST handler: gives the user a new access token. Runs after `authenticateRefreshToken`.
 *
 * - `prisma.user.findUnique({ where: { id }, select })` — `SELECT id, email, username FROM users WHERE id = $1`.
 *   `null` if the user was deleted since the refresh token was issued → 401.
 *   `select` fetches only the three fields the token needs.
 *
 * @param {AuthenticatedRequest} req - Has `refreshUserId` set by `authenticateRefreshToken`.
 * @param {Response} res - Express response object.
 * @returns {Promise<void>} 200 `{ token }`, 401 when the user is missing, or 500 on failure.
 */
export const refreshAccessTokenPrisma = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.refreshUserId) {
      res.status(401).json({ message: 'Invalid credentials' })
      return
    }
    const user = await prisma.user.findUnique({
      where: { id: req.refreshUserId },
      select: { id: true, email: true, username: true },
    })
    if (!user) {
      res.status(401).json({ message: 'Invalid credentials' })
      return
    }
    res.status(200).json({ token: await generateAccessToken(user) })
  } catch (error) {
    console.error('Refresh token error:', error)
    res.status(500).json({ message: 'Failed to refresh token' })
  }
}
