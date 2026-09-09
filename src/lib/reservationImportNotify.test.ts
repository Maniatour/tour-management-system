import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isBookingReceiptImportNotifyRow,
  isReservationRelatedImportNotifyRow,
  isReservationImportWithinRecentDays,
  isUnprocessedBookingImportListRow,
  type ReservationImportNotifyRow,
} from '@/lib/reservationImportNotify'

function row(partial: Partial<ReservationImportNotifyRow>): ReservationImportNotifyRow {
  return {
    id: 'imp-1',
    subject: null,
    platform_key: null,
    received_at: null,
    created_at: null,
    ...partial,
  }
}

test('예약 접수 메일은 사이드바 뱃지 대상이다', () => {
  assert.equal(
    isBookingReceiptImportNotifyRow(row({ extracted_data: { is_booking_confirmed: true } })),
    true
  )
  assert.equal(
    isBookingReceiptImportNotifyRow(row({ subject: '[KKday] 예약번호：123 주문이 접수되었습니다' })),
    true
  )
})

test('취소 메일은 예약 접수 뱃지에서 제외한다', () => {
  const cancel = row({ subject: 'Booking cancelled - ABC123' })
  assert.equal(isReservationRelatedImportNotifyRow(cancel), true)
  assert.equal(isBookingReceiptImportNotifyRow(cancel), false)
})

test('Zelle·ATM 메일은 예약 접수 뱃지에서 제외한다', () => {
  assert.equal(isBookingReceiptImportNotifyRow(row({ platform_key: 'zelle' })), false)
  assert.equal(isBookingReceiptImportNotifyRow(row({ platform_key: 'wells-fargo-atm' })), false)
})

test('이미 예약이 있으면 미처리 뱃지에서 제외한다', () => {
  const booking = row({ extracted_data: { is_booking_confirmed: true } })
  assert.equal(isUnprocessedBookingImportListRow({ ...booking, status: 'pending' }), true)
  assert.equal(
    isUnprocessedBookingImportListRow({
      ...booking,
      status: 'pending',
      reservation_exists_by_channel_rn: true,
    }),
    false
  )
  assert.equal(
    isUnprocessedBookingImportListRow({
      ...booking,
      status: 'pending',
      reservation_exists_by_customer_match: true,
    }),
    false
  )
  assert.equal(isUnprocessedBookingImportListRow({ ...booking, status: 'confirmed' }), false)
  assert.equal(isUnprocessedBookingImportListRow({ ...booking, status: 'pending', reservation_id: 'r1' }), false)
})

test('최근 3일 이내 수신 메일만 뱃지에 포함한다', () => {
  const now = Date.parse('2026-09-08T12:00:00.000Z')
  assert.equal(
    isReservationImportWithinRecentDays('2026-09-07T10:00:00.000Z', null, 3, now),
    true
  )
  assert.equal(
    isReservationImportWithinRecentDays('2026-09-04T11:59:00.000Z', null, 3, now),
    false
  )
  assert.equal(
    isReservationImportWithinRecentDays(null, '2026-09-06T12:00:00.000Z', 3, now),
    true
  )
  assert.equal(isReservationImportWithinRecentDays(null, null, 3, now), false)
})
