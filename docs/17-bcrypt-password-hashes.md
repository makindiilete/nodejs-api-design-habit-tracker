# Anatomy of a bcrypt Password Hash

> **One-line summary:** The string in the `password` column is not your password. It is one 60-character string with **three parts glued together**: *which bcrypt version and how slow*, *the random salt*, and *the scrambled result*. The salt and settings are stored openly so the server can repeat the exact same scramble at login time.

---

## 1. The real hash from my database

This is the user I created during the course (`uiking_01`), straight from the `users` table:

```
$2b$12$Rnw3/F4U5poQKSI3B2HUp.F4kwPdlQKJT0M3IBNR0jogViAmV6tH.
```

Split on the `$` signs and by length, it breaks down like this:

```
 $2b$ 12 $ Rnw3/F4U5poQKSI3B2HUp. F4kwPdlQKJT0M3IBNR0jogViAmV6tH.
 └┬─┘ └┬┘   └─────────┬──────────┘ └──────────────┬──────────────┘
  │    │              │                           │
  │    │         SALT (22 chars)          HASH (31 chars)
  │    │         random, unique           the scrambled result of
  │    │         per user                 password + salt
  │    │
  │   COST FACTOR (12) → 2^12 = 4,096 rounds
  │
 ALGORITHM VERSION (2b)

 Total length: 4 + 2 + 1 + 22 + 31 = 60 characters, always
```

| Part | In my hash | What it means |
| --- | --- | --- |
| Version | `$2b$` | Which flavour of bcrypt made it |
| Cost | `12$` | How slow the hashing was (2¹² rounds) |
| Salt | `Rnw3/F4U5poQKSI3B2HUp.` | 22 random characters picked at sign-up |
| Hash | `F4kwPdlQKJT0M3IBNR0jogViAmV6tH.` | 31 characters, the actual output |

My instructor's example (`$2b$10$N9qo8uLOickgx2ZMRZoMye...`) has the exact same shape. The only difference is the cost: **10** in the course example and **12** in my project.

---

## 2. Part by part

### 2.1 Version: `$2b$`

**Technical**
- Tells any bcrypt library which variant of the algorithm produced the hash.
- Versions you'll see:
  - `$2a$`: older; had an edge-case bug with very long passwords in some implementations.
  - `$2b$`: the fixed, current standard. Node's `bcrypt` and `bcryptjs` produce this.
  - `$2y$`: PHP's name for the fixed version. Same thing in practice.
- Because the version is stored *in* the string, you can upgrade libraries later and old hashes still verify.

**Analogy: the model number on a phone charger.** "Type-C, 20W" printed on the plug tells you which socket and phone it works with. `2b` tells the library which "socket" this hash fits.

### 2.2 Cost factor: `12`

**Technical**
- It's a **power of 2**: bcrypt runs its expensive key setup **2^cost** times.
  - cost 10 → 2¹⁰ = **1,024** rounds
  - cost 12 → 2¹² = **4,096** rounds (mine)
  - cost 14 → 2¹⁴ = **16,384** rounds
- **Each +1 doubles the time.** I measured it on one machine:

  | Cost | Time to hash one password |
  | --- | --- |
  | 10 | ~70 ms |
  | 12 | ~300 ms |
  | 14 | ~1,200 ms |

- Why slow is *good*: a real user logs in once, so 300 ms is nothing. An attacker who steals the database wants to try **billions** of guesses. At 300 ms each, that's hopeless.
- Because the cost is stored in the string, you can raise it later. Old users still log in with their old cost, and you re-hash with the new cost the next time they log in successfully.
- Common choice today: **10–12**. Pick the highest value that keeps login under ~250–500 ms on your server.

**Analogy: pounding yam.** One person can pound one mortar in reasonable time for dinner. Cost 12 means every guess needs 4,096 rounds of pounding. You only cook once per meal, so you don't mind. Someone trying a billion pots gives up.

### 2.3 Salt: `Rnw3/F4U5poQKSI3B2HUp.`

**Technical**
- **16 random bytes** (128 bits), generated fresh every time a password is hashed, written as **22 characters**.
- It gets mixed into the password *before* hashing, so:
  - Two users with the same password (`Password123!`) get **completely different** hashes.
  - Attackers can't use **rainbow tables** (huge pre-computed "password → hash" lists), because they'd need a separate table for every possible salt.
  - An attacker must crack each user **one at a time** instead of all at once.
- The salt is **not secret**. It's stored in plain view on purpose, because the server needs it at login (see section 3).
- Small detail: 22 chars × 6 bits = 132 bits, but only 128 are used. The last 4 bits are unused, so the **22nd character can only be one of four values: `.`, `O`, `e` or `u`**. Mine ends in `.`, the course example ends in `e`. 

**Proof that the salt does its job.** I hashed the *same* password twice at cost 12:

```
$2b$12$bf4DxDRrBtHrx1TVZmhmiu8xCGv3Lv5EWS8D1FtiN2j0VXvo7EGXm
$2b$12$5wA./s9HuyqzyvNiWW7x0u9ogzDubBDZKHfBIDm9LbhHCZKqwJeyu
```

Same password, different salt, so nothing after `$2b$12$` matches.

**Analogy: two pots of jollof from the same recipe.** Same rice, same tomatoes (same password). But each cook throws in their own random pinch of a secret spice (the salt) first, so the two pots never taste the same. The spice label can be stuck on the pot (stored openly), because knowing *which* spice was used doesn't give you the original ingredients back.

