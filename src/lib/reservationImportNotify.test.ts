import assert from 'node:assert/strict'
import test from 'node:test'
import {
  formatExtractedImportPartyLabel,
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

test('GYG 변경 메일은 관련 알림은 하되 신규 접수 뱃지에서는 제외한다', () => {
  const change = row({
    subject: 'Booking changed - S382661 - GYGN6B2ZHXQM',
    platform_key: 'getyourguide',
    source_email: 'supplier@getyourguide.com',
    extracted_data: { is_booking_change: true, is_booking_confirmed: false },
  })
  assert.equal(isReservationRelatedImportNotifyRow(change), true)
  assert.equal(isBookingReceiptImportNotifyRow(change), false)
  assert.equal(isUnprocessedBookingImportListRow({ ...change, status: 'pending' }), false)
})

test('Viator Amendment Request는 관련 알림은 하되 신규 접수 뱃지에서는 제외한다', () => {
  const change = row({
    subject: 'Please Respond: Amendment Request for Booking: Mon, Oct 12, 2026 (#BR-1330282749)',
    platform_key: 'viator',
    source_email: 'partners@viator.com',
  })
  assert.equal(isReservationRelatedImportNotifyRow(change), true)
  assert.equal(isBookingReceiptImportNotifyRow(change), false)
  assert.equal(isUnprocessedBookingImportListRow({ ...change, status: 'pending' }), false)
})

test('Viator Amended Booking도 신규 접수 뱃지에서 제외한다', () => {
  const change = row({
    subject: 'Amended Booking: Mon, Apr 05, 2027 (#BR-1443337285)',
    platform_key: 'viator',
    source_email: 'partners@viator.com',
  })
  assert.equal(isReservationRelatedImportNotifyRow(change), true)
  assert.equal(isBookingReceiptImportNotifyRow(change), false)
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

test('예약 메일 알림 인원은 이름 뒤에 붙일 문구로 만든다', () => {
  assert.equal(formatExtractedImportPartyLabel({ adults: 4 }), '4명')
  assert.equal(formatExtractedImportPartyLabel({ total_people: 3 }), '3명')
  assert.equal(
    formatExtractedImportPartyLabel({ adults: 2, children: 1 }),
    '성인 2 · 아동 1'
  )
  assert.equal(
    formatExtractedImportPartyLabel({ adults: 1, children: 1, infants: 1 }),
    '성인 1 · 아동 1 · 유아 1'
  )
  assert.equal(formatExtractedImportPartyLabel({}), '')
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
