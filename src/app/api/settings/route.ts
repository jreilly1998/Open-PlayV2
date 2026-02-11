import { NextRequest, NextResponse } from 'next/server'
import { getDb, ref, get, set, update } from '@/lib/firebase'

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { isPaused, pauseReason, clubName } = body

    const db = getDb()

    // Ensure settings exist
    const settingsSnap = await get(ref(db, 'settings/default'))
    let settings = settingsSnap.val()
    if (!settings) {
      settings = {
        id: 'default',
        clubName: clubName || 'Orinda Country Club',
        isPaused: isPaused || false,
        pauseReason: pauseReason || null,
      }
      await set(ref(db, 'settings/default'), settings)
      return NextResponse.json(settings)
    }

    // Build update object
    const updates: Record<string, unknown> = {}
    if (isPaused !== undefined) updates.isPaused = isPaused
    if (pauseReason !== undefined) updates.pauseReason = pauseReason
    if (clubName !== undefined) updates.clubName = clubName

    await update(ref(db, 'settings/default'), updates)

    const updatedSnap = await get(ref(db, 'settings/default'))
    return NextResponse.json(updatedSnap.val())
  } catch (error) {
    console.error('Settings update error:', error)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
