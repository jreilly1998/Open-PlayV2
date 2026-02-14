'use client'

import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { GroupData } from '@/lib/types'
import { teeOff, unpairGroup } from '@/lib/api'

function formatTime(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const h = d.getHours()
  const m = d.getMinutes().toString().padStart(2, '0')
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${(h % 12 || 12).toString().padStart(2, '0')}:${m} ${ampm}`
}

function getWidthClass(partySize: number): string {
  switch (partySize) {
    case 1: return 'w-2/5 min-w-[200px]'
    case 2: return 'w-1/2'
    case 3: return 'w-3/4'
    default: return 'w-full'
  }
}

function getPartySizeLabel(size: number): string {
  switch (size) {
    case 1: return 'Single'
    case 2: return 'Twosome'
    case 3: return 'Threesome'
    default: return 'Foursome'
  }
}

interface QueueCardProps {
  group: GroupData
  index: number
  onRefetch: () => void
  isOverlay?: boolean
  draggedGroup?: GroupData | null
  isPairTarget?: boolean
  isPairInvalid?: boolean
}

export default function QueueCard({
  group,
  index,
  onRefetch,
  isOverlay,
  draggedGroup,
  isPairTarget,
  isPairInvalid,
}: QueueCardProps) {
  const [teeingOff, setTeeingOff] = useState(false)
  const [unpairing, setUnpairing] = useState(false)

  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: group.id, disabled: isOverlay })

  // Pair drop zone — only active when a compatible group is being dragged
  const canReceivePair = draggedGroup && draggedGroup.id !== group.id && group.partySize < 4
  const { setNodeRef: setPairDropRef, isOver: isPairDropOver } = useDroppable({
    id: `pair-${group.id}`,
    disabled: !canReceivePair,
  })

  const style: React.CSSProperties = isOverlay
    ? { cursor: 'grabbing' }
    : {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
      }

  const isOnTheTee = index === 0
  const isOnDeck = index === 1
  const isInTheHole = index === 2
  const isPaired = !!group.pairedWithGroupId
  const effectivePartySize = group.partySize

  const handleTeeOff = async () => {
    setTeeingOff(true)
    try {
      await teeOff(group.id)
      onRefetch()
    } catch {
      setTeeingOff(false)
    }
  }

  const handleUnpair = async () => {
    console.log('[Unpair] Unpairing group:', {
      id: group.id,
      name: group.name,
      partySize: group.partySize,
      originalPartySize: group.originalPartySize,
      pairedWithGroupId: group.pairedWithGroupId,
      pairedGroupName: group.pairedGroupName,
      pairedGroupSize: group.pairedGroupSize,
    })
    setUnpairing(true)
    try {
      await unpairGroup(group.id)
      console.log('[Unpair] Unpair succeeded for group:', group.id)
      onRefetch()
    } catch (err) {
      console.error('[Unpair] Unpair failed:', err)
      setUnpairing(false)
    }
  }

  const playerIcons = Array.from({ length: effectivePartySize }, (_, i) => {
    // Show original group's players in default color, paired group's in blue
    const isFromPairedGroup = isPaired && group.originalPartySize && i >= group.originalPartySize
    return (
      <svg
        key={i}
        className={`w-5 h-5 ${isFromPairedGroup ? 'text-queue-blue' : 'text-gray-500'}`}
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" />
      </svg>
    )
  })

  // Compute pair drop validity for visual feedback
  const wouldExceed = draggedGroup ? effectivePartySize + draggedGroup.partySize > 4 : false
  const draggedIsAlreadyPaired = !!draggedGroup?.pairedWithGroupId
  const showPairZone = !!draggedGroup && draggedGroup.id !== group.id && !isDragging
  const pairZoneValid = showPairZone && !wouldExceed && effectivePartySize < 4 && !draggedIsAlreadyPaired
  const pairZoneInvalid = showPairZone && (wouldExceed || effectivePartySize >= 4 || draggedIsAlreadyPaired)

  // Combined name display (pairedGroupName may contain " + " for multiple secondaries)
  const displayName = isPaired
    ? `${group.name} + ${group.pairedGroupName}`
    : group.name

  return (
    <div className="flex gap-2 items-stretch" ref={setSortableRef} style={style}>
      {/* Queue card — width based on party size */}
      <div
        className={`
          group-card bg-white rounded-xl border-2 p-4 fade-in min-w-0 flex-shrink-0 transition-all duration-200
          ${getWidthClass(effectivePartySize)}
          ${isOnTheTee ? 'border-queue-green on-deck-pulse shadow-md' : isOnDeck ? 'border-amber-300 shadow-md' : 'border-gray-200'}
          ${isDragging ? 'z-50' : ''}
          ${isOverlay ? 'shadow-2xl ring-2 ring-queue-green/30 rotate-[1deg]' : ''}
          ${teeingOff ? 'opacity-50 scale-95 transition-all duration-300' : ''}
          ${isPairTarget ? 'ring-2 ring-queue-green bg-green-50 border-queue-green' : ''}
          ${isPairInvalid ? 'ring-2 ring-queue-red bg-red-50 border-queue-red' : ''}
        `}
      >
        <div className="flex items-start gap-3">
          {/* Drag handle */}
          <div
            {...attributes}
            {...listeners}
            className="mt-1 cursor-grab active:cursor-grabbing p-1 text-gray-300 hover:text-gray-500 touch-none flex-shrink-0"
          >
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M7 2a2 2 0 10.001 4.001A2 2 0 007 2zm0 6a2 2 0 10.001 4.001A2 2 0 007 8zm0 6a2 2 0 10.001 4.001A2 2 0 007 14zm6-8a2 2 0 10-.001-4.001A2 2 0 0013 6zm0 2a2 2 0 10.001 4.001A2 2 0 0013 8zm0 6a2 2 0 10.001 4.001A2 2 0 0013 14z" />
            </svg>
          </div>

          <div className="flex-1 min-w-0">
            {/* Top row: position, name, badge */}
            <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-2xl sm:text-3xl font-black text-gray-800 flex-shrink-0">#{group.position}</span>
                <h3 className="text-base sm:text-lg font-bold text-gray-900 truncate">{displayName}</h3>
              </div>
              <div className="flex-shrink-0">
                {isOnTheTee && (
                  <span className="px-2 sm:px-3 py-1 bg-queue-green text-white text-xs font-bold rounded-md tracking-wide whitespace-nowrap">
                    ON THE TEE
                  </span>
                )}
                {isOnDeck && (
                  <span className="px-2 sm:px-3 py-1 bg-queue-amber text-white text-xs font-bold rounded-md tracking-wide whitespace-nowrap">
                    ON DECK
                  </span>
                )}
                {isInTheHole && (
                  <span className="px-2 sm:px-3 py-1 bg-gray-500 text-white text-xs font-bold rounded-md tracking-wide whitespace-nowrap">
                    IN THE HOLE
                  </span>
                )}
              </div>
            </div>

            {/* Paired indicator */}
            {isPaired && (
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-queue-blue text-xs font-semibold rounded-full border border-blue-200">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                  </svg>
                  Paired: {group.originalPartySize} + {group.pairedGroupSize} = {effectivePartySize} players
                </span>
                <button
                  onClick={handleUnpair}
                  disabled={unpairing}
                  className="text-xs text-gray-400 hover:text-queue-red font-medium transition-colors disabled:opacity-50"
                >
                  {unpairing ? 'Unpairing...' : 'Unpair'}
                </button>
              </div>
            )}

            {/* Player count and time */}
            <div className="flex items-center gap-3 text-sm text-gray-500 mb-3">
              <div className="flex items-center gap-0.5">
                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M7 8a3 3 0 100-6 3 3 0 000 6zM14.5 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM1.615 16.428a1.224 1.224 0 01-.569-1.175 6.002 6.002 0 0111.908 0c.058.467-.172.92-.57 1.174A9.953 9.953 0 017 18a9.953 9.953 0 01-5.385-1.572zM14.5 16h-.106c.07-.297.088-.611.048-.933a7.47 7.47 0 00-1.588-3.755 4.502 4.502 0 015.874 2.636.818.818 0 01-.36.98A7.465 7.465 0 0114.5 16z" />
                </svg>
                <div className="flex gap-0.5">{playerIcons}</div>
                <span className="ml-1 font-semibold">{effectivePartySize}</span>
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
              {teeingOff ? 'Sending off...' : isPaired ? 'TEE OFF (Both Groups)' : 'TEE OFF'}
            </button>
          </div>
        </div>
      </div>

      {/* Pair drop zone — visible when dragging a compatible group */}
      {showPairZone && effectivePartySize < 4 && (
        <div
          ref={setPairDropRef}
          className={`
            flex-1 min-w-[80px] rounded-xl border-2 border-dashed flex flex-col items-center justify-center
            transition-all duration-200 text-center px-2
            ${pairZoneValid && isPairDropOver
              ? 'border-queue-green bg-green-100 scale-[1.02]'
              : pairZoneValid
              ? 'border-green-300 bg-green-50/50'
              : pairZoneInvalid
              ? 'border-red-300 bg-red-50/50'
              : 'border-gray-300 bg-gray-50/50'
            }
          `}
        >
          {pairZoneValid ? (
            <>
              <svg className={`w-6 h-6 mb-1 ${isPairDropOver ? 'text-queue-green' : 'text-green-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span className={`text-xs font-semibold ${isPairDropOver ? 'text-queue-green' : 'text-green-500'}`}>
                {isPairDropOver && draggedGroup
                  ? `${group.name} (${group.partySize}) + ${draggedGroup.name} (${draggedGroup.partySize}) = ${group.partySize + draggedGroup.partySize}`
                  : 'Drop to pair'}
              </span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5 mb-1 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              <span className="text-xs font-medium text-red-400">
                {effectivePartySize >= 4 ? 'Full' : draggedIsAlreadyPaired ? 'Already paired' : "Can't pair — exceeds 4"}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  )
}
