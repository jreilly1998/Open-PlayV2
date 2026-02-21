// Client-side API helpers

type MemberInput = { name: string; transport?: 'walking' | 'riding'; holes?: 9 | 18 }
type MemberInputWithId = MemberInput & { id?: string }

export async function createGroup(data: {
  name: string
  partySize: number
  members?: MemberInput[]
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

export async function updateMemberField(memberId: string, field: 'transport' | 'holes', value: string | number) {
  const res = await fetch(`/api/members/${memberId}/update-field`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ field, value }),
  })
  if (!res.ok) throw new Error('Failed to update member field')
  return res.json()
}

export async function editGroup(groupId: string, data: {
  name?: string
  partySize?: number
  members?: MemberInputWithId[]
  memberNames?: string
  scheduledTime?: string | null
}) {
  const res = await fetch(`/api/groups/${groupId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Failed to edit group')
  }
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

export async function pairGroups(primaryGroupId: string, secondaryGroupId: string) {
  const res = await fetch('/api/groups/pair', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ primaryGroupId, secondaryGroupId }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Failed to pair groups')
  }
  return res.json()
}

export async function unpairGroup(groupId: string) {
  const res = await fetch('/api/groups/unpair', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ groupId }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Failed to unpair group')
  }
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
