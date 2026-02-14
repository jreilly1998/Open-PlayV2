'use client'

import Link from 'next/link'
import { useDashboard, useCurrentTime } from '@/lib/hooks'

function formatTime(date: Date) {
  const h = date.getHours()
  const m = date.getMinutes().toString().padStart(2, '0')
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${(h % 12 || 12)}:${m} ${ampm}`
}

export default function MemberQueue() {
  const { data, lastUpdated, connectionStatus } = useDashboard()
  const currentTime = useCurrentTime()

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-queue-green border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 font-medium">Loading queue...</p>
        </div>
      </div>
    )
  }

  const statusDot = {
    live: 'bg-green-500',
    reconnecting: 'bg-yellow-500 animate-pulse',
    offline: 'bg-red-500',
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 shadow-sm sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">{data.settings.clubName}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`w-2 h-2 rounded-full ${statusDot[connectionStatus]}`} />
              <span className="text-xs text-gray-500">
                {connectionStatus === 'live' ? 'Live' : connectionStatus === 'reconnecting' ? 'Reconnecting...' : 'Offline'}
              </span>
              <span className="text-xs text-gray-400">{formatTime(currentTime)}</span>
            </div>
          </div>
          <Link
            href="/calendar"
            className="px-4 py-2.5 bg-queue-blue text-white font-bold text-sm rounded-lg hover:bg-blue-700 transition-colors min-h-[44px] flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Calendar
          </Link>
        </div>
      </header>

      {/* Paused Banner */}
      {data.settings.isPaused && (
        <div className="bg-queue-red text-white text-center py-3 font-bold text-sm tracking-wide">
          QUEUE IS PAUSED {data.settings.pauseReason ? `\u2014 ${data.settings.pauseReason}` : ''}
        </div>
      )}

      {/* Estimated Wait Banner */}
      <div className="bg-gradient-to-r from-queue-green to-emerald-600 text-white px-4 py-3">
        <div className="text-center">
          <div className="text-xs font-semibold uppercase tracking-wider opacity-90">Estimated Wait</div>
          <div className="text-3xl font-bold mt-0.5">
            {data.todayStats.spikeWaitMinutes > 0
              ? `${data.todayStats.averageWaitMinutes}\u2013${data.todayStats.averageWaitMinutes + data.todayStats.spikeWaitMinutes} minutes`
              : `${data.todayStats.averageWaitMinutes} minutes`}
          </div>
          {data.todayStats.spikeWaitMinutes > 0 && (
            <div className="text-xs mt-1 opacity-80">
              {data.todayStats.assemblingCount} group{data.todayStats.assemblingCount !== 1 ? 's' : ''} assembling may join the queue soon
            </div>
          )}
        </div>
      </div>

      {/* Stats Bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-around text-center">
          <div>
            <div className="text-2xl font-bold text-gray-900">{data.queued.length}</div>
            <div className="text-xs text-gray-500 font-medium">In Queue</div>
          </div>
          <div className="w-px h-8 bg-gray-200" />
          <div>
            <div className="text-2xl font-bold text-gray-900">{data.todayStats.assemblingCount}</div>
            <div className="text-xs text-gray-500 font-medium">Assembling</div>
          </div>
          <div className="w-px h-8 bg-gray-200" />
          <div>
            <div className="text-2xl font-bold text-gray-900">{data.todayStats.completedGroups}</div>
            <div className="text-xs text-gray-500 font-medium">Served Today</div>
          </div>
        </div>
      </div>

      {/* Main Content - Two columns on desktop */}
      <main className="flex-1 flex flex-col lg:flex-row lg:overflow-hidden">
        {/* LEFT: Queue List */}
        <div className="flex-1 px-4 py-4 lg:overflow-y-auto">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">
            Current Queue
          </h2>

          {data.queued.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <div className="text-4xl mb-3">&#9971;</div>
              <p className="font-bold text-gray-700">No groups in queue</p>
              <p className="text-sm text-gray-500 mt-1">The course is wide open!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.queued.map((group, idx) => {
                const label = idx === 0 ? 'ON THE TEE' : idx === 1 ? 'ON DECK' : idx === 2 ? 'IN THE HOLE' : null
                const labelColor = idx === 0 ? 'bg-queue-green' : idx === 1 ? 'bg-queue-amber' : 'bg-gray-500'
                const isPaired = !!group.pairedWithGroupId
                const displayName = isPaired
                  ? `${group.name} + ${group.pairedGroupName}`
                  : group.name
                const widthClass = group.partySize === 1 ? 'w-1/4' : group.partySize === 2 ? 'w-1/2' : group.partySize === 3 ? 'w-3/4' : 'w-full'
                return (
                  <div key={group.id} className="flex">
                    <div
                      className={`${widthClass} bg-white rounded-xl border p-4 fade-in transition-all duration-200 ${
                        idx === 0
                          ? 'border-queue-green shadow-sm ring-1 ring-queue-green/20'
                          : idx === 1
                          ? 'border-amber-300 shadow-sm'
                          : idx === 2
                          ? 'border-gray-300 shadow-sm'
                          : 'border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0 ${
                            idx === 0
                              ? 'bg-queue-green text-white'
                              : idx === 1
                              ? 'bg-queue-amber text-white'
                              : idx === 2
                              ? 'bg-gray-400 text-white'
                              : 'bg-gray-200 text-gray-600'
                          }`}>
                            {group.position}
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-bold text-gray-900 truncate">{displayName}</h3>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {Array.from({ length: group.partySize }).map((_, i) => {
                                const isFromPaired = isPaired && group.originalPartySize && i >= group.originalPartySize
                                return (
                                  <svg key={i} className={`w-4 h-4 ${isFromPaired ? 'text-queue-blue' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
                                  </svg>
                                )
                              })}
                              <span className="text-xs text-gray-500 ml-1">{group.partySize} players</span>
                            </div>
                            {isPaired && (
                              <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 bg-blue-50 text-queue-blue text-[10px] font-semibold rounded-full border border-blue-200">
                                Paired: {group.originalPartySize} + {group.pairedGroupSize}
                              </span>
                            )}
                          </div>
                        </div>

                        {label && (
                          <span className={`px-3 py-1.5 ${labelColor} text-white text-xs font-bold rounded-full flex-shrink-0 ${idx === 0 ? 'on-deck-pulse' : ''}`}>
                            {label}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* RIGHT: Groups Assembling (desktop side panel) */}
        {(() => {
          const todayStr = new Date().toISOString().split('T')[0]
          const todayAssembling = data.assembling.filter(group => {
            if (group.assemblingAt) {
              return group.assemblingAt.startsWith(todayStr)
            }
            if (group.scheduledTime) {
              return group.scheduledTime.startsWith(todayStr)
            }
            return group.createdAt.startsWith(todayStr)
          })
          return todayAssembling.length > 0 ? (
            <div className="lg:w-[380px] lg:border-l lg:border-gray-200 px-4 py-4 lg:overflow-y-auto">
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">
                Groups Assembling ({todayAssembling.length})
              </h2>
              <div className="space-y-3">
                {todayAssembling.map(group => {
                  const arrived = group.members.filter(m => m.arrived).length
                  return (
                    <div key={group.id} className="bg-white rounded-xl border border-amber-200 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-bold text-gray-900">{group.name}</h3>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {group.partySize} players
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-queue-amber">
                            {arrived}/{group.partySize} arrived
                          </div>
                          <div className="flex gap-1 mt-1 justify-end">
                            {group.members.map(m => (
                              <div
                                key={m.id}
                                className={`w-3 h-3 rounded-full ${m.arrived ? 'bg-queue-green' : 'bg-gray-300'}`}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null
        })()}
      </main>

      {/* Bottom Bar */}
      <footer className="bg-white border-t border-gray-200 px-4 py-3 text-center sticky bottom-0">
        <p className="text-xs text-gray-400">
          Auto-refreshes every 30 seconds &middot; {data.todayStats.completedGroups} groups served today
        </p>
      </footer>
    </div>
  )
}
