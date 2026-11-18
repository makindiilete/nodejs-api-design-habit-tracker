# Relational Databases

## The one-line definition

A **relational database** stores data in **tables**. Every row in a table follows the same **schema** (the same set of columns). Each row has a **primary key** that identifies it, and tables link to each other with **foreign keys**.

**Analogy: an Excel workbook whose sheets point at each other.** Each sheet is a table, each row is one record, and instead of copying a customer's details onto every receipt, the receipt sheet just writes the customer's ID.

Examples: **PostgreSQL**, **MySQL**, **SQL Server**, **SQLite**. You talk to all of them with **SQL**.

## What it looks like

**`customers`**

| id (PK) | name | email (unique) |
| --- | --- | --- |
| 1 | Michael | michael@mail.com |
| 2 | Ngozi | ngozi@mail.com |

**`transactions`**

| id (PK) | customer_id (FK → customers.id) | amount | date |
| --- | --- | --- | --- |
| 101 | 1 | 5000 | 2026-11-01 |
| 102 | 1 | 12000 | 2026-11-03 |
| 103 | 2 | 3500 | 2026-11-04 |

```
customers                         transactions
┌────┬─────────┐                  ┌─────┬─────────────┬────────┐
│ id │ name    │◄─────────────────┤ id  │ customer_id │ amount │
└────┴─────────┘   one customer   └─────┴─────────────┴────────┘
     (PK)          has many            (PK)    (FK)
                   transactions
```

Transaction `101` doesn't repeat Michael's name or email. It only says `customer_id = 1`. That pointer is the **relationship**, which is where the word "relational" comes from.

## The building blocks

### 1. Tables, rows, columns

- A **table** holds one kind of thing: customers, transactions, statements.
- A **row** is one item: one customer.
- A **column** is one detail about every item: `name`, `email`.

### 2. Schema: same columns for every row, but changeable

Two separate ideas that are easy to mix up:

| Statement | True? |
| --- | --- |
| Every row in a table has the same columns | ✅ Yes |
| The columns can never change after the table is created | ❌ No |

You **can** add, remove or rename columns later with a **migration** (`ALTER TABLE`). The rule is that the change applies to the **whole table**. Add `phone` and every row gets a `phone` column (empty, `NULL`, until filled in). What you can't do is give only one row an extra column.

**Analogy: a printed account-opening form.** Every customer fills in the same boxes. The bank can print a new version of the form with an extra box, and then everyone's form has it. What it can't do is staple an extra box onto one customer's form only.

```sql
-- migration: every existing row gets phone = NULL
ALTER TABLE customers ADD COLUMN phone VARCHAR(20);
```

### 3. Primary key vs unique key

| | Unique key | Primary key |
| --- | --- | --- |
| Values can repeat? | ❌ No | ❌ No |
| How many per table? | As many as you need | **Exactly one** |
| Can be empty (`NULL`)? | Usually yes | ❌ Never |
| Job | Stop duplicates (`email`, `phone`, `bvn`) | Be the row's **official ID** that other tables point to |

> **Every primary key is unique, but not every unique key is the primary key.**

**Analogy: a school.** Each student has a unique phone number, email and exam number, but the school picks one, the **student ID**, as the official number printed on every report card. That's the primary key. The others are unique keys.

```sql
CREATE TABLE customers (
  id    SERIAL PRIMARY KEY,         -- the official ID
  name  TEXT NOT NULL,
  email TEXT UNIQUE                  -- no two customers share an email
);
```

### 4. Foreign keys: the links between tables

A **foreign key** is a column that holds another table's primary key. The database **enforces** it:

- ❌ You can't insert a transaction for `customer_id = 99` if customer 99 doesn't exist.
- ❌ You can't delete a customer while transactions still point to them, unless you say what should happen (`ON DELETE CASCADE` deletes the transactions too, `ON DELETE SET NULL` clears the link).

```sql
CREATE TABLE transactions (
  id          SERIAL PRIMARY KEY,
  customer_id INT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  amount      NUMERIC(12, 2) NOT NULL
);
```

This guarantee is called **referential integrity**: links always point to something real.

#### Can a foreign key point to a unique key instead of the primary key?

**Yes.** A foreign key can reference the **primary key** or **any column with a `UNIQUE` constraint**. The real rule is that the target must identify **exactly one row**, and both guarantee that.

```sql
CREATE TABLE banks (
  id   SERIAL PRIMARY KEY,
  code VARCHAR(6) UNIQUE NOT NULL,   -- CBN bank code, e.g. '058'
  name TEXT NOT NULL
);

-- Option A: point at the primary key (the default)
CREATE TABLE accounts_a (
  id      SERIAL PRIMARY KEY,
  bank_id INT REFERENCES banks(id)
);

-- Option B: point at a unique key
CREATE TABLE accounts_b (
  id        SERIAL PRIMARY KEY,
  bank_code VARCHAR(6) REFERENCES banks(code)
);
```

If `code` weren't `UNIQUE`, Postgres would reject option B, because `'058'` could match two rows.

**Use the primary key (about 95% of the time) because it:**

- **never changes.** An `id` like `42` means nothing outside the database, so there's no reason to edit it.
- **is never `NULL`.** A unique column usually can be.
- **is small and fast** to join on.
- **is what ORMs and other developers expect** (Prisma, TypeORM).

