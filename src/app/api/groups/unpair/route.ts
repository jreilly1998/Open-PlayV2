import { NextRequest, NextResponse } from 'next/server'
import { getDb, ref, get, update, query, orderByChild, equalTo } from '@/lib/firebase'

export async function POST(request: NextRequest) {
  try {
    const { groupId } = await request.json()

    if (!groupId) {
      return NextResponse.json({ error: 'groupId is required' }, { status: 400 })
    }

    const db = getDb()
    const groupSnap = await get(ref(db, `groups/${groupId}`))
    const group = groupSnap.val()

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    if (!group.pairedWithGroupId) {
      return NextResponse.json({ error: 'Group is not paired' }, { status: 400 })
    }

    const secondaryId = group.pairedWithGroupId
    const secondarySnap = await get(ref(db, `groups/${secondaryId}`))
    const secondary = secondarySnap.val()

    if (!secondary) {
      return NextResponse.json({ error: 'Paired group not found' }, { status: 404 })
    }

    const now = new Date().toISOString()

    // Get current max position for queued groups
    const queuedSnap = await get(query(ref(db, 'groups'), orderByChild('status'), equalTo('queued')))
    let maxPosition = 0
    queuedSnap.forEach(child => {
      const g = child.val()
      if (g.position > maxPosition) maxPosition = g.position
    })

    // Unpair: restore primary, put secondary back in queue at end
    const updates: Record<string, unknown> = {
      [`groups/${groupId}/pairedWithGroupId`]: null,
      [`groups/${groupId}/pairedGroupName`]: null,
      [`groups/${groupId}/pairedGroupSize`]: null,
      [`groups/${groupId}/partySize`]: group.originalPartySize || group.partySize,
      [`groups/${groupId}/originalPartySize`]: null,
      [`groups/${groupId}/updatedAt`]: now,

      [`groups/${secondaryId}/pairedIntoGroupId`]: null,
      [`groups/${secondaryId}/status`]: 'queued',
      [`groups/${secondaryId}/position`]: maxPosition + 1,
      [`groups/${secondaryId}/updatedAt`]: now,
    }

    await update(ref(db), updates)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unpair error:', error)
    return NextResponse.json({ error: 'Failed to unpair groups' }, { status: 500 })
  }
}
