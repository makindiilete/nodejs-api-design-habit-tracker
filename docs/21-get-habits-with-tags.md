# 📖 `getHabitsWithTags`: Reading Habits With Their Tags

> **One-line summary:** one `findMany` with `with` reads three tables (`habits` → `habits_tags` → `tags`). Then a plain (non-async) `.map` reshapes each habit so the client gets a flat `tags` list.

🔗 **Related notes:** [19 · Understanding Tables and Their Relationships](./19-understanding-tables-and-relationships.md) · [20 · Async `.map` in `createHabitWithTags`](./20-async-map-in-create-habit-with-tags.md)
📄 **Code:** `src/controllers/habitController.ts` → `getTagsFromHabitTags`, `getHabitsWithTags` · Route: `GET /api/habits`

---

## 1. 🗄️ The query

```ts
const userHabitsWithTags = await db.query.habits.findMany({
  where: eq(habits.userId, req.user!.id),
  with: { habitTags: { with: { tag: true } } },
  orderBy: [desc(habits.createdAt)],
})
```

**Table by table:**

1. Go to the **`habits`** table. Keep rows where `habits.user_id` = the logged-in user's id. Sort by `habits.created_at`, newest first.
2. For each of those habits, go to the **`habits_tags`** table. Get every row where `habits_tags.habit_id` = that habit's `id`. They go into `habit.habitTags`.
3. For each of those `habits_tags` rows, go to the **`tags`** table. Get the one row where `tags.id` = that row's `tag_id`. It goes into `habitTag.tag`.

| Option | What it does |
| --- | --- |
| `db.query.habits.findMany` | Drizzle's relational query: gives back an array of habits |
| `where` | the filter on the `habits` table (`WHERE user_id = $1`) |
| `with` | nests related rows inside each habit, following the `relations()` in `schema.ts` |
| `orderBy: [desc(...)]` | `ORDER BY created_at DESC` |

---

## 2. 🧹 The helper: `getTagsFromHabitTags`

```ts
const getTagsFromHabitTags = (habitTags: HabitTagWithTag[]): Tag[] => {
  return habitTags.map((habitTag) => habitTag.tag)
}
```

Sample input (the habit "Read 30 mins" has two tags):

```ts
[
  {
    id: 'e5f7a9b1-4c3d-4e8f-a0b2-4c6d8e0f2a35',
    habitId: 'b1f4c2d8-3a6e-4f1b-9c2d-7e8a5b6c4d21',
    tagId: 'c3d5e7f9-1a2b-4c6d-8e0f-2a4b6c8d0e13',
    createdAt: new Date('2026-11-20T08:00:00.000Z'),
    updatedAt: new Date('2026-11-20T08:00:00.000Z'),
    tag: {
      id: 'c3d5e7f9-1a2b-4c6d-8e0f-2a4b6c8d0e13',
      name: 'Health',
      color: '#22c55e',
      createdAt: new Date('2026-11-01T09:00:00.000Z'),
      updatedAt: new Date('2026-11-01T09:00:00.000Z'),
    },
  },
  {
    id: 'f6a8b0c2-5d4e-4f9a-b1c3-5d7e9f1a3b46',
    habitId: 'b1f4c2d8-3a6e-4f1b-9c2d-7e8a5b6c4d21',
    tagId: 'd4e6f8a0-2b3c-4d7e-9f1a-3b5c7d9e1f24',
    createdAt: new Date('2026-11-20T08:00:00.000Z'),
    updatedAt: new Date('2026-11-20T08:00:00.000Z'),
    tag: {
      id: 'd4e6f8a0-2b3c-4d7e-9f1a-3b5c7d9e1f24',
      name: 'Morning',
      color: '#f59e0b',
      createdAt: new Date('2026-11-02T09:00:00.000Z'),
      updatedAt: new Date('2026-11-02T09:00:00.000Z'),
    },
  },
]
```

| Iteration | `habitTag` | Returns |
| :-: | --- | --- |
| 1 | the first link row above | its `tag`: the **Health** tag |
| 2 | the second link row above | its `tag`: the **Morning** tag |

Sample output:

