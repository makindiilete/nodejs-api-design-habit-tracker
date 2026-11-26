import express from 'express'
import authRoutes from './routes/authRoutes.ts'
import habitRoutes from './routes/habitRoutes.ts'
import userRoutes from './routes/userRoutes.ts'
import helmet from 'helmet'
import cors from 'cors'
import morgan from 'morgan'
import { isTest } from '../env.ts'
import { authenticateToken } from './middleware/auth.ts'
import { errorHandler } from './middleware/errorHandler.ts'

export const app = express()

//Register Global Middlewares
// =========================================
// Register Global Middlewares
// ============================================
// Every request passes through these in order, top to bottom,
// like a visitor going through checkpoints at an estate gate
// before reaching the house (your routes).

/**
 * helmet — sets security-related HTTP response headers.
 *
 * Why: browsers trust headers to decide what a page may do. Helmet sets
 * safe defaults: it blocks clickjacking (X-Frame-Options), stops browsers
 * guessing file types (X-Content-Type-Options), enforces HTTPS (HSTS),
 * hides the "X-Powered-By: Express" header, and so on.
 *
 * Think of it as: the burglar-proof bars and lock on your doors.
 * Nothing changes inside the house, but it's much harder to break in.
 *
 * Keep it first so every response, including errors, gets these headers.
 * @see https://helmetjs.github.io/
 */
app.use(helmet())

/**
 * cors — lets browsers on other domains call this API.
 *
 * Why: browsers block a page on one origin (e.g. http://localhost:5173)
 * from calling an API on another origin (e.g. http://localhost:3000)
 * unless the API says it's allowed. This adds the
 * Access-Control-Allow-* headers that say so.
 *
 * Think of it as: the gate guest list. With no options (as here),
 * EVERYONE is on the list. In production, restrict it:
 *   cors({ origin: ['https://myapp.com'] })
 *
 * Note: CORS only affects browsers. Postman, curl and other servers ignore it.
 * @see https://expressjs.com/en/resources/middleware/cors.html
 */
app.use(cors())

/**
 * express.json — parses JSON request bodies into `req.body`.
 *
 * Why: a request body arrives as a raw stream of bytes. Without this,
 * `req.body` is `undefined` when a client sends
 * `Content-Type: application/json` (e.g. a POST from fetch or axios).
 *
 * Think of it as: the mailroom opening the envelope and handing you
 * the letter, so your route doesn't have to tear it open itself.
 *
 * Default size limit is 100kb; raise it with express.json({ limit: '1mb' }).
 */
app.use(express.json())

/**
 * express.urlencoded — parses HTML form bodies into `req.body`.
 *
 * Why: a classic <form method="POST"> sends data as
 * `Content-Type: application/x-www-form-urlencoded`
 * (looks like: name=Mike&age=30). express.json() ignores this format,
 * so this parser handles it.
 *
 * `extended: true` uses the `qs` library, which supports nested
 * objects and arrays, e.g. user[name]=Mike becomes { user: { name: 'Mike' } }.
 *
 * Think of it as: the same mailroom, but for a different envelope type.
 */
app.use(express.urlencoded({ extended: true }))

/**
 * morgan — logs every HTTP request to the console.
 *
 * Why: you can see what's hitting the API while developing.
 * The 'dev' format gives short, colour-coded lines:
 *   GET /api/users 200 12.345 ms - 512
 *   (method, path, status, response time, response size)
 *
 * `skip: () => isTest()` turns logging off during tests, so test output
 * isn't flooded with request logs.
 *
 * Think of it as: the gateman's visitor logbook, which records who
 * came, where they went, and how long it took.
 * @see https://github.com/expressjs/morgan
 */
app.use(
  morgan('dev', {
    skip: () => isTest(),
  }),
)

//registering a health route is a route dt check that our server is fine
app.get('/health', (req, res) => {
  //req contains everything about the api request
  //res is the object you will use to respond back to the request
  // res.json({message: 'Hello'}).status(200)
  res.send({ message: 'Hello' }) //will do the same thing as line 9. 200 OK attached by default
})

app.use('/api/auth', authRoutes)
// Use our auth middleware to turn all routes under this to a protected routes...
// We cannot add it ontop of auth routes bcos Signup and Login sud not be protected
app.use(authenticateToken)
app.use('/api/users', userRoutes)
app.use('/api/habits', habitRoutes)

// 404 handler - MUST come after all valid routes
// app.use(notFound)

// Global error handler - MUST be last
app.use(errorHandler)
