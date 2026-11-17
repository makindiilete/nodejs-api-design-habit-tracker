import type { Request, Response, NextFunction } from 'express'
import { ZodError, type ZodSchema } from 'zod'

/**
 * Builds a middleware that validates `req.body` against a Zod schema.
 * Valid → replaces `req.body` with the clean data and calls `next()`.
 * Invalid → responds 400 with `{ field, message }` for each issue.
 *
 * @see docs/04-validation-middleware-zod.md
 */
export const validateBody = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // parse() doesn't touch req.body. It returns a NEW cleaned object
      // (extra keys removed, types converted, defaults added), or throws ZodError.
      const validatedData = schema.parse(req.body)
      // Swap it in, or the handler still reads the raw, untrusted client input.
      req.body = validatedData
      next()
    } catch (e) {
      if (e instanceof ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: e.issues.map((err) => ({
            field: err.path.join('.'), // ['owner', 'city'] → "owner.city"
            message: err.message,
          })),
        })
      }
      next(e) // next(e) so real errors reach the error handler
    }
  }
}

export const validateParams = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.params) // throws ZodError if invalid
      next()
    } catch (e) {
      if (e instanceof ZodError) {
        return res.status(400).json({
          error: 'Invalid Params',
          details: e.issues.map((err) => ({
            field: err.path.join('.'), // ['owner', 'city'] → "owner.city"
            message: err.message,
          })),
        })
      }
      next(e) // next(e) so real errors reach the error handler
    }
  }
}

export const validateQuery = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.query) // throws ZodError if invalid
      next()
    } catch (e) {
      if (e instanceof ZodError) {
        return res.status(400).json({
          error: 'Invalid Query',
          details: e.issues.map((err) => ({
            field: err.path.join('.'), // ['owner', 'city'] → "owner.city"
            message: err.message,
          })),
        })
      }
      next(e) // next(e) so real errors reach the error handler
    }
  }
}
