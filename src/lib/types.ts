export type GroupStatus = 'assembling' | 'queued' | 'playing' | 'completed' | 'cancelled'

export interface MemberData {
  id: string
  name: string
  arrived: boolean
  groupId: string
}

export interface GroupData {
  id: string
  name: string
  partySize: number
  status: GroupStatus
  position: number
  enteredQueueAt: string | null
  assemblingAt: string | null
  teedOffAt: string | null
  scheduledTime: string | null
  scheduledDate: string | null
  scheduledTimeSlot: string | null
  isPreRegistered: boolean
  createdAt: string
  updatedAt: string
  members: MemberData[]
}

export interface QueueSettingsData {
  id: string
  clubName: string
  isPaused: boolean
  pauseReason: string | null
}

export interface DashboardData {
  queued: GroupData[]
  assembling: GroupData[]
  preRegistered: GroupData[]
  settings: QueueSettingsData
  todayStats: {
    totalGroups: number
    completedGroups: number
    averageWaitMinutes: number
    assemblingCount: number
  }
}

export interface CalendarGroup {
  id: string
  name: string
  partySize: number
  members: Array<{ id: string; name: string }>
  scheduledTime: string
}

// { 'YYYY-MM-DD': { 'HH:MM': CalendarGroup[] } }
export type CalendarData = Record<string, Record<string, CalendarGroup[]>>

export interface CalendarResponse {
  calendar: CalendarData
  clubName: string
}
