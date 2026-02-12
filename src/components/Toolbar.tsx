'use client'

import { useCurrentTime } from '@/lib/hooks'
import { updateSettings } from '@/lib/api'
import { QueueSettingsData } from '@/lib/types'

function formatTime(date: Date) {
  const h = date.getHours()
  const m = date.getMinutes().toString().padStart(2, '0')
  const s = date.getSeconds().toString().padStart(2, '0')
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return { time: `${hour.toString().padStart(2, '0')}:${m}:${s}`, ampm }
}

interface ToolbarProps {
  settings: QueueSettingsData
  totalGroups: number
  averageWaitMinutes: number
  spikeWaitMinutes: number
  assemblingCount: number
  onRefetch: () => void
}

export default function Toolbar({
  settings,
  totalGroups,
  averageWaitMinutes,
  spikeWaitMinutes,
  assemblingCount,
  onRefetch,
}: ToolbarProps) {
  const currentTime = useCurrentTime()
  const { time, ampm } = formatTime(currentTime)

  const handlePauseToggle = async () => {
    await updateSettings({
      isPaused: !settings.isPaused,
      pauseReason: settings.isPaused ? null : 'Paused',
    })
    onRefetch()
  }

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-6">
        <h1 className="text-lg font-bold text-gray-800 tracking-tight">
          {settings.clubName}
        </h1>
        <div className="flex items-baseline gap-1.5 font-mono">
          <span className="text-3xl font-bold tracking-tight text-gray-900">{time}</span>
          <span className="text-lg font-semibold text-gray-500 ml-1">{ampm}</span>
        </div>
      </div>

      <div className="flex items-center gap-8 text-sm text-gray-600">
        <span className="font-medium">{totalGroups} groups today</span>
        <span className="font-medium">
          Est. wait: {spikeWaitMinutes > 0
            ? `${averageWaitMinutes}\u2013${averageWaitMinutes + spikeWaitMinutes} min`
            : `~${averageWaitMinutes} min`}
        </span>
        <span className="font-medium">{assemblingCount} assembling</span>

        <button
          onClick={handlePauseToggle}
          className={`
            px-5 py-2.5 rounded-lg font-bold text-sm tracking-wide transition-colors
            min-h-[44px] min-w-[160px]
            ${settings.isPaused
              ? 'bg-queue-green text-white hover:bg-green-700'
              : 'border-2 border-queue-red text-queue-red hover:bg-red-50'
            }
          `}
        >
          {settings.isPaused ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
              </svg>
              RESUME QUEUE
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M5.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75A.75.75 0 007.25 3h-1.5zM12.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75a.75.75 0 00-.75-.75h-1.5z" />
              </svg>
              PAUSE QUEUE
            </span>
          )}
        </button>

        <button
          className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          title="Settings"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>
    </header>
  )
}
