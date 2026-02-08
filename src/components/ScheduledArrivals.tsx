'use client'

import { useState } from 'react'
import { GroupData } from '@/lib/types'
import { checkInGroup, moveToQueue } from '@/lib/api'

function formatTime(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const h = d.getHours()
  const m = d.getMinutes().toString().padStart(2, '0')
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${(h % 12 || 12).toString().padStart(2, '0')}:${m} ${ampm}`
}

interface ScheduledArrivalsProps {
  groups: GroupData[]
  onRefetch: () => void
}

export default function ScheduledArrivals({ groups, onRefetch }: ScheduledArrivalsProps) {
  const [expanded, setExpanded] = useState(true)
  const [collapsedSlots, setCollapsedSlots] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState<Record<string, boolean>>({})

  // Group by time slot (round to nearest 30 min)
  const timeSlots = groups.reduce<Record<string, GroupData[]>>((acc, group) => {
    const time = group.scheduledTime ? formatTime(group.scheduledTime) : 'Unscheduled'
    if (!acc[time]) acc[time] = []
    acc[time].push(group)
    return acc
  }, {})

  const toggleSlot = (slot: string) => {
    setCollapsedSlots(prev => {
      const next = new Set(prev)
      if (next.has(slot)) next.delete(slot)
      else next.add(slot)
      return next
    })
  }

  const handleCheckIn = async (groupId: string) => {
    setLoading(prev => ({ ...prev, [groupId]: true }))
    try {
      await checkInGroup(groupId)
      onRefetch()
    } finally {
      setLoading(prev => ({ ...prev, [groupId]: false }))
    }
  }

  const handleMoveToQueue = async (groupId: string) => {
    setLoading(prev => ({ ...prev, [`queue-${groupId}`]: true }))
    try {
      await moveToQueue(groupId)
      onRefetch()
    } finally {
      setLoading(prev => ({ ...prev, [`queue-${groupId}`]: false }))
    }
  }

  return (
    <div className="rounded-xl overflow-hidden border border-blue-200">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full bg-queue-blue px-5 py-3 flex items-center justify-between"
      >
        <div>
          <h2 className="text-white font-bold text-lg text-left">Scheduled Arrivals</h2>
          <p className="text-blue-100 text-sm text-left">
            {groups.length} pre-registration{groups.length !== 1 ? 's' : ''}
          </p>
        </div>
        <svg
          className={`w-5 h-5 text-white transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="bg-gray-50">
          {groups.length === 0 ? (
            <div className="px-5 py-8 text-center text-gray-400">
              <p className="font-medium">No pre-registrations</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {Object.entries(timeSlots).map(([slot, slotGroups]) => (
                <div key={slot}>
                  <button
                    onClick={() => toggleSlot(slot)}
                    className="w-full px-5 py-3 flex items-center justify-between hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <svg
                        className={`w-4 h-4 text-gray-400 transition-transform ${!collapsedSlots.has(slot) ? 'rotate-90' : ''}`}
                        fill="currentColor" viewBox="0 0 20 20"
                      >
                        <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                      </svg>
                      <span className="font-bold text-gray-800">{slot}</span>
                    </div>
                    <span className="text-sm text-gray-500">
                      ({slotGroups.length} group{slotGroups.length !== 1 ? 's' : ''})
                    </span>
                  </button>

                  {!collapsedSlots.has(slot) && (
                    <div className="px-5 pb-3 space-y-2">
                      {slotGroups.map(group => (
                        <div
                          key={group.id}
                          className="bg-white rounded-lg border border-gray-200 p-3 fade-in"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-bold text-gray-900">{group.name}</h4>
                              <p className="text-sm text-gray-500">
                                {group.partySize} player{group.partySize !== 1 ? 's' : ''}
                                {group.members.length > 0 && (
                                  <span className="text-gray-400">
                                    {' '}&middot; {group.members.map(m => m.name).join(', ')}
                                  </span>
                                )}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleCheckIn(group.id)}
                                disabled={loading[group.id]}
                                className="px-4 py-2.5 bg-queue-blue hover:bg-blue-700 text-white font-bold text-sm rounded-lg transition-colors min-h-[44px] disabled:opacity-50"
                              >
                                CHECK IN
                              </button>
                              <button
                                onClick={() => handleMoveToQueue(group.id)}
                                disabled={loading[`queue-${group.id}`]}
                                className="px-4 py-2.5 bg-queue-green hover:bg-green-700 text-white font-bold text-sm rounded-lg transition-colors min-h-[44px] disabled:opacity-50"
                              >
                                → QUEUE
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
