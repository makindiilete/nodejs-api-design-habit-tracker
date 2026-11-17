// ---------------------------------------------------------------
// res.send() vs res.json()
// ---------------------------------------------------------------
// - res.json() ALWAYS sends JSON with Content-Type: application/json.
// - res.send() guesses from what you pass: objects/arrays get passed
//   to res.json (same result), but a string goes out as text/html.
// - Use res.json() for APIs: it's clearer, and still sends valid JSON
//   if a value turns out to be null or a string by mistake.

// res.send({ message: 'hi' }); // application/json
// res.json({ message: 'hi' }); // application/json (same)
// res.send('hello');           // text/html
// res.json('hello');           // application/json -> "hello"

// ---------------------------------------------------------------
// Handler vs Router
// ---------------------------------------------------------------
// - Router (app.get / router.get): matches the method + path and
//   decides WHICH function runs.
// - Handler: the callback (req, res) => {} that runs for that route.
//   It does the work and SENDS the response with res.json()/res.send().
//   Express ignores the function's return value.

// router.get('/habits', (req, res) => {   // router: GET /habits
//   res.json({ habits: [] });             // handler: everything in here
// });

// ---------------------------------------------------------------
// next()
// ---------------------------------------------------------------
// - Think of a request as a parcel on a conveyor belt. Each middleware
//   is a worker on the belt. next() is the worker saying "I'm done,
//   pass it to the next person."
// - Middleware signature: (req, res, next) => {}. Express hands you
//   next as the 3rd argument.
// - Every middleware must do ONE of two things:
//     1. Send a response (res.json / res.send) -> the trip ends here, OR
//     2. Call next() -> pass control to the next middleware/handler.
//   If it does neither, the request just hangs (client waits forever).
// - Don't do both. Sending a response AND calling next() can cause
//   "Cannot set headers after they are sent" when a later handler
//   also tries to respond.
// - next() does not stop your function. Code after it still runs,
//   so use `return next()` if nothing below should run.
// - next(err) (pass anything) skips all normal middleware and jumps
//   straight to the error handler: (err, req, res, next) => {}
//   (4 args, so Express knows it's the error handler).
// - Express 5: if an async handler throws or its promise rejects,
//   Express calls next(err) for you. In Express 4 you had to
//   try/catch and call next(err) yourself.

// const logger = (req, res, next) => {
//   console.log(req.method, req.path);
//   next();                                  // pass it on
// };
//
// const requireAuth = (req, res, next) => {
//   if (!req.headers.authorization) {
//     return res.status(401).json({ error: 'Unauthorized' }); // stop here
//   }
//   next();                                  // allowed, keep going
// };
//
// router.get('/habits', logger, requireAuth, (req, res) => {
//   res.json({ habits: [] });                // final handler responds
// });
//
// app.use((err, req, res, next) => {         // error handler (4 args)
//   res.status(500).json({ error: err.message });
// });
