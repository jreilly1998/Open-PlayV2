// Client-side API helpers

export async function createGroup(data: {
  name: string
  partySize: number
  memberNames?: string
  allPresent?: boolean
  scheduledTime?: string
  isPreRegistered?: boolean
}) {
  const res = await fetch('/api/groups', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Failed to create group')
  }
  return res.json()
}

export async function teeOff(groupId: string) {
  const res = await fetch(`/api/groups/${groupId}/tee-off`, { method: 'POST' })
  if (!res.ok) throw new Error('Failed to tee off')
  return res.json()
}

export async function moveToQueue(groupId: string) {
  const res = await fetch(`/api/groups/${groupId}/move-to-queue`, { method: 'POST' })
  if (!res.ok) throw new Error('Failed to move to queue')
  return res.json()
}

export async function checkInGroup(groupId: string) {
  const res = await fetch(`/api/groups/${groupId}/check-in`, { method: 'POST' })
  if (!res.ok) throw new Error('Failed to check in')
  return res.json()
}

export async function toggleMember(memberId: string) {
  const res = await fetch(`/api/members/${memberId}/toggle`, { method: 'POST' })
  if (!res.ok) throw new Error('Failed to toggle member')
  return res.json()
}

export async function removeGroup(groupId: string) {
  const res = await fetch(`/api/groups/${groupId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to remove group')
  return res.json()
}

export async function reorderGroups(orderedIds: string[]) {
  const res = await fetch('/api/groups/reorder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderedIds }),
  })
  if (!res.ok) throw new Error('Failed to reorder')
  return res.json()
}

export async function updateSettings(data: {
  isPaused?: boolean
  pauseReason?: string | null
  clubName?: string
}) {
  const res = await fetch('/api/settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update settings')
  return res.json()
}
