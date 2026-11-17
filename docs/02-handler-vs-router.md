# Handler vs Router

```js
router.get('/habits', (req, res) => { // router: GET /habits
  res.json({ habits: [] })            // handler: everything in here
})
```

| Part | Job |
| --- | --- |
| **Router** (`app.get`, `router.post`, …) | Matches the **method + path** and decides **which** function runs |
| **Handler** (`(req, res) => {}`) | The callback that runs for that route. It does the work and **sends** the response |

Analogy: the router is the **receptionist** who reads your ticket and points you to the right desk. The handler is the **officer at that desk** who actually serves you.

## Things to remember

- The handler must **send** the response with `res.json()` or `res.send()`. Express **ignores the function's return value**, so `return { habits: [] }` sends nothing.
- A route can have several functions before the handler. Those are middleware (see [03-middleware-and-next.md](./03-middleware-and-next.md)):

  ```js
  router.post('/', validateBody(createHabitSchema), handler)
  ```

- `express.Router()` lets you group related routes in their own file and mount them under a prefix:

  ```js
  // server.ts
  app.use('/api/habits', habitRoutes) // router.get('/:id') becomes GET /api/habits/:id
  ```

## Interview Q&A

**Q: What's the difference between a route and a handler?**
A: The route is the matching rule (method + path). The handler is the function that runs when that rule matches.

**Q: Why use `express.Router()` instead of putting everything on `app`?**
A: Organisation. Each resource gets its own file, and it's mounted once with a prefix.
