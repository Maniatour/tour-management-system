import assert from 'node:assert/strict'
import test from 'node:test'
import { isCancelledTicketBookingForPrint } from '@/lib/ticketBookingStatus'

test('isCancelledTicketBookingForPrint hides cancelled tickets only', () => {
  assert.equal(isCancelledTicketBookingForPrint({ status: 'cancelled' }), true)
  assert.equal(isCancelledTicketBookingForPrint({ status: 'canceled' }), true)
  assert.equal(isCancelledTicketBookingForPrint({ booking_status: 'weather_cancelled' }), true)
  assert.equal(isCancelledTicketBookingForPrint({ status: 'confirmed' }), false)
  assert.equal(isCancelledTicketBookingForPrint({ status: 'cancellation_requested' }), false)
  assert.equal(isCancelledTicketBookingForPrint({ status: 'credit' }), false)
  assert.equal(isCancelledTicketBookingForPrint({}), false)
})
