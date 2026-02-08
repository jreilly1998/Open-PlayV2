import { NextRequest, NextResponse } from 'next/server'
import { getDb, ref, update } from '@/lib/firebase'

export async function POST(request: NextRequest) {
  try {
    const { orderedIds } = await request.json()

    if (!Array.isArray(orderedIds)) {
      return NextResponse.json({ error: 'orderedIds must be an array' }, { status: 400 })
    }

    const db = getDb()

    // Update all positions atomically via multi-path update
    const updates: Record<string, number | string> = {}
    const now = new Date().toISOString()
    orderedIds.forEach((id: string, index: number) => {
      updates[`groups/${id}/position`] = index + 1
      updates[`groups/${id}/updatedAt`] = now
    })

    await update(ref(db), updates)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Reorder error:', error)
    return NextResponse.json({ error: 'Failed to reorder groups' }, { status: 500 })
  }
}
