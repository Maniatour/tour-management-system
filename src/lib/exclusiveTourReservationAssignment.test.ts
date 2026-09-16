import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyExclusiveReservationOwnership,
  coalesceRelatedReservationsOntoOneTour,
  collectSamePartyReservationIds,
  ensureUniqueReservationIdsAcrossTours,
} from '@/lib/exclusiveTourReservationAssignment'

test('applyExclusiveReservationOwnership strips the same reservation from sibling tours', () => {
  const next = applyExclusiveReservationOwnership(
    [
      { id: 'tour-a', reservation_ids: ['res-1', 'res-2'] },
      { id: 'tour-b', reservation_ids: ['res-1', 'res-3'] },
    ],
    'tour-a',
    ['res-1']
  )
  assert.deepEqual(next.find((row) => row.id === 'tour-a')?.reservation_ids, ['res-2', 'res-1'])
  assert.deepEqual(next.find((row) => row.id === 'tour-b')?.reservation_ids, ['res-3'])
})

test('collectSamePartyReservationIds keeps same customer bookings on the same product and date', () => {
  const ids = collectSamePartyReservationIds({
    seedIds: ['res-1'],
    seedRows: [
      {
        id: 'res-1',
        customer_id: 'cust-1',
        product_id: 'prod-1',
        tour_date: '2026-09-15',
        status: 'confirmed',
      },
    ],
    guestRows: [{ reservation_id: 'res-1', customer_id: 'cust-1' }],
    customerReservations: [
      {
        id: 'res-2',
        customer_id: 'cust-1',
        product_id: 'prod-1',
        tour_date: '2026-09-15',
        status: 'confirmed',
      },
      {
        id: 'res-other-day',
        customer_id: 'cust-1',
        product_id: 'prod-1',
        tour_date: '2026-09-16',
        status: 'confirmed',
      },
    ],
    guestReservationRows: [],
  })
  assert.deepEqual(ids.sort(), ['res-1', 'res-2'])
})

test('coalesceRelatedReservationsOntoOneTour moves split customer bookings onto one team', () => {
  const next = coalesceRelatedReservationsOntoOneTour(
    [
      { id: 'tour-a', reservation_ids: ['res-1'] },
      { id: 'tour-b', reservation_ids: ['res-2'] },
    ],
    [
      { id: 'res-1', customer_id: 'cust-1' },
      { id: 'res-2', customer_id: 'cust-1' },
    ]
  )
  const tourA = next.find((row) => row.id === 'tour-a')?.reservation_ids ?? []
  const tourB = next.find((row) => row.id === 'tour-b')?.reservation_ids ?? []
  assert.equal(tourA.includes('res-1') && tourA.includes('res-2'), true)
  assert.equal(tourB.length, 0)
})

test('ensureUniqueReservationIdsAcrossTours keeps a reservation on the first tour only', () => {
  const next = ensureUniqueReservationIdsAcrossTours([
    { id: 'tour-a', reservation_ids: ['res-1', 'res-2'] },
    { id: 'tour-b', reservation_ids: ['res-1', 'res-3'] },
  ])
  assert.deepEqual(next.find((row) => row.id === 'tour-a')?.reservation_ids, ['res-1', 'res-2'])
  assert.deepEqual(next.find((row) => row.id === 'tour-b')?.reservation_ids, ['res-3'])
})
