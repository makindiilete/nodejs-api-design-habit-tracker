import express from 'express'

export const app = express()

//registering a health route is a route dt check that our server is fine
app.get('/health', (req, res) => {
  //req contains everything about the api request
  //res is the object you will use to respond back to the request
  // res.json({message: 'Hello'}).status(200)
  res.send({ message: 'Hello' }) //will do the same thing as line 9. 200 OK attached by default
})

app.post('/cake', (req, res) => {
  res.send('next') // returns 'next'
})

app.post('/cake/:flavor/:id', (req, res) => {
  res.send(req.params) // req.params contains all parameter passed in the request
})
