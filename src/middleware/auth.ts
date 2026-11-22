import type { NextFunction, Request, Response } from 'express'
import { type JwtPayload, verifyToken } from '../utils/jwt.ts'

/** An Express request that may carry the logged-in user, set by `authenticateToken`. */
export interface AuthenticatedRequest extends Request {
  /** The user's id, email and username from the verified token. Unset until auth passes. */
  user?: JwtPayload
}

/**
 * Express middleware that lets a request through only if it has a valid JWT.
 *
 * - `req.headers['authorization']` — reads the `Authorization` header, e.g. `Bearer <token>`.
 * - `.split(' ')[1]` — takes the part after `Bearer`, i.e. the token itself.
 * - `verifyToken(token)` — checks the signature and expiry, then returns the user's claims.
 * - `req.user = ...` — attaches the user so later handlers know who is calling.
 * - `next()` — hands the request to the next middleware or route handler.
 *
 * Responds with `401` when no token is sent, and `403` when the token is invalid or expired.
 *
 * @param {AuthenticatedRequest} req - The incoming request; gets `user` set on success.
 * @param {Response} res - Used to send the 401 or 403 error.
 * @param {NextFunction} next - Called once the token is verified.
 * @returns {Promise<void | Response>} Nothing on success; the error response on failure.
 */
export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void | Response> => {
  try {
    // Get the token from the header
    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.split(' ')[1]

    // if the token does not exist, respond with 401
    if (!token) {
      return res
        .status(401)
        .json({ message: 'Fuck you, send a token next time' })
    }

    // Verify the token and set its response to user and next()
    req.user = await verifyToken(token)
    next()
  } catch (error) {
    console.log(error)
    return res.status(403).json({ error: 'Invalid or expired token' })
  }
}
