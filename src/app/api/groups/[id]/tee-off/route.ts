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

    const now = new Date().toISOString()
    await db.ref(`groups/${params.id}`).update({
      status: 'completed',
      teedOffAt: now,
      updatedAt: now,
    })

    // Re-number remaining positions
    const queuedSnap = await db.ref('groups').orderByChild('status').equalTo('queued').once('value')
    const remaining: { id: string; position: number }[] = []
    queuedSnap.forEach(child => {
      const g = child.val()
      remaining.push({ id: g.id, position: g.position })
    })
    remaining.sort((a, b) => a.position - b.position)

    const updates: Record<string, number> = {}
    remaining.forEach((g, i) => {
      updates[`groups/${g.id}/position`] = i + 1
    })
    if (Object.keys(updates).length > 0) {
      await db.ref().update(updates)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Tee off error:', error)
    return NextResponse.json({ error: 'Failed to tee off group' }, { status: 500 })
  }
}
