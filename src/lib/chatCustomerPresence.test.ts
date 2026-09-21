import assert from 'node:assert/strict'
import test from 'node:test'
import {
  chatPresenceIdentityKey,
  chatPresenceSelfKeys,
  countOnlineParticipants,
  customerChatIdentityKey,
  extraOnlineStaff,
  guideChatIdentityKey,
  isChatPresenceSelfKey,
  isStaffPresentInChat,
  isTourChatPresenceTopic,
  tourChatPresenceChannelName,
  upsertCustomerParticipant,
} from './chatCustomerPresence'
import type { Participant } from '@/types/chat'

test('customer identity key is trimmed and lowercased', () => {
  assert.equal(customerChatIdentityKey('  Judy  '), 'judy')
})

test('guide identity key normalizes email case', () => {
  assert.equal(guideChatIdentityKey('  Guide@Kovegas.com '), 'guide@kovegas.com')
})

test('presence channel name is shared across clients', () => {
  assert.equal(tourChatPresenceChannelName('room-1'), 'chat_presence_room-1')
  assert.equal(isTourChatPresenceTopic('realtime:chat_presence_room-1', 'room-1'), true)
  assert.equal(isTourChatPresenceTopic('chat_presence_room-1_171000', 'room-1'), false)
})

test('countOnlineParticipants only counts currently present people', () => {
  const people: Participant[] = [
    { id: '1', name: 'A', type: 'customer', lastSeen: new Date(), online: true },
    { id: '2', name: 'B', type: 'customer', lastSeen: new Date(), online: false },
    { id: '3', name: 'C', type: 'guide', lastSeen: new Date() },
  ]
  assert.equal(countOnlineParticipants(people), 1)
})

test('upsertCustomerParticipant keeps a joined guest even when offline', () => {
  const map = new Map<string, Participant>()
  upsertCustomerParticipant(map, 'Mina')
  upsertCustomerParticipant(map, 'MINA', { online: true })
  assert.equal(map.size, 1)
  assert.equal(map.get('mina')?.online, true)
  upsertCustomerParticipant(map, 'Mina', { online: false })
  assert.equal(map.get('mina')?.online, false)
  assert.equal(map.get('mina')?.name, 'Mina')
})

test('guide presence key uses email so viewing staff match member rows', () => {
  assert.equal(
    chatPresenceIdentityKey({
      userId: 'Guide@X.com',
      userName: 'Mina',
      userType: 'guide',
      userEmail: 'Guide@X.com',
    }),
    'guide@x.com'
  )
  assert.equal(
    chatPresenceIdentityKey({
      userId: 'Judy',
      userName: 'Judy',
      userType: 'customer',
    }),
    'judy'
  )
})

test('staff presence matches assigned guide email regardless of case', () => {
  const people: Participant[] = [
    {
      id: 'guide@x.com',
      name: 'Mina',
      type: 'guide',
      email: 'Guide@X.com',
      lastSeen: new Date(),
      online: true,
    },
  ]
  assert.equal(isStaffPresentInChat(people, 'GUIDE@x.com'), true)
  assert.equal(isStaffPresentInChat(people, 'other@x.com'), false)
  people[0]!.online = false
  assert.equal(isStaffPresentInChat(people, 'guide@x.com'), false)
})

test('extra online staff excludes already listed members', () => {
  const people: Participant[] = [
    {
      id: 'guide@x.com',
      name: 'Assigned',
      type: 'guide',
      email: 'guide@x.com',
      lastSeen: new Date(),
      online: true,
    },
    {
      id: 'admin@x.com',
      name: 'Admin',
      type: 'guide',
      email: 'admin@x.com',
      lastSeen: new Date(),
      online: true,
    },
  ]
  const extras = extraOnlineStaff(people, ['GUIDE@x.com'])
  assert.equal(extras.length, 1)
  assert.equal(extras[0]?.email, 'admin@x.com')
})

test('self presence keys cover the viewing guide email', () => {
  const keys = chatPresenceSelfKeys({
    userId: 'Guide@X.com',
    userName: 'Mina',
    isPublicView: false,
    guideEmail: 'Guide@X.com',
  })
  assert.deepEqual(keys, ['guide@x.com'])
  assert.equal(
    isChatPresenceSelfKey('GUIDE@x.com', {
      userId: 'Guide@X.com',
      userName: 'Mina',
      isPublicView: false,
      guideEmail: 'Guide@X.com',
    }),
    true
  )
})
