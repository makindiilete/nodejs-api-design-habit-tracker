import { SignJWT } from 'jose'
import { createSecretKey } from 'crypto'
import env from '../../env.ts'

/** Claims stored in the token. It is signed, not encrypted: never put secrets here. */
export type JwtPayload = {
  id: string
  email: string
  username: string
}

/**
 * Creates a signed JWT for a user.
 *
 * - `createSecretKey(secret)` — Node crypto: wraps `env.JWT_SECRET` in a KeyObject (jose won't sign a raw string).
 * - `new SignJWT(payload)` — jose: starts a token holding our claims.
 * - `.setProtectedHeader({ alg: 'HS256' })` — sign with HMAC-SHA256, i.e. one shared secret.
 * - `.setIssuedAt()` — adds `iat`, the time the token was made.
 * - `.setExpirationTime(env.JWT_EXPIRES_IN)` — adds `exp`; accepts `'7d'`, `'2h'`, etc.
 * - `.sign(secretKey)` — signs it and resolves to the `header.payload.signature` string.
 *
 * @param {JwtPayload} payload - The user's id, email and username to store in the token.
 * @returns {Promise<string>} The signed token.
 */
export const generateToken = (payload: JwtPayload): Promise<string> => {
  const secret = env.JWT_SECRET
  const secretKey = createSecretKey(secret, 'utf-8')

  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(env.JWT_EXPIRES_IN)
    .sign(secretKey)
}
