import express from 'express'
import authRoutes from './routes/authRoutes.ts'
import habitRoutes from './routes/habitRoutes.ts'
import userRoutes from './routes/userRoutes.ts'

export const app = express()

//registering a health route is a route dt check that our server is fine
app.get('/health', (req, res) => {
  //req contains everything about the api request
  //res is the object you will use to respond back to the request
  // res.json({message: 'Hello'}).status(200)
  res.send({ message: 'Hello' }) //will do the same thing as line 9. 200 OK attached by default
})

app.use('/api/users', userRoutes)
app.use('/api/habits', habitRoutes)
app.use('/api/auth', authRoutes)
