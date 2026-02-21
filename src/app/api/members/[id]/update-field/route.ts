import { NextRequest, NextResponse } from 'next/server'
import { getDb, ref, get, set } from '@/lib/firebase'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = getDb()
    const memberId = params.id
    const { field, value } = await request.json()

    if (!['transport', 'holes'].includes(field)) {
      return NextResponse.json({ error: 'Invalid field' }, { status: 400 })
    }

    // Find the member across all groups
    const groupsSnap = await get(ref(db, 'groups'))
    const allGroups = groupsSnap.val() || {}

    let foundGroupId: string | null = null
    let foundMemberId: string | null = null

    for (const [groupId, group] of Object.entries(allGroups) as [string, Record<string, unknown>][]) {
      const members = (group.members || {}) as Record<string, { id: string }>
      for (const [mId, member] of Object.entries(members)) {
        if (member.id === memberId || mId === memberId) {
          foundGroupId = groupId
          foundMemberId = mId
          break
        }
      }
      if (foundGroupId) break
    }

    if (!foundGroupId || !foundMemberId) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    await set(ref(db, `groups/${foundGroupId}/members/${foundMemberId}/${field}`), value)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Update member field error:', error)
    return NextResponse.json({ error: 'Failed to update member field' }, { status: 500 })
  }
}
