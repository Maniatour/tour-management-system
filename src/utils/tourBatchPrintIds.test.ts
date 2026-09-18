import assert from 'node:assert/strict'
import test from 'node:test'
import { reservationIdsForTourBatchPrint } from './tourUtils'

test('reservationIdsForTourBatchPrint uses assigned reservations and drops cancelled rows', () => {
  assert.deepEqual(
    reservationIdsForTourBatchPrint({
      assignedReservations: [
        { id: 'R1', status: 'confirmed' },
        { id: 'R2', status: 'cancelled' },
        { id: 'R3', status: 'canceled' },
      ],
      tourReservationIds: ['R1', 'R2', 'R3', 'R4'],
    }),
    ['R1']
  )
})

test('reservationIdsForTourBatchPrint falls back to tour ids and drops cancelled when assignment list is empty', () => {
  assert.deepEqual(
    reservationIdsForTourBatchPrint({
      assignedReservations: [],
      tourReservationIds: ['R1', 'R2', 'R3'],
      statusByReservationId: [
        { id: 'R1', status: 'confirmed' },
        { id: 'R2', status: 'cancelled_rebooking' },
        { id: 'R3', status: 'deleted' },
      ],
    }),
    ['R1']
  )
})
