import { initializeApp, getApps, cert, type App } from 'firebase-admin/app'
import { getDatabase, type Database } from 'firebase-admin/database'

let app: App
let db: Database

function getFirebaseApp(): App {
  if (getApps().length > 0) {
    return getApps()[0]
  }

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  const databaseURL = process.env.FIREBASE_DATABASE_URL

  if (!databaseURL) {
    throw new Error('FIREBASE_DATABASE_URL environment variable is required')
  }

  if (serviceAccount) {
    app = initializeApp({
      credential: cert(JSON.parse(serviceAccount)),
      databaseURL,
    })
  } else {
    // For local development / environments with default credentials
    app = initializeApp({ databaseURL })
  }

  return app
}

export function getDb(): Database {
  if (!db) {
    db = getDatabase(getFirebaseApp())
  }
  return db
}

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
