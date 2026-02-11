import { NextResponse } from 'next/server'
import { getDb, ref, get } from '@/lib/firebase'
import { getStartOfTodayISOInTz } from '@/lib/timezone'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const db = getDb()
    const todayISO = getStartOfTodayISOInTz()

    const groupsSnap = await get(ref(db, 'groups'))
    const allGroupsRaw = groupsSnap.val() || {}

    const groups = Object.values(allGroupsRaw)
      .map((g: unknown) => {
        const group = g as Record<string, unknown>
        return {
          ...group,
          members: group.members ? Object.values(group.members as Record<string, unknown>) : [],
        }
      })
      .filter((g: Record<string, unknown>) => {
        const createdAt = g.createdAt as string
        const status = g.status as string
        return createdAt >= todayISO && (status === 'completed' || status === 'cancelled')
      })
      .sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
        const aTime = a.teedOffAt as string | null
        const bTime = b.teedOffAt as string | null
        if (!aTime && !bTime) return 0
        if (!aTime) return 1
        if (!bTime) return -1
        return new Date(bTime).getTime() - new Date(aTime).getTime()
      })

    return NextResponse.json(groups)
  } catch (error) {
    console.error('History fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 })
  }
}
