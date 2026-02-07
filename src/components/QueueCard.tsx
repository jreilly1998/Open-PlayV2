'use client'

import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GroupData } from '@/lib/types'
import { teeOff } from '@/lib/api'

function formatTime(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const h = d.getHours()
  const m = d.getMinutes().toString().padStart(2, '0')
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${(h % 12 || 12).toString().padStart(2, '0')}:${m} ${ampm}`
}

interface QueueCardProps {
  group: GroupData
  index: number
  onRefetch: () => void
}

export default function QueueCard({ group, index, onRefetch }: QueueCardProps) {
  const [teeingOff, setTeeingOff] = useState(false)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: group.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const isOnDeck = index === 0
  const isInTheHole = index === 1

  const handleTeeOff = async () => {
    setTeeingOff(true)
    try {
      await teeOff(group.id)
      onRefetch()
    } catch {
      setTeeingOff(false)
    }
  }

  const playerIcons = Array.from({ length: group.partySize }, (_, i) => (
    <svg key={i} className="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
      <path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" />
    </svg>
  ))

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        group-card bg-white rounded-xl border-2 p-4 fade-in
        ${isOnDeck ? 'border-queue-green on-deck-pulse shadow-md' : 'border-gray-200'}
        ${isDragging ? 'shadow-2xl z-50' : ''}
        ${teeingOff ? 'opacity-50 scale-95 transition-all duration-300' : ''}
      `}
    >
      <div className="flex items-start gap-3">
        {/* Drag handle */}
        <div
          {...attributes}
          {...listeners}
          className="mt-1 cursor-grab active:cursor-grabbing p-1 text-gray-300 hover:text-gray-500 touch-none"
        >
          <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M7 2a2 2 0 10.001 4.001A2 2 0 007 2zm0 6a2 2 0 10.001 4.001A2 2 0 007 8zm0 6a2 2 0 10.001 4.001A2 2 0 007 14zm6-8a2 2 0 10-.001-4.001A2 2 0 0013 6zm0 2a2 2 0 10.001 4.001A2 2 0 0013 8zm0 6a2 2 0 10.001 4.001A2 2 0 0013 14z" />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          {/* Top row: position, name, badge */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-3">
              <span className="text-3xl font-black text-gray-800">#{group.position}</span>
              <h3 className="text-lg font-bold text-gray-900 truncate">{group.name}</h3>
            </div>
            {isOnDeck && (
              <span className="px-3 py-1 bg-queue-green text-white text-xs font-bold rounded-md tracking-wide">
                ON DECK
              </span>
            )}
            {isInTheHole && (
              <span className="px-3 py-1 bg-queue-green/80 text-white text-xs font-bold rounded-md tracking-wide">
                IN THE HOLE
              </span>
            )}
          </div>

          {/* Player count and time */}
          <div className="flex items-center gap-3 text-sm text-gray-500 mb-3">
            <div className="flex items-center gap-0.5">
              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path d="M7 8a3 3 0 100-6 3 3 0 000 6zM14.5 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM1.615 16.428a1.224 1.224 0 01-.569-1.175 6.002 6.002 0 0111.908 0c.058.467-.172.92-.57 1.174A9.953 9.953 0 017 18a9.953 9.953 0 01-5.385-1.572zM14.5 16h-.106c.07-.297.088-.611.048-.933a7.47 7.47 0 00-1.588-3.755 4.502 4.502 0 015.874 2.636.818.818 0 01-.36.98A7.465 7.465 0 0114.5 16z" />
              </svg>
              <div className="flex gap-0.5">{playerIcons}</div>
              <span className="ml-1 font-semibold">{group.partySize}</span>
            </div>
            <span className="text-gray-400">|</span>
            <span>Entered: {formatTime(group.enteredQueueAt)}</span>
          </div>

          {/* Tee Off button */}
          <button
            onClick={handleTeeOff}
            disabled={teeingOff}
            className="w-full py-3.5 bg-queue-green hover:bg-green-700 active:bg-green-800 text-white font-bold text-base rounded-lg transition-colors min-h-[48px] disabled:opacity-50"
          >
            {teeingOff ? 'Sending off...' : 'TEE OFF'}
          </button>
        </div>
      </div>
    </div>
  )
}
