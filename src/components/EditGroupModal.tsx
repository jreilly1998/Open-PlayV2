'use client'

import { useState, useEffect } from 'react'
import { editGroup } from '@/lib/api'

interface MemberRow {
  id?: string
  name: string
  transport: 'walking' | 'riding'
  holes: 9 | 18
}

interface EditGroupModalProps {
  group: {
    id: string
    name: string
    partySize: number
    members: Array<{ id: string; name: string; transport?: 'walking' | 'riding'; holes?: 9 | 18 }>
    scheduledTime?: string | null
  }
  showScheduledTime?: boolean
  onClose: () => void
  onSaved: () => void
}

function defaultMember(index: number): MemberRow {
  return { name: `Player ${index + 1}`, transport: 'riding', holes: 18 }
}

export default function EditGroupModal({ group, showScheduledTime, onClose, onSaved }: EditGroupModalProps) {
  const [name, setName] = useState(group.name)
  const [partySize, setPartySize] = useState(group.partySize)
  const [members, setMembers] = useState<MemberRow[]>(() => {
    // Initialize from existing members, defaulting transport/holes
    const rows: MemberRow[] = group.members.map(m => ({
      id: m.id,
      name: m.name,
      transport: m.transport ?? 'riding',
      holes: m.holes ?? 18,
    }))
    // Pad to partySize if needed
    while (rows.length < group.partySize) {
      rows.push(defaultMember(rows.length))
    }
    return rows
  })
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (showScheduledTime && group.scheduledTime) {
      const d = new Date(group.scheduledTime)
      const year = d.getUTCFullYear()
      const month = (d.getUTCMonth() + 1).toString().padStart(2, '0')
      const day = d.getUTCDate().toString().padStart(2, '0')
      const hours = d.getUTCHours().toString().padStart(2, '0')
      const minutes = d.getUTCMinutes().toString().padStart(2, '0')
      setScheduledDate(`${year}-${month}-${day}`)
      setScheduledTime(`${hours}:${minutes}`)
    }
  }, [showScheduledTime, group.scheduledTime])

  // Resize member rows when party size changes
  useEffect(() => {
    setMembers(prev => {
      const next = [...prev]
      while (next.length < partySize) next.push(defaultMember(next.length))
      return next.slice(0, partySize)
    })
  }, [partySize])

  const updateMember = (i: number, patch: Partial<MemberRow>) => {
    setMembers(prev => prev.map((m, j) => j === i ? { ...m, ...patch } : m))
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setSaving(true)
    setError('')
    try {
      const data: Parameters<typeof editGroup>[1] = {
        name: name.trim(),
        partySize,
        members: members.slice(0, partySize).map(m => ({
          id: m.id,
          name: m.name.trim() || '',
          transport: m.transport,
          holes: m.holes,
        })),
      }

      if (showScheduledTime && scheduledDate && scheduledTime) {
        data.scheduledTime = `${scheduledDate}T${scheduledTime}:00.000Z`
      }

      await editGroup(group.id, data)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-md sm:mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-gray-200 sticky top-0 bg-white rounded-t-2xl sm:rounded-t-xl">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900">Edit Group</h3>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Group Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
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
                  onClick={() => setPartySize(size)}
                  className={`py-3.5 rounded-xl font-bold text-lg transition-colors min-h-[48px] ${
                    partySize === size
                      ? 'bg-queue-blue text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {/* Member rows with transport / holes */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-semibold text-gray-700">Members</label>
              <div className="flex items-center gap-3 text-xs text-gray-400 pr-1">
                <span>Walk/Ride</span>
                <span>Holes</span>
              </div>
            </div>
            <div className="space-y-2">
              {members.slice(0, partySize).map((member, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={member.name}
                    onChange={e => updateMember(i, { name: e.target.value })}
                    placeholder={`Player ${i + 1}`}
                    className="flex-1 px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-queue-blue text-sm min-h-[44px]"
                  />
                  {/* Transport toggle */}
                  <button
                    type="button"
                    onClick={() => updateMember(i, { transport: member.transport === 'riding' ? 'walking' : 'riding' })}
                    title={member.transport === 'walking' ? 'Walking — tap to switch to riding' : 'Riding — tap to switch to walking'}
                    className={`min-w-[44px] min-h-[44px] rounded-xl text-lg flex items-center justify-center transition-colors flex-shrink-0 border ${
                      member.transport === 'walking'
                        ? 'bg-green-50 border-green-300 text-green-700'
                        : 'bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {member.transport === 'walking' ? '🚶' : '🛒'}
                  </button>
                  {/* Holes toggle */}
                  <button
                    type="button"
                    onClick={() => updateMember(i, { holes: member.holes === 18 ? 9 : 18 })}
                    title={`${member.holes} holes — tap to switch`}
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

          {showScheduledTime && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Date</label>
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={e => setScheduledDate(e.target.value)}
                  className="w-full px-4 py-3.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-queue-blue focus:border-transparent text-base min-h-[48px]"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Time</label>
                <input
                  type="time"
                  value={scheduledTime}
                  onChange={e => setScheduledTime(e.target.value)}
                  className="w-full px-4 py-3.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-queue-blue focus:border-transparent text-base min-h-[48px]"
                />
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 border border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-colors min-h-[48px] text-base"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || saving}
              className="flex-1 py-3 bg-queue-blue hover:bg-blue-700 text-white font-bold rounded-xl transition-colors min-h-[48px] disabled:opacity-50 text-base"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
