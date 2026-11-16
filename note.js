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
