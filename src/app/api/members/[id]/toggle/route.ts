import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const member = await prisma.member.findUnique({
      where: { id: params.id },
      include: { group: { include: { members: true } } },
    })
    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    // Toggle arrived status
    const updated = await prisma.member.update({
      where: { id: params.id },
      data: { arrived: !member.arrived },
    })

    // Check if all members are now arrived
    const group = await prisma.group.findUnique({
      where: { id: member.groupId },
      include: { members: true },
    })

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    const allArrived = group.members.every(m =>
      m.id === params.id ? !member.arrived : m.arrived
    )

    // Auto-move to queue if all members arrive and group is assembling
    if (allArrived && group.status === 'assembling' && group.assemblingAt !== null) {
      const maxPosition = await prisma.group.aggregate({
        where: { status: 'queued' },
        _max: { position: true },
      })
      const nextPosition = (maxPosition._max.position ?? 0) + 1

      await prisma.group.update({
        where: { id: group.id },
        data: {
          status: 'queued',
          position: nextPosition,
          enteredQueueAt: new Date(),
        },
      })
    }

    return NextResponse.json({
      member: updated,
      allArrived,
      groupId: member.groupId,
    })
  } catch (error) {
    console.error('Toggle member error:', error)
    return NextResponse.json({ error: 'Failed to toggle member' }, { status: 500 })
  }
}
