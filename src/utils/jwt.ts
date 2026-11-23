import { jwtVerify, SignJWT } from 'jose'
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
export const generateAccessToken = (payload: JwtPayload): Promise<string> => {
  const secret = env.JWT_SECRET
  const secretKey = createSecretKey(secret, 'utf-8')
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(env.JWT_EXPIRES_IN)
    .sign(secretKey)
}

/**
 * Checks an access token and returns the user inside it.
 *
 * - `createSecretKey(env.JWT_SECRET)` — the same key used to sign access tokens.
 * - `jwtVerify(token, secretKey)` — jose: checks the signature and `exp`; **throws** if either fails.
 *   A refresh token fails here because it was signed with a different secret.
 *
 * @param {string} token - The token from the `Authorization: Bearer <token>` header.
 * @returns {Promise<JwtPayload>} The user's id, email and username.
 * @throws If the token is fake, tampered with or expired.
 */
export const verifyAccessToken = async (token: string) => {
  const secret = env.JWT_SECRET
  const secretKey = createSecretKey(secret, 'utf-8')
  const { payload } = await jwtVerify<JwtPayload>(token, secretKey)
  return {
    id: payload.id,
    email: payload.email,
    username: payload.username,
  }
}

/**
 * Creates a long-lived refresh token, used only to get new access tokens at `POST /refresh`.
 *
 * - `createSecretKey(env.JWT_REFRESH_SECRET)` — a separate secret, so it can't pass as an access token.
 * - `{ ...payload, type: 'refresh' }` — stores only the user id plus a label saying what kind of token it is.
 * - `.setExpirationTime(env.REFRESH_TOKEN_EXPIRES_IN)` — adds `exp`, e.g. `'7d'`.
 * - Other calls are the same as {@link generateAccessToken}.
 *
 * @param {{ id: string }} payload - The user's id.
 * @returns {Promise<string>} The signed refresh token.
 */
export const generateRefreshToken = (payload: {
  id: string
}): Promise<string> => {
  const secret = env.JWT_REFRESH_SECRET
  const secretKey = createSecretKey(secret, 'utf-8')
  return new SignJWT({ ...payload, type: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(env.REFRESH_TOKEN_EXPIRES_IN)
    .sign(secretKey)
}

/**
 * Checks a refresh token and returns the user id inside it.
 *
 * - `jwtVerify(token, secretKey)` — checks signature (with `JWT_REFRESH_SECRET`) and `exp`; throws if either fails.
 * - `payload.type !== 'refresh'` — extra guard: rejects any token not labelled as a refresh token.
 *
 * @param {string} token - The refresh token from the request body.
 * @returns {Promise<{ id: string }>} The user's id.
 * @throws If the token is fake, expired or not a refresh token.
 */
export const verifyRefreshToken = async (token: string) => {
  const secret = env.JWT_REFRESH_SECRET
  const secretKey = createSecretKey(secret, 'utf-8')
  const { payload } = await jwtVerify<{ id: string; type: string }>(
    token,
    secretKey,
  )
  if (payload.type !== 'refresh') {
    throw new Error('Wrong token type')
  }
  return {
    id: payload.id,
  }
}
