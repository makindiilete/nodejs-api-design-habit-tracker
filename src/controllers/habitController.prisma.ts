/**
 * PRISMA VERSION of habitController.ts: same routes, same responses, written with Prisma.
 * Not wired into the routes; compare it side by side with the Drizzle file.
 *
 * Prisma query options used below (they are plain objects, read them like a sentence):
 * - `where`   — which rows: `{ userId: 'x' }` = `WHERE user_id = 'x'`; `{ id: { in: ids } }` = `WHERE id IN (...)`.
 * - `data`    — the values to write (create/update).
 * - `select`  — which columns to return (`true` = include). Leave it out to get every column.
 * - `include` — also load related rows through a relation field from schema.prisma.
 *   `{ habitTags: { include: { tag: true } } }` = "bring each habit's habits_tags rows, and for each
 *   of those, its row from tags". Same job as Drizzle's `with`.
 * - `orderBy` — sort: `{ createdAt: 'desc' }` = newest first.
 * - Nested writes inside `data.habitTags`: `create: [...]` inserts link rows, `deleteMany: {}` deletes
 *   all of this habit's link rows. Prisma runs the whole call in ONE transaction for you.
 */
import type { Response } from 'express'
import { prisma } from '../db/prisma.ts'
import {
  Prisma,
  type HabitTag,
  type Tag,
} from '../db/generated/prisma/client.ts'
import type { UpdateHabitBody } from '../db/schema.ts'
import type { AuthenticatedRequest } from '../middleware/auth.ts'

/** One `habits_tags` row with its tag loaded (what `include: { tag: true }` returns). */
type HabitTagWithTag = HabitTag & { tag: Tag }

/** `[{ ..., tag: { id, name } }]` → `[{ id, name }]`: the flat tag list the API sends back. */
const getTagsFromHabitTags = (habitTags: HabitTagWithTag[]): Tag[] =>
  habitTags.map((habitTag) => habitTag.tag)

/**
 * POST handler: creates a habit for the logged-in user (no tags).
 *
 * - `prisma.habit.create({ data })` — `INSERT INTO habits ... RETURNING *`. Resolves to the saved
 *   row (one object, with the database-made `id`, defaults and timestamps).
 * - `userId` comes from the verified token, never the body, so no one can create habits for another user.
 *
 * @param {AuthenticatedRequest} req - `req.user` set by `authenticateToken`; body checked by `insertHabitSchema`.
 * @param {Response} res - Express response object.
 * @returns {Promise<void>} 201 `{ message, habit }`, or 500 `{ message }` on failure.
 */
export const createHabitBasicPrisma = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const { name, description, frequency, targetCount, isActive } = req.body
    const habit = await prisma.habit.create({
      data: {
        name,
        description,
        frequency,
        targetCount,
        isActive,
        userId: req.user!.id,
      },
    })
    res.status(201).json({ message: 'Habit created successfully', habit })
  } catch (error) {
    console.log(error)
    res.status(500).json({ message: 'Failed to create habit' })
  }
}

/**
 * POST handler: creates a habit for the logged-in user and links it to existing tags.
 *
 * - `prisma.tag.count({ where: { id: { in: tagIds } } })` — `SELECT COUNT(*) FROM tags WHERE id IN (...)`.
 *   Fewer than `tagIds.length` → at least one id doesn't exist → 400, before anything is saved.
 * - `prisma.habit.create({ data: { ..., habitTags: { create: [...] } } })` — a NESTED write:
 *   inserts the habit, then one `habits_tags` row per `{ tagId }`, filling `habitId` with the new
 *   habit's id for you. Both inserts run in one transaction (no `db.transaction` needed).
 *
 * @param {AuthenticatedRequest} req - `req.user` set by `authenticateToken`; body checked by `validateBody`.
 * @param {Response} res - Express response object.
 * @returns {Promise<void>} 201 `{ message, newHabit }`, 400 `{ message }` for an unknown tag, or 500 on failure.
 */
export const createHabitWithTagsPrisma = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const { name, description, frequency, targetCount, isActive, tagIds } =
      req.body
    const tagIdList: string[] = tagIds ?? []

    if (tagIdList.length > 0) {
      const foundTagCount = await prisma.tag.count({
        where: { id: { in: tagIdList } },
      })
      if (foundTagCount !== tagIdList.length) {
        res.status(400).json({ message: 'Invalid tag' })
        return
      }
    }

    const newHabit = await prisma.habit.create({
      data: {
        name,
        description,
        frequency,
        targetCount,
        isActive,
        userId: req.user!.id,
        habitTags: { create: tagIdList.map((tagId) => ({ tagId })) },
      },
    })
    res.status(201).json({
      message: 'Habit with tag(s) created successfully',
      newHabit,
    })
  } catch (error) {
    console.log('Server error creating habit with tags ', error)
    res.status(500).json({ message: 'Something went wrong, please try again' })
  }
}

