import assert from 'node:assert/strict'
import test from 'node:test'
import {
  countOnlineParticipants,
  customerChatIdentityKey,
  upsertCustomerParticipant,
} from './chatCustomerPresence'
import type { Participant } from '@/types/chat'

test('customer identity key is trimmed and lowercased', () => {
  assert.equal(customerChatIdentityKey('  Judy  '), 'judy')
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
