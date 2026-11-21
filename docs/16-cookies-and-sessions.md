# Cookies & Session-Based Authentication

> **One-line summary:** A cookie is a note the server asks the browser to keep and *automatically* bring back on every request. Session auth puts only an ID on that note and keeps the real details on the server, which is why the server can cancel it at any time.

---

## 1. What a cookie is

### Technical
- A cookie is a small **name=value** string the server asks the browser to store.
- The server sets it with the `Set-Cookie` **response header**.
- After that, the browser **automatically** sends it back in the `Cookie` **request header** on every request to the same site. Your frontend code never attaches it.

```http
HTTP/1.1 200 OK
Set-Cookie: sid=abc123; HttpOnly; Secure; SameSite=Lax; Max-Age=604800
```

```http
GET /api/profile
Cookie: sid=abc123
```

**Why cookies exist:** HTTP is **stateless**. Every request arrives like a stranger, and the server can't tell it's the same person who logged in 2 seconds ago. Cookies let the browser carry a reminder with each request.

**Cookie vs localStorage token**

| | Cookie | localStorage token |
|---|---|---|
| Who attaches it? | Browser, automatically | You, manually (`Authorization: Bearer ...`) |
| Readable by JS? | Not if `HttpOnly` | Always |
| Main risk | CSRF | XSS |

### Plain analogy: the dry cleaner's ticket
You drop off your clothes and get **ticket #482**. The ticket says nothing about you. It's just a number. The shop's **book** says "#482 = Michael, 3 shirts, 1 agbada." Each visit you show the ticket and they check the book.

- Ticket = cookie (`sid=abc123`)
- Shop's book = session store (Redis)
- Showing the ticket every visit = browser auto-sending the cookie

---

## 2. Session-based authentication flow

```
 Browser                          Node server                 Redis
   |  POST /login (email, pwd)       |                           |
   |-------------------------------->|  verify password          |
   |                                 |  SET sess:abc123 -> {userId: 7}
   |                                 |-------------------------->|
   |  Set-Cookie: sid=abc123         |                           |
   |<--------------------------------|                           |
   |                                 |                           |
   |  GET /api/profile               |                           |
   |  Cookie: sid=abc123  (auto)     |                           |
   |-------------------------------->|  GET sess:abc123          |
   |                                 |-------------------------->|
   |                                 |  {userId: 7} ✔            |
   |  200 { name: "Michael" }        |<--------------------------|
   |<--------------------------------|                           |
```

### Express example

```js
import crypto from 'node:crypto';
import cookieParser from 'cookie-parser';

app.use(cookieParser());

// LOGIN
app.post('/login', async (req, res) => {
  const user = await verifyCredentials(req.body); // your own check
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });

  const sessionId = crypto.randomUUID();
  await redis.set(`sess:${sessionId}`, JSON.stringify({ userId: user.id }), { EX: 60 * 60 * 24 * 7 });
  await redis.sAdd(`user-sessions:${user.id}`, sessionId); // track all devices

  res.cookie('sid', sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // ms in Express
  });
  res.json({ ok: true });
});

// AUTH MIDDLEWARE
async function requireAuth(req, res, next) {
  const raw = await redis.get(`sess:${req.cookies.sid}`);
  if (!raw) return res.status(401).end();
  req.user = JSON.parse(raw);
  next();
}

// LOGOUT (this device)
app.post('/logout', requireAuth, async (req, res) => {
  await redis.del(`sess:${req.cookies.sid}`);
  await redis.sRem(`user-sessions:${req.user.userId}`, req.cookies.sid);
  res.clearCookie('sid');
  res.end();
});

// LOGOUT ALL DEVICES
app.post('/logout-all', requireAuth, async (req, res) => {
  const ids = await redis.sMembers(`user-sessions:${req.user.userId}`);
  if (ids.length) await redis.del(ids.map((id) => `sess:${id}`));
  await redis.del(`user-sessions:${req.user.userId}`);
  res.clearCookie('sid');
  res.end();
});
```

> In real projects you'd often use `express-session` + `connect-redis` instead of writing this by hand. Writing it once yourself shows you what those libraries do under the hood.

### "Log out of all devices"
- Each device logs in separately, so each gets its **own session ID**.
- Redis holds several sessions all pointing to the same `userId`.
- "Log out everywhere" = delete all of that user's sessions.
- The cookies still sit in the browsers, but the server no longer recognises them → **401**.

Analogy: the dry cleaner crosses out every ticket in the book with Michael's name. Your old tickets are now just paper.

---

## 3. Sessions vs JWT

| | Session (cookie + Redis) | JWT |
|---|---|---|
| Where the data lives | Server (Redis) | Inside the token itself |
| Server keeps state? | Yes (stateful) | No (stateless) |
| Revoke instantly? | ✅ Delete from Redis | ❌ Valid until it expires |
| Extra lookup per request | Yes (Redis is fast) | No, just verify the signature |
| Good for | Web apps, "log out everywhere" | Mobile apps, service-to-service, scaling without shared store |

