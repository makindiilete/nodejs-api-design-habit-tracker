# ORMs (and how they compare to Entity Framework)

## The one-line definition

An **ORM (Object-Relational Mapper)** is a library that **maps database tables to objects in your code**. You query and save data using your programming language (JavaScript/TypeScript, C#) instead of writing raw SQL. The ORM writes the SQL, runs it, and turns the rows that come back into objects.

**Entity Framework (EF Core) is an ORM.** It's the main ORM in .NET. Node.js has its own ORMs that do the same job.

**Analogy: your bank app.** You tap "Send ₦5,000 to Ngozi". You never type the bank's internal codes, account routing numbers or settlement messages. The app turns your simple tap into whatever the bank's system needs, then shows you a clean "Successful" screen. The ORM is the app: you speak in objects, and it speaks SQL to the database for you.

## What it looks like

The same query, three ways:

**Raw SQL**

```sql
SELECT * FROM users WHERE age > 18;
```

**Entity Framework (C#)**

```csharp
var adults = await db.Users.Where(u => u.Age > 18).ToListAsync();
```

**Prisma (Node.js)**

```ts
const adults = await prisma.user.findMany({ where: { age: { gt: 18 } } });
```

**TypeORM (Node.js)**

```ts
const adults = await userRepo.find({ where: { age: MoreThan(18) } });
```

All three ORM versions produce roughly the same SQL. You get back `User` objects, not raw rows.

## What an ORM does for you

```
 Your code (objects)          ORM                     Database (tables)
┌──────────────────┐   ┌──────────────────┐   ┌─────────────────────────┐
│ prisma.user      │──►│ builds SQL       │──►│ SELECT * FROM users ... │
│  .findMany(...)  │   │                  │   │                         │
│                  │◄──│ rows → objects   │◄──│ rows                    │
└──────────────────┘   └──────────────────┘   └─────────────────────────┘
```

1. **Mapping:** a table becomes a class/model, a row becomes an object, a column becomes a property.
2. **Query building:** method calls (`findMany`, `Where`) become SQL.
3. **Relationships:** load a user's transactions with `include` (Prisma), `relations` (TypeORM) or `Include()` (EF) instead of writing a `JOIN`.
4. **Migrations:** change your models, and the ORM generates the `ALTER TABLE` scripts.
5. **Safety:** values are sent as parameters, which protects you from SQL injection.

## Entity Framework → Node.js cheat sheet

| .NET (Entity Framework Core) | Prisma | TypeORM |
| --- | --- | --- |
| `DbContext` | `PrismaClient` | `DataSource` |
| Entity class (`public class User`) | `model User { }` in `schema.prisma` | `@Entity() class User` |
| `[Key]`, `[Required]` attributes | `@id`, required by default | `@PrimaryGeneratedColumn()`, `@Column()` |
| `DbSet<User>` | `prisma.user` | `Repository<User>` |
| `.Include(u => u.Transactions)` | `include: { transactions: true }` | `relations: { transactions: true }` |
| `dotnet ef migrations add` | `prisma migrate dev` | `typeorm migration:generate` |
| LINQ (`.Where`, `.Select`) | Object filters (`where`, `select`) | `find` options or QueryBuilder |

### Which one feels like EF?

- **TypeORM** feels most like EF: classes with decorators, repositories, migrations. It's the common default with **NestJS**.
- **Prisma** is the most popular right now. You define tables in one `schema.prisma` file, and it generates a fully typed client. Less like EF, but very easy to read.
- Others you'll see: **Sequelize** (older, still in many codebases), **Drizzle** (newer, close to SQL), **Mongoose** (an ODM, the MongoDB version of this idea).

## Same model in EF, Prisma and TypeORM

**EF Core**

```csharp
public class User
{
    public int Id { get; set; }
    public string Email { get; set; }
    public List<Transaction> Transactions { get; set; }
}
```

**Prisma**

```prisma
model User {
  id           Int           @id @default(autoincrement())
  email        String        @unique
  transactions Transaction[]
}
```

**TypeORM**

```ts
@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @OneToMany(() => Transaction, (t) => t.user)
  transactions: Transaction[];
}
```

## ORM vs query builder vs raw SQL

| | Raw SQL (`pg`) | Query builder (Knex, Drizzle) | ORM (Prisma, TypeORM, EF) |
| --- | --- | --- | --- |
| You write | SQL strings | SQL-shaped JS calls | Object/model methods |
| Maps rows to objects | ❌ You do it | Partly | ✅ Yes |
| Relationships & migrations | ❌ Manual | Some | ✅ Built in |
| Control over the exact SQL | ✅ Full | High | Lower |

## Gotchas

**1. The N+1 problem.** Loading 100 users, then their transactions one user at a time, runs 101 queries. Fix it by loading the relation up front (`include` / `relations` / `Include()`). Same trap exists in EF.

**2. ORMs don't replace knowing SQL.** When a query is slow, you still read the generated SQL and add indexes. Every ORM lets you log or drop down to raw SQL (`prisma.$queryRaw`, `query()` in TypeORM, `FromSqlRaw` in EF).

**3. ORM vs ODM.** An **ORM** is for relational databases (Postgres, MySQL). An **ODM** (Object-Document Mapper), like **Mongoose**, does the same job for document databases like MongoDB.

**4. EF tracks changes automatically; Prisma doesn't.** In EF you edit an object and call `SaveChanges()`. In Prisma you call `prisma.user.update(...)` explicitly. TypeORM sits in between: change the entity, then `repo.save(entity)`.

## Interview Q&A

**Q: What is an ORM?**
A: A library that maps database tables to objects in code, so you can query and save data in your programming language instead of writing raw SQL. It generates the SQL and converts rows to objects.

**Q: Is Entity Framework an ORM? What's the Node.js equivalent?**
A: Yes, EF Core is .NET's main ORM. In Node.js the closest equivalents are Prisma and TypeORM (TypeORM is the most EF-like and pairs with NestJS). Sequelize and Drizzle are other options.

**Q: What are the benefits of an ORM?**
A: Less boilerplate SQL, type safety, built-in relationships and migrations, and protection from SQL injection through parameterised queries.

**Q: What are the downsides?**
A: Less control over the exact SQL, possible performance traps like N+1 queries, and an extra layer to learn. For complex reports, raw SQL is often better.

**Q: What's the N+1 problem and how do you fix it?**
A: Running one query for a list, then one extra query per item for related data. Fix it by eager-loading the relation in one query (`include` in Prisma, `relations` in TypeORM, `Include()` in EF).

**Q: ORM vs ODM?**
A: An ORM works with relational (table) databases. An ODM, like Mongoose, works with document databases like MongoDB.

**Q: Would you ever skip the ORM?**
A: Yes, for heavy reporting queries, bulk operations or performance-critical paths. Most ORMs let you run raw SQL for those cases while keeping the ORM for everyday CRUD.
