import type { Participant } from '@/types/chat'

export function customerChatIdentityKey(name: string | null | undefined): string {
  return String(name ?? '').trim().toLowerCase()
}

export function isPresentInChat(participant: Pick<Participant, 'online'>): boolean {
  return participant.online === true
}

export function countOnlineParticipants(participants: Iterable<Pick<Participant, 'online'>>): number {
  let count = 0
  for (const participant of participants) {
    if (isPresentInChat(participant)) count += 1
  }
  return count
}

export function upsertCustomerParticipant(
  map: Map<string, Participant>,
  name: string,
  extras?: Partial<Pick<Participant, 'id' | 'online' | 'lastSeen'>>
): void {
  const trimmed = name.trim()
  if (!trimmed) return
  const key = customerChatIdentityKey(trimmed)
  if (!key) return
  const existing = map.get(key)
  const next: Participant = {
    id: extras?.id || existing?.id || trimmed,
    name: existing?.name || trimmed,
    type: 'customer',
    lastSeen: extras?.lastSeen || existing?.lastSeen || new Date(),
    online: extras?.online ?? existing?.online ?? false,
  }
  map.set(key, next)
}
