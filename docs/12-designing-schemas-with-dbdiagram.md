# Designing Schemas with dbdiagram.io

## The one-line answer

**dbdiagram.io** lets you *type* your tables in a short language called **DBML** and draws the ER diagram live. Design and check there first, then turn the DBML into your ORM schema.

## The workflow

```
1. THINK        →  2. TYPE (DBML)      →  3. CHECK         →  4. GENERATE
nouns = tables     dbdiagram draws it     5-step recipe       Drizzle schema
"one or many?"     live as you type       + "ask both ways"   (AI converts DBML)
```

## The 5-step recipe (do this before typing)

1. **Find the nouns** → each noun is a table.
2. **Give every table** `id`, `created_at`, `updated_at`.
3. **For each pair of tables ask both ways:** one A → many B? one B → many A?
4. **Apply:** one side many → FK on the many side. Both many → link table. Both one → FK + `unique`.
5. **Add guards:** `unique`, `not null`, `on delete` behaviour.

## DBML syntax cheat sheet

```dbml
Table users {
  id uuid [pk]
  email varchar(255) [unique, not null]
  is_active boolean [default: true]
  created_at timestamptz [default: `now()`]
  balance numeric(12,2) [note: 'Money: never float']
}
```

| You want | DBML |
| --- | --- |
| Primary key | `[pk]` |
| Unique | `[unique]` |
| Not null | `[not null]` |
| Default value | `[default: true]`, `[default: 1]`, ``[default: `now()`]`` |
| Note on a column | `[note: 'hashed']` |
| Auto-increment | `[pk, increment]` |
| Unique pair | `indexes { (habit_id, tag_id) [unique] }` |
| Colour a table header | `Table habit_tags [headercolor: #8E44AD] { … }` |

## Relationship symbols

| Symbol | Meaning | Example |
| --- | --- | --- |
| `>` | many-to-one | `Ref: habits.user_id > users.id` |
| `<` | one-to-many | `Ref: users.id < habits.user_id` |
| `-` | one-to-one | `Ref: kyc_profiles.user_id - users.id` |
| `<>` | **many-to-many** | `Ref: habits.id <> tags.id` |

Add delete behaviour like this: `Ref: habits.user_id > users.id [delete: cascade]`

> ✨ **`<>` lets you design at the "meaning" level.** You draw one many-to-many line, and when you export to SQL, dbdiagram generates the link table for you. Keep an explicit link table (like `habit_tags`) when the link needs its own data, such as `created_at`.

## Convention: colour your link tables

```dbml
Table habit_tags [headercolor: #8E44AD, note: 'LINK TABLE: habits <> tags'] {
  id uuid [pk]
  habit_id uuid [not null]
  tag_id uuid [not null]
  created_at timestamptz [default: `now()`]
  indexes {
    (habit_id, tag_id) [unique]
  }
}
```

A purple header always means "bridge table" in every diagram you make.

## Exporting

- **Export → PNG / PDF** gives a picture for docs and PRs (save it in `docs/images/`).
- **Export → PostgreSQL** gives ready-to-run `CREATE TABLE` SQL.
- **Share → link** gives a live, always-up-to-date cloud version to paste into docs.

## Speed tips

- **AI first draft:** describe the app in plain English → ask for DBML → paste into dbdiagram → review with the recipe.
- **AI conversion:** paste the finished DBML → *"Convert to a Drizzle Postgres schema with cascade deletes."*
- **AI review:** paste any schema → *"List every relationship in plain English and flag any many-to-many."*
- **Reverse it:** for an existing database, Drizzle Studio, ChartDB or pgAdmin's ERD tool can draw the diagram for you.


## Full DBML for the habit tracker

```dbml
Table users {
  id uuid [pk]
  email varchar(255) [unique, not null]
  username varchar(50) [unique, not null]
  password varchar(255) [not null, note: 'hashed']
  first_name varchar(50)
  last_name varchar(50)
  created_at timestamptz [default: `now()`]
  updated_at timestamptz [default: `now()`]
}

Table habits {
  id uuid [pk]
  user_id uuid [not null]
  name varchar(100) [not null]
  description text
  frequency varchar(20) [not null, note: 'daily | weekly']
  target_count int [default: 1]
  is_active boolean [default: true]
  created_at timestamptz [default: `now()`]
  updated_at timestamptz [default: `now()`]
}

Table entries {
  id uuid [pk]
  habit_id uuid [not null]
  completion_date timestamptz [default: `now()`]
  note text
  created_at timestamptz [default: `now()`]
}

Table tags {
  id uuid [pk]
  name varchar(50) [unique, not null]
  color varchar(7) [default: '#6B7280']
  created_at timestamptz [default: `now()`]
  updated_at timestamptz [default: `now()`]
}

Table habit_tags [headercolor: #8E44AD, note: 'LINK TABLE: habits <> tags'] {
  id uuid [pk]
  habit_id uuid [not null]
  tag_id uuid [not null]
  created_at timestamptz [default: `now()`]
  indexes {
    (habit_id, tag_id) [unique]
  }
}

Ref: habits.user_id > users.id [delete: cascade]
Ref: entries.habit_id > habits.id [delete: cascade]
Ref: habit_tags.habit_id > habits.id [delete: cascade]
Ref: habit_tags.tag_id > tags.id [delete: cascade]
```

## Gotchas

**1. Forgetting `UNIQUE` on a link table's pair.** Without it, the same tag can be attached to a habit twice.

---

**Series:** [10 Reading ER diagrams](./10-reading-er-diagrams.md) · [11 Postgres data types](./11-postgres-data-types.md) · **12 Designing with dbdiagram** · [13 Drizzle relations](./13-drizzle-relations-from-diagrams.md) · [14 Prisma](./14-prisma-schema-and-relations.md)
