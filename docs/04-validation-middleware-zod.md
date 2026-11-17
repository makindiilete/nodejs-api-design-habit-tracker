# Validation Middleware with Zod

Code: [`src/middleware/validation.ts`](../src/middleware/validation.ts)

## The big picture

Think of the API as a **bank branch**:

```
customer (request) → security desk (validateBody) → account officer (route handler)
```

The security desk checks the form against a **checklist** (the Zod schema). Bad forms are sent back with a note listing what's wrong, so the account officer never sees them.

```ts
const createHabitSchema = z.object({
  name: z.string(),
  age: z.number(),
})

router.post('/', validateBody(createHabitSchema), (req, res) => {
  res.status(201).json({ message: 'Created a habit' })
})
```

## Why `validateBody` returns a function (middleware factory)

```ts
const validateBody = (schema) => (req, res, next) => { ... }
```

Express wants a function shaped `(req, res, next)`, but we **also** need to tell it which schema to use. So the outer function takes the schema and builds a guard that **remembers** it. That memory is called a **closure**.

Analogy: a **stamp factory**. Give it a word and you get back a stamp with that word on it.

```ts
validateBody(createHabitSchema) // guard for create
validateBody(updateHabitSchema) // guard for update
```

> Interview keywords: **higher-order function**, **closure**.

## The middleware, step by step

```ts
export const validateBody = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedData = schema.parse(req.body) // check it
      req.body = validatedData                     // swap raw body for the clean copy
      next()                                       // you may pass
    } catch (e) {
      if (e instanceof ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: e.issues.map((err) => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        })
      }
      next(e) // not a validation problem: send it to the error handler
    }
  }
}
```

### `schema.parse()`

- ✅ **Valid:** returns a **clean copy**. Unknown extra keys are stripped by default.
- ❌ **Invalid:** **throws** a `ZodError`, which is why we need `try/catch`.

Alternative: `schema.safeParse(data)` **never throws**. It returns:

```ts
{ success: true, data }      // or
{ success: false, error }
```

### Why `req.body = validatedData`?

**The key fact:** `schema.parse(req.body)` does **not** change `req.body`. It hands you back a **brand-new, cleaned-up copy**, and the original stays exactly as the client sent it.

So if you validate but don't swap it in, your handler still reads the **original, uncleaned** body.

**Analogy:** you hand a messy form to the security desk. They check it, then write a **neat copy** with the junk crossed out and the mistakes fixed. If they keep the neat copy in their drawer and pass your **messy original** to the account officer, what was the point of the cleaning? `req.body = validatedData` is the desk **swapping the messy form for the neat one** before passing it on.

#### See it happen

Schema:

```ts
const createHabitSchema = z.object({
  name: z.string().trim(),           // remove spaces at the ends
  age: z.coerce.number(),            // turn "3" into 3
  isActive: z.boolean().default(true), // fill in if missing
})
```

Client sends:

```json
{ "name": "  Read  ", "age": "3", "userId": "someone-elses-id" }
```

What each one holds after `parse` (real output):

```js
req.body      // { name: '  Read  ', age: '3', userId: 'someone-elses-id' }  ← untouched
validatedData // { name: 'Read', age: 3, isActive: true }                    ← cleaned
req.body === validatedData // false: two different objects
```

#### What goes wrong if you skip the swap

Your handler saves the body to the database:

```ts
await db.insert(habits).values(req.body)
```

| Without the swap, `req.body` has… | Result |
| --- | --- |
| `userId: 'someone-elses-id'` | The habit is saved under **another user's account**. This is called **mass assignment**: the client sets fields it should never control (`userId`, `isAdmin`, `balance`). |
| `age: '3'` (a string) | The database gets the wrong type, or your maths breaks (`'3' + 1 === '31'`) |
| `name: '  Read  '` | Messy data saved with extra spaces |
| no `isActive` | The default you defined never gets applied |

With the swap, the handler only ever sees `{ name: 'Read', age: 3, isActive: true }`.

**One-liner for interviews:** *"`parse` returns a new, cleaned object. Reassigning it to `req.body` makes sure every handler downstream works with the trusted version (stripped, converted and defaulted), not the raw client input."*

## `err.path`: the directions to the bad field

`path` is a list of steps to reach the bad field, starting from the top of the body. It works like giving directions: *Lagos → Ajah → Street 5*. Each step goes one level deeper.

`.join('.')` glues the steps into one readable label.

