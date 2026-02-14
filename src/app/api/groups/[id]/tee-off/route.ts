import { NextRequest, NextResponse } from 'next/server'
import { getDb, ref, get, update, query, orderByChild, equalTo } from '@/lib/firebase'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = getDb()
    const groupSnap = await get(ref(db, `groups/${params.id}`))
    const group = groupSnap.val()

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    const now = new Date().toISOString()
    const teeOffUpdates: Record<string, unknown> = {
      [`groups/${params.id}/status`]: 'completed',
      [`groups/${params.id}/teedOffAt`]: now,
      [`groups/${params.id}/updatedAt`]: now,
    }

    // If this group has a paired secondary group, mark it completed too
    if (group.pairedWithGroupId) {
      teeOffUpdates[`groups/${group.pairedWithGroupId}/status`] = 'completed'
      teeOffUpdates[`groups/${group.pairedWithGroupId}/teedOffAt`] = now
      teeOffUpdates[`groups/${group.pairedWithGroupId}/updatedAt`] = now
    }

    await update(ref(db), teeOffUpdates)

    // Re-number remaining positions
    const queuedSnap = await get(query(ref(db, 'groups'), orderByChild('status'), equalTo('queued')))
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
      await update(ref(db), updates)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Tee off error:', error)
    return NextResponse.json({ error: 'Failed to tee off group' }, { status: 500 })
  }
}
