import type { Request, Response } from 'express'
import { db } from '../db/connection.ts'
import { habits } from '../db/schema.ts'
import type { AuthenticatedRequest } from '../middleware/auth.ts'
import { eq } from 'drizzle-orm'

export const createHabit = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [habit] = await db
      .insert(habits)
      .values({
        frequency: req.body.frequency,
        name: req.body.name,
        userId: req.user!.id,
        description: req.body.description,
        isActive: req.body.isActive,
        targetCount: req.body.targetCount,
      })
      .returning()
    res.status(201).json({ message: 'Habit created successfully', habit })
  } catch (error) {
    console.log(error)
    res.status(500).json({ message: 'Failed to create habit' })
  }
}

export const getHabits = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userHabits = await db
      .select()
      .from(habits)
      .where(eq(habits.userId, req.user!.id))
    res.status(200).json({ habits: userHabits })
  } catch (error) {
    console.log(error)
    res
      .status(500)
      .json({ message: 'Something went wrong, please try again later' })
  }
}
