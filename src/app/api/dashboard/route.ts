import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Ensure settings exist
    const settings = await prisma.queueSettings.upsert({
      where: { id: 'default' },
      update: {},
      create: { id: 'default', clubName: 'Fairview Golf Club', isPaused: false },
    })

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [queued, assembling, preRegistered, todayGroups] = await Promise.all([
      prisma.group.findMany({
        where: { status: 'queued' },
        include: { members: true },
        orderBy: { position: 'asc' },
      }),
      prisma.group.findMany({
        where: { status: 'assembling' },
        include: { members: true },
        orderBy: { assemblingAt: 'asc' },
      }),
      prisma.group.findMany({
        where: {
          isPreRegistered: true,
          status: 'assembling',
          scheduledTime: { not: null },
          assemblingAt: null,
        },
        include: { members: true },
        orderBy: { scheduledTime: 'asc' },
      }),
      prisma.group.findMany({
        where: { createdAt: { gte: today } },
        include: { members: true },
      }),
    ])

    // Separate pre-registered that haven't checked in yet
    // vs assembling groups (which may have been pre-registered but are now checked in)
    const actualAssembling = assembling.filter(g => g.assemblingAt !== null)
    const actualPreRegistered = await prisma.group.findMany({
      where: {
        isPreRegistered: true,
        status: { in: ['assembling'] },
        assemblingAt: null,
      },
      include: { members: true },
      orderBy: { scheduledTime: 'asc' },
    })

    const completedGroups = todayGroups.filter(g => g.status === 'completed')
    const assemblingCount = actualAssembling.length

    // Calculate average wait time from completed groups
    let averageWaitMinutes = 0
    if (completedGroups.length > 0) {
      const totalWait = completedGroups.reduce((sum, g) => {
        if (g.enteredQueueAt && g.teedOffAt) {
          return sum + (new Date(g.teedOffAt).getTime() - new Date(g.enteredQueueAt).getTime())
        }
        return sum
      }, 0)
      averageWaitMinutes = Math.round(totalWait / completedGroups.length / 60000)
    } else if (queued.length > 0) {
      // Estimate from current queue
      averageWaitMinutes = queued.length * 8 // ~8 min per group rough estimate
    }

    return NextResponse.json({
      queued,
      assembling: actualAssembling,
      preRegistered: actualPreRegistered,
      settings,
      todayStats: {
        totalGroups: todayGroups.length,
        completedGroups: completedGroups.length,
        averageWaitMinutes,
        assemblingCount,
      },
    })
  } catch (error) {
    console.error('Dashboard fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 })
  }
}
