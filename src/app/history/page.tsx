'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { GroupData } from '@/lib/types'

function formatTime(dateStr: string | null): string {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  const h = d.getHours()
  const m = d.getMinutes().toString().padStart(2, '0')
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${(h % 12 || 12).toString().padStart(2, '0')}:${m} ${ampm}`
}

function waitTime(entered: string | null, teedOff: string | null): string {
  if (!entered || !teedOff) return '-'
  const diff = new Date(teedOff).getTime() - new Date(entered).getTime()
  const mins = Math.round(diff / 60000)
  return `${mins} min`
}

export default function HistoryPage() {
  const [groups, setGroups] = useState<GroupData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/history')
      .then(res => res.json())
      .then(data => {
        setGroups(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const completed = groups.filter(g => g.status === 'completed')
  const cancelled = groups.filter(g => g.status === 'cancelled')

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <Link
            href="/staff"
            className="text-queue-blue hover:text-blue-800 font-medium flex items-center gap-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </Link>
          <h1 className="text-xl font-bold text-gray-800">Today&apos;s History</h1>
        </div>
        <div className="text-sm text-gray-500">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-6">
        {loading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-4 border-queue-green border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-500">Loading history...</p>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <p className="text-sm text-gray-500">Groups Played</p>
                <p className="text-3xl font-bold text-gray-900">{completed.length}</p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <p className="text-sm text-gray-500">Total Players</p>
                <p className="text-3xl font-bold text-gray-900">
                  {completed.reduce((sum, g) => sum + g.partySize, 0)}
                </p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <p className="text-sm text-gray-500">Cancelled</p>
                <p className="text-3xl font-bold text-gray-900">{cancelled.length}</p>
              </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-5 py-3 text-sm font-semibold text-gray-600">Group</th>
                    <th className="text-left px-5 py-3 text-sm font-semibold text-gray-600">Size</th>
                    <th className="text-left px-5 py-3 text-sm font-semibold text-gray-600">Entered Queue</th>
                    <th className="text-left px-5 py-3 text-sm font-semibold text-gray-600">Teed Off</th>
                    <th className="text-left px-5 py-3 text-sm font-semibold text-gray-600">Wait Time</th>
                    <th className="text-left px-5 py-3 text-sm font-semibold text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {groups.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-gray-400">
                        No groups served today yet
                      </td>
                    </tr>
                  ) : (
                    groups.map(group => (
                      <tr key={group.id} className="hover:bg-gray-50">
                        <td className="px-5 py-3">
                          <div className="font-medium text-gray-900">{group.name}</div>
                          <div className="text-xs text-gray-400">
                            {group.members.map(m => m.name).join(', ')}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-gray-600">{group.partySize}</td>
                        <td className="px-5 py-3 text-gray-600">{formatTime(group.enteredQueueAt)}</td>
                        <td className="px-5 py-3 text-gray-600">{formatTime(group.teedOffAt)}</td>
                        <td className="px-5 py-3 text-gray-600">{waitTime(group.enteredQueueAt, group.teedOffAt)}</td>
                        <td className="px-5 py-3">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${
                            group.status === 'completed'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {group.status === 'completed' ? 'PLAYED' : 'CANCELLED'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
