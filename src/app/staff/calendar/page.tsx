'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useCalendar, useCurrentTime } from '@/lib/hooks'
import { createGroup, editGroup, removeGroup } from '@/lib/api'
import { CalendarGroup } from '@/lib/types'

interface MemberRow {
  id?: string
  name: string
  transport: 'walking' | 'riding'
  holes: 9 | 18
}

function defaultMember(): MemberRow {
  return { name: '', transport: 'riding', holes: 18 }
}

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
  const [formMembers, setFormMembers] = useState<MemberRow[]>([
    defaultMember(), defaultMember(), defaultMember(), defaultMember(),
  ])
  const [submitting, setSubmitting] = useState(false)

  // Resize formMembers when formPartySize changes
  useEffect(() => {
    setFormMembers(prev => {
      const next = [...prev]
      while (next.length < formPartySize) next.push(defaultMember())
      return next.slice(0, formPartySize)
    })
  }, [formPartySize])

  // Edit/delete state for calendar groups
  const [editingCalGroup, setEditingCalGroup] = useState<{ group: CalendarGroup; date: string; time: string } | null>(null)
  const [editName, setEditName] = useState('')
  const [editPartySize, setEditPartySize] = useState(4)
  const [editMembers, setEditMembers] = useState<MemberRow[]>([])
  const [editDate, setEditDate] = useState('')
  const [editTime, setEditTime] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleteDeleting, setDeleteDeleting] = useState(false)

  // Resize editMembers when editPartySize changes
  useEffect(() => {
    setEditMembers(prev => {
      const next = [...prev]
      while (next.length < editPartySize) next.push(defaultMember())
      return next.slice(0, editPartySize)
    })
  }, [editPartySize])

  const handleSlotClick = (date: string, time: string) => {
    setSelectedSlot({ date, time })
    setShowAddForm(true)
    setFormName('')
    setFormPartySize(4)
    setFormMembers([defaultMember(), defaultMember(), defaultMember(), defaultMember()])
  }

  const handleAddPreRegistration = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName.trim() || !selectedSlot) return

    setSubmitting(true)
    try {
      await createGroup({
        name: formName.trim(),
        partySize: formPartySize,
        members: formMembers.slice(0, formPartySize).map(m => ({
          name: m.name.trim() || '',
          transport: m.transport,
          holes: m.holes,
        })),
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

  const handleStartEditCalGroup = (g: CalendarGroup, date: string, time: string) => {
    setEditingCalGroup({ group: g, date, time })
    setEditName(g.name)
    setEditPartySize(g.partySize)
    const rows: MemberRow[] = g.members.map(m => ({
      id: m.id,
      name: m.name,
      transport: (m.transport ?? 'riding') as 'walking' | 'riding',
      holes: (m.holes ?? 18) as 9 | 18,
    }))
    while (rows.length < g.partySize) rows.push(defaultMember())
    setEditMembers(rows)
    setEditDate(date)
    setEditTime(time)
  }

  const handleSaveCalGroupEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingCalGroup || !editName.trim()) return

    setEditSaving(true)
    try {
      const data: Parameters<typeof editGroup>[1] = {
        name: editName.trim(),
        partySize: editPartySize,
        members: editMembers.slice(0, editPartySize).map(m => ({
          id: m.id,
          name: m.name.trim() || '',
          transport: m.transport,
          holes: m.holes,
        })),
      }
      if (editDate && editTime) {
        data.scheduledTime = `${editDate}T${editTime}:00.000Z`
      }
      await editGroup(editingCalGroup.group.id, data)
      setEditingCalGroup(null)
      setViewSlot(null)
      refetch()
    } catch (err) {
      console.error('Failed to edit pre-registration:', err)
    } finally {
      setEditSaving(false)
    }
  }

  const handleDeleteCalGroup = async (groupId: string) => {
    setDeleteDeleting(true)
    try {
      await removeGroup(groupId)
      setDeleteConfirmId(null)
      // Update viewSlot to remove the deleted group
      if (viewSlot) {
        const remaining = viewSlot.groups.filter(g => g.id !== groupId)
        if (remaining.length === 0) {
          setViewSlot(null)
        } else {
          setViewSlot({ ...viewSlot, groups: remaining })
        }
      }
      refetch()
    } catch (err) {
      console.error('Failed to delete pre-registration:', err)
    } finally {
      setDeleteDeleting(false)
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
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 lg:px-6 py-3 flex items-center justify-between shadow-sm sticky top-0 z-20">
        <div className="flex items-center gap-3 lg:gap-6">
          <h1 className="text-base lg:text-lg font-bold text-gray-800 tracking-tight">{data.clubName}</h1>
          <span className="text-sm font-medium text-gray-500">{clockTime}</span>
        </div>
        <h2 className="text-sm lg:text-lg font-bold text-gray-800 hidden sm:block">Pre-Registration Calendar</h2>
      </header>

      {/* Desktop-only Staff Navigation */}
      <nav className="hidden lg:flex bg-white border-b border-gray-200 px-6 py-2 items-center gap-4">
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

      {/* Mobile Tab Bar — Calendar tab active */}
      <div className="lg:hidden bg-white border-b border-gray-200 flex shrink-0 shadow-sm">

        {/* Tab 1: Queue */}
        <Link
          href="/staff"
          className="flex-1 flex flex-col items-center pt-2.5 pb-1.5 px-1 gap-0.5 text-gray-400 relative transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
          <span className="text-[11px] font-semibold tracking-tight">Queue</span>
        </Link>

        {/* Tab 2: Assembling */}
        <Link
          href="/staff"
          className="flex-1 flex flex-col items-center pt-2.5 pb-1.5 px-1 gap-0.5 text-gray-400 relative transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <span className="text-[11px] font-semibold tracking-tight">Assembling</span>
        </Link>

        {/* Tab 3: Add Group */}
        <Link
          href="/staff"
          className="flex-1 flex flex-col items-center pt-2.5 pb-1.5 px-1 gap-0.5 text-gray-400 relative transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span className="text-[11px] font-semibold tracking-tight">Add Group</span>
        </Link>

        {/* Tab 4: Calendar (active) */}
        <div className="flex-1 flex flex-col items-center pt-2.5 pb-1.5 px-1 gap-0.5 text-queue-green relative">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-[11px] font-semibold tracking-tight">Calendar</span>
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-queue-green" />
        </div>
      </div>

      {/* ============================================ */}
      {/* MOBILE LAYOUT (< lg) */}
      {/* ============================================ */}
      <div className="lg:hidden flex flex-col flex-1 min-h-0 overflow-hidden">
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
                <div key={g.id} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-gray-900 text-base">{g.name}</div>
                      <div className="text-sm text-gray-500">{g.partySize} player{g.partySize !== 1 ? 's' : ''}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleStartEditCalGroup(g, viewSlot.date, viewSlot.time)}
                        className="p-1.5 rounded transition-colors text-gray-400 hover:text-queue-blue hover:bg-blue-50"
                        title="Edit"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(g.id)}
                        className="p-1.5 rounded transition-colors text-gray-400 hover:text-queue-red hover:bg-red-50"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  {g.members.length > 0 && (
                    <div className="mt-1.5 space-y-0.5">
                      {g.members.map(m => {
                        const transport = m.transport ?? 'riding'
                        const holes = m.holes ?? 18
                        return (
                          <div key={m.id} className="flex items-center gap-1.5 text-xs text-gray-500">
                            <span className="font-medium">{m.name}</span>
                            <span className={transport === 'walking' ? 'text-green-600' : 'text-gray-400'}>
                              {transport === 'walking' ? '🚶' : '🛒'}
                            </span>
                            <span className={`font-semibold ${holes === 9 ? 'text-amber-600' : 'text-gray-400'}`}>
                              {holes}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
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
                          <div className="ml-0 sm:ml-20 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                            {group.members.map(m => {
                              const transport = m.transport ?? 'riding'
                              const holes = m.holes ?? 18
                              return (
                                <span key={m.id} className="text-sm text-gray-500 flex items-center gap-1">
                                  {m.name}
                                  <span>{transport === 'walking' ? '🚶' : '🛒'}</span>
                                  <span className={`font-semibold ${holes === 9 ? 'text-amber-600' : ''}`}>{holes}</span>
                                </span>
                              )
                            })}
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

              {/* Member rows */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-semibold text-gray-700">
                    Members <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <div className="flex items-center gap-3 text-xs text-gray-400 pr-1">
                    <span>Walk/Ride</span>
                    <span>Holes</span>
                  </div>
                </div>
                <div className="space-y-2">
                  {formMembers.slice(0, formPartySize).map((member, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={member.name}
                        onChange={e => setFormMembers(prev => prev.map((m, j) => j === i ? { ...m, name: e.target.value } : m))}
                        placeholder={`Player ${i + 1}`}
                        className="flex-1 px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-queue-blue text-sm min-h-[44px]"
                      />
                      <button
                        type="button"
                        onClick={() => setFormMembers(prev => prev.map((m, j) => j === i ? { ...m, transport: m.transport === 'riding' ? 'walking' : 'riding' } : m))}
                        title={member.transport === 'walking' ? 'Walking' : 'Riding'}
                        className={`min-w-[44px] min-h-[44px] rounded-xl text-lg flex items-center justify-center transition-colors flex-shrink-0 border ${
                          member.transport === 'walking'
                            ? 'bg-green-50 border-green-300 text-green-700'
                            : 'bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {member.transport === 'walking' ? '🚶' : '🛒'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormMembers(prev => prev.map((m, j) => j === i ? { ...m, holes: m.holes === 18 ? 9 : 18 } : m))}
                        title={`${member.holes} holes`}
                        className={`min-w-[44px] min-h-[44px] rounded-xl font-bold text-sm flex items-center justify-center transition-colors flex-shrink-0 border ${
                          member.holes === 9
                            ? 'bg-amber-50 border-amber-300 text-amber-700'
                            : 'bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {member.holes}
                      </button>
                    </div>
                  ))}
                </div>
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

      {/* Edit Pre-Registration Modal */}
      {editingCalGroup && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-md sm:mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-200 sticky top-0 bg-white rounded-t-2xl sm:rounded-t-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">Edit Pre-Registration</h3>
                <button
                  onClick={() => setEditingCalGroup(null)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <form onSubmit={handleSaveCalGroupEdit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Group Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
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
                      onClick={() => setEditPartySize(size)}
                      className={`py-3.5 rounded-xl font-bold text-lg transition-colors min-h-[48px] ${
                        editPartySize === size
                          ? 'bg-queue-blue text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              {/* Member rows */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-semibold text-gray-700">Members</label>
                  <div className="flex items-center gap-3 text-xs text-gray-400 pr-1">
                    <span>Walk/Ride</span>
                    <span>Holes</span>
                  </div>
                </div>
                <div className="space-y-2">
                  {editMembers.slice(0, editPartySize).map((member, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={member.name}
                        onChange={e => setEditMembers(prev => prev.map((m, j) => j === i ? { ...m, name: e.target.value } : m))}
                        placeholder={`Player ${i + 1}`}
                        className="flex-1 px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-queue-blue text-sm min-h-[44px]"
                      />
                      <button
                        type="button"
                        onClick={() => setEditMembers(prev => prev.map((m, j) => j === i ? { ...m, transport: m.transport === 'riding' ? 'walking' : 'riding' } : m))}
                        title={member.transport === 'walking' ? 'Walking' : 'Riding'}
                        className={`min-w-[44px] min-h-[44px] rounded-xl text-lg flex items-center justify-center transition-colors flex-shrink-0 border ${
                          member.transport === 'walking'
                            ? 'bg-green-50 border-green-300 text-green-700'
                            : 'bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {member.transport === 'walking' ? '🚶' : '🛒'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditMembers(prev => prev.map((m, j) => j === i ? { ...m, holes: m.holes === 18 ? 9 : 18 } : m))}
                        title={`${member.holes} holes`}
                        className={`min-w-[44px] min-h-[44px] rounded-xl font-bold text-sm flex items-center justify-center transition-colors flex-shrink-0 border ${
                          member.holes === 9
                            ? 'bg-amber-50 border-amber-300 text-amber-700'
                            : 'bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {member.holes}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Date</label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={e => setEditDate(e.target.value)}
                    className="w-full px-4 py-3.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-queue-blue focus:border-transparent text-base min-h-[48px]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Time</label>
                  <input
                    type="time"
                    value={editTime}
                    onChange={e => setEditTime(e.target.value)}
                    className="w-full px-4 py-3.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-queue-blue focus:border-transparent text-base min-h-[48px]"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingCalGroup(null)}
                  className="flex-1 py-3 border border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-colors min-h-[48px] text-base"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!editName.trim() || editSaving}
                  className="flex-1 py-3 bg-queue-blue hover:bg-blue-700 text-white font-bold rounded-xl transition-colors min-h-[48px] disabled:opacity-50 text-base"
                >
                  {editSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Pre-Registration Confirmation */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-sm sm:mx-4">
            <div className="p-5 text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-red-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-queue-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">
                Delete pre-registration?
              </h3>
              <p className="text-sm text-gray-500">
                This cannot be undone.
              </p>
            </div>
            <div className="p-5 pt-0 flex gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                disabled={deleteDeleting}
                className="flex-1 py-3 border border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-colors min-h-[48px] text-base disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteCalGroup(deleteConfirmId)}
                disabled={deleteDeleting}
                className="flex-1 py-3 bg-queue-red hover:bg-red-700 text-white font-bold rounded-xl transition-colors min-h-[48px] text-base disabled:opacity-50"
              >
                {deleteDeleting ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
