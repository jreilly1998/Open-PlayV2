import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const groups = await prisma.group.findMany({
      where: {
        createdAt: { gte: today },
        status: { in: ['completed', 'cancelled'] },
      },
      include: { members: true },
      orderBy: { teedOffAt: 'desc' },
    })

    return NextResponse.json(groups)
  } catch (error) {
    console.error('History fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 })
  }
}
