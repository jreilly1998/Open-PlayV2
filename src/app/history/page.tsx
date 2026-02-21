'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { GroupData, MemberData } from '@/lib/types'

function formatTime(dateStr: string | null): string {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  const h = d.getHours()
  const m = d.getMinutes().toString().padStart(2, '0')
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${(h % 12 || 12).toString().padStart(2, '0')}:${m} ${ampm}`
}

function waitTime(entered: string | null, teedOff: string | null): string {
  if (!entered || !teedOff) return '-'
  const diff = new Date(teedOff).getTime() - new Date(entered).getTime()
  const mins = Math.round(diff / 60000)
  return `${mins} min`
}

interface GroupWithMembers extends GroupData {
  allMembers: MemberData[]
}

function buildDisplayGroups(groups: GroupData[]): GroupWithMembers[] {
  const completed = groups.filter(g => g.status === 'completed')

  // Map secondary groups by their primary group id for member lookup
  const secondaryByPrimaryId = new Map<string, GroupData>()
  for (const g of completed) {
    if (g.pairedIntoGroupId) {
      secondaryByPrimaryId.set(g.pairedIntoGroupId, g)
    }
  }

  // Only render primary groups (and standalone groups); exclude secondaries
  return completed
    .filter(g => !g.pairedIntoGroupId)
    .map(g => {
      const ownMembers = g.members ?? []
      const secondary = g.pairedWithGroupId ? secondaryByPrimaryId.get(g.id) : undefined
      const pairedMembers = secondary?.members ?? []
      return { ...g, allMembers: [...ownMembers, ...pairedMembers] }
    })
}

function groupStats(members: MemberData[]) {
  const walkers = members.filter(m => (m.transport ?? 'riding') === 'walking').length
  const riders = members.filter(m => (m.transport ?? 'riding') === 'riding').length
  const holes18 = members.filter(m => (m.holes ?? 18) === 18).length
  const holes9 = members.filter(m => (m.holes ?? 18) === 9).length
  return { walkers, riders, holes18, holes9 }
}

function buildSummaryLine(riders: number, walkers: number, holes18: number, holes9: number): string {
  const parts: string[] = []
  if (riders > 0) parts.push(`${riders} ${riders === 1 ? 'cart' : 'carts'}`)
  if (walkers > 0) parts.push(`${walkers} ${walkers === 1 ? 'walker' : 'walkers'}`)
  const holeParts: string[] = []
  if (holes18 > 0) holeParts.push(`${holes18}x18`)
  if (holes9 > 0) holeParts.push(`${holes9}x9`)
  if (holeParts.length > 0) parts.push(holeParts.join(' + ') + ' holes')
  return parts.join(', ')
}

export default function HistoryPage() {
  const [groups, setGroups] = useState<GroupData[]>([])
  const [loading, setLoading] = useState(true)
  const [sortAsc, setSortAsc] = useState(true)

  useEffect(() => {
    fetch('/api/history')
      .then(res => res.json())
      .then(data => {
        setGroups(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const displayGroups = buildDisplayGroups(groups).sort((a, b) => {
    const aTime = a.teedOffAt
    const bTime = b.teedOffAt
    if (!aTime && !bTime) return 0
    if (!aTime) return sortAsc ? 1 : -1
    if (!bTime) return sortAsc ? -1 : 1
    const diff = new Date(aTime).getTime() - new Date(bTime).getTime()
    return sortAsc ? diff : -diff
  })

  const cancelled = groups.filter(g => g.status === 'cancelled')

  // Day-wide totals (across all primary display groups)
  const totalPlayers = displayGroups.reduce((sum, g) => sum + (g.allMembers.length || g.partySize), 0)
  const totalCarts = displayGroups.reduce((sum, g) => sum + groupStats(g.allMembers).riders, 0)
  const totalWalkers = displayGroups.reduce((sum, g) => sum + groupStats(g.allMembers).walkers, 0)
  const total18 = displayGroups.reduce((sum, g) => sum + groupStats(g.allMembers).holes18, 0)
  const total9 = displayGroups.reduce((sum, g) => sum + groupStats(g.allMembers).holes9, 0)

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">

      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm print:shadow-none">
        <div className="flex items-center gap-4">
          <Link
            href="/staff"
            className="text-queue-blue hover:text-blue-800 font-medium flex items-center gap-1 print:hidden"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </Link>
          <h1 className="text-xl font-bold text-gray-800">Today&apos;s History</h1>
          <span className="text-sm text-gray-400 print:text-gray-700">{today}</span>
        </div>
        <div className="flex items-center gap-3 print:hidden">
          <button
            onClick={() => setSortAsc(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h5m8-4v12m0 0l-4-4m4 4l4-4" />
            </svg>
            {sortAsc ? 'Earliest first' : 'Latest first'}
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-queue-green hover:bg-green-700 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-6 print:p-2 print:max-w-none">
        {loading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-4 border-queue-green border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-500">Loading history...</p>
          </div>
        ) : (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 print:grid-cols-4 print:gap-2 print:mb-4">
              <div className="bg-white rounded-xl p-4 border border-gray-200 print:rounded print:border-gray-400">
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Groups Played</p>
                <p className="text-3xl font-bold text-gray-900">{displayGroups.length}</p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-gray-200 print:rounded print:border-gray-400">
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Total Players</p>
                <p className="text-3xl font-bold text-gray-900">{totalPlayers}</p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-gray-200 print:rounded print:border-gray-400">
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Carts</p>
                <p className="text-3xl font-bold text-gray-900">{totalCarts}</p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-gray-200 print:rounded print:border-gray-400">
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Walkers</p>
                <p className="text-3xl font-bold text-gray-900">{totalWalkers}</p>
              </div>
            </div>

            {/* Group cards */}
            {displayGroups.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
                No groups have teed off today yet
              </div>
            ) : (
              <div className="space-y-3 mb-6 print:space-y-2">
                {displayGroups.map(group => {
                  const members = group.allMembers
                  const { walkers, riders, holes18, holes9 } = groupStats(members)
                  const displayName = group.pairedWithGroupId && group.pairedGroupName
                    ? `${group.name} + ${group.pairedGroupName}`
                    : group.name
                  const playerCount = members.length || group.partySize
                  const summaryLine = buildSummaryLine(riders, walkers, holes18, holes9)

                  return (
                    <div
                      key={group.id}
                      className="bg-white rounded-xl border border-gray-200 overflow-hidden print:rounded print:border-gray-400 print:break-inside-avoid"
                    >
                      {/* Group header */}
                      <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200 print:bg-gray-100">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="font-bold text-gray-900 text-base">{displayName}</span>
                          <span className="text-sm font-medium text-gray-600">
                            Teed off {formatTime(group.teedOffAt)}
                          </span>
                          {group.enteredQueueAt && group.teedOffAt && (
                            <span className="text-xs text-gray-400">
                              (waited {waitTime(group.enteredQueueAt, group.teedOffAt)})
                            </span>
                          )}
                        </div>
                        <span className="text-sm font-semibold text-gray-500 flex-shrink-0">
                          {playerCount} {playerCount === 1 ? 'player' : 'players'}
                        </span>
                      </div>

                      {/* Member list */}
                      <div className="px-5 py-3">
                        {members.length > 0 ? (
                          <div className="space-y-1.5 mb-3">
                            {members.map(member => {
                              const transport = member.transport ?? 'riding'
                              const holes = member.holes ?? 18
                              return (
                                <div key={member.id} className="flex items-center gap-2 text-sm">
                                  <span className="font-medium text-gray-800 min-w-0 flex-1 truncate">
                                    {member.name}
                                  </span>
                                  <span className={`flex-shrink-0 text-base ${transport === 'walking' ? 'text-green-600' : 'text-gray-400'}`}>
                                    {transport === 'walking' ? '🚶' : '🛒'}
                                  </span>
                                  <span className={`flex-shrink-0 font-bold text-sm w-6 text-right ${holes === 9 ? 'text-amber-600' : 'text-gray-400'}`}>
                                    {holes}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-400 mb-3">No member details recorded</p>
                        )}

                        {/* Per-group summary line */}
                        <div className="text-xs text-gray-500 font-medium border-t border-gray-100 pt-2">
                          Total: {summaryLine || `${playerCount} ${playerCount === 1 ? 'player' : 'players'}`}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Day Summary */}
            <div className="rounded-xl border border-gray-300 bg-gray-800 text-white p-5 mb-4 print:rounded print:bg-white print:text-gray-900 print:border-gray-800">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 print:text-gray-600 mb-1.5">
                Day Summary
              </p>
              <p className="text-sm leading-relaxed">
                Today:{' '}
                <strong>{displayGroups.length}</strong> {displayGroups.length === 1 ? 'group' : 'groups'},{' '}
                <strong>{totalPlayers}</strong> total {totalPlayers === 1 ? 'player' : 'players'},{' '}
                <strong>{totalCarts}</strong> {totalCarts === 1 ? 'cart' : 'carts'},{' '}
                <strong>{totalWalkers}</strong> {totalWalkers === 1 ? 'walker' : 'walkers'}
                {(total18 > 0 || total9 > 0) && (
                  <> &mdash; {total18 > 0 && <><strong>{total18}</strong>x18</>}{total18 > 0 && total9 > 0 && ' + '}{total9 > 0 && <><strong>{total9}</strong>x9</>} holes</>
                )}
              </p>
              {cancelled.length > 0 && (
                <p className="text-xs text-gray-400 print:text-gray-600 mt-1">
                  + {cancelled.length} cancelled {cancelled.length === 1 ? 'group' : 'groups'}
                </p>
              )}
            </div>

            {/* Cancelled groups */}
            {cancelled.length > 0 && (
              <div className="print:break-inside-avoid">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2 print:text-gray-700">
                  Cancelled ({cancelled.length})
                </h2>
                <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 print:rounded print:border-gray-400">
                  {cancelled.map(group => (
                    <div key={group.id} className="px-5 py-2.5 flex items-center justify-between">
                      <span className="font-medium text-gray-700">{group.name}</span>
                      <span className="text-xs font-bold text-red-500 uppercase tracking-wide">Cancelled</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
