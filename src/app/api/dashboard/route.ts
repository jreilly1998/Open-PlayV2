import { NextResponse } from 'next/server'
import { getDb } from '@/lib/firebase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const db = getDb()

    // Ensure settings exist
    const settingsSnap = await db.ref('settings/default').once('value')
    let settings = settingsSnap.val()
    if (!settings) {
      settings = { id: 'default', clubName: 'Fairview Golf Club', isPaused: false, pauseReason: null }
      await db.ref('settings/default').set(settings)
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayISO = today.toISOString()

    // Fetch all groups
    const groupsSnap = await db.ref('groups').once('value')
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

    const actualPreRegistered = allGroups
      .filter(g => g.isPreRegistered && g.status === 'assembling' && !g.assemblingAt)
      .sort((a, b) => {
        if (!a.scheduledTime || !b.scheduledTime) return 0
        return new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime()
      })

    const todayGroups = allGroups.filter(g => g.createdAt >= todayISO)
    const completedGroups = todayGroups.filter(g => g.status === 'completed')
    const assemblingCount = actualAssembling.length

    // Calculate average wait time from completed groups
    let averageWaitMinutes = 0
    if (completedGroups.length > 0) {
      const totalWait = completedGroups.reduce((sum, g) => {
        if (g.enteredQueueAt && g.teedOffAt) {
          return sum + (new Date(g.teedOffAt).getTime() - new Date(g.enteredQueueAt).getTime())
        }
        return sum
      }, 0)
      averageWaitMinutes = Math.round(totalWait / completedGroups.length / 60000)
    } else if (queued.length > 0) {
      averageWaitMinutes = queued.length * 8
    }

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
