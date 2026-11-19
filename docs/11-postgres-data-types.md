# PostgreSQL Data Types (and what they become in JavaScript)

## The one-line answer

Every column has a **type** that decides what it can hold. Most map neatly to JavaScript (`varchar` → `string`, `boolean` → `boolean`), but a few have surprises, especially **money** (`numeric`) and **big numbers** (`bigint`), which arrive in Node as strings.

## Short answer: is `varchar` a string?

**Yes.** `varchar` = **var**iable-length **char**acters = a string in JS. `varchar(255)` means "a string of at most 255 characters". The database rejects anything longer.

## The full cheat sheet (PostgreSQL)

### Text

| Postgres type | JS type | Use for | Notes |
| --- | --- | --- | --- |
| `varchar(n)` | `string` | Names, emails, usernames | Max length `n` enforced |
| `text` | `string` | Descriptions, notes, long content | No length limit |
| `char(n)` | `string` | Fixed-length codes (`NGN`, country codes) | Pads with spaces. Rarely used |

> In Postgres, `varchar(n)` and `text` perform the same. Use `varchar(n)` when a **limit is a business rule** (a BVN is 11 digits), and `text` when it isn't.

### Numbers

| Postgres type | JS type | Range / use | Notes |
| --- | --- | --- | --- |
| `smallint` | `number` | -32,768 to 32,767 | Small counters |
| `integer` / `int` | `number` | About ±2.1 billion | Counts, `target_count` |
| `bigint` | ⚠️ `string` (or `bigint`) | Huge numbers | The `pg` driver returns it as a **string** to avoid losing precision |
| `serial` / `bigserial` | `number` / `string` | Auto-increment IDs (1, 2, 3…) | Older ID style. `uuid` is common now |
| `numeric(p, s)` / `decimal` | ⚠️ `string` | **Money**, exact decimals | `numeric(12, 2)` = up to 12 digits, 2 after the point. Returned as a string so no kobo is lost |
| `real` / `double precision` | `number` | Scientific values, measurements | **Never for money**: `0.1 + 0.2 !== 0.3` |

> 💰 **Fintech rule:** money is **`numeric`** (or an integer in kobo, e.g. ₦50.25 → `5025`). It's **never** `real` or `double`.

### True/false, IDs, dates

| Postgres type | JS type | Use for | Notes |
| --- | --- | --- | --- |
| `boolean` | `boolean` | `is_active`, `is_verified` | `true` / `false` / `NULL` |
| `uuid` | `string` | Primary keys | `'3f2b…-…'`. Random, so IDs can't be guessed |
| `date` | `string` / `Date` | Birthdays, due dates | Day only, no time |
| `time` | `string` | Opening hours | Time only |
| `timestamp` | `Date` | Event times | ⚠️ No timezone stored |
| `timestamptz` | `Date` | **Prefer this** for `created_at` etc. | Stores in UTC and converts correctly. Safest across Lagos ↔ London servers |
| `interval` | `object` / `string` | Durations ("3 days") | |

### Structured & special

| Postgres type | JS type | Use for | Notes |
| --- | --- | --- | --- |
| `jsonb` | `object` / `array` | Flexible extra data, settings, API payloads | Indexable and queryable. Prefer it over `json` |
| `json` | `object` / `array` | Same, stored as raw text | Slower to query |
| `text[]`, `int[]` | `string[]`, `number[]` | Simple lists | Don't use arrays to fake relationships. Use a link table |
| `enum` (custom) | `string` union | Fixed choices: `'daily' \| 'weekly'` | The DB rejects any other value |
| `bytea` | `Buffer` | Small binary data | Store files in object storage instead, and keep only the URL |

## Constraints you'll see beside the types

| Label | Meaning |
| --- | --- |
| `PK` / 🔑 | Primary key: unique, never null, the row's official ID |
| `FK` / 🔗 | Foreign key: must match an `id` that exists in another table |
| `NN` / `not null` | Can't be empty |
| `unique` / fingerprint icon | No two rows can share this value |
| `default` | Value used when you don't send one (`now()`, `true`, `1`) |
| `on delete cascade` | Delete the parent and its children go with it |

---

## Gotchas

**1. Using `real`/`double` for money.** Use `numeric(p, s)` or integer kobo.

**2. Surprise strings from the driver.** `bigint` and `numeric` come back as **strings** in Node. Convert deliberately.

**3. `timestamp` without a timezone.** Prefer `timestamptz`.

## Interview Q&A

**Q: Does `varchar` map to a JS string? What's the difference from `text`?**
A: Yes, both are strings. `varchar(n)` enforces a maximum length, and `text` has no limit. In Postgres they perform the same.

**Q: What type would you use for money, and why?**
A: `numeric(p, s)` or an integer in the smallest unit (kobo). Floats can't represent decimals exactly, so they cause rounding errors.

**Q: `timestamp` vs `timestamptz`?**
A: `timestamptz` stores the moment in UTC and converts it for each timezone. `timestamp` stores no timezone, which causes bugs when servers or users are in different zones.

---

**Series:** [10 Reading ER diagrams](./10-reading-er-diagrams.md) · **11 Postgres data types** · [12 Designing with dbdiagram](./12-designing-schemas-with-dbdiagram.md) · [13 Drizzle relations](./13-drizzle-relations-from-diagrams.md) · [14 Prisma](./14-prisma-schema-and-relations.md)
