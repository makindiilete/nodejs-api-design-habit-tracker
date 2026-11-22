import type { Request, Response } from 'express'
import { type NewUser, type User, users } from '../db/schema.ts'
import { hashPassword, comparePassword } from '../utils/passwords.ts'
import { db } from '../db/connection.ts'
import { generateToken } from '../utils/jwt.ts'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcrypt'
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
    const token = await generateToken({
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

/**
 * POST handler: signs an existing user in and returns a fresh JWT.
 *
 * Steps:
 * - `db.select().from(users)` — Drizzle: start a `SELECT * FROM users` query.
 * - `.where(eq(users.email, email))` — `eq` builds `WHERE email = $1` (parameterised, so
 *   no SQL injection). Resolves to an array, hence `const [user]`.
 * - {@link comparePassword} — bcrypt-checks the given password against the stored hash.
 * - Unknown email and wrong password both return the same 401 `Invalid credentials`, so
 *   attackers can't tell which emails are registered.
 * - {@link generateToken} — signs a JWT with the user's id, email and username.
 *
 * @param {Request} req - Body is `{ email, password }`, already checked by `loginSchema`.
 * @param {Response} res - Express response object.
 * @returns {Promise<void>} Sends 200 `{ message, user, token }` (no password), 401 `{ message }`
 *   on bad credentials, or 500 `{ message, error }` on failure.
 */
export const login = async (
  req: Request<any, any, { email: string; password: string }>,
  res: Response,
): Promise<Response<any, Record<string, any>>> => {
  try {
    // find user by email in the db
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, req.body.email))
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }
    //compare provided password with stored hash
    const isValidatedPassword = await comparePassword(
      req.body.password,
      user.password,
    )
    if (!isValidatedPassword) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    //If valid, generate JWT token
    const token = await generateToken({
      username: user.username,
      id: user.id,
      email: user.email,
    })

    //Return token for future requests
    res.status(200).json({
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
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ message: 'Sign in failed ', error })
  }
}