### 2.4 Hash: `F4kwPdlQKJT0M3IBNR0jogViAmV6tH.`

**Technical**
- The final output of running bcrypt on **password + salt** at the given cost.
- 31 characters = 23 bytes (bcrypt computes 24 bytes and drops the last one).
- It's **one-way**: there is no "decrypt" function. You can only re-hash a guess and compare.
- Hashing ≠ encryption:

  | | Encryption | Hashing |
  | --- | --- | --- |
  | Can you reverse it? | Yes, with the key | No |
  | Used for | Data you need back (e.g. card details for a processor) | Passwords: you only need to *check* them |

**Analogy: a smoothie.** Put in banana, milk and a password, blend 4,096 times, and you get a smoothie. You can't un-blend it to get the banana back. You can only blend the same ingredients again and see if you get the identical smoothie.

### 2.5 The alphabet

bcrypt writes salt and hash in its **own Base64 alphabet**: `./ A–Z a–z 0–9` (64 characters). That's why you see `.` and `/` in the string and never `+` or `=`.

---

## 3. How login works if the hash can't be reversed

```
 SIGN-UP                                        LOGIN
 ───────                                        ─────
 password "Secret!1"                            typed password "Secret!1"
        │                                              │
        ▼                                              ▼
 generate random salt  ──┐                     read stored hash from DB
        │                │                     $2b$12$Rnw3/F4U5poQKSI3B2HUp.F4kw...
        ▼                │                            │
 bcrypt(password, salt,  │                     pull out version + cost + salt
        cost 12)         │                     ($2b$, 12, Rnw3/F4U5poQKSI3B2HUp.)
        │                │                            │
        ▼                │                            ▼
 store ONE string:  ◀────┘                     bcrypt(typed password, SAME salt,
 $2b$12$<salt><hash>                                  SAME cost)
                                                      │
                                                      ▼
                                               new hash == stored hash ?
                                                 yes → logged in
                                                 no  → 401
```

This is the reason the salt and cost live **inside** the string. Login needs them to repeat the exact same recipe.

### In Node (the `bcrypt` package)

```js
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12; // the "12" in $2b$12$

// SIGN-UP: generates the salt for you and returns the full 60-char string
const hashed = await bcrypt.hash(plainPassword, SALT_ROUNDS);
// → '$2b$12$Rnw3/F4U5poQKSI3B2HUp.F4kwPdlQKJT0M3IBNR0jogViAmV6tH.'

// LOGIN: reads version, cost and salt out of `hashed`, re-hashes, compares
const ok = await bcrypt.compare(plainPassword, hashed); // true / false
```

- `bcrypt.hash(password, rounds)`: makes a new random salt, hashes, returns the combined string.
- `bcrypt.compare(password, storedHash)`: parses the stored string, re-hashes the attempt with the same salt and cost, and does a timing-safe comparison.
- Use the **async** versions. Hashing is deliberately slow, and the sync versions block the event loop for every other request.

---

## 4. Gotchas worth knowing

- **Column size:** a bcrypt hash is always 60 characters. My column is `varchar(255)`, which is fine and leaves room if I switch algorithms later (e.g. Argon2 hashes are longer).
- **72-byte limit:** bcrypt only looks at the first **72 bytes** of the password. Anything after is silently ignored. Cap password length in validation (e.g. Zod `.max(72)`) or pre-hash very long inputs.
- **Never log or return the hash.** Strip `password` from user objects before sending them in a response.
- **Never compare with `===` yourself.** Always use `bcrypt.compare`.
- **Alternatives:** **Argon2id** is the newer recommendation (it also uses lots of memory, which makes GPU attacks harder). bcrypt is still widely used and accepted.

---

## 5. Interview quick-fire

**Q: Walk me through `$2b$12$Rnw3/F4U5poQKSI3B2HUp.F4kwPdlQKJT0M3IBNR0jogViAmV6tH.`**
`2b` = bcrypt version. `12` = cost, meaning 2¹² rounds. The next 22 characters are the salt. The last 31 are the hash of password + salt.

**Q: Why is the salt stored in plain text? Isn't that insecure?**
No. The salt only has to be unique, not secret. Its job is to stop identical passwords producing identical hashes and to make pre-computed tables useless. The server needs it at login to re-hash the attempt.

**Q: How do you check a password if you can't decrypt the hash?**
Re-hash the typed password using the salt and cost stored in the hash, and compare the results. `bcrypt.compare` does this.

**Q: What happens if you go from cost 10 to cost 11?**
Hashing takes about twice as long, for you and for an attacker.

**Q: Why not just use SHA-256 for passwords?**
SHA-256 is built to be *fast*. GPUs can do billions per second, which helps attackers. bcrypt is built to be slow and tunable, and it handles the salt for you.

**Q: Two users have the password `Password123!`. Will their hashes match?**
No. Each gets a different random salt, so the hashes are completely different.

**Q: Hashing vs encryption?**
Encryption can be reversed with a key. Hashing is one-way. Passwords should be hashed, never encrypted.

**Q: Why use `bcrypt.hash` and not `bcrypt.hashSync` in an Express app?**
Hashing is slow on purpose. The sync version blocks Node's single thread, so every other request waits.

**Q: What's the maximum password length bcrypt handles?**
72 bytes. Anything after that is ignored.
