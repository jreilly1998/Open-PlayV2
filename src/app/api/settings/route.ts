import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebase'

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { isPaused, pauseReason, clubName } = body

    const db = getDb()

    // Ensure settings exist
    const settingsSnap = await db.ref('settings/default').once('value')
    let settings = settingsSnap.val()
    if (!settings) {
      settings = {
        id: 'default',
        clubName: clubName || 'Fairview Golf Club',
        isPaused: isPaused || false,
        pauseReason: pauseReason || null,
      }
      await db.ref('settings/default').set(settings)
      return NextResponse.json(settings)
    }

    // Build update object
    const updates: Record<string, unknown> = {}
    if (isPaused !== undefined) updates.isPaused = isPaused
    if (pauseReason !== undefined) updates.pauseReason = pauseReason
    if (clubName !== undefined) updates.clubName = clubName

    await db.ref('settings/default').update(updates)

    const updatedSnap = await db.ref('settings/default').once('value')
    return NextResponse.json(updatedSnap.val())
  } catch (error) {
    console.error('Settings update error:', error)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