```ts
[
  {
    id: 'c3d5e7f9-1a2b-4c6d-8e0f-2a4b6c8d0e13',
    name: 'Health',
    color: '#22c55e',
    createdAt: new Date('2026-11-01T09:00:00.000Z'),
    updatedAt: new Date('2026-11-01T09:00:00.000Z'),
  },
  {
    id: 'd4e6f8a0-2b3c-4d7e-9f1a-3b5c7d9e1f24',
    name: 'Morning',
    color: '#f59e0b',
    createdAt: new Date('2026-11-02T09:00:00.000Z'),
    updatedAt: new Date('2026-11-02T09:00:00.000Z'),
  },
]
```

A habit with no tags has `habitTags: []`, so the helper gives back `[]`.

---

## 3. 🔄 The outer `.map`: reshaping each habit

```ts
const transformedHabits = userHabitsWithTags.map((habit) => ({
  ...habit,
  tags: getTagsFromHabitTags(habit.habitTags),
  habitTags: undefined,
}))
res.status(200).json({ habits: transformedHabits })
```

One habit **before** the `.map` (iteration 1):

```ts
{
  id: 'b1f4c2d8-3a6e-4f1b-9c2d-7e8a5b6c4d21',
  userId: '9a7e3c1f-2b4d-4e6a-8f0c-1d3b5a7c9e02',
  name: 'Read 30 mins',
  description: 'Read a book before bed',
  frequency: 'daily',
  targetCount: 1,
  isActive: true,
  createdAt: new Date('2026-11-20T08:00:00.000Z'),
  updatedAt: new Date('2026-11-20T08:00:00.000Z'),
  habitTags: [
    {
      id: 'e5f7a9b1-4c3d-4e8f-a0b2-4c6d8e0f2a35',
      habitId: 'b1f4c2d8-3a6e-4f1b-9c2d-7e8a5b6c4d21',
      tagId: 'c3d5e7f9-1a2b-4c6d-8e0f-2a4b6c8d0e13',
      createdAt: new Date('2026-11-20T08:00:00.000Z'),
      updatedAt: new Date('2026-11-20T08:00:00.000Z'),
      tag: {
        id: 'c3d5e7f9-1a2b-4c6d-8e0f-2a4b6c8d0e13',
        name: 'Health',
        color: '#22c55e',
        createdAt: new Date('2026-11-01T09:00:00.000Z'),
        updatedAt: new Date('2026-11-01T09:00:00.000Z'),
      },
    },
  ],
}
```

The same habit **as the client receives it** inside `habits`:

```json
{
  "id": "b1f4c2d8-3a6e-4f1b-9c2d-7e8a5b6c4d21",
  "userId": "9a7e3c1f-2b4d-4e6a-8f0c-1d3b5a7c9e02",
  "name": "Read 30 mins",
  "description": "Read a book before bed",
  "frequency": "daily",
  "targetCount": 1,
  "isActive": true,
  "createdAt": "2026-11-20T08:00:00.000Z",
  "updatedAt": "2026-11-20T08:00:00.000Z",
  "tags": [
    {
      "id": "c3d5e7f9-1a2b-4c6d-8e0f-2a4b6c8d0e13",
      "name": "Health",
      "color": "#22c55e",
      "createdAt": "2026-11-01T09:00:00.000Z",
      "updatedAt": "2026-11-01T09:00:00.000Z"
    }
  ]
}
```

> 🔑 `res.json` turns `Date` objects into ISO strings and **drops keys whose value is `undefined`**, which is why `habitTags: undefined` removes it from the response.

> ⚖️ **Notice the difference:** this `.map` has **no `async`** and makes no database calls, so it gives back plain objects right away and needs no `await`. The database work was already finished by `findMany`.

---

## 4. 🎯 Interview takeaways

- `findMany` + `with` follows the `relations()` in `schema.ts`, so you never write the join yourself.
- A many-to-many read comes back nested (`habit.habitTags[].tag`); reshape it into a flat `tags` list before sending it.
- Setting a key to `undefined` is a simple way to hide it: `res.json` drops it.
- An empty result is still `200` with `{ habits: [] }`, not `404`.