**Use a unique key when it's a stable code the outside world already uses:**

1. **Official codes that never change:** currency (`NGN`), country (`NG`), CBN bank codes (`058`). The row stays readable without a join.
2. **Data coming from outside:** a statement or third-party API gives you `bank_code: "058"`, not your internal `id`, so you can insert without looking the id up first.
3. **Linking across systems:** another service only knows `customer_ref` (`CUST-00123`), not your ids.
4. **Legacy schemas** already linked on a business code.

**Analogy: your phone contacts.** If five group chats saved your friend by phone number and they change numbers, every chat breaks. If the chats saved them by a contact ID that never changes, you update the number once and everything still works. The primary key is that unchanging contact ID.

> ⚠️ **Never point a foreign key at a unique key that can change**, like `email` or `phone`. When it changes, every row pointing at the old value breaks, unless you add `ON UPDATE CASCADE`, which rewrites every child row.

**Rule:** point at the primary key by default. Point at a unique key only if it's **stable, not null, and used by an outside system or person**.

### 5. Indexes: speed, not relationships

An **index** helps the database **find rows fast** without scanning the whole table. It does **not** link tables. (Foreign keys do that.)

**Analogy: the index at the back of a textbook.** It doesn't change the book's content. It just tells you which page to jump to.

```sql
CREATE INDEX idx_transactions_customer ON transactions(customer_id);
```

Primary keys and unique columns get an index automatically. Foreign key columns usually don't in Postgres, so you add one yourself when you query by them often.

## Why split data into related tables?

- **No repetition.** A customer's email lives in one row, not on every transaction.
- **One place to update.** Change the email once and every transaction still points to the right customer.
- **No broken links.** Foreign keys stop orphan rows.
- **Join when you need it:**

```sql
SELECT c.name, t.amount
FROM transactions t
JOIN customers c ON c.id = t.customer_id;
```

## Relational vs MongoDB

**MongoDB is not relational.** It's a **document (NoSQL) database**.

| | Relational (Postgres, MySQL) | MongoDB |
| --- | --- | --- |
| Stores data as | Rows in tables | JSON-like documents in collections |
| Same fields for every item? | ✅ Enforced by the schema | ❌ Each document can differ (unless you add validation) |
| Links between data | Foreign keys, **enforced** | Stored `_id` references, **not enforced** |
| Combining data | `JOIN` | Embedding, or `$lookup` / Mongoose `.populate()` |
| Query language | SQL | MongoDB query API |

How MongoDB handles relationships:

**1. Embed:** put the child data inside the parent.

```js
{
  _id: ObjectId("..."),
  name: "Michael",
  transactions: [
    { amount: 5000, date: "2026-11-01" },
    { amount: 12000, date: "2026-11-03" }
  ]
}
```

**2. Reference:** store the other document's `_id`.

```js
{ _id: ObjectId("t101"), customerId: ObjectId("c1"), amount: 5000 }
```

The reference *looks* like a foreign key, but MongoDB won't stop you saving a `customerId` that doesn't exist, or deleting a customer that transactions still point to. **Your app code has to protect those links.**

**Analogy: a strict registry office vs a personal notebook.** The registry office (relational) refuses to register a child to parents who aren't on file. The notebook (MongoDB) lets you write "parent: #99" whether #99 exists or not.

## Gotchas

**1. "Fixed columns" is misleading.** The columns are *consistent* across rows, not frozen forever. Migrations change them.

**2. Indexes aren't relationships.** Foreign keys link tables. Indexes only make lookups faster.

**3. A unique column can still be `NULL`** in most databases (Postgres allows many `NULL`s in a unique column). A primary key never can.

**4. Deleting a parent row fails** if child rows still reference it and you didn't set an `ON DELETE` rule.

## Interview Q&A

**Q: What is a relational database?**
A: A database that stores data in tables. Every row follows the table's schema, each row has a primary key, and tables link through foreign keys. You query it with SQL.

**Q: Can you add a column to a table after it's created?**
A: Yes, with a migration (`ALTER TABLE ... ADD COLUMN`). The new column applies to every row. Existing rows get `NULL` or a default value.

**Q: Primary key vs unique key?**
A: Both stop duplicates. A table has one primary key, it can't be `NULL`, and it's the row's official ID that foreign keys point to. A table can have many unique keys, and they can usually be `NULL`.

**Q: What's a foreign key?**
A: A column that holds another table's primary key. The database enforces that it points to a real row (referential integrity).

**Q: Does a foreign key have to reference a primary key?**
A: No. It can reference the primary key or any `UNIQUE` column, because both identify exactly one row.

**Q: When would you reference a unique key instead of the primary key?**
A: When it's a stable, non-null code that outside systems use, like a currency, country or bank code. That avoids an id lookup on insert and keeps rows readable. Never use something that can change, like an email.

**Q: Does an index create a relationship between tables?**
A: No. An index only speeds up lookups. Relationships come from foreign keys.

**Q: Is MongoDB relational? How do you model relationships in it?**
A: No, it's a document database. You either embed related data inside a document or store another document's `_id` as a reference and combine them with `$lookup` or `.populate()`. References aren't enforced, so the app keeps them valid.

**Q: When would you pick a relational database?**
A: When data has clear relationships and correctness matters, like money, accounts and transactions. Foreign keys, constraints and transactions protect the data. That's why most fintechs use Postgres or MySQL for core data.
