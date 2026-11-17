# Middleware and `next()`

## What is middleware?

A function that sits **between** the request arriving and the final route handler.

```ts
(req, res, next) => { ... }
```

Analogy: a request is a **parcel on a conveyor belt**. Each middleware is a worker standing by the belt. `next()` is the worker saying *"I'm done, pass it to the next person."*

```
request → logger → requireAuth → validateBody → handler → response
```

Express runs the functions **left to right**, in the order you list them:

```ts
router.post('/', validateBody(schema), handler)
//               ^ runs first          ^ only runs if the guard calls next()
```

## Every middleware must do ONE of these

| Action | Meaning |
| --- | --- |
| `next()` | Pass: go to the next function in line |
| `next(err)` | Something broke: skip straight to the error handler |
| `res.json()` / `res.send()` | Stop here: answer the client, and the chain ends |

If it does **none** of these, the request **hangs** and the client waits until it times out.

## Rules that catch people out

- **Don't respond AND call `next()`.** A later handler will also try to respond, and you get `Cannot set headers after they are sent`.
- **`next()` does not stop your function.** Code below it still runs, so use `return next()` or `return res.status(...)` when nothing after should run.
- **`next(err)`** (pass anything) skips all normal middleware and jumps to the **error handler**, which has **4 arguments** so Express knows what it is:

  ```ts
  app.use((err, req, res, next) => {
    res.status(500).json({ error: err.message })
  })
  ```

- **Express 5:** if an `async` handler throws or its promise rejects, Express calls `next(err)` for you. In Express 4 you had to `try/catch` and call `next(err)` yourself.

## Full example

```ts
const logger = (req, res, next) => {
  console.log(req.method, req.path)
  next() // pass it on
}

const requireAuth = (req, res, next) => {
  if (!req.headers.authorization) {
    return res.status(401).json({ error: 'Unauthorized' }) // stop here
  }
  next() // allowed, keep going
}

router.get('/habits', logger, requireAuth, (req, res) => {
  res.json({ habits: [] }) // final handler responds
})

app.use((err, req, res, next) => { // error handler (4 args)
  res.status(500).json({ error: err.message })
})
```

## Global vs route middleware

```ts
app.use(express.json()) // global: runs for EVERY request
router.post('/', validateBody(schema), handler) // route: only for this route
```

Forgetting `express.json()` means `req.body` is `undefined`, so every validation fails.

## Interview Q&A

**Q: What happens if middleware never calls `next()` or sends a response?**
A: The request hangs until the client times out.

**Q: How does Express know a function is an error handler?**
A: It has 4 parameters: `(err, req, res, next)`.

**Q: What's the difference between `next()` and `next(err)`?**
A: `next()` moves to the next normal middleware. `next(err)` skips them all and goes to the error handler.

**Q: What changed with async errors in Express 5?**
A: A rejected promise in a handler is passed to `next(err)` automatically.
