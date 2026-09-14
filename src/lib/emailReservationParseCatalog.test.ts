import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluateImportAutoConfirmReadiness, getOtaParseProductRules } from '@/lib/emailReservationParseCatalog'

test('Klook 액티비티 매핑 규칙에 가격 필드가 있다', () => {
  const rules = getOtaParseProductRules().filter((r) => r.platform_key === 'klook')
  assert.ok(rules.length >= 4)
  assert.ok(rules.every((r) => r.product_id && r.price.amount && r.price.amount_excluded))
})

test('파싱이 완전하면 자동 추가 자격이 된다', () => {
  const r = evaluateImportAutoConfirmReadiness({
    platformKey: 'klook',
    subject: 'Klook Order Confirmed - 123',
    extracted: {
      is_booking_confirmed: true,
      product_id: 'MDGCSUNRISE',
      tour_date: '2026-10-01',
      adults: 2,
      customer_name: 'Jane Doe',
      amount: '$398',
    },
  })
  assert.equal(r.ready, true)
  assert.equal(r.priceConnected, true)
})

test('금액이 없으면 자동 추가하지 않는다', () => {
  const r = evaluateImportAutoConfirmReadiness({
    platformKey: 'nol',
    subject: '1234 예약이 접수되었습니다',
    extracted: {
      is_booking_confirmed: true,
      product_id: 'MDGCSUNRISE',
      tour_date: '2026-10-01',
      adults: 2,
      customer_name: '홍길동',
    },
  })
  assert.equal(r.ready, false)
  assert.ok(r.missing.includes('missing_price'))
})
