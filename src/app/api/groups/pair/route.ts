import { NextRequest, NextResponse } from 'next/server'
import { getDb, ref, get, update, query, orderByChild, equalTo } from '@/lib/firebase'

export async function POST(request: NextRequest) {
  try {
    const { primaryGroupId, secondaryGroupId } = await request.json()

    if (!primaryGroupId || !secondaryGroupId) {
      return NextResponse.json(
        { error: 'primaryGroupId and secondaryGroupId are required' },
        { status: 400 }
      )
    }

    const db = getDb()

    // Fetch both groups
    const [primarySnap, secondarySnap] = await Promise.all([
      get(ref(db, `groups/${primaryGroupId}`)),
      get(ref(db, `groups/${secondaryGroupId}`)),
    ])

    const primary = primarySnap.val()
    const secondary = secondarySnap.val()

    if (!primary || !secondary) {
      return NextResponse.json({ error: 'One or both groups not found' }, { status: 404 })
    }

    if (primary.status !== 'queued' || secondary.status !== 'queued') {
      return NextResponse.json(
        { error: 'Both groups must be in queued status to pair' },
        { status: 400 }
      )
    }

    if (primary.pairedWithGroupId || secondary.pairedWithGroupId || secondary.pairedIntoGroupId) {
      return NextResponse.json(
        { error: 'One or both groups are already paired' },
        { status: 400 }
      )
    }

    const combinedSize = primary.partySize + secondary.partySize
    if (combinedSize > 4) {
      return NextResponse.json(
        { error: `Can't pair — would exceed 4 players (${primary.partySize} + ${secondary.partySize} = ${combinedSize})` },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()

    // Build atomic update:
    // - Primary group: store pairing info, update partySize to combined total
    // - Secondary group: set status to 'paired', store reference to primary
    const updates: Record<string, unknown> = {
      [`groups/${primaryGroupId}/pairedWithGroupId`]: secondaryGroupId,
      [`groups/${primaryGroupId}/pairedGroupName`]: secondary.name,
      [`groups/${primaryGroupId}/pairedGroupSize`]: secondary.partySize,
      [`groups/${primaryGroupId}/originalPartySize`]: primary.partySize,
      [`groups/${primaryGroupId}/partySize`]: combinedSize,
      [`groups/${primaryGroupId}/updatedAt`]: now,

      [`groups/${secondaryGroupId}/pairedIntoGroupId`]: primaryGroupId,
      [`groups/${secondaryGroupId}/status`]: 'paired',
      [`groups/${secondaryGroupId}/updatedAt`]: now,
    }

    await update(ref(db), updates)

    // Re-number remaining queued positions (secondary is no longer queued)
    const queuedSnap = await get(query(ref(db, 'groups'), orderByChild('status'), equalTo('queued')))
    const remaining: { id: string; position: number }[] = []
    queuedSnap.forEach(child => {
      const g = child.val()
      remaining.push({ id: g.id, position: g.position })
    })
    remaining.sort((a, b) => a.position - b.position)

    const posUpdates: Record<string, number> = {}
    remaining.forEach((g, i) => {
      posUpdates[`groups/${g.id}/position`] = i + 1
    })
    if (Object.keys(posUpdates).length > 0) {
      await update(ref(db), posUpdates)
    }

    return NextResponse.json({
      success: true,
      combinedSize,
      combinedName: `${primary.name} + ${secondary.name}`,
    })
  } catch (error) {
    console.error('Pair error:', error)
    return NextResponse.json({ error: 'Failed to pair groups' }, { status: 500 })
  }
}
