'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useCalendar, useCurrentTime } from '@/lib/hooks'
import { createGroup } from '@/lib/api'
import { CalendarGroup } from '@/lib/types'

function formatTimeSlot(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function toLocalDateStr(d: Date): string {
  const year = d.getFullYear()
  const month = (d.getMonth() + 1).toString().padStart(2, '0')
  const day = d.getDate().toString().padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Only show Fridays, Saturdays, and Sundays
function getAvailableDates(): string[] {
  const dates: string[] = []
  const now = new Date()
  for (let i = 0; i < 14; i++) {
    const d = new Date(now)
    d.setDate(now.getDate() + i)
    const day = d.getDay()
    // 0 = Sunday, 5 = Friday, 6 = Saturday
    if (day === 0 || day === 5 || day === 6) {
      dates.push(toLocalDateStr(d))
    }
  }
  return dates
}

function formatDateFull(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

// Friday: all day (6:00 AM - 6:00 PM)
const FRIDAY_TIME_SLOTS = [
  '06:00', '06:30', '07:00', '07:30', '08:00', '08:30',
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  '18:00',
]

// Saturday & Sunday: 6:30 AM - 10:50 AM only
const WEEKEND_TIME_SLOTS = [
  '06:30', '07:00', '07:30', '08:00', '08:30',
  '09:00', '09:30', '10:00', '10:30',
]

function getTimeSlotsForDate(dateStr: string): string[] {
  const d = new Date(dateStr + 'T12:00:00')
  const day = d.getDay()
  if (day === 5) return FRIDAY_TIME_SLOTS
  return WEEKEND_TIME_SLOTS
}

// Shared slot colors - same as member calendar for visual consistency
function getSlotBg(groupCount: number): string {
  if (groupCount >= 5) return 'bg-red-50 border-red-300'
  if (groupCount >= 3) return 'bg-yellow-50 border-yellow-300'
  if (groupCount >= 1) return 'bg-blue-50 border-blue-300'
  return 'bg-white border-gray-200'
}

// Desktop grid cell colors
function getGridCellBg(groupCount: number): string {
  if (groupCount >= 5) return 'bg-red-50'
  if (groupCount >= 3) return 'bg-yellow-50'
  if (groupCount >= 1) return 'bg-blue-50'
  return ''
}

function getGridCellBorder(groupCount: number): string {
  if (groupCount >= 5) return 'border-l-2 border-l-red-400'
  if (groupCount >= 3) return 'border-l-2 border-l-yellow-400'
  if (groupCount >= 1) return 'border-l-2 border-l-blue-400'
  return ''
}

export default function StaffCalendar() {
  const { data, refetch } = useCalendar()
  const currentTime = useCurrentTime()
  const availableDates = getAvailableDates()
  const todayStr = toLocalDateStr(new Date())

  // Mobile day selection
  const [selectedDay, setSelectedDay] = useState(availableDates[0] || todayStr)

  const [showAddForm, setShowAddForm] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<{ date: string; time: string } | null>(null)
  const [viewSlot, setViewSlot] = useState<{ date: string; time: string; groups: CalendarGroup[] } | null>(null)
  const [printDate, setPrintDate] = useState<string | null>(null)

  // Add form state
  const [formName, setFormName] = useState('')
  const [formPartySize, setFormPartySize] = useState(4)
  const [formMemberNames, setFormMemberNames] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSlotClick = (date: string, time: string) => {
    setSelectedSlot({ date, time })
    setShowAddForm(true)
    setFormName('')
    setFormPartySize(4)
    setFormMemberNames('')
  }

  const handleAddPreRegistration = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName.trim() || !selectedSlot) return

    setSubmitting(true)
    try {
      await createGroup({
        name: formName.trim(),
        partySize: formPartySize,
        memberNames: formMemberNames.trim() || undefined,
        isPreRegistered: true,
        scheduledTime: `${selectedSlot.date}T${selectedSlot.time}:00.000Z`,
      })
      setShowAddForm(false)
      setSelectedSlot(null)
      refetch()
    } catch (err) {
      console.error('Failed to add pre-registration:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const getSlotGroups = (date: string, time: string): CalendarGroup[] => {
    if (!data?.calendar[date]?.[time]) return []
    return data.calendar[date][time]
  }

  const getDayTotal = (date: string): number => {
    if (!data?.calendar[date]) return 0
    return Object.values(data.calendar[date]).reduce((sum, groups) => sum + groups.length, 0)
  }

  const clockH = currentTime.getHours()
  const clockM = currentTime.getMinutes().toString().padStart(2, '0')
  const clockAmpm = clockH >= 12 ? 'PM' : 'AM'
  const clockTime = `${(clockH % 12 || 12).toString().padStart(2, '0')}:${clockM} ${clockAmpm}`

  const timeSlotsForDay = getTimeSlotsForDate(selectedDay)

  if (!data) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-queue-blue border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 font-medium">Loading calendar...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 lg:px-6 py-3 flex items-center justify-between shadow-sm sticky top-0 z-20">
        <div className="flex items-center gap-3 lg:gap-6">
          <h1 className="text-base lg:text-lg font-bold text-gray-800 tracking-tight">{data.clubName}</h1>
          <span className="text-sm font-medium text-gray-500">{clockTime}</span>
        </div>
        <h2 className="text-sm lg:text-lg font-bold text-gray-800 hidden sm:block">Pre-Registration Calendar</h2>
      </header>

      {/* Staff Navigation */}
      <nav className="bg-white border-b border-gray-200 px-4 lg:px-6 py-2 flex items-center gap-4">
        <Link
          href="/staff"
          className="text-sm font-medium text-gray-500 hover:text-gray-800 pb-1 transition-colors"
        >
          Dashboard
        </Link>
        <span className="text-sm font-bold text-queue-blue border-b-2 border-queue-blue pb-1">
          Calendar
        </span>
      </nav>

      {/* ============================================ */}
      {/* MOBILE LAYOUT (< lg) */}
      {/* ============================================ */}
      <div className="lg:hidden flex flex-col flex-1">
        {/* Day Selector - horizontal scrollable */}
        <div className="bg-white border-b border-gray-200">
          <div className="flex overflow-x-auto py-2 px-2 gap-1 no-scrollbar">
            {availableDates.map(date => {
              const dayTotal = getDayTotal(date)
              const isSelected = date === selectedDay
              const isToday = date === todayStr
              const d = new Date(date + 'T12:00:00')
              const dayName = d.toLocaleDateString('en-US', { weekday: 'short' })
              const dayNum = d.getDate()

              return (
                <button
                  key={date}
                  onClick={() => setSelectedDay(date)}
                  className={`flex-shrink-0 flex flex-col items-center px-3 py-2 rounded-xl min-w-[60px] transition-colors ${
                    isSelected
                      ? 'bg-queue-blue text-white'
                      : isToday
                      ? 'bg-blue-50 text-queue-blue'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <span className="text-xs font-medium">{dayName}</span>
                  <span className="text-lg font-bold">{dayNum}</span>
                  {dayTotal > 0 && (
                    <span className={`text-xs font-bold mt-0.5 ${
                      isSelected ? 'text-blue-200' : 'text-queue-blue'
                    }`}>
                      {dayTotal} grp{dayTotal !== 1 ? 's' : ''}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Mobile Time Slots */}
        <main className="flex-1 overflow-y-auto px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">
              {formatDate(selectedDay)}
            </h2>
            <button
              onClick={() => setPrintDate(selectedDay)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-200 rounded-lg transition-colors min-h-[36px]"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print
            </button>
          </div>

          <div className="space-y-2">
            {timeSlotsForDay.map(time => {
              const groups = getSlotGroups(selectedDay, time)
              const isPast = selectedDay < todayStr

              if (isPast) {
                return (
                  <div
                    key={time}
                    className="rounded-xl border border-gray-100 p-3 opacity-40 bg-gray-50 min-h-[48px] flex items-center"
                  >
                    <span className="text-sm font-medium text-gray-400 w-[80px]">{formatTimeSlot(time)}</span>
                    <span className="text-sm text-gray-300">Past</span>
                  </div>
                )
              }

              return (
                <button
                  key={time}
                  type="button"
                  onClick={() => {
                    if (groups.length > 0) {
                      setViewSlot({ date: selectedDay, time, groups })
                    } else {
                      handleSlotClick(selectedDay, time)
                    }
                  }}
                  className={`slot-button w-full text-left rounded-xl border-2 p-3 min-h-[48px] transition-all cursor-pointer
                    hover:shadow-md hover:border-blue-400 hover:-translate-y-0.5
                    active:scale-[0.98] active:shadow-none active:bg-blue-100
                    ${getSlotBg(groups.length)}
                  `}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`text-sm w-[80px] ${
                        groups.length > 0 ? 'font-bold text-gray-900' : 'font-medium text-gray-500'
                      }`}>
                        {formatTimeSlot(time)}
                      </span>
                      {groups.length > 0 ? (
                        <div>
                          <span className="text-sm font-bold text-gray-800">
                            {groups.length} group{groups.length !== 1 ? 's' : ''}
                          </span>
                          <span className="text-sm text-gray-500 ml-1">
                            ({groups.reduce((s, g) => s + g.partySize, 0)} players)
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">Open</span>
                      )}
                    </div>
                    <span className="text-queue-blue flex items-center">
                      {groups.length > 0 ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      )}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </main>
      </div>

      {/* ============================================ */}
      {/* DESKTOP LAYOUT (>= lg) */}
      {/* ============================================ */}
      <main className="hidden lg:flex flex-col flex-1 overflow-auto p-4">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Day Headers */}
          <div
            className="border-b border-gray-200 sticky top-0 bg-white z-10"
            style={{ display: 'grid', gridTemplateColumns: `100px repeat(${availableDates.length}, 1fr)` }}
          >
            <div className="p-3 text-xs font-semibold text-gray-400 uppercase border-r border-gray-100">
              Time
            </div>
            {availableDates.map(date => (
              <div
                key={date}
                onClick={() => setPrintDate(date)}
                className={`p-3 text-center border-r border-gray-100 last:border-r-0 cursor-pointer hover:bg-gray-50 transition-colors ${
                  date === todayStr ? 'bg-blue-50 hover:bg-blue-100' : ''
                }`}
              >
                <div className={`text-xs font-bold ${date === todayStr ? 'text-queue-blue' : 'text-gray-800'}`}>
                  {formatDate(date)}
                </div>
              </div>
            ))}
          </div>

          {/* Time Rows - use union of all time slots needed */}
          {(() => {
            // Collect all unique time slots across available dates
            const allTimesSet = new Set<string>()
            availableDates.forEach(date => {
              getTimeSlotsForDate(date).forEach(t => allTimesSet.add(t))
            })
            const allTimes = Array.from(allTimesSet).sort()

            return allTimes.map(time => (
              <div
                key={time}
                className="border-b border-gray-100 last:border-b-0"
                style={{ display: 'grid', gridTemplateColumns: `100px repeat(${availableDates.length}, 1fr)` }}
              >
                <div className="p-2 text-xs font-medium text-gray-500 border-r border-gray-100 flex items-start justify-end pr-3 pt-3">
                  {formatTimeSlot(time)}
                </div>
                {availableDates.map(date => {
                  const dateSlotsForDay = getTimeSlotsForDate(date)
                  const isValidSlot = dateSlotsForDay.includes(time)
                  const groups = isValidSlot ? getSlotGroups(date, time) : []
                  const isPast = date < todayStr

                  if (!isValidSlot) {
                    return (
                      <div
                        key={date}
                        className="border-r border-gray-100 last:border-r-0 p-1 min-h-[52px] bg-gray-50"
                      />
                    )
                  }

                  return (
                    <div
                      key={date}
                      className={`group/cell border-r border-gray-100 last:border-r-0 p-1 min-h-[52px] cursor-pointer transition-colors
                        ${getGridCellBg(groups.length)}
                        ${date === todayStr && groups.length === 0 ? 'bg-blue-50/50' : ''}
                        ${isPast ? 'opacity-50' : ''}
                        ${getGridCellBorder(groups.length)}
                        hover:bg-blue-50/70
                      `}
                      onClick={() => {
                        if (isPast) return
                        if (groups.length > 0) {
                          setViewSlot({ date, time, groups })
                        } else {
                          handleSlotClick(date, time)
                        }
                      }}
                    >
                      {groups.length > 0 ? (
                        <div>
                          <div className="w-full text-left px-2 py-1.5 rounded-md hover:bg-white/50 transition-colors">
                            <span className="text-xs font-bold text-gray-800">
                              {groups.length} group{groups.length !== 1 ? 's' : ''}
                            </span>
                            <span className="text-xs text-gray-500 ml-1">
                              ({groups.reduce((s, g) => s + g.partySize, 0)} players)
                            </span>
                          </div>
                          {!isPast && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleSlotClick(date, time) }}
                              className="mt-0.5 w-full text-xs text-gray-400 hover:text-queue-blue transition-all py-0.5 opacity-0 group-hover/cell:opacity-100"
                            >
                              + Add
                            </button>
                          )}
                        </div>
                      ) : !isPast ? (
                        <div className="w-full h-full min-h-[40px] flex items-center justify-center">
                          <span className="text-xs text-gray-300 group-hover/cell:hidden">Open</span>
                          <span className="hidden group-hover/cell:flex w-full h-full min-h-[40px] items-center justify-center text-queue-blue text-xs font-medium">
                            + Add
                          </span>
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            ))
          })()}
        </div>
      </main>

      {/* ============================================ */}
      {/* SHARED MODALS */}
      {/* ============================================ */}

      {/* View Groups Modal */}
      {viewSlot && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-md sm:mx-4 max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    {formatTimeSlot(viewSlot.time)} &mdash; {viewSlot.groups.length} group{viewSlot.groups.length !== 1 ? 's' : ''}
                  </h3>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {formatDate(viewSlot.date)}
                  </p>
                </div>
                <button
                  onClick={() => setViewSlot(null)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-5 space-y-2 overflow-y-auto flex-1">
              {viewSlot.groups.map(g => (
                <div key={g.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <div>
                    <div className="font-semibold text-gray-900 text-base">{g.name}</div>
                    <div className="text-sm text-gray-500">{g.partySize} player{g.partySize !== 1 ? 's' : ''}</div>
                  </div>
                  <div className="text-xs text-gray-400 text-right max-w-[50%]">
                    {g.members.map(m => m.name).join(', ')}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-5 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setViewSlot(null)}
                className="flex-1 py-3 border border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-50 transition-colors min-h-[48px] text-base"
              >
                Close
              </button>
              <button
                onClick={() => {
                  const { date, time } = viewSlot
                  setViewSlot(null)
                  handleSlotClick(date, time)
                }}
                className="flex-1 py-3 bg-queue-blue hover:bg-blue-700 text-white font-bold rounded-lg transition-colors min-h-[48px] text-base"
              >
                + Add Group
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Day Sheet Modal */}
      {printDate && data && (() => {
        const daySlots = data.calendar[printDate] || {}
        const sortedTimes = Object.keys(daySlots).sort()
        const allGroups: Array<{ time: string; group: CalendarGroup }> = []
        for (const time of sortedTimes) {
          for (const group of daySlots[time]) {
            allGroups.push({ time, group })
          }
        }
        const totalGroups = allGroups.length
        const totalPlayers = allGroups.reduce((sum, { group }) => sum + group.partySize, 0)

        return (
          <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50" id="print-day-sheet-backdrop">
            <div id="print-day-sheet" className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-2xl sm:mx-4 max-h-[90vh] flex flex-col">
              {/* Header */}
              <div className="p-5 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">
                    Day Sheet
                  </h3>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {formatDateFull(printDate)}
                  </p>
                  {data.clubName && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {data.clubName}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setPrintDate(null)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="p-5 overflow-y-auto flex-1">
                {allGroups.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No pre-registrations for this day.</p>
                ) : (
                  <div className="space-y-1.5">
                    {allGroups.map(({ time, group }) => (
                      <div key={group.id} className="py-2 border-b border-gray-100 last:border-b-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="text-sm font-bold text-gray-900 w-20 shrink-0">
                            {formatTimeSlot(time)}
                          </span>
                          <span className="text-sm font-semibold text-gray-800">
                            {group.name}
                          </span>
                          <span className="text-sm text-gray-500">
                            ({group.partySize} player{group.partySize !== 1 ? 's' : ''})
                          </span>
                        </div>
                        {group.members.length > 0 && (
                          <div className="ml-0 sm:ml-20 text-sm text-gray-500 mt-0.5">
                            {group.members.map(m => m.name).join(', ')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Summary & Actions */}
              <div className="p-5 border-t border-gray-200">
                <div className="mb-4">
                  <div className="text-sm font-semibold text-gray-600">
                    Total: {totalGroups} group{totalGroups !== 1 ? 's' : ''} &middot; {totalPlayers} player{totalPlayers !== 1 ? 's' : ''}
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setPrintDate(null)}
                    className="flex-1 py-3 border border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-50 transition-colors min-h-[48px] text-base"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="flex-1 py-3 bg-gray-800 hover:bg-gray-900 text-white font-bold rounded-lg transition-colors min-h-[48px] text-base"
                  >
                    Print Day Sheet
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Add Pre-Registration Modal */}
      {showAddForm && selectedSlot && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-md sm:mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-200 sticky top-0 bg-white rounded-t-2xl sm:rounded-t-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Add Pre-Registration</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {formatDate(selectedSlot.date)} at {formatTimeSlot(selectedSlot.time)}
                  </p>
                </div>
                <button
                  onClick={() => { setShowAddForm(false); setSelectedSlot(null) }}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <form onSubmit={handleAddPreRegistration} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Group Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="e.g., Johnson Foursome"
                  className="w-full px-4 py-3.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-queue-blue focus:border-transparent text-base min-h-[48px]"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Party Size</label>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map(size => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setFormPartySize(size)}
                      className={`py-3.5 rounded-xl font-bold text-lg transition-colors min-h-[48px] ${
                        formPartySize === size
                          ? 'bg-queue-blue text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Member Names <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={formMemberNames}
                  onChange={e => setFormMemberNames(e.target.value)}
                  placeholder="Separate with commas"
                  className="w-full px-4 py-3.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-queue-blue focus:border-transparent text-base min-h-[48px]"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowAddForm(false); setSelectedSlot(null) }}
                  className="flex-1 py-3 border border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-colors min-h-[48px] text-base"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!formName.trim() || submitting}
                  className="flex-1 py-3 bg-queue-blue hover:bg-blue-700 text-white font-bold rounded-xl transition-colors min-h-[48px] disabled:opacity-50 text-base"
                >
                  {submitting ? 'Adding...' : 'Add Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
