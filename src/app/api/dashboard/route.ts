import { NextResponse } from 'next/server'
import { getDb, ref, get, set } from '@/lib/firebase'
import { getTodayDateStrInTz, getStartOfTodayISOInTz, APP_TIMEZONE } from '@/lib/timezone'
import { fromZonedTime } from 'date-fns-tz'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const db = getDb()

    // Ensure settings exist
    const settingsSnap = await get(ref(db, 'settings/default'))
    let settings = settingsSnap.val()
    if (!settings) {
      settings = { id: 'default', clubName: 'Orinda Country Club', isPaused: false, pauseReason: null }
      await set(ref(db, 'settings/default'), settings)
    }

    const todayISO = getStartOfTodayISOInTz()

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

    const todayDateStr = getTodayDateStrInTz()

    const actualAssembling = allGroups
      .filter(g => {
        if (g.status !== 'assembling') return false
        // Non-pre-registered groups (Quick Add): show if assemblingAt is set
        if (!g.isPreRegistered) return g.assemblingAt !== null
        // Pre-registered groups: only show if scheduled for today
        if (g.scheduledTime) {
          const scheduledDate = g.scheduledTime.split('T')[0]
          return scheduledDate === todayDateStr
        }
        // Pre-registered with no scheduledTime but already assembling
        return g.assemblingAt !== null
      })
      .sort((a, b) => {
        // Sort by assemblingAt if available, otherwise by scheduledTime
        const aTime = a.assemblingAt || a.scheduledTime
        const bTime = b.assemblingAt || b.scheduledTime
        if (!aTime || !bTime) return 0
        return new Date(aTime).getTime() - new Date(bTime).getTime()
      })

    const todayGroups = allGroups.filter(g => g.createdAt >= todayISO)
    const completedGroups = todayGroups.filter(g => g.status === 'completed')
    const assemblingCount = actualAssembling.length

    // Estimate wait time: groups tee off every ~10 minutes
    const averageWaitMinutes = queued.length * 10

    // Calculate spike time: only include assembling groups that will realistically
    // enter the queue before your projected tee time
    const now = new Date()
    const projectedTeeTime = new Date(now.getTime() + averageWaitMinutes * 60 * 1000)

    // Debug: log spike calculation inputs
    console.log('[Spike Debug] Current time (UTC):', now.toISOString())
    console.log('[Spike Debug] Current time (Pacific):', now.toLocaleString('en-US', { timeZone: APP_TIMEZONE }))
    console.log('[Spike Debug] Queue length:', queued.length, '= base wait', averageWaitMinutes, 'min')
    console.log('[Spike Debug] Projected tee time (UTC):', projectedTeeTime.toISOString())
    console.log('[Spike Debug] Projected tee time (Pacific):', projectedTeeTime.toLocaleString('en-US', { timeZone: APP_TIMEZONE }))
    console.log('[Spike Debug] All assembling groups:', actualAssembling.map(g => ({
      name: g.name,
      scheduledTime: g.scheduledTime,
      isPreRegistered: g.isPreRegistered,
      assemblingAt: g.assemblingAt,
    })))
    console.log('[Spike Debug] Groups with scheduledTime:', actualAssembling.filter(g => g.scheduledTime).map(g => ({
      name: g.name,
      scheduledTime: g.scheduledTime,
    })))

    const spikeGroupCount = actualAssembling.filter(g => {
      // Quick Add / walk-up groups have no scheduled time — timing unknown, exclude
      if (!g.scheduledTime) return false

      // scheduledTime is stored as "YYYY-MM-DDTHH:MM:SS.000Z" but the time
      // components actually represent Pacific time, not UTC.
      // Strip the Z suffix and convert from Pacific to actual UTC for comparison.
      const localTimeStr = g.scheduledTime.replace('Z', '')
      const scheduledUtc = fromZonedTime(localTimeStr, APP_TIMEZONE)

      const inWindow = scheduledUtc.getTime() > now.getTime() && scheduledUtc.getTime() <= projectedTeeTime.getTime()
      console.log(`[Spike Debug] Group "${g.name}": scheduledTime=${g.scheduledTime}, actualUTC=${scheduledUtc.toISOString()}, inWindow=${inWindow}`)
      return inWindow
    }).length
    console.log('[Spike Debug] Spike group count:', spikeGroupCount)
    const spikeWaitMinutes = spikeGroupCount * 10
    console.log(`[Spike Debug] Result: base=${averageWaitMinutes}, spike=${spikeWaitMinutes}, display=${spikeWaitMinutes > 0 ? `${averageWaitMinutes}-${averageWaitMinutes + spikeWaitMinutes}` : `${averageWaitMinutes}`} minutes`)

    return NextResponse.json({
      queued,
      assembling: actualAssembling,
      settings,
      todayStats: {
        totalGroups: todayGroups.length,
        completedGroups: completedGroups.length,
        averageWaitMinutes,
        spikeWaitMinutes,
        assemblingCount,
      },
    })
  } catch (error) {
    console.error('Dashboard fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 })
  }
}
