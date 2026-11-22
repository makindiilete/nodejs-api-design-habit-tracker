import type { Request, Response } from 'express'
import { type NewUser, type User, users } from '../db/schema.ts'
import { hashPassword } from '../utils/passwords.ts'
import { db } from '../db/connection.ts'
import { generateToken } from '../utils/jwt.ts'
/**
 * POST handler: creates a user and logs them in straight away.
 *
 * Steps:
 * - {@link hashPassword} — swaps the plain password for a bcrypt hash before saving.
 * - `db.insert(users)` — Drizzle: start an `INSERT INTO users` query.
 * - `.values({...})` — the row to insert (request body + hashed password).
 * - `.returning({...})` — Postgres `RETURNING`: send back these columns of the new
 *   row (password deliberately left out). Resolves to an array, hence `const [user]`.
 * - {@link generateToken} — signs a JWT with the user's id, email and username.
 *
 * @param {Request} req - Body is a {@link NewUser}: email, username, password, names.
 * @param {Response} res - Express response object.
 * @returns {Promise<void>} Sends 201 `{ message, user, token }`, or 500 `{ message }` on failure.
 */
export const register = async (
  req: Request<any, User, NewUser>,
  res: Response,
): Promise<void> => {
  try {
    const hashedPassword = await hashPassword(req.body.password)
    const [user] = await db
      .insert(users)
      .values({ ...req.body, password: hashedPassword })
      .returning({
        id: users.id,
        email: users.email,
        username: users.username,
        firstName: users.firstName,
        lastName: users.lastName,
        createdAt: users.createdAt,
      })
    const token = generateToken({
      id: user.id,
      email: user.email,
      username: user.username,
    })

    res.status(201).json({ message: 'User created successfully', user, token })
  } catch (e) {
    console.error('Registration error', e)
    res.status(500).json({ message: 'Failed to create user' })
  }
}
