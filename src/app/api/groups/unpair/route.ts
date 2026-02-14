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

    // Support multiple secondaries (comma-separated IDs)
    const secondaryIds = String(group.pairedWithGroupId).split(',').map((id: string) => id.trim()).filter(Boolean)

    console.log('[Unpair] Starting unpair:', {
      primaryId: groupId,
      primaryName: group.name,
      primaryPartySize: group.partySize,
      originalPartySize: group.originalPartySize,
      secondaryIds,
    })

    // Verify all secondary groups exist
    const secondarySnaps = await Promise.all(
      secondaryIds.map(id => get(ref(db, `groups/${id}`)))
    )
    const secondaries = secondarySnaps.map((snap: { val: () => unknown }) => snap.val())

    const missingIndex = secondaries.findIndex((s: unknown) => !s)
    if (missingIndex !== -1) {
      console.error('[Unpair] Secondary group not found:', secondaryIds[missingIndex])
      return NextResponse.json({ error: `Paired group not found: ${secondaryIds[missingIndex]}` }, { status: 404 })
    }

    const now = new Date().toISOString()

    // Get current max position for queued groups
    const queuedSnap = await get(query(ref(db, 'groups'), orderByChild('status'), equalTo('queued')))
    let maxPosition = 0
    queuedSnap.forEach(child => {
      const g = child.val()
      if (g.position > maxPosition) maxPosition = g.position
    })

    // Unpair: restore primary, put all secondaries back in queue at end
    const updates: Record<string, unknown> = {
      [`groups/${groupId}/pairedWithGroupId`]: null,
      [`groups/${groupId}/pairedGroupName`]: null,
      [`groups/${groupId}/pairedGroupSize`]: null,
      [`groups/${groupId}/partySize`]: group.originalPartySize || group.partySize,
      [`groups/${groupId}/originalPartySize`]: null,
      [`groups/${groupId}/updatedAt`]: now,
    }

    // Restore each secondary group to queued status
    secondaryIds.forEach((secId, i) => {
      updates[`groups/${secId}/pairedIntoGroupId`] = null
      updates[`groups/${secId}/status`] = 'queued'
      updates[`groups/${secId}/position`] = maxPosition + 1 + i
      updates[`groups/${secId}/updatedAt`] = now
    })

    console.log('[Unpair] Applying updates:', {
      restoredPrimarySize: group.originalPartySize || group.partySize,
      secondariesRestored: secondaryIds.length,
      updates: Object.keys(updates),
    })

    await update(ref(db), updates)

    return NextResponse.json({ success: true, secondariesRestored: secondaryIds.length })
  } catch (error) {
    console.error('Unpair error:', error)
    return NextResponse.json({ error: 'Failed to unpair groups' }, { status: 500 })
  }
}
