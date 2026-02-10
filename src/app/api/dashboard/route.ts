import { NextResponse } from 'next/server'
import { getDb, ref, get, set } from '@/lib/firebase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const db = getDb()

    // Ensure settings exist
    const settingsSnap = await get(ref(db, 'settings/default'))
    let settings = settingsSnap.val()
    if (!settings) {
      settings = { id: 'default', clubName: 'Fairview Golf Club', isPaused: false, pauseReason: null }
      await set(ref(db, 'settings/default'), settings)
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayISO = today.toISOString()

    // Fetch all groups
    const groupsSnap = await get(ref(db, 'groups'))
    const allGroupsRaw = groupsSnap.val() || {}

    // Convert to array with members as arrays
    const allGroups = Object.values(allGroupsRaw).map((g: unknown) => {
      const group = g as Record<string, unknown>
      return {
        ...group,
        members: group.members ? Object.values(group.members as Record<string, unknown>) : [],
      }
    }) as Array<{
      id: string
      name: string
      partySize: number
      status: string
      position: number
      enteredQueueAt: string | null
      assemblingAt: string | null
      teedOffAt: string | null
      scheduledTime: string | null
      isPreRegistered: boolean
      createdAt: string
      updatedAt: string
      members: Array<{ id: string; name: string; arrived: boolean; groupId: string }>
    }>

    // Filter groups
    const queued = allGroups
      .filter(g => g.status === 'queued')
      .sort((a, b) => a.position - b.position)

    const actualAssembling = allGroups
      .filter(g => g.status === 'assembling' && g.assemblingAt !== null)
      .sort((a, b) => {
        if (!a.assemblingAt || !b.assemblingAt) return 0
        return new Date(a.assemblingAt).getTime() - new Date(b.assemblingAt).getTime()
      })

    // Today's date as YYYY-MM-DD (local server time, matching the club's timezone)
    const now = new Date()
    const todayDateStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`

    const allPreRegistered = allGroups
      .filter(g => g.isPreRegistered && g.status === 'assembling' && !g.assemblingAt)
      .sort((a, b) => {
        if (!a.scheduledTime || !b.scheduledTime) return 0
        return new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime()
      })

    // Only show pre-registered groups scheduled for today or earlier (not future days)
    const actualPreRegistered = allPreRegistered.filter(g => {
      const groupDate = (g as Record<string, unknown>).scheduledDate as string | null
      if (groupDate) return groupDate <= todayDateStr
      // Fallback for old data without scheduledDate: use scheduledTime ISO date
      if (g.scheduledTime) return g.scheduledTime.split('T')[0] <= todayDateStr
      return true // include groups with no scheduled date
    })

    const todayGroups = allGroups.filter(g => g.createdAt >= todayISO)
    const completedGroups = todayGroups.filter(g => g.status === 'completed')
    const assemblingCount = actualAssembling.length

    // Estimate wait time: groups tee off every ~10 minutes
    const averageWaitMinutes = queued.length * 10

    return NextResponse.json({
      queued,
      assembling: actualAssembling,
      preRegistered: actualPreRegistered,
      settings,
      todayStats: {
        totalGroups: todayGroups.length,
        completedGroups: completedGroups.length,
        averageWaitMinutes,
        assemblingCount,
      },
    })
  } catch (error) {
    console.error('Dashboard fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 })
  }
}
