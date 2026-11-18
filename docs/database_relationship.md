# Database Relationships

## The one-line answer

There are three types of relationship between tables: **one-to-one (1:1)**, **one-to-many (1:N)** and **many-to-many (M:N)**. They describe how many rows on one side can connect to how many rows on the other.

## The two-question test

For any two tables A and B, ask:

1. One A can have **how many** B's?
2. One B can have **how many** A's?

| Answers | Relationship |
| --- | --- |
| one and one | **One-to-one** |
| many and one | **One-to-many** |
| many and many | **Many-to-many** |

## How often each one is used

| Rank | Relationship | How common |
| --- | --- | --- |
| 1 | **One-to-many** | ⭐⭐⭐ By far the most common. Most of a typical schema is this. |
| 2 | **Many-to-many** | ⭐⭐ Common. Most real apps have a few. |
| 3 | **One-to-one** | ⭐ The least common. Often the data just goes in the same table. |

There's no official count, but this order is the general experience across real-world schemas. Look at any app: users have many orders, an account has many transactions, a post has many comments. Those are all one-to-many. Many-to-many shows up for things like tags, roles and enrollments. One-to-one is mostly used to split off sensitive or optional data.

## 1. One-to-one (1:1)

**Technical:** one row in A matches **at most one** row in B, and the other way round too. Build it with a foreign key that is also `UNIQUE`, so the same parent can't be linked twice.

**Example:** `users` ↔ `kyc_profiles`. Each user has one KYC profile, and each profile belongs to one user.

```sql
CREATE TABLE kyc_profiles (
  id      SERIAL PRIMARY KEY,
  user_id INT UNIQUE NOT NULL REFERENCES users(id),  -- UNIQUE makes it 1:1
  bvn     VARCHAR(11) UNIQUE
);
```

**Analogy: a person and their NIN.** One person gets one NIN, and one NIN belongs to one person.

**Why not just put it in the same table?** Sometimes you should. Split it out when the extra data is:

- **sensitive** (lock it down separately),
- **large** (don't load it on every query), or
- **optional** (most rows would leave those columns empty).

## 2. One-to-many (1:N)

**Technical:** one row in A matches **many** rows in B, but each B row belongs to **only one** A. The foreign key goes on the **"many" side**.

**Example:** `customers` → `transactions`. One customer has many transactions, and each transaction belongs to one customer.

```sql
CREATE TABLE transactions (
  id          SERIAL PRIMARY KEY,
  customer_id INT NOT NULL REFERENCES customers(id),  -- no UNIQUE, so many allowed
  amount      NUMERIC(12, 2)
);
```

**Analogy: a mother and her children.** A mother can have many children, but each child has one mother. The child's birth certificate carries the mother's name. The mother doesn't carry a list of children, so the pointer lives on the many side.

> **1:1 vs 1:N in SQL:** the only difference is `UNIQUE` on the foreign key.

## 3. Many-to-many (M:N)

**Technical:** many rows in A match many rows in B. A single foreign key column can only hold **one** ID, so you can't do this with a column in either table. You need a third table in the middle, a **junction table** (also called a join, link or pivot table), that holds **two foreign keys**, one for each side.

**Example:** `students` ↔ `courses`. A student takes many courses, and a course has many students.

```sql
CREATE TABLE enrollments (
  student_id  INT REFERENCES students(id),
  course_id   INT REFERENCES courses(id),
  enrolled_at TIMESTAMP DEFAULT now(),
  PRIMARY KEY (student_id, course_id)   -- same student can't enroll in the same course twice
);
```

| student_id | course_id |
| --- | --- |
| 1 | 10 |
| 1 | 11 |
| 2 | 10 |

Student 1 takes courses 10 and 11, and course 10 has students 1 and 2.

**Analogy: a church attendance register.** One member attends many services, and one service has many members. The church doesn't list every service on a member's card. It keeps a separate register where each line says "member X attended service Y." That register is the junction table.

> A many-to-many is really **two one-to-many relationships** joined through the middle table: `students → enrollments ← courses`.

The junction table often holds **its own data**, like `enrolled_at`, a grade, or a role.

## Summary

| | One-to-one | One-to-many | Many-to-many |
| --- | --- | --- | --- |
| Example | User ↔ KYC profile | Customer → transactions | Students ↔ courses |
| How it's built | FK + `UNIQUE` | FK on the many side | Junction table with two FKs |
| How common | Least | Most | Middle |

## In MongoDB

There are no enforced foreign keys and no junction tables:

- **1:1 and small 1:N:** usually **embedded** inside the parent document.
- **Large 1:N:** the child stores the parent's `_id` (a reference).
- **M:N:** arrays of `_id`s on one or both sides, combined with `$lookup` or `.populate()`.

## Gotchas

**1. Putting the FK on the wrong side of a 1:N.** The parent can't hold a list of child IDs in one column. The FK always goes on the child (the many side).

**2. Forgetting `UNIQUE` on a 1:1.** Without it, the database will happily let one user have two KYC profiles. Now it's really a 1:N.

**3. Faking M:N with a comma-separated column** (`course_ids = '10,11'`). You can't add foreign keys to it, can't index it properly, and it's painful to query. Use a junction table.

**4. Duplicate rows in a junction table.** Make `(student_id, course_id)` the primary key or `UNIQUE` so the same pair can't be inserted twice.

## Interview Q&A

**Q: What are the types of relationships in a relational database?**
A: One-to-one, one-to-many and many-to-many. They describe how many rows on each side can connect.

**Q: Which is the most common?**
A: One-to-many, by a wide margin. Then many-to-many. One-to-one is the least common.

**Q: Given `customers` and `transactions`, what's the relationship and where does the FK go?**
A: One-to-many. The FK `customer_id` goes on `transactions`, the many side.

**Q: How do you model many-to-many?**
A: With a junction table that has a foreign key to each side, usually with the pair as a composite primary key.

**Q: How is a one-to-one different from a one-to-many in SQL?**
A: Both use a foreign key. In one-to-one, the foreign key is also `UNIQUE`.

**Q: When would you use one-to-one instead of extra columns in the same table?**
A: When the extra data is sensitive, large or optional, so it's better stored and secured separately.
