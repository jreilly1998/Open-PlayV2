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

function getWeekDates(): string[] {
  const dates: string[] = []
  const now = new Date()
  for (let i = 0; i < 7; i++) {
    const d = new Date(now)
    d.setDate(now.getDate() + i)
    dates.push(d.toISOString().split('T')[0])
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

export default function StaffCalendar() {
  const { data, refetch } = useCalendar(10000)
  const currentTime = useCurrentTime()
  const [showAddForm, setShowAddForm] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<{ date: string; time: string } | null>(null)
  const [viewSlot, setViewSlot] = useState<{ date: string; time: string; groups: CalendarGroup[] } | null>(null)

  // Add form state
  const [formName, setFormName] = useState('')
  const [formPartySize, setFormPartySize] = useState(4)
  const [formMemberNames, setFormMemberNames] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const weekDates = getWeekDates()
  const todayStr = new Date().toISOString().split('T')[0]

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
      const scheduledTime = new Date(`${selectedSlot.date}T${selectedSlot.time}:00`)
      await createGroup({
        name: formName.trim(),
        partySize: formPartySize,
        memberNames: formMemberNames.trim() || undefined,
        isPreRegistered: true,
        scheduledTime: scheduledTime.toISOString(),
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

  const clockH = currentTime.getHours()
  const clockM = currentTime.getMinutes().toString().padStart(2, '0')
  const clockAmpm = clockH >= 12 ? 'PM' : 'AM'
  const clockTime = `${(clockH % 12 || 12).toString().padStart(2, '0')}:${clockM} ${clockAmpm}`

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
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-6">
          <h1 className="text-lg font-bold text-gray-800 tracking-tight">{data.clubName}</h1>
          <span className="text-sm font-medium text-gray-500">{clockTime}</span>
        </div>
        <h2 className="text-lg font-bold text-gray-800">Pre-Registration Calendar</h2>
      </header>

      {/* Staff Navigation */}
      <nav className="bg-white border-b border-gray-200 px-6 py-2 flex items-center gap-4">
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

      {/* Calendar Grid */}
      <main className="flex-1 overflow-auto p-4">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Day Headers */}
          <div className="grid grid-cols-[100px_repeat(7,1fr)] border-b border-gray-200 sticky top-0 bg-white z-10">
            <div className="p-3 text-xs font-semibold text-gray-400 uppercase border-r border-gray-100">
              Time
            </div>
            {weekDates.map(date => (
              <div
                key={date}
                className={`p-3 text-center border-r border-gray-100 last:border-r-0 ${
                  date === todayStr ? 'bg-blue-50' : ''
                }`}
              >
                <div className={`text-xs font-bold ${date === todayStr ? 'text-queue-blue' : 'text-gray-800'}`}>
                  {formatDate(date)}
                </div>
              </div>
            ))}
          </div>

          {/* Time Rows */}
          {TIME_SLOTS.map(time => (
            <div key={time} className="grid grid-cols-[100px_repeat(7,1fr)] border-b border-gray-100 last:border-b-0">
              <div className="p-2 text-xs font-medium text-gray-500 border-r border-gray-100 flex items-start justify-end pr-3 pt-3">
                {formatTimeSlot(time)}
              </div>
              {weekDates.map(date => {
                const groups = getSlotGroups(date, time)
                const isPast = date < todayStr

                return (
                  <div
                    key={date}
                    className={`border-r border-gray-100 last:border-r-0 p-1 min-h-[52px] ${
                      date === todayStr ? 'bg-blue-50/50' : ''
                    } ${isPast ? 'opacity-50' : ''}`}
                  >
                    {groups.length > 0 ? (
                      <div>
                        <button
                          onClick={() => setViewSlot({ date, time, groups })}
                          className="w-full text-left px-2 py-1.5 rounded-md bg-queue-blue/10 hover:bg-queue-blue/20 transition-colors"
                        >
                          <span className="text-xs font-bold text-queue-blue">
                            {groups.length} group{groups.length !== 1 ? 's' : ''}
                          </span>
                          <span className="text-xs text-gray-500 ml-1">
                            ({groups.reduce((s, g) => s + g.partySize, 0)} players)
                          </span>
                        </button>
                        {!isPast && (
                          <button
                            onClick={() => handleSlotClick(date, time)}
                            className="mt-1 w-full text-xs text-gray-400 hover:text-queue-blue transition-colors py-0.5"
                          >
                            + Add
                          </button>
                        )}
                      </div>
                    ) : !isPast ? (
                      <button
                        onClick={() => handleSlotClick(date, time)}
                        className="w-full h-full min-h-[40px] flex items-center justify-center text-gray-300 hover:text-queue-blue hover:bg-blue-50 rounded transition-colors text-xs"
                      >
                        +
                      </button>
                    ) : null}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </main>

      {/* View Groups Modal */}
      {viewSlot && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
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
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-5 space-y-2 max-h-[60vh] overflow-y-auto">
              {viewSlot.groups.map(g => (
                <div key={g.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <div>
                    <div className="font-semibold text-gray-900">{g.name}</div>
                    <div className="text-sm text-gray-500">{g.partySize} player{g.partySize !== 1 ? 's' : ''}</div>
                  </div>
                  <div className="text-xs text-gray-400">
                    {g.members.map(m => m.name).join(', ')}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-5 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setViewSlot(null)}
                className="flex-1 py-3 border border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-50 transition-colors min-h-[44px]"
              >
                Close
              </button>
              <button
                onClick={() => {
                  const { date, time } = viewSlot
                  setViewSlot(null)
                  handleSlotClick(date, time)
                }}
                className="flex-1 py-3 bg-queue-blue hover:bg-blue-700 text-white font-bold rounded-lg transition-colors min-h-[44px]"
              >
                + Add Group
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Pre-Registration Modal */}
      {showAddForm && selectedSlot && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-5 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Add Pre-Registration</h3>
              <p className="text-sm text-gray-500 mt-1">
                {formatDate(selectedSlot.date)} at {formatTimeSlot(selectedSlot.time)}
              </p>
            </div>
            <form onSubmit={handleAddPreRegistration} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Group Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="e.g., Johnson Foursome"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-queue-blue focus:border-transparent min-h-[44px]"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Party Size</label>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map(size => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setFormPartySize(size)}
                      className={`py-3 rounded-lg font-bold text-lg transition-colors min-h-[44px] ${
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
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Member Names <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={formMemberNames}
                  onChange={e => setFormMemberNames(e.target.value)}
                  placeholder="Separate with commas"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-queue-blue focus:border-transparent min-h-[44px]"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowAddForm(false); setSelectedSlot(null) }}
                  className="flex-1 py-3 border border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-50 transition-colors min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!formName.trim() || submitting}
                  className="flex-1 py-3 bg-queue-blue hover:bg-blue-700 text-white font-bold rounded-lg transition-colors min-h-[44px] disabled:opacity-50"
                >
                  {submitting ? 'Adding...' : 'Add Pre-Registration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
