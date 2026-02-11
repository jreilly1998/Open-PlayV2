import { initializeApp } from 'firebase/app'
import { getDatabase, ref, set, remove } from 'firebase/database'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
}

if (!firebaseConfig.databaseURL) {
  console.error('NEXT_PUBLIC_FIREBASE_DATABASE_URL environment variable is required')
  process.exit(1)
}

const app = initializeApp(firebaseConfig)
const db = getDatabase(app)

function generateId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const timestamp = Date.now().toString(36)
  let random = ''
  for (let i = 0; i < 8; i++) {
    random += chars[Math.floor(Math.random() * chars.length)]
  }
  return `${timestamp}${random}`
}

async function main() {
  // Clean existing data
  await remove(ref(db, 'groups'))
  await remove(ref(db, 'settings'))

  // Create settings
  await set(ref(db, 'settings/default'), {
    id: 'default',
    clubName: 'Orinda Country Club',
    isPaused: false,
    pauseReason: null,
  })

  const now = new Date()

  // Helper to create a group with members
  async function createGroup(data: {
    name: string
    partySize: number
    status: string
    position?: number
    enteredQueueAt?: Date | null
    assemblingAt?: Date | null
    teedOffAt?: Date | null
    scheduledTime?: Date | null
    isPreRegistered?: boolean
    memberNames: { name: string; arrived: boolean }[]
  }) {
    const groupId = generateId()
    const members: Record<string, unknown> = {}

    data.memberNames.forEach(m => {
      const memberId = generateId()
      members[memberId] = {
        id: memberId,
        name: m.name,
        arrived: m.arrived,
        groupId,
      }
    })

    await set(ref(db, `groups/${groupId}`), {
      id: groupId,
      name: data.name,
      partySize: data.partySize,
      status: data.status,
      position: data.position ?? 0,
      enteredQueueAt: data.enteredQueueAt?.toISOString() ?? null,
      assemblingAt: data.assemblingAt?.toISOString() ?? null,
      teedOffAt: data.teedOffAt?.toISOString() ?? null,
      scheduledTime: data.scheduledTime?.toISOString() ?? null,
      isPreRegistered: data.isPreRegistered ?? false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      members,
    })
  }

  // Groups in queue (ready to play)
  await createGroup({
    name: 'Johnson Foursome',
    partySize: 4,
    status: 'queued',
    position: 1,
    enteredQueueAt: new Date(now.getTime() - 15 * 60000),
    memberNames: [
      { name: 'Tom Johnson', arrived: true },
      { name: 'Bill Johnson', arrived: true },
      { name: 'Mike Johnson', arrived: true },
      { name: 'Steve Johnson', arrived: true },
    ],
  })

  await createGroup({
    name: 'Martinez Group',
    partySize: 3,
    status: 'queued',
    position: 2,
    enteredQueueAt: new Date(now.getTime() - 10 * 60000),
    memberNames: [
      { name: 'Carlos Martinez', arrived: true },
      { name: 'Luis Martinez', arrived: true },
      { name: 'Diego Fernandez', arrived: true },
    ],
  })

  await createGroup({
    name: 'Smith Twosome',
    partySize: 2,
    status: 'queued',
    position: 3,
    enteredQueueAt: new Date(now.getTime() - 8 * 60000),
    memberNames: [
      { name: 'John Smith', arrived: true },
      { name: 'Jane Smith', arrived: true },
    ],
  })

  // Groups assembling
  await createGroup({
    name: 'Anderson Foursome',
    partySize: 4,
    status: 'assembling',
    assemblingAt: new Date(now.getTime() - 18 * 60000),
    memberNames: [
      { name: 'Pete Anderson', arrived: true },
      { name: 'Mark Thompson', arrived: true },
      { name: 'Dave Miller', arrived: false },
      { name: 'Ryan Davis', arrived: true },
    ],
  })

  await createGroup({
    name: 'Williams Group',
    partySize: 3,
    status: 'assembling',
    assemblingAt: new Date(now.getTime() - 5 * 60000),
    memberNames: [
      { name: 'Sarah Williams', arrived: true },
      { name: 'Emma Brown', arrived: false },
      { name: 'Lisa Taylor', arrived: false },
    ],
  })

  // Pre-registered groups (scheduled arrivals)
  await createGroup({
    name: 'Wilson Foursome',
    partySize: 4,
    status: 'assembling',
    isPreRegistered: true,
    scheduledTime: new Date(now.getTime() + 60 * 60000),
    memberNames: [
      { name: 'Bob Wilson', arrived: false },
      { name: 'Frank Wilson', arrived: false },
      { name: 'Greg Wilson', arrived: false },
      { name: 'Harry Wilson', arrived: false },
    ],
  })

  await createGroup({
    name: 'Clark Twosome',
    partySize: 2,
    status: 'assembling',
    isPreRegistered: true,
    scheduledTime: new Date(now.getTime() + 90 * 60000),
    memberNames: [
      { name: 'Ken Clark', arrived: false },
      { name: 'Phil Clark', arrived: false },
    ],
  })

  // Completed groups (history)
  const names = [
    'Adams Group', 'Baker Twosome', 'Carter Foursome', 'Davis Threesome', 'Evans Group',
    'Foster Foursome', 'Garcia Twosome', 'Harris Group', 'Irving Threesome', 'Jones Foursome',
    'King Twosome', 'Lee Group', 'Morgan Foursome', 'Nelson Threesome', 'Owen Group',
  ]

  for (let i = 0; i < 15; i++) {
    const enteredAt = new Date(now.getTime() - (240 - i * 15) * 60000)
    const teedOffAt = new Date(enteredAt.getTime() + (20 + Math.floor(Math.random() * 30)) * 60000)
    const size = [2, 3, 4, 4, 3][i % 5]

    await createGroup({
      name: names[i],
      partySize: size,
      status: 'completed',
      position: 0,
      enteredQueueAt: enteredAt,
      teedOffAt: teedOffAt,
      memberNames: Array.from({ length: size }, (_, j) => ({
        name: `Player ${j + 1}`,
        arrived: true,
      })),
    })
  }

  console.log('Seed data created successfully')
  process.exit(0)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
