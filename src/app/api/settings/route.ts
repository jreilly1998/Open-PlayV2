import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { isPaused, pauseReason, clubName } = body

    const settings = await prisma.queueSettings.upsert({
      where: { id: 'default' },
      update: {
        ...(isPaused !== undefined && { isPaused }),
        ...(pauseReason !== undefined && { pauseReason }),
        ...(clubName !== undefined && { clubName }),
      },
      create: {
        id: 'default',
        clubName: clubName || 'Fairview Golf Club',
        isPaused: isPaused || false,
        pauseReason: pauseReason || null,
      },
    })

    return NextResponse.json(settings)
  } catch (error) {
    console.error('Settings update error:', error)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
