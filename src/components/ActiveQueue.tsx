'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  rectIntersection,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverlay,
  CollisionDetection,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { GroupData } from '@/lib/types'
import { reorderGroups, pairGroups } from '@/lib/api'
import QueueCard from './QueueCard'

interface ActiveQueueProps {
  groups: GroupData[]
  isPaused: boolean
  onRefetch: () => void
}

export default function ActiveQueue({ groups, isPaused, onRefetch }: ActiveQueueProps) {
  const [localGroups, setLocalGroups] = useState(groups)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [isReordering, setIsReordering] = useState(false)
  const [isPairing, setIsPairing] = useState(false)
  const isReorderingRef = useRef(false)

  // Sync local state with server data, but not while a reorder is in flight
  useEffect(() => {
    if (!isReorderingRef.current) {
      setLocalGroups(groups)
    }
  }, [groups])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Custom collision detection: prioritize pair drop zones over sortable items
  const collisionDetection: CollisionDetection = useCallback((args) => {
    // First check if we're over any pair drop zone
    const pairContainers = args.droppableContainers.filter(
      container => String(container.id).startsWith('pair-')
    )
    if (pairContainers.length > 0) {
      const pairCollisions = rectIntersection({
        ...args,
        droppableContainers: pairContainers,
      })
      if (pairCollisions.length > 0) {
        return pairCollisions
      }
    }

    // Fall back to closestCenter for sortable reordering
    return closestCenter(args)
  }, [])

  const handleDragStart = (event: DragStartEvent) => {
    const dragId = String(event.active.id)
    const dragGroup = localGroups.find(g => g.id === dragId)
    console.log('[DragDrop] Drag started:', {
      groupId: dragId,
      name: dragGroup?.name,
      partySize: dragGroup?.partySize,
      isPaired: !!dragGroup?.pairedWithGroupId,
    })
    setActiveId(dragId)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over) {
      console.log('[DragDrop] Drag cancelled — no drop target')
      return
    }

    const overId = String(over.id)
    console.log('[DragDrop] Dropped on:', overId)

    // Check if dropped on a pair zone
    if (overId.startsWith('pair-')) {
      const targetGroupId = overId.replace('pair-', '')
      const draggedGroup = localGroups.find(g => g.id === active.id)
      const targetGroup = localGroups.find(g => g.id === targetGroupId)

      console.log('[DragDrop] Pair attempt:', {
        dragged: draggedGroup ? { id: draggedGroup.id, name: draggedGroup.name, partySize: draggedGroup.partySize, isPaired: !!draggedGroup.pairedWithGroupId } : null,
        target: targetGroup ? { id: targetGroup.id, name: targetGroup.name, partySize: targetGroup.partySize, isPaired: !!targetGroup.pairedWithGroupId } : null,
        combinedSize: (draggedGroup?.partySize || 0) + (targetGroup?.partySize || 0),
      })

      if (!draggedGroup || !targetGroup) {
        console.warn('[DragDrop] Pair aborted — group not found')
        return
      }
      if (draggedGroup.partySize + targetGroup.partySize > 4) {
        console.warn('[DragDrop] Pair aborted — would exceed 4 players:', draggedGroup.partySize, '+', targetGroup.partySize)
        return
      }

      // Perform pairing — target is primary (keeps position), dragged is secondary
      setIsPairing(true)
      try {
        console.log('[DragDrop] Calling pairGroups API:', { primaryId: targetGroup.id, secondaryId: draggedGroup.id })
        await pairGroups(targetGroup.id, draggedGroup.id)
        console.log('[DragDrop] Pair succeeded!')
        onRefetch()
      } catch (err) {
        console.error('[DragDrop] Pairing failed:', err)
      } finally {
        setIsPairing(false)
      }
      return
    }

    // Standard reorder logic
    if (active.id === over.id) return

    const oldIndex = localGroups.findIndex(g => g.id === active.id)
    const newIndex = localGroups.findIndex(g => g.id === over.id)

    if (oldIndex === -1 || newIndex === -1) return

    // Optimistic local reorder — prevents snap-back
    const reordered = arrayMove(localGroups, oldIndex, newIndex)
    setLocalGroups(reordered)

    setIsReordering(true)
    isReorderingRef.current = true
    try {
      await reorderGroups(reordered.map(g => g.id))
    } catch {
      // Revert on failure
      setLocalGroups(groups)
    } finally {
      setIsReordering(false)
      isReorderingRef.current = false
      onRefetch()
    }
  }

  const handleDragCancel = () => {
    setActiveId(null)
  }

  const activeGroup = activeId ? localGroups.find(g => g.id === activeId) : null
  const activeIndex = activeId ? localGroups.findIndex(g => g.id === activeId) : -1

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-queue-green px-5 py-3 rounded-t-xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-white font-bold text-lg">Queue</h2>
            <p className="text-green-100 text-sm">
              {localGroups.length} group{localGroups.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {activeGroup && (
              <span className="text-green-100 text-xs font-medium">
                Drag onto a group to pair, or between groups to reorder
              </span>
            )}
            {(isReordering || isPairing) && (
              <span className="text-green-100 text-xs font-medium animate-pulse">
                {isPairing ? 'Pairing...' : 'Saving...'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Pause overlay */}
      {isPaused && (
        <div className="bg-red-50 border-b border-red-200 px-5 py-3 text-center">
          <span className="text-queue-red font-bold text-sm tracking-wide">
            QUEUE PAUSED
          </span>
        </div>
      )}

      {/* Queue list */}
      <div className="flex-1 overflow-y-auto queue-scroll bg-gray-50 p-4 space-y-3 rounded-b-xl">
        {localGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 py-12">
            <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <p className="font-medium text-base">No groups ready</p>
            <p className="text-sm mt-1">Add groups from Quick Add or check in pre-registrations</p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={collisionDetection}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <SortableContext
              items={localGroups.map(g => g.id)}
              strategy={verticalListSortingStrategy}
            >
              {localGroups.map((group, index) => (
                <QueueCard
                  key={group.id}
                  group={group}
                  index={index}
                  onRefetch={onRefetch}
                  draggedGroup={activeGroup || null}
                />
              ))}
            </SortableContext>
            <DragOverlay dropAnimation={null}>
              {activeGroup ? (
                <QueueCard
                  group={activeGroup}
                  index={activeIndex}
                  onRefetch={onRefetch}
                  isOverlay
                />
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>
    </div>
  )
}
