import type { Participant } from '@/types/chat'

export type ChatPresencePayload = {
  userId?: string
  userName?: string
  userType?: string
  userEmail?: string
}

export function customerChatIdentityKey(name: string | null | undefined): string {
  return String(name ?? '').trim().toLowerCase()
}

export function guideChatIdentityKey(value: string | null | undefined): string {
  return String(value ?? '').trim().toLowerCase()
}

export function tourChatPresenceChannelName(roomId: string): string {
  return `chat_presence_${roomId}`
}

export function isTourChatPresenceTopic(topic: string | null | undefined, roomId: string): boolean {
  const name = tourChatPresenceChannelName(roomId)
  const value = String(topic ?? '')
  return value === name || value === `realtime:${name}` || value.endsWith(`:${name}`)
}

export function chatPresenceIdentityKey(presence: ChatPresencePayload): string {
  const isCustomer =
    presence.userType === 'customer' ||
    (!presence.userType && !presence.userEmail && Boolean(presence.userName || presence.userId))
  if (isCustomer) {
    return customerChatIdentityKey(presence.userName || presence.userId)
  }
  return guideChatIdentityKey(presence.userEmail || presence.userId || presence.userName)
}

export function chatPresenceSelfKeys(args: {
  userId: string
  userName: string
  isPublicView: boolean
  guideEmail?: string
}): string[] {
  if (args.isPublicView) {
    return uniqueKeys([
      customerChatIdentityKey(args.userName),
      customerChatIdentityKey(args.userId),
    ])
  }
  return uniqueKeys([
    guideChatIdentityKey(args.guideEmail),
    guideChatIdentityKey(args.userId),
  ])
}

export function isChatPresenceSelfKey(
  key: string,
  args: {
    userId: string
    userName: string
    isPublicView: boolean
    guideEmail?: string
  }
): boolean {
  if (!key) return false
  const self = new Set(chatPresenceSelfKeys(args))
  if (self.has(key)) return true
  const normalized = args.isPublicView ? customerChatIdentityKey(key) : guideChatIdentityKey(key)
  return Boolean(normalized) && self.has(normalized)
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

export function isStaffPresentInChat(
  participants: Iterable<Pick<Participant, 'id' | 'email' | 'type' | 'online'>>,
  staffEmail: string | null | undefined
): boolean {
  const email = guideChatIdentityKey(staffEmail)
  if (!email) return false
  for (const participant of participants) {
    if (participant.type === 'customer') continue
    if (!isPresentInChat(participant)) continue
    if (guideChatIdentityKey(participant.email) === email) return true
    if (guideChatIdentityKey(participant.id) === email) return true
  }
  return false
}

export function extraOnlineStaff(
  participants: Iterable<Participant>,
  memberEmails: Iterable<string>
): Participant[] {
  const assigned = new Set(
    Array.from(memberEmails, (email) => guideChatIdentityKey(email)).filter(Boolean)
  )
  const extras: Participant[] = []
  const seen = new Set<string>()
  for (const participant of participants) {
    if (participant.type === 'customer') continue
    if (!isPresentInChat(participant)) continue
    const email = guideChatIdentityKey(participant.email || participant.id)
    if (!email || assigned.has(email) || seen.has(email)) continue
    seen.add(email)
    extras.push(participant)
  }
  return extras
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

function uniqueKeys(keys: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const key of keys) {
    const value = String(key ?? '').trim()
    if (!value || seen.has(value)) continue
    seen.add(value)
    out.push(value)
  }
  return out
}