| Body sent | `err.path` | `.join('.')` |
| --- | --- | --- |
| `{}` (name missing) | `['name']` | `"name"` |
| `{ "owner": { "address": { "city": 123 } } }` | `['owner', 'address', 'city']` | `"owner.address.city"` |
| `{ "name": "Read" }` (owner missing) | `['owner']` | `"owner"` |
| `{ "habits": [{ "name": "A" }, { "name": 42 }] }` | `['habits', 1, 'name']` | `"habits.1.name"` |

- Array positions appear as **numbers** and start at **0**, so `1` is the **second** item.
- If a parent object is missing, Zod stops at that "door". You get `"owner"`, not `"owner.address.city"`.
- Frontend form libraries (react-hook-form, Formik) use this dotted format to show the error under the right input.

## What the client sees (Postman / Insomnia)

The examples below use this schema:

```ts
z.object({
  name: z.string(),
  owner: z.object({
    address: z.object({ city: z.string() }),
  }),
  habits: z.array(z.object({ name: z.string() })).optional(),
})
```

### Wrong type deep inside

**Request:** `POST /api/habits`

```json
{ "name": "Read", "owner": { "address": { "city": 123 } } }
```

**Response:** `400 Bad Request`

```json
{
  "error": "Validation failed",
  "details": [
    {
      "field": "owner.address.city",
      "message": "Invalid input: expected string, received number"
    }
  ]
}
```

Without `.join('.')`, you'd get `"field": ["owner", "address", "city"]`. It's the same information, but as a list.

### Several mistakes at different depths

```json
{ "name": 5, "owner": { "address": {} } }
```

```json
{
  "error": "Validation failed",
  "details": [
    { "field": "name", "message": "Invalid input: expected string, received number" },
    { "field": "owner.address.city", "message": "Invalid input: expected string, received undefined" }
  ]
}
```

Zod reports **all** problems at once, not just the first, which is a better experience for whoever is filling the form.

### Parent missing

```json
{ "name": "Read" }
```

```json
{
  "details": [
    { "field": "owner", "message": "Invalid input: expected object, received undefined" }
  ]
}
```

### Bad array item

```json
{ "name": "Read", "owner": { "address": { "city": "Lagos" } }, "habits": [{ "name": "Gym" }, { "name": 42 }] }
```

```json
{
  "details": [
    { "field": "habits.1.name", "message": "Invalid input: expected string, received number" }
  ]
}
```

## Try it yourself

Save this as a scratch file (e.g. `scratch.js` at the project root) and run `node scratch.js`:

```js
import { z } from 'zod'

const schema = z.object({
  name: z.string(),
  owner: z.object({ address: z.object({ city: z.string() }) }),
  habits: z.array(z.object({ name: z.string() })).optional(),
})

const result = schema.safeParse({ name: 'Read', owner: { address: { city: 123 } } })

if (!result.success) {
  for (const issue of result.error.issues) {
    console.log(issue.path, '→', issue.path.join('.'), '→', issue.message)
  }
}
// [ 'owner', 'address', 'city' ] → owner.address.city → Invalid input: expected string, received number
```

## Common bugs

| ❌ Bug | ✅ Fix |
| --- | --- |
| Calling `next()` for non-Zod errors, so the request carries on as if fine | `next(e)` sends it to the error handler (500) |
| Forgetting `return` before `res.status(400)...` | Without it, code keeps running and may cause `Cannot set headers after they are sent` |
| Forgetting `app.use(express.json())` | Without it, `req.body` is `undefined` and every request fails validation |
| Only validating on the frontend | Anyone can call the API with Postman or curl, so **always validate on the server** |
| Using `ZodSchema` type in Zod v4 | It's deprecated; use `z.ZodType` |

## Interview Q&A

**Q: Why validate in middleware instead of inside each handler?**
A: Separation of concerns and reuse. Handlers stay focused on business logic, and one guard serves every route (DRY).

**Q: `parse` vs `safeParse`?**
A: `parse` throws on failure. `safeParse` returns `{ success, data | error }`.

**Q: What's in a `ZodError`?**
A: `.issues`, an array where each issue has a `path`, a `message`, and a `code` (e.g. `"invalid_type"`).

**Q: How would you validate params or query too?**
A: Use the same factory pattern: `validateParams(schema)` calls `schema.parse(req.params)`, and `validateQuery(schema)` calls `schema.parse(req.query)`. Params and query are **always strings**, so use `z.coerce.number()` for numeric ids.

**Q: How do you share types between the schema and TypeScript?**
A: `type CreateHabit = z.infer<typeof createHabitSchema>`. The schema is then the one source of truth: a runtime check **and** a compile-time type.

**Q: Why 400 and not 500 for validation errors?**
A: 4xx means the client's fault (bad input). 5xx means the server's fault.
