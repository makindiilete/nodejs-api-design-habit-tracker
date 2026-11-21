# Connection Pooling: Mongoose vs Postgres (`pg` + Drizzle)

## The one-line answer

A **connection pool** is a small set of database connections that stay open and get **lent out** to each query, then **returned**, so your app doesn't pay the cost of opening a fresh connection every time. **Both** Mosh's Mongoose setup and our Postgres setup use pooling: Mongoose does it **silently** for you, while we create the pool **explicitly** with `new Pool()` from `pg`.

> ⚠️ **Common mix-up:** `remember()` is **not** the pooling. `new Pool()` is the pooling. `remember()` only stops dev hot-reloads from creating extra pools.

---

## Why pooling exists

Opening a database connection is expensive. Before a single query runs, the app and the database have to:

1. Open a network (TCP) connection
2. Do a TLS handshake (if encrypted)
3. Log in (check username and password)
4. Set up a session on the database side

Doing all of that **per query** would be slow, and the database would drown in short-lived connections.

> 🚕 **Analogy: the taxi rank.** Without a pool, every trip means **buying a new car**, driving once, then scrapping it. With a pool, there's a **taxi rank** with a fixed number of taxis. A request walks up, takes a taxi, finishes the trip, and the taxi goes back to the rank for the next person. If every taxi is busy, you **wait in the queue** for one to come back.

| Without a pool | With a pool |
| --- | --- |
| New connection per query | Connections reused |
| Login + handshake every time | Paid once per connection |
| Slow under load | Fast under load |
| Can exceed the DB's connection limit | Capped at the pool's `max` |

---

## Side by side: Mosh vs this project

### Mosh (Vidly course): MongoDB + Mongoose

```js
// startup/db_init.js
const winston = require("winston");
const mongoose = require("mongoose");

module.exports = function() {
  mongoose
    .connect("mongodb://localhost/vidly")
    .then(() => winston.info("Connected to MongoDB......"));
};
```

Called once at startup, e.g. `require('./startup/db_init')()`.

### This project: Postgres + `pg` Pool + Drizzle

```ts
// src/db/connection.ts
const createPool = () => new Pool({ connectionString: env.DATABASE_URL })

let client: Pool
if (isProd()) {
  client = createPool()
} else {
  client = remember('dbPool', () => createPool())
}

export const db = drizzle({ client, schema })
```

Imported wherever you need it: `import { db } from '../db/connection.ts'`.

### The comparison

| | Mosh: Mongoose | Ours: `pg` + Drizzle |
| --- | --- | --- |
| Database | MongoDB (documents) | PostgreSQL (tables) |
| Is there a pool? | ✅ Yes, **hidden** inside the MongoDB driver | ✅ Yes, **visible**: `new Pool()` |
| Who creates it | `mongoose.connect()` does it for you | You do, with `new Pool()` |
| When it connects | **Eagerly**, as soon as `connect()` is called | **Lazily**, on the first query |
| Connection string | Hard-coded in the file | From `env.DATABASE_URL`, validated by Zod in `env.ts` |
| What you export | A **function** you must call at startup | A ready **object** (`db`) you import |
| How the rest of the app reaches the DB | Mongoose is a global singleton: any model just works after `connect()` | Import `db` explicitly |
| Success log | "Connected to MongoDB" | None |
| Dev hot-reload safety | Not handled | `remember('dbPool', …)` |

> 🏠 **Analogy: building wiring.** Mongoose is a **rented flat**: the wiring (pool) is already inside the walls, you just flip the main switch (`connect()`). Our setup is **building your own house**: you install the fuse box yourself (`new Pool()`), so you can see it and adjust it, and every room (file) gets a socket by importing `db`.

---

## Where Mongoose hides its pool

`mongoose.connect()` hands the job to the official MongoDB Node driver, which keeps a pool per server. You can tune it if you want:

```js
mongoose.connect(uri, { maxPoolSize: 10 })
```

You just never *see* the pool in Mosh's code, which is why it feels like "no pooling." It's there.

Mongoose also **buffers** commands: if a model query runs before the connection finishes, Mongoose holds it and runs it once connected. That's why you can call `connect()` and immediately start using models.

---

## Our `pg` Pool, piece by piece

```ts
new Pool({ connectionString: env.DATABASE_URL })
```

Key defaults from `pg` (you can override any of these in the options object):

| Option | Default | Meaning |
| --- | --- | --- |
| `max` | `10` | Most connections the pool will open at once |
| `idleTimeoutMillis` | `10000` (10s) | Close a connection that has sat unused this long |
| `connectionTimeoutMillis` | `0` (wait forever) | How long a query waits for a free connection |

What happens on a query:

1. Drizzle asks the pool for a connection
2. Pool hands over an idle one, **or** opens a new one if under `max`, **or** queues the request if all `max` are busy
3. Query runs
4. Connection goes **back to the pool** (not closed)

> 🔢 **Remember the ceiling.** Postgres itself allows only so many connections in total (commonly 100 by default). Every running copy of your app has its own pool. 5 copies × `max: 10` = 50 connections. That's why the pool size matters once you scale.

### `drizzle({ client, schema })`

Drizzle doesn't manage connections. It **borrows the pool** you give it and turns your TypeScript calls into SQL. Passing `schema` unlocks the relational query API (`db.query.habits.findMany({ with: { entries: true } })`, see doc 13).

---

## What `remember()` is actually for

In development, the server **hot-reloads** when you save a file. A reload re-runs `connection.ts` from the top.

Without `remember`:

```
save #1 → new Pool()  (pool A, still holding connections)
save #2 → new Pool()  (pool B; A is orphaned but its connections stay open)
save #3 → new Pool()  (pool C; A and B still open)
…eventually: "sorry, too many clients already"
```

`remember('dbPool', createPool)` stores the pool on `globalThis` under the key `'dbPool'`. `globalThis` survives a reload, so the next run finds the pool already there and **reuses it**.

> 🗝️ **Analogy: the key under the doormat.** On the first visit you make a key and put it under the mat (`globalThis`). On every later visit you check the mat first and use the same key, instead of cutting a new one each time.

Production doesn't hot-reload, so it skips `remember` and calls `createPool()` once.

| | Does pooling? | Job |
| --- | --- | --- |
| `new Pool()` | ✅ | Keep and lend out connections |
| `remember()` | ❌ | Keep **one** pool alive across dev reloads |

---

## Gotcha: lazy connection = late errors

Because `pg` connects on the first query, a server can start "fine" with a wrong password or a database that's down, and only fail on the first request.

`env.ts` already catches a **badly formatted** URL (must start with `postgresql://`), but not a URL that's well-formed and wrong. If you want Mosh-style "Connected" feedback at startup, ping the database once:

```ts
import { sql } from 'drizzle-orm'
await db.execute(sql`select 1`)
console.log('Connected to Postgres')
```

---

## Interview-ready summary

- **Pooling** = reuse a fixed set of open connections instead of opening one per query.
- **Mongoose**: pooling is built in and hidden; `mongoose.connect()` sets it up and connects eagerly.
- **`pg`**: you create the pool with `new Pool()`; it connects lazily on the first query; default `max` is 10.
- **Drizzle** sits on top of the pool and turns TypeScript into SQL; it doesn't manage connections.
- **`remember()`** is a dev-only guard so hot-reloads reuse one pool instead of leaking new ones. It is **not** what provides pooling.
