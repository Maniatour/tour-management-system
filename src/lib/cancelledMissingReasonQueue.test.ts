import assert from 'node:assert/strict'
import test from 'node:test'
import {
  orderReservationIdsByLatestCancelTransition,
  type ReservationStatusAuditRow,
} from '@/lib/reservationStatusAudit'

function row(
  recordId: string,
  createdAt: string,
  from: string,
  to: string
): ReservationStatusAuditRow {
  return {
    record_id: recordId,
    created_at: createdAt,
    changed_fields: ['status'],
    old_values: { status: from },
    new_values: { status: to },
  }
}

test('orderReservationIdsByLatestCancelTransition uses cancel-event time, not later edits', () => {
  const ids = orderReservationIdsByLatestCancelTransition([
    row('old-cancel', '2026-08-01T10:00:00.000Z', 'confirmed', 'cancelled'),
    row('recent-cancel', '2026-09-16T12:00:00.000Z', 'pending', 'cancelled'),
    row('price-edit-only', '2026-09-16T18:00:00.000Z', 'cancelled', 'cancelled'),
    row('recent-cancel', '2026-09-16T08:00:00.000Z', 'confirmed', 'pending'),
  ])
  assert.deepEqual(ids, ['recent-cancel', 'old-cancel'])
})

test('orderReservationIdsByLatestCancelTransition ignores recovered then uses later cancel', () => {
  const ids = orderReservationIdsByLatestCancelTransition([
    row('r1', '2026-09-10T10:00:00.000Z', 'confirmed', 'cancelled'),
    row('r1', '2026-09-11T10:00:00.000Z', 'cancelled', 'confirmed'),
    row('r1', '2026-09-15T10:00:00.000Z', 'confirmed', 'canceled'),
  ])
  assert.deepEqual(ids, ['r1'])
})
