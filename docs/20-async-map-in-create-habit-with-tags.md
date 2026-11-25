# ⏳ Async `.map` and `Promise.all` in `createHabitWithTags`

> **One-line summary:** an `async` callback makes `.map` give back an array of **Promises**, not results. Nothing waits for them unless you `await Promise.all(...)`.

🔗 **Related notes:** [18 · Writing a Multi-Table Route](./18-writing-a-multi-table-route.md) · [19 · Understanding Tables and Their Relationships](./19-understanding-tables-and-relationships.md)
📄 **Code:** `src/controllers/habitController.ts` → `createHabitWithTags`

---

## 1. 🐛 The bug: `.map` with an `async` callback

### What `async` does to a function

| Function | What it returns |
| --- | --- |
| `(t) => t.toUpperCase()` | the value, straight away (e.g. `'HEALTH'`) |
| `async (t) => { ... }` | **always a Promise**, even if you `return` a plain value |

So `.map` with an `async` callback collects **one Promise per item**.

### Walk-through

Sample input:

```ts
const tagIds = [
  'c3d5e7f9-1a2b-4c6d-8e0f-2a4b6c8d0e13',
  'd4e6f8a0-2b3c-4d7e-9f1a-3b5c7d9e1f24',
]
```

The old code (line 81 before the fix):

```ts
tagIds.map(async (t: string) => {
  const [tagsFromDb] = await db.select().from(tags).where(eq(tags.id, t))
  if (!tagsFromDb) {
    return res.status(400).json({ message: 'Invalid tag' })
  }
})
// the code below runs immediately: the habit gets created
```

| Iteration | `t` | What happens |
| :-: | --- | --- |
| 1 | `'c3d5e7f9-1a2b-4c6d-8e0f-2a4b6c8d0e13'` | Starts the tags query, hits `await`, hands back a **pending Promise** at once |
| 2 | `'d4e6f8a0-2b3c-4d7e-9f1a-3b5c7d9e1f24'` | Same: query started, **pending Promise** handed back |

Output of `.map`, straight after it finishes:

```ts
[Promise { <pending> }, Promise { <pending> }]
```

Nobody awaits that array, so the function moves on and **creates the habit while both lookups are still running.**

### 💥 What goes wrong

| # | Problem | When you see it |
| :-: | --- | --- |
| 1 | An unknown tag id doesn't stop the habit being created | Send a valid UUID that isn't in `tags`, e.g. `00000000-0000-4000-8000-000000000000` |
| 2 | The late `res.status(400)` runs **after** the 201 was sent → `Cannot set headers after they are sent` | Same request, in the terminal |
| 3 | The `habits_tags` inserts inside the transaction weren't awaited, so a failing insert can't roll the habit back | An insert error, e.g. a foreign key error |
| 4 | The transaction callback returned nothing, so `result` was `undefined` and the response had no `newHabit` | Every request: the body was just `{ message }` |

> 🍀 **Why your test with real tags looked fine:** the `pg` client runs queries in the order they were started. The inserts started before the transaction's COMMIT was sent, so they happened to finish first. That is luck, not correct code.

---

## 2. ✅ The fix

### Part A: check every tag, then decide once

```ts
if (tagIds && tagIds.length > 0) {
  // .map gives back one Promise per tag id.
  // Promise.all waits for all of them and gives back the found tags, in order.
  const tagsFromDb = await Promise.all(
    tagIds.map(async (t: string) => {
      const [tagFromDb] = await db.select().from(tags).where(eq(tags.id, t))
      return tagFromDb // undefined when no tags row has this id
    }),
  )
  const hasInvalidTag = tagsFromDb.some((tag) => tag === undefined)
  if (hasInvalidTag) {
    res.status(400).json({ message: 'Invalid tag' })
    return
  }
}
```

**Table by table:** for each id in `tagIds`, go to the `tags` table and get the row where `tags.id` = that id.

Sample input (the second id is not in the `tags` table):

```ts
const tagIds = [
  'c3d5e7f9-1a2b-4c6d-8e0f-2a4b6c8d0e13',
  '00000000-0000-4000-8000-000000000000',
]
```

