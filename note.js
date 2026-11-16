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
