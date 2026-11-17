import type { Request, Response, NextFunction } from 'express'
import { ZodError, type ZodSchema } from 'zod'

/**
 * validateBody — a middleware FACTORY.
 *
 * Analogy: a security desk at a bank. You hand it a checklist (the Zod schema)
 * and it gives you back a guard who checks every form (req.body) before the
 * customer reaches the account officer (your route handler).
 *
 * It does not validate anything itself — it RETURNS a middleware that does.
 * That lets one function serve every route:
 *   router.post('/', validateBody(createHabitSchema), handler)
 *   router.patch('/:id', validateBody(updateHabitSchema), handler)
 *
 * Flow:
 *   request → guard (this middleware) → pass?  → next() → route handler
 *                                     → fail?  → 400 JSON, handler never runs
 *
 * @param schema - The Zod schema (checklist) the body must match.
 *                 NOTE: `ZodSchema` is deprecated in Zod v4 (hence the
 *                 strikethrough in the editor). Modern form: `z.ZodType`.
 * @returns An Express middleware `(req, res, next) => void`.
 *
 * @example
 * // Body sent: { "name": "Read", "owner": { "address": { "city": 123 } } }
 * // Response (400):
 * // {
 * //   "error": "Validation failed",
 * //   "details": [
 * //     { "field": "owner.address.city",
 * //       "message": "Invalid input: expected string, received number" }
 * //   ]
 * // }
 */
export const validateBody = (schema: ZodSchema) => {
  // This inner function is the actual guard Express calls for each request.
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // parse() checks req.body against the checklist.
      // ✅ Valid   → returns a CLEAN copy (unknown extra keys are stripped).
      // ❌ Invalid → THROWS a ZodError, so we jump to the catch block.
      const validatedData = schema.parse(req.body)

      // Swap the raw body for the clean one, so the handler only ever
      // sees data that matches the schema.
      req.body = validatedData

      // "You may pass" — hand over to the next function in the route chain.
      next()
    } catch (e) {
      if (e instanceof ZodError) {
        // 400 = Bad Request: the CLIENT sent something wrong.
        // `return` stops here so we don't also call next().
        return res.status(400).json({
          error: 'Validation failed',
          // e.issues = Zod's list of every problem it found (not just the first).
          details: e.issues.map((err) => ({
            // err.path = the DIRECTIONS to the bad field, from the top of the body.
            //   { name: 5 }                          → ['name']                  → "name"
            //   { owner: { address: { city: 1 } } }  → ['owner','address','city'] → "owner.address.city"
            //   { habits: [ {...}, { name: 42 } ] }  → ['habits', 1, 'name']     → "habits.1.name"
            // .join('.') turns the list into one readable label that a
            // frontend form can use to show the error under the right input.
            field: err.path.join('.'),
            message: err.message,
          })),
        })
      }

      // Not a validation error (i.e. something unexpected broke).
      // ⚠️ TODO: should be `next(e)` — plain next() lets the request carry on
      // as if nothing went wrong. next(e) sends it to Express's error handler.
      next()
    }
  }
}
