import assert from 'node:assert/strict'
import test from 'node:test'
import { extractReservationFromEmail } from '@/lib/emailReservationParser'
import {
  findBookingTimeChoicePricing,
  toOtaAndNotIncluded,
} from '@/lib/bookingTimeChoicePricing'
import { pickImportDynamicPricingOta, resolveOtaFromChoicesPricing } from '@/lib/importReservationPriceResolve'

test('Klook 상품 설명의 연간패스 $250은 불포함 금액이 아니다', () => {
  const { extracted_data } = extractReservationFromEmail({
    subject: 'Klook Order Received - Grand Canyon Sunrise',
    sourceEmail: 'noreply@klook.com',
    text: `
Booking reference ID: VGP999001
Date Request: 2026-04-10
Lead participant: ()Jane Doe
No. of participants: 2
Total amount: $398.00
Package: Lower Antelope Canyon
Not included:
- Grand Canyon National Park annual pass ($250)
- Meals
`,
  })
  assert.equal(extracted_data.amount_excluded, undefined)
  assert.equal(extracted_data.channel_variant_key, 'all_inclusive')
})

test('Klook Amount not included 칸의 $95만 불포함 금액으로 인정한다', () => {
  const { extracted_data } = extractReservationFromEmail({
    subject: 'Klook Order Received - Grand Canyon Sunrise',
    sourceEmail: 'noreply@klook.com',
    text: `
Booking reference ID: VGP999002
Date Request: 2026-04-10
Lead participant: ()Jane Doe
No. of participants: 2
Total amount: $220.00
Amount not included: $95
Package: Lower Antelope Canyon
`,
  })
  assert.equal(extracted_data.amount_excluded, '$95')
  assert.equal(extracted_data.channel_variant_key, 'with_exclusions')
})

test('판매가가 같은 초이스 조합에서 패스구매 불포함 $250을 쓰지 않는다', () => {
  const choicesPricing = {
    'canyon+lower+resident+us': { ota_sale_price: 199, not_included_price: 0 },
    'canyon+lower+resident+pass': { ota_sale_price: 199, not_included_price: 250 },
    'canyon+lower+resident+non': { ota_sale_price: 199, not_included_price: 100 },
  }
  const resolved = resolveOtaFromChoicesPricing(choicesPricing, [])
  assert.ok(resolved)
  assert.equal(resolved.ota_sale_price, 199)
  assert.equal(resolved.not_included_price, undefined)
})

test('예약 시점 초이스만 있으면 패스구매 조합의 $250 불포함을 고르지 않는다', () => {
  const choicesPricing = {
    'canyon+lower': { ota_sale_price: 199, not_included_price: 0 },
    'canyon+lower+resident+pass': { ota_sale_price: 199, not_included_price: 250 },
  }
  const match = findBookingTimeChoicePricing('canyon+lower', choicesPricing)
  const catalog = toOtaAndNotIncluded(match)
  assert.equal(match?.matchedKey, 'canyon+lower')
  assert.equal(catalog?.ota_sale_price, 199)
  assert.equal(catalog?.not_included_price, undefined)
})

test('올인클루시브 행의 행단위 불포함 $250을 초이스 매칭 결과로 덮지 않는다', () => {
  const picked = pickImportDynamicPricingOta({
    rows: [
      {
        variant_key: 'all_inclusive',
        adult_price: 199,
        not_included_price: 250,
        choices_pricing: {
          'canyon+lower': { ota_sale_price: 199, not_included_price: 0 },
        },
      },
    ],
    selectedChoices: [{ choice_id: 'canyon', option_id: 'lower' }],
    preferredVariantKey: 'all_inclusive',
    emailUnit: 199,
  })
  assert.ok(picked)
  assert.equal(picked.ota, 199)
  assert.equal(picked.notIncluded, 0)
})
