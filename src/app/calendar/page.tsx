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

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function toLocalDateStr(d: Date): string {
  const year = d.getFullYear()
  const month = (d.getMonth() + 1).toString().padStart(2, '0')
  const day = d.getDate().toString().padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getWeekDates(): string[] {
  const dates: string[] = []
  const now = new Date()
  for (let i = 0; i < 7; i++) {
    const d = new Date(now)
    d.setDate(now.getDate() + i)
    dates.push(toLocalDateStr(d))
  }
  return dates
}

const TIME_SLOTS = [
  '06:00', '06:30', '07:00', '07:30', '08:00', '08:30',
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  '18:00',
]

export default function MemberCalendar() {
  const { data, refetch } = useCalendar()
  const currentTime = useCurrentTime()
  const weekDates = getWeekDates()
  const todayStr = toLocalDateStr(new Date())

  // Day selection for mobile view
  const [selectedDay, setSelectedDay] = useState(todayStr)

  // Add form state
  const [showAddForm, setShowAddForm] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<{ date: string; time: string } | null>(null)
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

  const formatClock = (d: Date) => {
    const h = d.getHours()
    const m = d.getMinutes().toString().padStart(2, '0')
    const ampm = h >= 12 ? 'PM' : 'AM'
    return `${(h % 12 || 12)}:${m} ${ampm}`
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-queue-blue border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 font-medium">Loading calendar...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 shadow-sm sticky top-0 z-20">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">{data.clubName}</h1>
            <p className="text-xs text-gray-500">{formatClock(currentTime)} &middot; Plan your visit</p>
          </div>
          <Link
            href="/"
            className="px-4 py-2.5 bg-queue-green text-white font-bold text-sm rounded-lg hover:bg-green-700 transition-colors min-h-[44px] flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            Queue
          </Link>
        </div>
      </header>

      {/* Day Selector - horizontal scrollable */}
      <div className="bg-white border-b border-gray-200 sticky top-[61px] z-10">
        <div className="flex overflow-x-auto py-2 px-2 gap-1 no-scrollbar">
          {weekDates.map(date => {
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

      {/* Time Slots for Selected Day */}
      <main className="flex-1 px-4 py-4">
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">
          {formatDateShort(selectedDay)}
        </h2>

        <div className="space-y-2">
          {TIME_SLOTS.map(time => {
            const groups = getSlotGroups(selectedDay, time)
            const isPast = selectedDay === todayStr && (() => {
              const [h, m] = time.split(':').map(Number)
              const now = new Date()
              return h < now.getHours() || (h === now.getHours() && m < now.getMinutes())
            })()

            return (
              <div
                key={time}
                className={`bg-white rounded-xl border p-3 ${
                  isPast ? 'opacity-50 border-gray-100' : 'border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-gray-700 w-[80px]">
                      {formatTimeSlot(time)}
                    </span>
                    {groups.length > 0 ? (
                      <span className="text-sm font-bold text-queue-blue">
                        {groups.length} group{groups.length !== 1 ? 's' : ''} registered
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">Open</span>
                    )}
                  </div>

                  {!isPast && (
                    <button
                      onClick={() => handleSlotClick(selectedDay, time)}
                      className="px-3 py-2 text-sm font-bold text-queue-blue hover:bg-blue-50 rounded-lg transition-colors min-h-[40px]"
                    >
                      + Register
                    </button>
                  )}
                </div>

                {/* Demand Indicator */}
                {groups.length > 0 && (
                  <div className="mt-2 flex gap-1">
                    {Array.from({ length: Math.min(groups.length, 5) }).map((_, i) => (
                      <div
                        key={i}
                        className={`h-1.5 flex-1 rounded-full ${
                          groups.length >= 4 ? 'bg-queue-red' :
                          groups.length >= 2 ? 'bg-queue-amber' :
                          'bg-queue-green'
                        }`}
                      />
                    ))}
                    {groups.length < 5 && Array.from({ length: 5 - Math.min(groups.length, 5) }).map((_, i) => (
                      <div key={`empty-${i}`} className="h-1.5 flex-1 rounded-full bg-gray-100" />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </main>

      {/* Add Pre-Registration Modal */}
      {showAddForm && selectedSlot && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-md sm:mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-200 sticky top-0 bg-white rounded-t-2xl sm:rounded-t-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Pre-Register</h3>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {formatDate(selectedSlot.date)} at {formatTimeSlot(selectedSlot.time)}
                  </p>
                </div>
                <button
                  onClick={() => { setShowAddForm(false); setSelectedSlot(null) }}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
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
                  Player Names <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={formMemberNames}
                  onChange={e => setFormMemberNames(e.target.value)}
                  placeholder="Separate with commas"
                  className="w-full px-4 py-3.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-queue-blue focus:border-transparent text-base min-h-[48px]"
                />
              </div>

              <button
                type="submit"
                disabled={!formName.trim() || submitting}
                className="w-full py-4 bg-queue-blue hover:bg-blue-700 text-white font-bold text-base rounded-xl transition-colors min-h-[52px] disabled:opacity-50"
              >
                {submitting ? 'Registering...' : 'Pre-Register My Group'}
              </button>

              <button
                type="button"
                onClick={() => { setShowAddForm(false); setSelectedSlot(null) }}
                className="w-full py-3 text-gray-500 font-medium text-sm"
              >
                Cancel
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
