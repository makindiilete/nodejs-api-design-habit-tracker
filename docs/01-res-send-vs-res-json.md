# `res.send()` vs `res.json()`

Both send a response to the client. The difference is how they decide the **content type**, which is the label on the parcel that tells the client what's inside.

| Method | What it sends | `Content-Type` |
| --- | --- | --- |
| `res.json(x)` | **Always** JSON | `application/json` |
| `res.send(x)` | Guesses from what you pass | Depends on `x` |

- `res.send()` with an **object or array** calls `res.json()` for you, so the result is the same.
- `res.send()` with a **string** sends it as `text/html`.

```js
res.send({ message: 'hi' }) // application/json
res.json({ message: 'hi' }) // application/json (same)
res.send('hello')           // text/html
res.json('hello')           // application/json -> "hello"
```

## Which one to use

Use **`res.json()` for APIs**. It says clearly what you mean, and it still sends valid JSON if a value turns out to be `null` or a string by mistake.

## Interview Q&A

**Q: When would `res.send()` and `res.json()` behave differently?**
A: When you pass a string. `send` labels it `text/html`, while `json` wraps it as a JSON string with `application/json`.

**Q: Which do you use in a REST API and why?**
A: `res.json()`. It's explicit, and the client can always rely on getting JSON back.
