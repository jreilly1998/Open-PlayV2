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
      isPreRegistered: boolean
      createdAt: string
      members: Array<{ id: string; name: string; arrived: boolean; groupId: string; transport?: string; holes?: number }>
    }>

    // Get pre-registered groups that haven't been checked in yet (assembling + no assemblingAt)
    // plus any with a scheduledTime regardless
    const preRegistered = allGroups.filter(
      g => g.isPreRegistered && g.status === 'assembling' && g.scheduledTime
    )

    // Group by date, then by time slot
    const calendarData: Record<string, Record<string, Array<{
      id: string
      name: string
      partySize: number
      members: Array<{ id: string; name: string; transport?: string; holes?: number }>
      scheduledTime: string
    }>>> = {}

    preRegistered.forEach(group => {
      if (!group.scheduledTime) return

      const dt = new Date(group.scheduledTime)
      const dateKey = group.scheduledTime.split('T')[0] // YYYY-MM-DD from ISO string
      const hours = dt.getUTCHours()
      const minutes = dt.getUTCMinutes()
      // Round to nearest 30-min slot
      const roundedMinutes = minutes < 15 ? 0 : minutes < 45 ? 30 : 0
      const roundedHours = minutes >= 45 ? hours + 1 : hours
      const timeKey = `${roundedHours.toString().padStart(2, '0')}:${roundedMinutes.toString().padStart(2, '0')}`

      if (!calendarData[dateKey]) calendarData[dateKey] = {}
      if (!calendarData[dateKey][timeKey]) calendarData[dateKey][timeKey] = []

      calendarData[dateKey][timeKey].push({
        id: group.id,
        name: group.name,
        partySize: group.partySize,
        members: group.members.map(m => ({ id: m.id, name: m.name, transport: m.transport, holes: m.holes })),
        scheduledTime: group.scheduledTime,
      })
    })

    // Fetch settings for club name
    const settingsSnap = await get(ref(db, 'settings/default'))
    const settings = settingsSnap.val() || { clubName: 'Orinda Country Club' }

    return NextResponse.json({
      calendar: calendarData,
      clubName: settings.clubName,
    })
  } catch (error) {
    console.error('Calendar fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch calendar data' }, { status: 500 })
  }
}
