import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Clean existing data
  await prisma.member.deleteMany()
  await prisma.group.deleteMany()
  await prisma.queueSettings.deleteMany()

  // Create settings
  await prisma.queueSettings.create({
    data: {
      id: 'default',
      clubName: 'Fairview Golf Club',
      isPaused: false,
    },
  })

  const now = new Date()

  // Groups in queue (ready to play)
  await prisma.group.create({
    data: {
      name: 'Johnson Foursome',
      partySize: 4,
      status: 'queued',
      position: 1,
      enteredQueueAt: new Date(now.getTime() - 15 * 60000),
      members: {
        create: [
          { name: 'Tom Johnson', arrived: true },
          { name: 'Bill Johnson', arrived: true },
          { name: 'Mike Johnson', arrived: true },
          { name: 'Steve Johnson', arrived: true },
        ],
      },
    },
  })

  await prisma.group.create({
    data: {
      name: 'Martinez Group',
      partySize: 3,
      status: 'queued',
      position: 2,
      enteredQueueAt: new Date(now.getTime() - 10 * 60000),
      members: {
        create: [
          { name: 'Carlos Martinez', arrived: true },
          { name: 'Luis Martinez', arrived: true },
          { name: 'Diego Fernandez', arrived: true },
        ],
      },
    },
  })

  await prisma.group.create({
    data: {
      name: 'Smith Twosome',
      partySize: 2,
      status: 'queued',
      position: 3,
      enteredQueueAt: new Date(now.getTime() - 8 * 60000),
      members: {
        create: [
          { name: 'John Smith', arrived: true },
          { name: 'Jane Smith', arrived: true },
        ],
      },
    },
  })

  // Groups assembling
  await prisma.group.create({
    data: {
      name: 'Anderson Foursome',
      partySize: 4,
      status: 'assembling',
      assemblingAt: new Date(now.getTime() - 18 * 60000),
      members: {
        create: [
          { name: 'Pete Anderson', arrived: true },
          { name: 'Mark Thompson', arrived: true },
          { name: 'Dave Miller', arrived: false },
          { name: 'Ryan Davis', arrived: true },
        ],
      },
    },
  })

  await prisma.group.create({
    data: {
      name: 'Williams Group',
      partySize: 3,
      status: 'assembling',
      assemblingAt: new Date(now.getTime() - 5 * 60000),
      members: {
        create: [
          { name: 'Sarah Williams', arrived: true },
          { name: 'Emma Brown', arrived: false },
          { name: 'Lisa Taylor', arrived: false },
        ],
      },
    },
  })

  // Pre-registered groups (scheduled arrivals)
  await prisma.group.create({
    data: {
      name: 'Wilson Foursome',
      partySize: 4,
      status: 'assembling',
      isPreRegistered: true,
      scheduledTime: new Date(now.getTime() + 60 * 60000), // 1 hour from now
      members: {
        create: [
          { name: 'Bob Wilson', arrived: false },
          { name: 'Frank Wilson', arrived: false },
          { name: 'Greg Wilson', arrived: false },
          { name: 'Harry Wilson', arrived: false },
        ],
      },
    },
  })

  await prisma.group.create({
    data: {
      name: 'Clark Twosome',
      partySize: 2,
      status: 'assembling',
      isPreRegistered: true,
      scheduledTime: new Date(now.getTime() + 90 * 60000), // 1.5 hours from now
      members: {
        create: [
          { name: 'Ken Clark', arrived: false },
          { name: 'Phil Clark', arrived: false },
        ],
      },
    },
  })

  // Completed groups (history)
  for (let i = 0; i < 15; i++) {
    const enteredAt = new Date(now.getTime() - (240 - i * 15) * 60000)
    const teedOffAt = new Date(enteredAt.getTime() + (20 + Math.floor(Math.random() * 30)) * 60000)
    const size = [2, 3, 4, 4, 3][i % 5]
    const names = [
      ['Adams Group', 'Baker Twosome', 'Carter Foursome', 'Davis Threesome', 'Evans Group',
       'Foster Foursome', 'Garcia Twosome', 'Harris Group', 'Irving Threesome', 'Jones Foursome',
       'King Twosome', 'Lee Group', 'Morgan Foursome', 'Nelson Threesome', 'Owen Group'],
    ][0]

    await prisma.group.create({
      data: {
        name: names[i],
        partySize: size,
        status: 'completed',
        position: 0,
        enteredQueueAt: enteredAt,
        teedOffAt: teedOffAt,
        members: {
          create: Array.from({ length: size }, (_, j) => ({
            name: `Player ${j + 1}`,
            arrived: true,
          })),
        },
      },
    })
  }

  console.log('Seed data created successfully')
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
