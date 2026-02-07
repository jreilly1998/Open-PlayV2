import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, partySize, memberNames, allPresent, scheduledTime, isPreRegistered } = body

    if (!name || !partySize) {
      return NextResponse.json({ error: 'Name and party size required' }, { status: 400 })
    }

    // Parse member names
    const members: string[] = memberNames
      ? memberNames.split(',').map((n: string) => n.trim()).filter(Boolean)
      : []

    // Pad or create member entries to match party size
    while (members.length < partySize) {
      members.push(`Player ${members.length + 1}`)
    }

    if (allPresent) {
      // Go straight to queue
      const maxPosition = await prisma.group.aggregate({
        where: { status: 'queued' },
        _max: { position: true },
      })
      const nextPosition = (maxPosition._max.position ?? 0) + 1

      const group = await prisma.group.create({
        data: {
          name,
          partySize,
          status: 'queued',
          position: nextPosition,
          enteredQueueAt: new Date(),
          isPreRegistered: isPreRegistered || false,
          scheduledTime: scheduledTime ? new Date(scheduledTime) : null,
          members: {
            create: members.map(memberName => ({
              name: memberName,
              arrived: true,
            })),
          },
        },
        include: { members: true },
      })

      return NextResponse.json(group, { status: 201 })
    } else {
      // Go to assembling
      const group = await prisma.group.create({
        data: {
          name,
          partySize,
          status: 'assembling',
          assemblingAt: isPreRegistered ? null : new Date(),
          isPreRegistered: isPreRegistered || false,
          scheduledTime: scheduledTime ? new Date(scheduledTime) : null,
          members: {
            create: members.map(memberName => ({
              name: memberName,
              arrived: false,
            })),
          },
        },
        include: { members: true },
      })

      return NextResponse.json(group, { status: 201 })
    }
  } catch (error) {
    console.error('Create group error:', error)
    return NextResponse.json({ error: 'Failed to create group' }, { status: 500 })
  }
}
