# Route Params vs Query Params

## The one-line difference

- **Route params** say **WHICH thing** you want.
- **Query params** say **HOW you want it**: filtered, sorted, paged, searched.

**Analogy: ordering food delivery.**

- The **route param** is the **address**: *House 7, Street 42*. Without it, the rider doesn't know where to go, so it's **required**.
- The **query params** are the **delivery notes**: *"extra pepper, no onions, ring the bell twice"*. Nice to have, but the order still works without them, so they're **optional**.

## What they look like

```
GET /users/42/habits/7?status=active&sort=name
          └┬┘       └┬┘ └───────────┬─────────┘
     route param  route param   query params
       (userId)    (habitId)   (after the ?, joined by &)
```

```ts
router.get('/users/:userId/habits/:habitId', (req, res) => {
  req.params // { userId: '42', habitId: '7' }
  req.query  // { status: 'active', sort: 'name' }
})
```

| | Route params | Query params |
| --- | --- | --- |
| Where in the URL | Inside the path: `/habits/7` | After `?`: `/habits?status=active` |
| Defined in the route? | ✅ Yes: `'/habits/:id'` | ❌ No, any key can be sent |
| Read with | `req.params` | `req.query` |
| Required? | ✅ Yes, or the route doesn't match | ❌ Optional |
| Order matters? | ✅ Yes, by position | ❌ No: `?a=1&b=2` = `?b=2&a=1` |
| Job | **Identify** a resource | **Filter / sort / page / search** a list |

## Real output (Express 5, tested in this project)

Request:

```
GET /users/42/habits/7?status=active&sort=name&tag=a&tag=b&page=2&filter[x]=1
```

```json
{
  "params": { "userId": "42", "habitId": "7" },
  "query": {
    "status": "active",
    "sort": "name",
    "tag": ["a", "b"],
    "page": "2",
    "filter[x]": "1"
  }
}
```

What this shows:

- **Both are key-value objects.**
- **Every value is a string.** `42`, `7` and `page: "2"` all come in as strings, never numbers.
- **A repeated key becomes an array:** `tag=a&tag=b` gives `["a", "b"]`.
- **Express 5 doesn't build nested objects by default.** `filter[x]=1` stays as the literal key `"filter[x]"`. (Express 4 turned it into `{ filter: { x: '1' } }`.)

## When to use which

**Ask yourself: "If I remove it, am I asking for a DIFFERENT thing, or the SAME list arranged differently?"**

- **Different thing** → route param
- **Same list, arranged differently** → query param

| I want to… | Use | Example |
| --- | --- | --- |
| Get one habit | Route | `GET /habits/7` |
| Update / delete one habit | Route | `PATCH /habits/7`, `DELETE /habits/7` |
| Get habits that belong to a user | Route (nesting) | `GET /users/42/habits` |
| Act on one habit | Route | `POST /habits/7/complete` |
| Only active habits | Query | `GET /habits?status=active` |
| Sort | Query | `GET /habits?sort=createdAt&order=desc` |
| Paginate | Query | `GET /habits?page=2&limit=20` |
| Search | Query | `GET /habits?search=read` |
| Combine them | Both | `GET /users/42/habits?status=active&page=2` |

## Not found: the behaviour differs

- **Route param, doesn't exist** → `GET /habits/999` → **404 Not Found**. You asked for one specific thing, and it isn't there.
- **Query filter, matches nothing** → `GET /habits?status=archived` → **200 with `[]`**. The list exists; it's just empty for that filter.

## Gotchas

**1. Everything is a string**, so convert before comparing or doing maths:

```ts
req.params.id === 7       // ❌ false: it's '7'
'2' + 1                   // ❌ '21'
z.coerce.number()         // ✅ turns '7' into 7 in a Zod schema
```

**2. Express 5: `req.query` is read-only.** You can't do `req.query = validated` the way you do with `req.body`. It throws:

```
Cannot set property query of #<IncomingMessage> which has only a getter
```

Store the clean version somewhere else instead, e.g. `res.locals.query = validated`, or parse it inside the handler.

**3. A query value can be a string OR an array.** `?tag=a` gives `'a'`, but `?tag=a&tag=b` gives `['a', 'b']`. Validate it so your code doesn't break on one or the other.

**4. Don't put secrets in query params.** URLs end up in browser history, server logs and analytics. Tokens and passwords go in **headers** or the **body**.

## Validating them with Zod

The same factory idea as `validateBody` (see [04-validation-middleware-zod.md](./04-validation-middleware-zod.md)):

```ts
const habitParamsSchema = z.object({
  id: z.coerce.number().int().positive(), // '7' → 7
})

const listHabitsQuerySchema = z.object({
  status: z.enum(['active', 'archived']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().max(100).default(20),
})
```

## Interview Q&A

**Q: How are query parameters represented in the request object?**
A: As a **key-value object** on `req.query`. Values are strings, or arrays of strings when a key repeats.

**Q: Route param vs query param: when do you use each?**
A: Route params **identify** a resource (`/habits/7`). Query params **modify how a list is returned**: filter, sort, paginate, search (`/habits?status=active`).

**Q: Why is `req.params.id === 7` false?**
A: URL values are always strings. Convert with `Number()` or `z.coerce.number()`.

**Q: `GET /habits/999` vs `GET /habits?status=x` with no results: what status codes?**
A: 404 for the missing resource, 200 with an empty array for the filter.

**Q: Anything different in Express 5?**
A: `req.query` is a read-only getter, and the default query parser no longer builds nested objects from `a[b]=1`.
