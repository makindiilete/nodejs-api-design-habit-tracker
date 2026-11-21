import type { Request, Response } from 'express'
export const register = (req: Request, res: Response) => {
  try {
  } catch (e) {
    console.error('Registration error', e)
    res.status(500).json({ message: 'Failed to create user' })
  }
}
