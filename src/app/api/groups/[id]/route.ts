import { NextRequest, NextResponse } from 'next/server'
import { getDb, ref, get, set, update, query, orderByChild, equalTo } from '@/lib/firebase'

export async function DELETE(
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

    await set(ref(db, `groups/${params.id}/status`), 'cancelled')
    await set(ref(db, `groups/${params.id}/updatedAt`), new Date().toISOString())

    // Re-number positions if was in queue
    if (group.status === 'queued') {
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
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete group error:', error)
    return NextResponse.json({ error: 'Failed to delete group' }, { status: 500 })
  }
}
