import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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
      },
      include: { members: true },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Move to queue error:', error)
    return NextResponse.json({ error: 'Failed to move group to queue' }, { status: 500 })
  }
}
