'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { DashboardData, CalendarResponse } from './types'

export function useDashboard(pollInterval = 3000) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [connectionStatus, setConnectionStatus] = useState<'live' | 'reconnecting' | 'offline'>('live')
  const retryCountRef = useRef(0)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to fetch')
      const json = await res.json()
      setData(json)
      setLastUpdated(new Date())
      setConnectionStatus('live')
      setError(null)
      retryCountRef.current = 0
    } catch (e) {
      retryCountRef.current++
      if (retryCountRef.current > 3) {
        setConnectionStatus('offline')
        setError('Connection lost')
      } else {
        setConnectionStatus('reconnecting')
      }
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, pollInterval)
    return () => clearInterval(interval)
  }, [fetchData, pollInterval])

  return { data, error, lastUpdated, connectionStatus, refetch: fetchData }
}

export function useCalendar(pollInterval = 10000) {
  const [data, setData] = useState<CalendarResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const retryCountRef = useRef(0)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/calendar', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to fetch')
      const json = await res.json()
      setData(json)
      setError(null)
      retryCountRef.current = 0
    } catch {
      retryCountRef.current++
      if (retryCountRef.current > 3) {
        setError('Connection lost')
      }
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, pollInterval)
    return () => clearInterval(interval)
  }, [fetchData, pollInterval])

  return { data, error, refetch: fetchData }
}

export function useCurrentTime() {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  return time
}