| Step | Value |
| --- | --- |
| After `.map` | `[Promise { <pending> }, Promise { <pending> }]` |
| Iteration 1 resolves to | `{ id: 'c3d5e7f9-1a2b-4c6d-8e0f-2a4b6c8d0e13', name: 'Health', color: '#22c55e', createdAt: 2026-11-01T09:00:00.000Z, updatedAt: 2026-11-01T09:00:00.000Z }` |
| Iteration 2 resolves to | `undefined` (no row found) |
| After `await Promise.all(...)` | `[{ id: 'c3d5e7f9-1a2b-4c6d-8e0f-2a4b6c8d0e13', name: 'Health', color: '#22c55e', createdAt: 2026-11-01T09:00:00.000Z, updatedAt: 2026-11-01T09:00:00.000Z }, undefined]` |
| `.some((tag) => tag === undefined)` | `true` → send 400 and `return` |

> 🔑 `.some` asks "is **at least one** item like this?" and gives back `true` or `false`.
> The `return` after `res.status(400)` stops the function, so it never reaches the transaction.

### Part B: insert the links with one awaited query (the course way, see note 18)

```ts
const result = await db.transaction(async (tx) => {
  const [createdHabit] = await tx
    .insert(habits)
    .values({
      name,
      description,
      frequency,
      targetCount,
      isActive,
      userId: req.user!.id,
    })
    .returning()
  if (tagIds && tagIds.length > 0) {
    const habitTagRows = tagIds.map((t: string) => ({
      habitId: createdHabit.id,
      tagId: t,
    }))
    await tx.insert(habitTags).values(habitTagRows)
  }
  return createdHabit // becomes `result`
})
```

This `.map` has **no `async`**, so it gives back plain objects, not Promises.

Sample input:

```ts
createdHabit.id = 'b1f4c2d8-3a6e-4f1b-9c2d-7e8a5b6c4d21'
tagIds = ['c3d5e7f9-1a2b-4c6d-8e0f-2a4b6c8d0e13', 'd4e6f8a0-2b3c-4d7e-9f1a-3b5c7d9e1f24']
```

| Iteration | `t` | Object returned |
| :-: | --- | --- |
| 1 | `'c3d5e7f9-1a2b-4c6d-8e0f-2a4b6c8d0e13'` | `{ habitId: 'b1f4c2d8-3a6e-4f1b-9c2d-7e8a5b6c4d21', tagId: 'c3d5e7f9-1a2b-4c6d-8e0f-2a4b6c8d0e13' }` |
| 2 | `'d4e6f8a0-2b3c-4d7e-9f1a-3b5c7d9e1f24'` | `{ habitId: 'b1f4c2d8-3a6e-4f1b-9c2d-7e8a5b6c4d21', tagId: 'd4e6f8a0-2b3c-4d7e-9f1a-3b5c7d9e1f24' }` |

Output `habitTagRows`:

```ts
[
  { habitId: 'b1f4c2d8-3a6e-4f1b-9c2d-7e8a5b6c4d21', tagId: 'c3d5e7f9-1a2b-4c6d-8e0f-2a4b6c8d0e13' },
  { habitId: 'b1f4c2d8-3a6e-4f1b-9c2d-7e8a5b6c4d21', tagId: 'd4e6f8a0-2b3c-4d7e-9f1a-3b5c7d9e1f24' },
]
```

`tx.insert(habitTags).values(habitTagRows)` then adds **both rows to the `habits_tags` table in one query**, and it is awaited, so a failure rolls back the habit too.

### Two ways to wait for async work in a loop

| Way | Runs the queries | Use it when |
| --- | --- | --- |
| `await Promise.all(items.map(async ...))` | all at the same time | the items don't depend on each other (our tag checks) |
| `for (const item of items) { await ... }` | one after another | order matters, or you want to stop at the first failure |

> 📱 **Analogy:** `.map` with `async` is like sending the same WhatsApp question to five friends. Sending is instant, but the replies come later. `Promise.all` is you waiting until **all five** have replied before you decide anything.

---

## 3. 🎯 Interview takeaways

- `array.map(async ...)` returns `Promise[]`. Always pair it with `await Promise.all(...)`, or use a `for...of` loop with `await`.
- Never send a response from inside a loop's callback. Collect results first, then send **one** response.
- Every query inside `db.transaction` must be awaited, or it isn't really part of the all-or-nothing unit.
- Whatever the transaction callback `return`s is what `await db.transaction(...)` gives back.
