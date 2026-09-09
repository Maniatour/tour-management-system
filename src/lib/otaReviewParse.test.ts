import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isKlookTableText,
  parseOtaReviewText,
  validateParsedOtaRows,
} from '@/lib/otaReviewParse'

const WRAPPED_KLOOK_ROW = [
  'ZEP463420',
  'ラスベガス発 グランドキャニオン＆アンテロープキャニオン少人数グループツアー',
  'ラスベガス グランドキャニオン＆アンテロープキャニオン少人数グループツアー',
  '2026-09-07 00:00:00',
  '2026-09-08 06:54:44',
  '',
].join('\t')

const WRAPPED_KLOOK_COMMENT =
  'This tour was incredibly satisfying. We were able to efficiently visit all the main spots in the Grand Canyon! Both of our guides were very kind, and it was reassuring to have a guide who spoke Japanese. Thank you for a wonderful experience!'

test('Klook 표에서 별점·리뷰가 다음 줄로 줄바꿈돼도 파싱한다', () => {
  const text = `${WRAPPED_KLOOK_ROW}\n5\n${WRAPPED_KLOOK_COMMENT}\t`
  assert.equal(isKlookTableText(text), true)

  const rows = parseOtaReviewText(text, 'klook')
  assert.equal(rows.length, 1)

  const row = rows[0]
  assert.equal(row?.reservationNumber, 'ZEP463420')
  assert.equal(row?.rating, 5)
  assert.equal(row?.comment, WRAPPED_KLOOK_COMMENT)
  assert.equal(row?.tourDate, '2026-09-07')
  assert.equal(row?.productHint?.includes('アンテロープ'), true)
  assert.equal(row?.reviewCreatedAt != null, true)

  const { valid, invalid } = validateParsedOtaRows(rows)
  assert.equal(valid.length, 1)
  assert.equal(invalid.length, 0)
})

test('Klook 한 줄 표(예약번호·날짜·별점·리뷰)는 기존처럼 파싱한다', () => {
  const text = ['VGP123456', '2026-08-01 12:00:00', '5', 'Great tour!'].join('\t')
  const rows = parseOtaReviewText(text, 'klook')
  assert.equal(rows.length, 1)
  assert.equal(rows[0]?.reservationNumber, 'VGP123456')
  assert.equal(rows[0]?.rating, 5)
  assert.equal(rows[0]?.comment, 'Great tour!')
})

test('Klook 별점 다음 줄 리뷰가 여러 줄이어도 본문에 이어붙인다', () => {
  const text =
    ['ZEP111222', '2026-09-01 00:00:00', '2026-09-02 09:10:11', '5'].join('\t') +
    '\nFirst sentence.\nSecond sentence!'
  const rows = parseOtaReviewText(text, 'klook')
  assert.equal(rows[0]?.rating, 5)
  assert.equal(rows[0]?.comment, 'First sentence.\nSecond sentence!')
})

test('Klook 헤더가 있고 별점·리뷰가 다음 줄로 내려가도 파싱한다', () => {
  const header = [
    'Booking reference ID',
    'Activity',
    'Package',
    'Participation date',
    'Reviewed date',
    'Stars',
    'Reviews',
  ].join('\t')
  const text = `${header}\n${WRAPPED_KLOOK_ROW}\n5\n${WRAPPED_KLOOK_COMMENT}`
  const rows = parseOtaReviewText(text, 'klook')
  assert.equal(rows.length, 1)
  assert.equal(rows[0]?.reservationNumber, 'ZEP463420')
  assert.equal(rows[0]?.rating, 5)
  assert.equal(rows[0]?.comment, WRAPPED_KLOOK_COMMENT)
})
