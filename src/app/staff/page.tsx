'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useDashboard } from '@/lib/hooks'
import Toolbar from '@/components/Toolbar'
import StatusBar from '@/components/StatusBar'
import ActiveQueue from '@/components/ActiveQueue'
import AssemblingSection from '@/components/AssemblingSection'
import QuickAdd from '@/components/QuickAdd'
import VoiceInput from '@/components/VoiceInput'

type MobileTab = 'queue' | 'assembling' | 'add'

export default function StaffDashboard() {
  const { data, lastUpdated, connectionStatus, refetch } = useDashboard()
  const [activeTab, setActiveTab] = useState<MobileTab>('queue')

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

  const queueCount = data.queued.length
  const assemblingCount = data.assembling.length

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Top Toolbar */}
      <Toolbar
        settings={data.settings}
        totalGroups={data.todayStats.totalGroups}
        averageWaitMinutes={data.todayStats.averageWaitMinutes}
        spikeWaitMinutes={data.todayStats.spikeWaitMinutes}
        assemblingCount={data.todayStats.assemblingCount}
        onRefetch={refetch}
      />

      {/* Desktop-only Staff Navigation */}
      <nav className="hidden lg:flex bg-white border-b border-gray-200 px-6 py-2 items-center gap-4">
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

      {/* ============================================ */}
      {/* MOBILE LAYOUT: Tabbed Interface (< lg)       */}
      {/* ============================================ */}
      <div className="lg:hidden flex flex-col flex-1 min-h-0 overflow-hidden">

        {/* Mobile Tab Bar — sticky at top */}
        <div className="bg-white border-b border-gray-200 flex shrink-0 shadow-sm">

          {/* Tab 1: Queue */}
          <button
            onClick={() => setActiveTab('queue')}
            className={`flex-1 flex flex-col items-center pt-2.5 pb-1.5 px-1 gap-0.5 transition-colors relative ${
              activeTab === 'queue' ? 'text-queue-green' : 'text-gray-400'
            }`}
          >
            <div className="relative">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              {queueCount > 0 && (
                <span className={`absolute -top-1.5 -right-2.5 min-w-[16px] h-4 text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none ${
                  activeTab === 'queue' ? 'bg-queue-green text-white' : 'bg-gray-200 text-gray-600'
                }`}>
                  {queueCount}
                </span>
              )}
            </div>
            <span className="text-[11px] font-semibold tracking-tight">Queue</span>
            {activeTab === 'queue' && (
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-queue-green" />
            )}
          </button>

          {/* Tab 2: Assembling */}
          <button
            onClick={() => setActiveTab('assembling')}
            className={`flex-1 flex flex-col items-center pt-2.5 pb-1.5 px-1 gap-0.5 transition-colors relative ${
              activeTab === 'assembling' ? 'text-queue-green' : 'text-gray-400'
            }`}
          >
            <div className="relative">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              {assemblingCount > 0 && (
                <span className={`absolute -top-1.5 -right-2.5 min-w-[16px] h-4 text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none ${
                  activeTab === 'assembling' ? 'bg-queue-green text-white' : 'bg-amber-400 text-white'
                }`}>
                  {assemblingCount}
                </span>
              )}
            </div>
            <span className="text-[11px] font-semibold tracking-tight">Assembling</span>
            {activeTab === 'assembling' && (
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-queue-green" />
            )}
          </button>

          {/* Tab 3: Add Group */}
          <button
            onClick={() => setActiveTab('add')}
            className={`flex-1 flex flex-col items-center pt-2.5 pb-1.5 px-1 gap-0.5 transition-colors relative ${
              activeTab === 'add' ? 'text-queue-green' : 'text-gray-400'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-[11px] font-semibold tracking-tight">Add Group</span>
            {activeTab === 'add' && (
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-queue-green" />
            )}
          </button>

          {/* Tab 4: Calendar — navigates to /staff/calendar */}
          <Link
            href="/staff/calendar"
            className="flex-1 flex flex-col items-center pt-2.5 pb-1.5 px-1 gap-0.5 text-gray-400 relative transition-colors active:text-queue-green"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-[11px] font-semibold tracking-tight">Calendar</span>
          </Link>
        </div>

        {/* Mobile Tab Content — each tab fills remaining screen */}
        <div className="flex-1 min-h-0 overflow-hidden">

          {/* Tab 1: Active Queue — full screen with internal scroll */}
          {activeTab === 'queue' && (
            <div className="h-full p-3 flex flex-col">
              <ActiveQueue
                groups={data.queued}
                isPaused={data.settings.isPaused}
                onRefetch={refetch}
              />
            </div>
          )}

          {/* Tab 2: Assembling — full screen, scrollable */}
          {activeTab === 'assembling' && (
            <div className="h-full overflow-y-auto queue-scroll p-3">
              <AssemblingSection
                groups={data.assembling}
                onRefetch={refetch}
              />
            </div>
          )}

          {/* Tab 3: Add Group — full screen form */}
          {activeTab === 'add' && (
            <div className="h-full overflow-y-auto queue-scroll p-4">
              <QuickAdd onRefetch={refetch} />
            </div>
          )}
        </div>
      </div>

      {/* ============================================ */}
      {/* DESKTOP LAYOUT: Two columns (>= lg)          */}
      {/* ============================================ */}
      <main className="hidden lg:flex flex-1 overflow-hidden">
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

          {/* Quick Add */}
          <QuickAdd onRefetch={refetch} />
        </div>
      </main>

      {/* Floating Voice Input Button */}
      <VoiceInput
        groups={[...data.queued, ...data.assembling]}
        onRefetch={refetch}
      />

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