**Analogy for JWT:** a **signed letter** with all your details written on it, valid until Friday. The shop keeps no book. It just checks the signature. That's why it can't easily cancel your letter before Friday.

**Common real-world mix:** a short-lived JWT access token (e.g. 15 min) plus a **refresh token stored server-side**. Revoking the refresh token gives you "logout everywhere" within about 15 minutes.

⚠️ **Being logged in on many devices is NOT special to sessions.** JWT apps can do that too. What sessions make easy is **killing** a login instantly.

---

## 4. Cookie attributes

| Attribute | What it does | Plain version |
|---|---|---|
| `HttpOnly` | JavaScript can't read it (`document.cookie` won't show it) | Locked in a drawer only the browser has the key to |
| `Secure` | Only sent over HTTPS | Only handed over in a sealed envelope |
| `SameSite=Strict` | Never sent on requests started by other sites | Ticket only works if you walk in yourself |
| `SameSite=Lax` (default) | Sent on top-level navigation (clicking a link), not on cross-site form POSTs/fetches | Works if you walk in, not if someone sends a stranger with your ticket |
| `SameSite=None` | Sent everywhere (**requires `Secure`**) | Needed for cross-site setups |
| `Max-Age` / `Expires` | When the cookie dies | No value = "session cookie", dies when the browser closes |
| `Domain` / `Path` | Which URLs receive it | Which branches of the shop accept the ticket |

### The two attacks to remember
- **XSS (Cross-Site Scripting):** attacker JS runs on your page and steals readable tokens. → Fix with `HttpOnly`.
- **CSRF (Cross-Site Request Forgery):** another site tricks your browser into sending a request *with your cookie attached*. → Fix with `SameSite`, plus CSRF tokens for sensitive actions.

> **localStorage is exposed to XSS. Cookies are exposed to CSRF.**

---

## 5. The Next.js proxy pattern (BFF)

What the security team asked for, and why:

1. **Problem:** the token was in localStorage, so any injected script could read it (XSS).
2. **Fix:** store it in an **HttpOnly cookie** so JS can't read it.
3. **Catch:** browsers only send a cookie to **the domain that set it**. The real API was on a different domain.
4. **Solution:** the Next.js server sets the cookie on its own domain, the browser calls Next.js `/api/*` routes (cookie rides along automatically), and the Next.js server reads the cookie and adds `Authorization: Bearer ...` before forwarding to the real backend.

```
Browser ──(Cookie: token, auto)──▶ Next.js server ──(Authorization: Bearer token)──▶ Real API
          JS can't read it          reads cookie, attaches header
```

This is called **BFF: Backend-for-Frontend**.

**Analogy:** you keep the original document locked at home (HttpOnly cookie) and send a trusted family member (the Next.js server) to present it at the office for you. Strangers on the street (attacker JS) never get to hold it.

---

## 6. Cookie consent pop-ups

- **First-party cookies:** set by the site you're on (login, cart, language).
- **Third-party cookies:** set by another domain whose script is embedded on many sites (ads, Facebook pixel, analytics). They let that company recognise you **across** sites.
- Privacy laws (GDPR in the EU, Nigeria Data Protection Act) require **consent for tracking/non-essential cookies**.
- Login/session cookies are **"strictly necessary"** and don't need consent.

Clicking "Reject" rejects the trackers, not your login.

---

## 7. Interview quick-fire

**Q: What's the difference between a cookie and a session?**
A cookie is storage in the browser. A session is state on the server. In session auth, the cookie holds only the session ID, and the session holds the user data.

**Q: How does the server know who's making a request?**
The browser auto-sends `Cookie: sid=...`. The server looks up that ID in Redis to find the user.

**Q: Why use Redis for sessions instead of server memory?**
Memory is lost on restart and isn't shared across multiple server instances behind a load balancer. Redis is fast, shared and supports TTL expiry.

**Q: How do you implement "log out of all devices"?**
Track all session IDs per user (e.g. a Redis set `user-sessions:<userId>`) and delete them all.

**Q: Where should a web app store tokens?**
Preferably in an `HttpOnly; Secure; SameSite` cookie, not localStorage, because of XSS.

**Q: If cookies are sent automatically, isn't that dangerous?**
Yes, that's CSRF. Mitigate it with `SameSite=Lax/Strict` and CSRF tokens on state-changing requests.

**Q: Why can't you revoke a JWT easily?**
The server doesn't store it. Validity comes from the signature plus expiry. To revoke, you'd need a blocklist (which reintroduces state) or short expiry plus revocable refresh tokens.

**Q: What does `SameSite=None` require?**
The `Secure` flag (HTTPS). Otherwise the browser rejects the cookie.
