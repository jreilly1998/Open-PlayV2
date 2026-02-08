import { NextRequest, NextResponse } from 'next/server'
import { getDb, ref, get, set, update, query, orderByChild, equalTo } from '@/lib/firebase'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = getDb()
    const memberId = params.id

    // Find the member across all groups
    const groupsSnap = await get(ref(db, 'groups'))
    const allGroups = groupsSnap.val() || {}

    let foundMember: { id: string; name: string; arrived: boolean; groupId: string } | null = null
    let foundGroupId: string | null = null
    let foundMemberId: string | null = null

    for (const [groupId, group] of Object.entries(allGroups) as [string, Record<string, unknown>][]) {
      const members = (group.members || {}) as Record<string, { id: string; name: string; arrived: boolean; groupId: string }>
      for (const [mId, member] of Object.entries(members)) {
        if (member.id === memberId || mId === memberId) {
          foundMember = member
          foundGroupId = groupId
          foundMemberId = mId
          break
        }
      }
      if (foundMember) break
    }

    if (!foundMember || !foundGroupId || !foundMemberId) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    // Toggle arrived status
    const newArrived = !foundMember.arrived
    await set(ref(db, `groups/${foundGroupId}/members/${foundMemberId}/arrived`), newArrived)

    // Check if all members are now arrived
    const groupSnap = await get(ref(db, `groups/${foundGroupId}`))
    const group = groupSnap.val()
    const members = group.members ? Object.values(group.members) as { id: string; arrived: boolean }[] : []

    const allArrived = members.every(m =>
      m.id === memberId ? newArrived : m.arrived
    )

    // Auto-move to queue if all members arrive and group is assembling
    if (allArrived && group.status === 'assembling' && group.assemblingAt !== null) {
      const queuedSnap = await get(query(ref(db, 'groups'), orderByChild('status'), equalTo('queued')))
      let maxPosition = 0
      queuedSnap.forEach(child => {
        const pos = child.val().position || 0
        if (pos > maxPosition) maxPosition = pos
      })
      const nextPosition = maxPosition + 1
      const now = new Date().toISOString()

      await update(ref(db, `groups/${foundGroupId}`), {
        status: 'queued',
        position: nextPosition,
        enteredQueueAt: now,
        updatedAt: now,
      })
    }

    return NextResponse.json({
      member: { ...foundMember, arrived: newArrived },
      allArrived,
      groupId: foundGroupId,
    })
  } catch (error) {
    console.error('Toggle member error:', error)
    return NextResponse.json({ error: 'Failed to toggle member' }, { status: 500 })
  }
}
