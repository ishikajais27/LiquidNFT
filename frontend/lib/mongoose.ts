import mongoose from 'mongoose'

const MONGODB_URI = process.env.MONGODB_URI!

if (!MONGODB_URI) throw new Error('Please define MONGODB_URI in .env.local')

let cached = (global as any).mongoose || { conn: null, promise: null }
;(global as any).mongoose = cached

export async function connectDB() {
  if (cached.conn) return cached.conn
  if (!cached.promise) {
    cached.promise = mongoose
      .connect(MONGODB_URI, {
        bufferCommands: false,
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
      })
      .then((m) => m)
  }
  try {
    cached.conn = await cached.promise
  } catch (e) {
    cached.promise = null
    throw e
  }
  return cached.conn
}
