import { NextResponse } from 'next/server'
import { getDb, ref, get } from '@/lib/firebase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const db = getDb()

    // Fetch all groups
    const groupsSnap = await get(ref(db, 'groups'))
    const allGroupsRaw = groupsSnap.val() || {}

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
      scheduledTime: string | null
      scheduledDate: string | null
      scheduledTimeSlot: string | null
      isPreRegistered: boolean
      createdAt: string
      members: Array<{ id: string; name: string; arrived: boolean; groupId: string }>
    }>

    // Get pre-registered groups (assembling status with isPreRegistered flag)
    const preRegistered = allGroups.filter(
      g => g.isPreRegistered && g.status === 'assembling' && (g.scheduledDate || g.scheduledTime)
    )

    // Group by date, then by time slot using plain string fields (no timezone conversion)
    const calendarData: Record<string, Record<string, Array<{
      id: string
      name: string
      partySize: number
      members: Array<{ id: string; name: string }>
      scheduledTime: string
    }>>> = {}

    preRegistered.forEach(group => {
      // Use plain string fields directly; fall back to parsing scheduledTime for old data
      let dateKey = group.scheduledDate
      let timeKey = group.scheduledTimeSlot

      if (!dateKey || !timeKey) {
        if (!group.scheduledTime) return
        // Fallback: parse ISO string using UTC to avoid timezone drift
        const dt = new Date(group.scheduledTime)
        dateKey = dateKey || dt.toISOString().split('T')[0]
        const hours = dt.getUTCHours()
        const minutes = dt.getUTCMinutes()
        const roundedMinutes = minutes < 15 ? 0 : minutes < 45 ? 30 : 0
        const roundedHours = minutes >= 45 ? hours + 1 : hours
        timeKey = timeKey || `${roundedHours.toString().padStart(2, '0')}:${roundedMinutes.toString().padStart(2, '0')}`
      }

      if (!calendarData[dateKey]) calendarData[dateKey] = {}
      if (!calendarData[dateKey][timeKey]) calendarData[dateKey][timeKey] = []

      calendarData[dateKey][timeKey].push({
        id: group.id,
        name: group.name,
        partySize: group.partySize,
        members: group.members.map(m => ({ id: m.id, name: m.name })),
        scheduledTime: group.scheduledTime || `${dateKey}T${timeKey}:00.000Z`,
      })
    })

    // Fetch settings for club name
    const settingsSnap = await get(ref(db, 'settings/default'))
    const settings = settingsSnap.val() || { clubName: 'Golf Club' }

    return NextResponse.json({
      calendar: calendarData,
      clubName: settings.clubName,
    })
  } catch (error) {
    console.error('Calendar fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch calendar data' }, { status: 500 })
  }
}
