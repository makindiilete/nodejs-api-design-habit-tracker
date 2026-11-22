import bcrypt from 'bcrypt'
import env from '../../env.ts'
import type { Request } from 'express'
import type { User } from '../db/schema.ts'

/**
 * Hashes a password so it's safe to store.
 *
 * - `bcrypt.hash(password, rounds)` — creates a random salt and hashes in one call, so the
 *   same password never gives the same hash. `rounds` is `env.BCRYPT_ROUNDS`; each extra
 *   round doubles the work (slow for attackers, still fast for one login).
 *
 * @param {string} password - The plain-text password from the request.
 * @returns {Promise<string>} The bcrypt hash to save in the database.
 */
export const hashPassword = async (password: string): Promise<string> => {
  return await bcrypt.hash(password, env.BCRYPT_ROUNDS)
}

/**
 * Checks a login password against the hash saved at sign-up.
 *
 * - `bcrypt.compare(password, hash)` — reads the salt and rounds stored inside the hash,
 *   re-hashes the plain password with them, and compares the two in constant time.
 *   You never "decrypt" a hash; you only re-hash and compare.
 *
 * @param {string} password - The plain-text password from the login request.
 * @param {string} hashedPassword - The bcrypt hash stored on the user row.
 * @returns {Promise<boolean>} `true` if the password matches, otherwise `false`.
 */
export async function comparePassword(
  password: string,
  hashedPassword: string,
): Promise<boolean> {
  return await bcrypt.compare(password, hashedPassword)
}
