import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebase'

// Check in a pre-registered group (move from pre-registered to assembling or queue)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = getDb()
    const groupSnap = await db.ref(`groups/${params.id}`).once('value')
    const group = groupSnap.val()

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    const members = group.members ? Object.values(group.members) as { id: string; name: string; arrived: boolean; groupId: string }[] : []
    const allArrived = members.every((m) => m.arrived)
    const now = new Date().toISOString()

    if (allArrived) {
      // All members present, go straight to queue
      const queuedSnap = await db.ref('groups').orderByChild('status').equalTo('queued').once('value')
      let maxPosition = 0
      queuedSnap.forEach(child => {
        const pos = child.val().position || 0
        if (pos > maxPosition) maxPosition = pos
      })
      const nextPosition = maxPosition + 1

      await db.ref(`groups/${params.id}`).update({
        status: 'queued',
        position: nextPosition,
        enteredQueueAt: now,
        assemblingAt: now,
        updatedAt: now,
      })

      const updatedSnap = await db.ref(`groups/${params.id}`).once('value')
      const updated = updatedSnap.val()
      return NextResponse.json({
        ...updated,
        members: updated.members ? Object.values(updated.members) : [],
      })
    } else {
      // Partial arrival, move to assembling
      await db.ref(`groups/${params.id}`).update({
        assemblingAt: now,
        updatedAt: now,
      })

      const updatedSnap = await db.ref(`groups/${params.id}`).once('value')
      const updated = updatedSnap.val()
      return NextResponse.json({
        ...updated,
        members: updated.members ? Object.values(updated.members) : [],
      })
    }
  } catch (error) {
    console.error('Check in error:', error)
    return NextResponse.json({ error: 'Failed to check in group' }, { status: 500 })
  }
}
