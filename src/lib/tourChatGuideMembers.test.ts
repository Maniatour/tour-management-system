import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assignedTourStaffEmails,
  canRemoveTourChatGuide,
  isGuideOrDriverTeamPosition,
  planTourChatGuideSync,
} from './tourChatGuideMembers'

test('assignedTourStaffEmails parses comma lists and de-dupes case', () => {
  assert.deepEqual(
    assignedTourStaffEmails('A@x.com, b@x.com', '["B@x.com"]'),
    ['a@x.com', 'b@x.com']
  )
})

test('sync plan adds assigned guides and drops leftover assignment members', () => {
  const plan = planTourChatGuideSync({
    tourGuideId: 'new@x.com',
    assistantId: 'driver@x.com',
    existing: [
      { id: '1', participant_id: 'old@x.com', is_active: true, membership_source: 'assignment' },
      { id: '2', participant_id: 'new@x.com', is_active: false, membership_source: 'assignment' },
      { id: '3', participant_id: 'helper@x.com', is_active: true, membership_source: 'invited' },
    ],
  })

  assert.deepEqual(plan.assignedEmails, ['new@x.com', 'driver@x.com'])
  assert.deepEqual(plan.toInsert, ['driver@x.com'])
  assert.deepEqual(plan.toReactivateIds, ['2'])
  assert.deepEqual(plan.toDeactivateIds, ['1'])
})

test('cannot remove a currently assigned assignment member', () => {
  assert.equal(
    canRemoveTourChatGuide({
      participantEmail: 'guide@x.com',
      membershipSource: 'assignment',
      assignedEmails: ['guide@x.com'],
    }),
    false
  )
  assert.equal(
    canRemoveTourChatGuide({
      participantEmail: 'old@x.com',
      membershipSource: 'assignment',
      assignedEmails: ['guide@x.com'],
    }),
    true
  )
  assert.equal(
    canRemoveTourChatGuide({
      participantEmail: 'guide@x.com',
      membershipSource: 'invited',
      assignedEmails: ['guide@x.com'],
    }),
    true
  )
})

test('guide/driver position matching', () => {
  assert.equal(isGuideOrDriverTeamPosition('Tour Guide'), true)
  assert.equal(isGuideOrDriverTeamPosition('드라이버'), true)
  assert.equal(isGuideOrDriverTeamPosition('office manager'), false)
})
