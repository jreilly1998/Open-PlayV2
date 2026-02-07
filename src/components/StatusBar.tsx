'use client'

import Link from 'next/link'

interface StatusBarProps {
  lastUpdated: Date
  connectionStatus: 'live' | 'reconnecting' | 'offline'
  completedGroups: number
  onRetry?: () => void
}

function timeSince(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 5) return '0 sec ago'
  if (seconds < 60) return `${seconds} sec ago`
  return `${Math.floor(seconds / 60)} min ago`
}

export default function StatusBar({ lastUpdated, connectionStatus, completedGroups, onRetry }: StatusBarProps) {
  const statusColor = {
    live: 'bg-green-500',
    reconnecting: 'bg-yellow-500',
    offline: 'bg-red-500',
  }

  const statusLabel = {
    live: 'Live',
    reconnecting: 'Reconnecting...',
    offline: 'Offline',
  }

  return (
    <footer className="bg-white border-t border-gray-200 px-6 py-2.5 flex items-center justify-between text-sm">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${statusColor[connectionStatus]} ${connectionStatus === 'reconnecting' ? 'animate-pulse' : ''}`} />
          <span className="text-gray-600 font-medium">
            {statusLabel[connectionStatus]} &middot; Updated {timeSince(lastUpdated)}
          </span>
        </div>
        {connectionStatus === 'offline' && onRetry && (
          <button
            onClick={onRetry}
            className="text-queue-blue hover:text-blue-800 font-medium underline"
          >
            Retry
          </button>
        )}
      </div>

      <Link
        href="/history"
        className="text-queue-blue hover:text-blue-800 font-medium hover:underline"
      >
        View Today&apos;s History
      </Link>

      <div className="text-gray-600 font-medium">
        Total Groups Served Today: {completedGroups}
      </div>
    </footer>
  )
}
