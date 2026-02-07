import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Check in a pre-registered group (move from pre-registered to assembling or queue)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const group = await prisma.group.findUnique({
      where: { id: params.id },
      include: { members: true },
    })
    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    const allArrived = group.members.every(m => m.arrived)

    if (allArrived) {
      // All members present, go straight to queue
      const maxPosition = await prisma.group.aggregate({
        where: { status: 'queued' },
        _max: { position: true },
      })
      const nextPosition = (maxPosition._max.position ?? 0) + 1

      const updated = await prisma.group.update({
        where: { id: params.id },
        data: {
          status: 'queued',
          position: nextPosition,
          enteredQueueAt: new Date(),
          assemblingAt: new Date(),
        },
        include: { members: true },
      })

      return NextResponse.json(updated)
    } else {
      // Partial arrival, move to assembling
      const updated = await prisma.group.update({
        where: { id: params.id },
        data: {
          assemblingAt: new Date(),
        },
        include: { members: true },
      })

      return NextResponse.json(updated)
    }
  } catch (error) {
    console.error('Check in error:', error)
    return NextResponse.json({ error: 'Failed to check in group' }, { status: 500 })
  }
}
