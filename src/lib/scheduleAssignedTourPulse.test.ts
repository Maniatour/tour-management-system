import assert from 'node:assert/strict'
import test from 'node:test'
import {
  collectTourConfirmationPulseIssues,
  scheduleAssignedTourPulseAlertLine,
  scheduleTourConfirmationPulseWindowEnd,
} from './scheduleAssignedTourPulse'

test('confirmation pulse window is today plus 6 more days', () => {
  assert.equal(scheduleTourConfirmationPulseWindowEnd('2026-09-16'), '2026-09-22')
})

test('collects missing dispatch, assignment, and tour status inside the window', () => {
  const issues = collectTourConfirmationPulseIssues({
    tourDate: '2026-09-18',
    tourStatus: 'recruiting',
    assignmentStatus: 'assigned',
    tourCarId: null,
    assignedPeople: 6,
    today: '2026-09-16',
    tourStatusLabel: '모집중',
    assignmentStatusLabel: '부여',
  })
  assert.deepEqual(
    issues.map((issue) => issue.kind),
    ['missing_dispatch', 'unconfirmed_assignment', 'unconfirmed_tour'],
  )
  assert.equal(scheduleAssignedTourPulseAlertLine(issues[0], 'ko'), '배차 미확정 · 미배차')
  assert.equal(scheduleAssignedTourPulseAlertLine(issues[1], 'ko'), '배정 미확정 · 부여')
  assert.equal(scheduleAssignedTourPulseAlertLine(issues[2], 'ko'), '상태 미확정 · 모집중')
})

test('skips confirmed tours with a vehicle and confirmed assignment', () => {
  const issues = collectTourConfirmationPulseIssues({
    tourDate: '2026-09-16',
    tourStatus: 'confirmed',
    assignmentStatus: 'confirmed',
    tourCarId: 'car-1',
    assignedPeople: 8,
    today: '2026-09-16',
  })
  assert.equal(issues.length, 0)
})

test('skips empty, cancelled, past, and far-future tours', () => {
  const base = {
    tourStatus: 'recruiting',
    assignmentStatus: 'pending',
    tourCarId: null,
    today: '2026-09-16',
  }
  assert.equal(
    collectTourConfirmationPulseIssues({ ...base, tourDate: '2026-09-16', assignedPeople: 0 }).length,
    0,
  )
  assert.equal(
    collectTourConfirmationPulseIssues({
      ...base,
      tourDate: '2026-09-16',
      assignedPeople: 4,
      tourStatus: 'cancelled',
    }).length,
    0,
  )
  assert.equal(
    collectTourConfirmationPulseIssues({ ...base, tourDate: '2026-09-15', assignedPeople: 4 }).length,
    0,
  )
  assert.equal(
    collectTourConfirmationPulseIssues({ ...base, tourDate: '2026-09-23', assignedPeople: 4 }).length,
    0,
  )
})
