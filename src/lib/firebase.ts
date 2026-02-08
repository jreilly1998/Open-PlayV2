import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import {
  getDatabase,
  ref,
  get,
  set,
  update,
  remove,
  query,
  orderByChild,
  equalTo,
  type Database,
} from 'firebase/database'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
}

let app: FirebaseApp
let db: Database

function getFirebaseApp(): FirebaseApp {
  if (getApps().length > 0) {
    return getApps()[0]
  }

  if (!firebaseConfig.databaseURL) {
    throw new Error('NEXT_PUBLIC_FIREBASE_DATABASE_URL environment variable is required')
  }

  app = initializeApp(firebaseConfig)
  return app
}

export function getDb(): Database {
  if (!db) {
    db = getDatabase(getFirebaseApp())
  }
  return db
}

// Re-export Firebase Realtime Database utilities
export { ref, get, set, update, remove, query, orderByChild, equalTo }

// Helper to generate a unique ID (replaces Prisma's cuid)
export function generateId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const timestamp = Date.now().toString(36)
  let random = ''
  for (let i = 0; i < 8; i++) {
    random += chars[Math.floor(Math.random() * chars.length)]
  }
  return `${timestamp}${random}`
}
