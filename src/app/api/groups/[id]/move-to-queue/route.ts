import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebase'

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

    const queuedSnap = await db.ref('groups').orderByChild('status').equalTo('queued').once('value')
    let maxPosition = 0
    queuedSnap.forEach(child => {
      const pos = child.val().position || 0
      if (pos > maxPosition) maxPosition = pos
    })
    const nextPosition = maxPosition + 1
    const now = new Date().toISOString()

    await db.ref(`groups/${params.id}`).update({
      status: 'queued',
      position: nextPosition,
      enteredQueueAt: now,
      updatedAt: now,
    })

    const updatedSnap = await db.ref(`groups/${params.id}`).once('value')
    const updated = updatedSnap.val()
    return NextResponse.json({
      ...updated,
      members: updated.members ? Object.values(updated.members) : [],
    })
  } catch (error) {
    console.error('Move to queue error:', error)
    return NextResponse.json({ error: 'Failed to move group to queue' }, { status: 500 })
  }
}
