import { NextRequest, NextResponse } from 'next/server'
import { getDb, generateId } from '@/lib/firebase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, partySize, memberNames, allPresent, scheduledTime, isPreRegistered } = body

    if (!name || !partySize) {
      return NextResponse.json({ error: 'Name and party size required' }, { status: 400 })
    }

    const db = getDb()

    // Parse member names
    const memberList: string[] = memberNames
      ? memberNames.split(',').map((n: string) => n.trim()).filter(Boolean)
      : []

    while (memberList.length < partySize) {
      memberList.push(`Player ${memberList.length + 1}`)
    }

    const groupId = generateId()
    const now = new Date().toISOString()

    // Build members object
    const members: Record<string, { id: string; name: string; arrived: boolean; groupId: string }> = {}
    memberList.forEach(memberName => {
      const memberId = generateId()
      members[memberId] = {
        id: memberId,
        name: memberName,
        arrived: allPresent ? true : false,
        groupId,
      }
    })

    if (allPresent) {
      // Find max position among queued groups
      const queuedSnap = await db.ref('groups').orderByChild('status').equalTo('queued').once('value')
      let maxPosition = 0
      queuedSnap.forEach(child => {
        const pos = child.val().position || 0
        if (pos > maxPosition) maxPosition = pos
      })
      const nextPosition = maxPosition + 1

      const group = {
        id: groupId,
        name,
        partySize,
        status: 'queued',
        position: nextPosition,
        enteredQueueAt: now,
        assemblingAt: null,
        teedOffAt: null,
        scheduledTime: scheduledTime ? new Date(scheduledTime).toISOString() : null,
        isPreRegistered: isPreRegistered || false,
        createdAt: now,
        updatedAt: now,
        members,
      }

      await db.ref(`groups/${groupId}`).set(group)

      // Return with members as array for API compatibility
      return NextResponse.json({
        ...group,
        members: Object.values(members),
      }, { status: 201 })
    } else {
      const group = {
        id: groupId,
        name,
        partySize,
        status: 'assembling',
        position: 0,
        enteredQueueAt: null,
        assemblingAt: isPreRegistered ? null : now,
        teedOffAt: null,
        scheduledTime: scheduledTime ? new Date(scheduledTime).toISOString() : null,
        isPreRegistered: isPreRegistered || false,
        createdAt: now,
        updatedAt: now,
        members,
      }

      await db.ref(`groups/${groupId}`).set(group)

      return NextResponse.json({
        ...group,
        members: Object.values(members),
      }, { status: 201 })
    }
  } catch (error) {
    console.error('Create group error:', error)
    return NextResponse.json({ error: 'Failed to create group' }, { status: 500 })
  }
}
