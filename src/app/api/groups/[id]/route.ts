import { NextRequest, NextResponse } from 'next/server'
import { getDb, ref, get, set, update, query, orderByChild, equalTo, generateId } from '@/lib/firebase'

type MemberInput = { id?: string; name: string; transport?: 'walking' | 'riding'; holes?: 9 | 18 }
type StoredMember = { id: string; name: string; arrived: boolean; groupId: string; transport: string; holes: number }

export async function PATCH(
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

    const body = await request.json()
    const { name, partySize, members: membersArray, memberNames, scheduledTime } = body
    const now = new Date().toISOString()

    const updates: Record<string, unknown> = {
      [`groups/${params.id}/updatedAt`]: now,
    }

    if (name !== undefined) {
      updates[`groups/${params.id}/name`] = name
    }

    if (scheduledTime !== undefined) {
      updates[`groups/${params.id}/scheduledTime`] = scheduledTime ? new Date(scheduledTime).toISOString() : null
    }

    const existingMembers = group.members
      ? Object.values(group.members) as StoredMember[]
      : []

    const targetSize = partySize !== undefined ? partySize : group.partySize

    if (partySize !== undefined && partySize !== group.partySize) {
      updates[`groups/${params.id}/partySize`] = partySize
    }

    if (membersArray !== undefined && Array.isArray(membersArray)) {
      // Structured member data — preserve IDs and arrived status where possible
      const newMembers: Record<string, StoredMember> = {}
      for (let i = 0; i < targetSize; i++) {
        const input: MemberInput = membersArray[i] || {}
        const existing = existingMembers[i]
        if (existing) {
          newMembers[existing.id] = {
            id: existing.id,
            name: input.name || existing.name,
            arrived: existing.arrived,
            groupId: params.id,
            transport: input.transport ?? existing.transport ?? 'riding',
            holes: input.holes ?? existing.holes ?? 18,
          }
        } else {
          const memberId = generateId()
          newMembers[memberId] = {
            id: memberId,
            name: input.name || `Player ${i + 1}`,
            arrived: false,
            groupId: params.id,
            transport: input.transport || 'riding',
            holes: input.holes || 18,
          }
        }
      }
      updates[`groups/${params.id}/members`] = newMembers
    } else if (memberNames !== undefined) {
      // Legacy comma-separated names — preserve transport/holes from existing members
      const newNames: string[] = String(memberNames).split(',').map((n: string) => n.trim()).filter(Boolean)
      while (newNames.length < targetSize) {
        newNames.push(`Player ${newNames.length + 1}`)
      }

      const newMembers: Record<string, StoredMember> = {}
      for (let i = 0; i < targetSize; i++) {
        if (i < existingMembers.length) {
          const existing = existingMembers[i]
          newMembers[existing.id] = {
            ...existing,
            name: newNames[i] || existing.name,
          }
        } else {
          const memberId = generateId()
          newMembers[memberId] = {
            id: memberId,
            name: newNames[i] || `Player ${i + 1}`,
            arrived: false,
            groupId: params.id,
            transport: 'riding',
            holes: 18,
          }
        }
      }
      updates[`groups/${params.id}/members`] = newMembers
    } else if (partySize !== undefined && partySize !== group.partySize) {
      // Party size changed but no member data — resize with defaults
      const newMembers: Record<string, StoredMember> = {}
      for (let i = 0; i < partySize; i++) {
        if (i < existingMembers.length) {
          const existing = existingMembers[i]
          newMembers[existing.id] = existing
        } else {
          const memberId = generateId()
          newMembers[memberId] = {
            id: memberId,
            name: `Player ${i + 1}`,
            arrived: false,
            groupId: params.id,
            transport: 'riding',
            holes: 18,
          }
        }
      }
      updates[`groups/${params.id}/members`] = newMembers
    }

    await update(ref(db), updates)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Edit group error:', error)
    return NextResponse.json({ error: 'Failed to edit group' }, { status: 500 })
  }
}

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
