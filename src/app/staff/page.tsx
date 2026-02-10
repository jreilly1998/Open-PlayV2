'use client'

import Link from 'next/link'
import { useDashboard } from '@/lib/hooks'
import Toolbar from '@/components/Toolbar'
import StatusBar from '@/components/StatusBar'
import ActiveQueue from '@/components/ActiveQueue'
import AssemblingSection from '@/components/AssemblingSection'
import ScheduledArrivals from '@/components/ScheduledArrivals'
import QuickAdd from '@/components/QuickAdd'

export default function StaffDashboard() {
  const { data, lastUpdated, connectionStatus, refetch } = useDashboard(3000)

  if (!data) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-queue-green border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 font-medium">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Top Toolbar */}
      <Toolbar
        settings={data.settings}
        totalGroups={data.todayStats.totalGroups}
        averageWaitMinutes={data.todayStats.averageWaitMinutes}
        assemblingCount={data.todayStats.assemblingCount}
        onRefetch={refetch}
      />

      {/* Staff Navigation */}
      <nav className="bg-white border-b border-gray-200 px-6 py-2 flex items-center gap-4">
        <span className="text-sm font-bold text-queue-green border-b-2 border-queue-green pb-1">
          Dashboard
        </span>
        <Link
          href="/staff/calendar"
          className="text-sm font-medium text-gray-500 hover:text-gray-800 pb-1 transition-colors"
        >
          Calendar
        </Link>
      </nav>

      {/* Paused Banner */}
      {data.settings.isPaused && (
        <div className="bg-queue-red text-white text-center py-2 font-bold text-sm tracking-wide">
          QUEUE IS PAUSED {data.settings.pauseReason ? `\u2014 ${data.settings.pauseReason}` : ''}
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {/* LEFT COLUMN - Active Queue (55%) */}
        <div className="w-[55%] p-4 flex flex-col min-h-0">
          <ActiveQueue
            groups={data.queued}
            isPaused={data.settings.isPaused}
            onRefetch={refetch}
          />
        </div>

        {/* RIGHT COLUMN (45%) */}
        <div className="w-[45%] p-4 pl-0 flex flex-col gap-4 overflow-y-auto queue-scroll min-h-0">
          {/* Assembling */}
          <AssemblingSection
            groups={data.assembling}
            onRefetch={refetch}
          />

          {/* Scheduled Arrivals */}
          <ScheduledArrivals
            groups={data.preRegistered}
            onRefetch={refetch}
          />

          {/* Quick Add */}
          <QuickAdd onRefetch={refetch} />
        </div>
      </main>

      {/* Bottom Status Bar */}
      <StatusBar
        lastUpdated={lastUpdated}
        connectionStatus={connectionStatus}
        completedGroups={data.todayStats.completedGroups}
        onRetry={refetch}
      />
    </div>
  )
}
