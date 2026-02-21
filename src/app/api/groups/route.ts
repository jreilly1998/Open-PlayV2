import { NextRequest, NextResponse } from 'next/server'
import { getDb, ref, get, set, query, orderByChild, equalTo, generateId } from '@/lib/firebase'

type MemberInput = { name: string; transport?: 'walking' | 'riding'; holes?: 9 | 18 }

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, partySize, members: membersArray, memberNames, allPresent, scheduledTime, isPreRegistered } = body

    if (!name || !partySize) {
      return NextResponse.json({ error: 'Name and party size required' }, { status: 400 })
    }

    const db = getDb()

    // Parse member data — support structured array or legacy comma-separated string
    let memberList: MemberInput[] = []
    if (membersArray && Array.isArray(membersArray)) {
      memberList = membersArray.map((m: MemberInput) => ({
        name: m.name || '',
        transport: m.transport || 'riding',
        holes: m.holes || 18,
      }))
    } else if (memberNames) {
      memberList = memberNames.split(',').map((n: string) => ({
        name: n.trim(),
        transport: 'riding' as const,
        holes: 18 as const,
      })).filter((m: MemberInput) => m.name)
    }

    while (memberList.length < partySize) {
      memberList.push({ name: `Player ${memberList.length + 1}`, transport: 'riding', holes: 18 })
    }

    const groupId = generateId()
    const now = new Date().toISOString()

    // Build members object
    const members: Record<string, { id: string; name: string; arrived: boolean; groupId: string; transport: string; holes: number }> = {}
    memberList.slice(0, partySize).forEach(memberInput => {
      const memberId = generateId()
      members[memberId] = {
        id: memberId,
        name: memberInput.name,
        arrived: allPresent ? true : false,
        groupId,
        transport: memberInput.transport || 'riding',
        holes: memberInput.holes || 18,
      }
    })

    if (allPresent) {
      // Find max position among queued groups
      const queuedSnap = await get(query(ref(db, 'groups'), orderByChild('status'), equalTo('queued')))
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

      await set(ref(db, `groups/${groupId}`), group)

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

      await set(ref(db, `groups/${groupId}`), group)

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
