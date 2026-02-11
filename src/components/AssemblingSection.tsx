'use client'

import { useState } from 'react'
import { GroupData } from '@/lib/types'
import { toggleMember, moveToQueue, removeGroup } from '@/lib/api'

function formatTime(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const h = d.getHours()
  const m = d.getMinutes().toString().padStart(2, '0')
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${(h % 12 || 12).toString().padStart(2, '0')}:${m} ${ampm}`
}

function formatScheduledTime(dateStr: string | null): string {
  if (!dateStr) return ''
  // scheduledTime stores conceptual local time as UTC, so use UTC methods
  const d = new Date(dateStr)
  const h = d.getUTCHours()
  const m = d.getUTCMinutes().toString().padStart(2, '0')
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${(h % 12 || 12).toString().padStart(2, '0')}:${m} ${ampm}`
}

interface AssemblingSectionProps {
  groups: GroupData[]
  onRefetch: () => void
}

export default function AssemblingSection({ groups, onRefetch }: AssemblingSectionProps) {
  const [expanded, setExpanded] = useState(true)
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)
  const [loading, setLoading] = useState<Record<string, boolean>>({})

  const handleToggleMember = async (memberId: string) => {
    setLoading(prev => ({ ...prev, [memberId]: true }))
    try {
      await toggleMember(memberId)
      onRefetch()
    } finally {
      setLoading(prev => ({ ...prev, [memberId]: false }))
    }
  }

  const handleMoveToQueue = async (groupId: string) => {
    setLoading(prev => ({ ...prev, [groupId]: true }))
    try {
      await moveToQueue(groupId)
      onRefetch()
    } finally {
      setLoading(prev => ({ ...prev, [groupId]: false }))
    }
  }

  const handleRemove = async (groupId: string) => {
    if (confirmRemove !== groupId) {
      setConfirmRemove(groupId)
      setTimeout(() => setConfirmRemove(null), 3000)
      return
    }
    await removeGroup(groupId)
    setConfirmRemove(null)
    onRefetch()
  }

  // Sort: groups closest to complete first
  const sorted = [...groups].sort((a, b) => {
    const aRatio = a.members.filter(m => m.arrived).length / a.partySize
    const bRatio = b.members.filter(m => m.arrived).length / b.partySize
    return bRatio - aRatio
  })

  return (
    <div className="rounded-xl overflow-hidden border border-amber-200 shrink-0">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full bg-amber-600 px-5 py-3 flex items-center justify-between"
      >
        <div>
          <h2 className="text-white font-bold text-lg text-left">Groups Assembling</h2>
          <p className="text-amber-100 text-sm text-left">
            {groups.length} group{groups.length !== 1 ? 's' : ''}
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
          {sorted.length === 0 ? (
            <div className="px-5 py-8 text-center text-gray-400">
              <p className="font-medium">No groups assembling</p>
            </div>
          ) : (
            <div className="p-3 space-y-3">
              {sorted.map(group => {
                const arrivedCount = group.members.filter(m => m.arrived).length
                const allHere = arrivedCount === group.partySize
                const pct = Math.round((arrivedCount / group.partySize) * 100)

                return (
                  <div
                    key={group.id}
                    className={`
                      bg-white rounded-lg border p-4 transition-all fade-in
                      ${allHere ? 'border-queue-green ready-glow' : 'border-gray-200'}
                    `}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-bold text-gray-900">{group.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          {/* Checkbox visualization */}
                          <div className="flex gap-0.5">
                            {Array.from({ length: group.partySize }, (_, i) => (
                              <span key={i} className="text-lg">
                                {i < arrivedCount ? (
                                  <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                                  </svg>
                                ) : (
                                  <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 20 20">
                                    <rect x="3" y="3" width="14" height="14" rx="2" strokeWidth={1.5} />
                                  </svg>
                                )}
                              </span>
                            ))}
                          </div>
                          <span className="text-sm text-gray-600 font-medium">
                            {arrivedCount} of {group.partySize} here
                          </span>
                          <span className="text-sm text-gray-400">({pct}%)</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          {group.assemblingAt
                            ? `Started ${formatTime(group.assemblingAt)}`
                            : group.scheduledTime
                              ? `Scheduled ${formatScheduledTime(group.scheduledTime)}`
                              : ''}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRemove(group.id)}
                        className={`p-1 rounded transition-colors ${
                          confirmRemove === group.id
                            ? 'text-red-600 bg-red-50'
                            : 'text-gray-300 hover:text-gray-500'
                        }`}
                        title={confirmRemove === group.id ? 'Click again to confirm' : 'Remove group'}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    {/* Member list */}
                    <div className="space-y-1.5 mt-3">
                      {group.members.map(member => (
                        <button
                          key={member.id}
                          onClick={() => handleToggleMember(member.id)}
                          disabled={loading[member.id]}
                          className={`
                            w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors min-h-[44px]
                            ${member.arrived
                              ? 'bg-green-50 text-green-800'
                              : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                            }
                            ${loading[member.id] ? 'opacity-50' : ''}
                          `}
                        >
                          <span className={member.arrived ? 'check-animate' : ''}>
                            {member.arrived ? (
                              <svg className="w-5 h-5 text-queue-green" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                              </svg>
                            ) : (
                              <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <circle cx="12" cy="12" r="9" strokeWidth={1.5} />
                              </svg>
                            )}
                          </span>
                          <span className={`font-medium ${member.arrived ? 'text-green-800' : 'text-gray-700'}`}>
                            {member.name}
                          </span>
                        </button>
                      ))}
                    </div>

                    {/* Move to Queue button */}
                    <button
                      onClick={() => handleMoveToQueue(group.id)}
                      disabled={loading[group.id]}
                      className={`w-full mt-3 py-3 font-bold rounded-lg transition-colors min-h-[44px] ${
                        allHere
                          ? 'bg-queue-green hover:bg-green-700 text-white'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                      }`}
                    >
                      {allHere ? 'Move to Queue' : 'Move to Queue Anyway'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
