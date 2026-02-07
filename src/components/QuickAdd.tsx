'use client'

import { useState } from 'react'
import { createGroup } from '@/lib/api'

interface QuickAddProps {
  onRefetch: () => void
}

export default function QuickAdd({ onRefetch }: QuickAddProps) {
  const [expanded, setExpanded] = useState(true)
  const [name, setName] = useState('')
  const [partySize, setPartySize] = useState(4)
  const [memberNames, setMemberNames] = useState('')
  const [allPresent, setAllPresent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setSubmitting(true)
    try {
      await createGroup({
        name: name.trim(),
        partySize,
        memberNames: memberNames.trim() || undefined,
        allPresent,
      })
      setName('')
      setMemberNames('')
      setAllPresent(false)
      setPartySize(4)
      onRefetch()
    } catch (err) {
      console.error('Failed to add group:', err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-xl overflow-hidden border border-gray-600">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full bg-gray-700 px-5 py-3 flex items-center justify-between"
      >
        <h2 className="text-white font-bold text-lg">Quick Add</h2>
        <svg
          className={`w-5 h-5 text-white transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="bg-gray-800 p-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Group Name */}
            <div>
              <label className="block text-sm font-semibold text-green-400 mb-1.5">
                Group Name
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g., Johnson Foursome"
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-queue-blue focus:border-transparent min-h-[44px]"
              />
            </div>

            {/* Party Size */}
            <div>
              <label className="block text-sm font-semibold text-green-400 mb-1.5">
                Party Size
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 3, 4].map(size => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setPartySize(size)}
                    className={`
                      py-3 rounded-lg font-bold text-lg transition-colors min-h-[44px]
                      ${partySize === size
                        ? 'bg-queue-blue text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }
                    `}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* Member Names */}
            <div>
              <label className="block text-sm font-semibold text-green-400 mb-1.5">
                Member Names <span className="text-gray-500 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={memberNames}
                onChange={e => setMemberNames(e.target.value)}
                placeholder="Separate with commas"
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-queue-blue focus:border-transparent min-h-[44px]"
              />
            </div>

            {/* All Present Checkbox */}
            <label className="flex items-center gap-3 cursor-pointer py-1">
              <input
                type="checkbox"
                checked={allPresent}
                onChange={e => setAllPresent(e.target.checked)}
                className="w-5 h-5 rounded border-gray-500 bg-gray-700 text-queue-blue focus:ring-queue-blue focus:ring-offset-0"
              />
              <span className="text-gray-300 text-sm font-medium">
                All members present (skip assembling, go to queue)
              </span>
            </label>

            {/* Submit */}
            <button
              type="submit"
              disabled={!name.trim() || submitting}
              className="w-full py-3.5 bg-queue-green hover:bg-green-700 active:bg-green-800 text-white font-bold text-base rounded-lg transition-colors min-h-[48px] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {allPresent ? 'ADD TO QUEUE' : 'ADD TO ASSEMBLING'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
