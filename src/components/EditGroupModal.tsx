'use client'

import { useState, useEffect } from 'react'
import { editGroup } from '@/lib/api'

interface EditGroupModalProps {
  group: {
    id: string
    name: string
    partySize: number
    members: Array<{ id: string; name: string }>
    scheduledTime?: string | null
  }
  showScheduledTime?: boolean
  onClose: () => void
  onSaved: () => void
}

function formatTimeSlot(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`
}

export default function EditGroupModal({ group, showScheduledTime, onClose, onSaved }: EditGroupModalProps) {
  const [name, setName] = useState(group.name)
  const [partySize, setPartySize] = useState(group.partySize)
  const [memberNames, setMemberNames] = useState(
    group.members.map(m => m.name).join(', ')
  )
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (showScheduledTime && group.scheduledTime) {
      // scheduledTime is stored as UTC representing conceptual local time
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setSaving(true)
    setError('')
    try {
      const data: Parameters<typeof editGroup>[1] = {
        name: name.trim(),
        partySize,
        memberNames: memberNames.trim() || undefined,
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

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Member Names <span className="text-gray-400 font-normal">(comma-separated)</span>
            </label>
            <input
              type="text"
              value={memberNames}
              onChange={e => setMemberNames(e.target.value)}
              placeholder="Separate with commas"
              className="w-full px-4 py-3.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-queue-blue focus:border-transparent text-base min-h-[48px]"
            />
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
