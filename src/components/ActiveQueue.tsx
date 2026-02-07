'use client'

import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { GroupData } from '@/lib/types'
import { reorderGroups } from '@/lib/api'
import QueueCard from './QueueCard'

interface ActiveQueueProps {
  groups: GroupData[]
  isPaused: boolean
  onRefetch: () => void
}

export default function ActiveQueue({ groups, isPaused, onRefetch }: ActiveQueueProps) {
  const [isReordering, setIsReordering] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = groups.findIndex(g => g.id === active.id)
    const newIndex = groups.findIndex(g => g.id === over.id)

    if (oldIndex === -1 || newIndex === -1) return

    // Optimistic reorder
    const reordered = [...groups]
    const [moved] = reordered.splice(oldIndex, 1)
    reordered.splice(newIndex, 0, moved)

    setIsReordering(true)
    try {
      await reorderGroups(reordered.map(g => g.id))
      onRefetch()
    } catch {
      onRefetch()
    } finally {
      setIsReordering(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-queue-green px-5 py-3 rounded-t-xl">
        <h2 className="text-white font-bold text-lg">Ready to Play</h2>
        <p className="text-green-100 text-sm">
          {groups.length} group{groups.length !== 1 ? 's' : ''}
        </p>
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
        {groups.length === 0 ? (
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
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={groups.map(g => g.id)}
              strategy={verticalListSortingStrategy}
            >
              {groups.map((group, index) => (
                <QueueCard
                  key={group.id}
                  group={group}
                  index={index}
                  onRefetch={onRefetch}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  )
}