/**
 * GET handler: lists every habit that belongs to the logged-in user.
 *
 * - `prisma.habit.findMany({ where: { userId } })` — `SELECT * FROM habits WHERE user_id = $1`.
 *   Always resolves to an array (`[]` when the user has none, which is still a 200).
 *
 * @param {AuthenticatedRequest} req - `req.user` set by `authenticateToken`.
 * @param {Response} res - Express response object.
 * @returns {Promise<void>} 200 `{ habits }`, or 500 `{ message }` on failure.
 */
export const getHabitsPrisma = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const userHabits = await prisma.habit.findMany({
      where: { userId: req.user!.id },
    })
    res.status(200).json({ habits: userHabits })
  } catch (error) {
    console.log(error)
    res
      .status(500)
      .json({ message: 'Something went wrong, please try again later' })
  }
}

/**
 * GET handler: lists the logged-in user's habits, newest first, each with its tags.
 *
 * - `prisma.habit.findMany({ where, include, orderBy })`:
 *   - `where: { userId }` — only this user's habits.
 *   - `include: { habitTags: { include: { tag: true } } }` — for each habit, its `habits_tags` rows,
 *     and for each of those, the full tag (so you get the tag's `name`).
 *   - `orderBy: { createdAt: 'desc' }` — newest habit first.
 * - The `.map` then swaps the nested `habitTags` for a flat `tags: [{ id, name, ... }]` list.
 *
 * @param {AuthenticatedRequest} req - `req.user` set by `authenticateToken`.
 * @param {Response} res - Express response object.
 * @returns {Promise<void>} 200 `{ habits }` (may be `[]`), or 500 `{ message }` on failure.
 */
export const getHabitsWithTagsPrisma = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const userHabitsWithTags = await prisma.habit.findMany({
      where: { userId: req.user!.id },
      include: { habitTags: { include: { tag: true } } },
      orderBy: { createdAt: 'desc' },
    })

    const transformedHabits = userHabitsWithTags.map((habit) => ({
      ...habit,
      tags: getTagsFromHabitTags(habit.habitTags),
      habitTags: undefined,
    }))

    res.status(200).json({ habits: transformedHabits })
  } catch (error) {
    console.log(error)
    res.status(500).json({ message: 'Something went wrong, please try again' })
  }
}

/**
 * PUT handler: updates one of the logged-in user's habits and, if `tagIds` is sent, replaces its tags.
 * The route has already checked `:id` (UUID) and the body (`updateHabitSchema`, which drops `userId`/`id`).
 *
 * - `prisma.tag.count({ where: { id: { in: ids } } })` — checks every tag exists first → 422 if not.
 * - `prisma.habit.update({ where, data, include })` — ONE call does the whole job, in one transaction:
 *   - `where: { id, userId }` — the right habit AND owned by this user. No match → Prisma throws
 *     error code `P2025` ("record not found"), which the catch turns into a 404.
 *   - `data: { ...habitFields }` — the changed columns. `updatedAt` is set automatically (`@updatedAt`).
 *   - `data.habitTags: { deleteMany: {}, create: [...] }` — only when `tagIds` was sent:
 *     delete ALL this habit's links (`{}` = no extra filter), then create the new ones. `[]` clears all tags.
 *   - `include: { habitTags: { include: { tag: true } } }` — return the updated habit with each tag's name.
 * - `Prisma.PrismaClientKnownRequestError` — the error class for database errors Prisma knows; `.code` says which.
 *
 * @param {AuthenticatedRequest} req - `req.params.id` = habit id; `req.body` = validated {@link UpdateHabitBody}.
 * @param {Response} res - Express response object.
 * @returns {Promise<void>} 200 `{ message, habit }` (with `tags`), 404 not found / not yours,
 *   422 unknown tag, or 500 on failure.
 */
export const updateHabitPrisma = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const habitId = req.params.id
    const { tagIds, ...habitFields } = req.body as UpdateHabitBody
    // Remove repeated ids so the same habit–tag pair is never inserted twice
    const uniqueTagIds = tagIds ? [...new Set(tagIds)] : undefined

    if (uniqueTagIds && uniqueTagIds.length > 0) {
      const foundTagCount = await prisma.tag.count({
        where: { id: { in: uniqueTagIds } },
      })
      if (foundTagCount !== uniqueTagIds.length) {
        res.status(422).json({ message: 'One or more tags do not exist' })
        return
      }
    }

    const updatedHabit = await prisma.habit.update({
      where: { id: habitId, userId: req.user!.id },
      data: {
        ...habitFields,
        ...(uniqueTagIds && {
          habitTags: {
            deleteMany: {},
            create: uniqueTagIds.map((tagId) => ({ tagId })),
          },
        }),
      },
      include: { habitTags: { include: { tag: true } } },
    })

    res.status(200).json({
      message: 'Habit updated successfully',
      habit: {
        ...updatedHabit,
        tags: getTagsFromHabitTags(updatedHabit.habitTags),
        habitTags: undefined,
      },
    })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      res.status(404).json({ message: 'Habit not found' })
      return
    }
    console.log('Update habit error - ', error)
    res.status(500).json({ message: 'Something went wrong, please try again' })
  }
}
