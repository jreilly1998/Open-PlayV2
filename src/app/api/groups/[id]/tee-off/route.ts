import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const group = await prisma.group.findUnique({ where: { id: params.id } })
    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    await prisma.group.update({
      where: { id: params.id },
      data: {
        status: 'completed',
        teedOffAt: new Date(),
      },
    })

    // Re-number remaining positions
    const remaining = await prisma.group.findMany({
      where: { status: 'queued' },
      orderBy: { position: 'asc' },
    })
    for (let i = 0; i < remaining.length; i++) {
      await prisma.group.update({
        where: { id: remaining[i].id },
        data: { position: i + 1 },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Tee off error:', error)
    return NextResponse.json({ error: 'Failed to tee off group' }, { status: 500 })
  }
}
