# HTTP Status Codes

Rule of thumb: **2xx** means it worked, **4xx** means the client got it wrong, **5xx** means the server got it wrong.

| Code | Name | When to use |
| --- | --- | --- |
| `200` | OK | Success, with a body (GET, PATCH/PUT that returns data) |
| `201` | Created | A new resource was created (`POST /habits`) |
| `204` | No Content | Success, **no body**. Express drops anything you send. |
| `400` | Bad Request | The client sent invalid data (validation failures) |
| `401` | Unauthorized | Not logged in, or the token is missing or bad |
| `403` | Forbidden | Logged in, but not allowed to do this |
| `404` | Not Found | The resource doesn't exist |
| `409` | Conflict | Clashes with existing data (e.g. email already registered) |
| `422` | Unprocessable Entity | Some teams use this instead of 400 for validation |
| `500` | Internal Server Error | Our bug, not the client's fault |

## Gotchas

```ts
// ❌ body is silently thrown away
res.status(204).send({ message: 'Deleted' })

// ✅ either no body…
res.status(204).end()
// ✅ …or a 200 with a body
res.status(200).json({ message: 'Deleted' })
```

- Marking something as done (e.g. `POST /habits/:id/complete`) is closer to an **update**, so `200` usually fits better than `201`.

## Interview Q&A

**Q: 401 vs 403?**
A: 401 means "I don't know who you are." 403 means "I know who you are, and you're not allowed."

**Q: 400 vs 422?**
A: Both are used for bad input. 400 is the general one, and 422 says "I understood the format, but the content is invalid." Pick one and be consistent.
