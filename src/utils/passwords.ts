import bcrypt from 'bcrypt'
import env from '../../env.ts'

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
