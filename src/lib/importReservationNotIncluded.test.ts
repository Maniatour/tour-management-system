import assert from 'node:assert/strict'
import test from 'node:test'
import { extractReservationFromEmail } from '@/lib/emailReservationParser'
import {
  findBookingTimeChoicePricing,
  restrictChoicesPricingToCatalogCombinations,
  toOtaAndNotIncluded,
  usesBookingTimeChoiceCatalog,
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
  assert.deepEqual(extracted_data.import_choice_option_names, ['Lower Antelope Canyon'])
})

test('Klook Package Antelope Canyon X는 엑스 앤텔롭으로 파싱한다', () => {
  const { extracted_data } = extractReservationFromEmail({
    subject: 'Klook has confirmed an order for Grand Canyon Sunrise, Antelope Canyon and Horseshoe Highlights Tour',
    sourceEmail: 'noreply@klook.com',
    text: `
Hey there Wooyong Shim,
Klook has confirmed an order for Grand Canyon Sunrise, Antelope Canyon and Horseshoe Highlights Tour - Antelope Canyon X and issued a voucher to the participant. See order details below for your record.

Grand Canyon Sunrise, Antelope Canyon and Horseshoe Highlights Tour
Package:   Antelope Canyon X

Booking reference ID: SNS713484
Date Request: 2026-09-10
Time Request: NA
Lead participant: ()Cholticha Trakulsirichoke
Country/region of passport: United States
Lead person email: jao6344jun@gmail.com
Lead person mobile: 1-6177333553
Participant: 1 x Person
Activity URL: https://www.klook.com/en-US/activity/113386
`,
  })
  assert.deepEqual(extracted_data.import_choice_option_names, [
    'X Antelope Canyon',
    'Antelope X Canyon',
  ])
  assert.equal(extracted_data.product_id, 'MDGCSUNRISE')
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

test('홈페이지 포함 모든 채널은 예약 시점 초이스 카탈로그를 쓴다', () => {
  assert.equal(usesBookingTimeChoiceCatalog('M00001'), true)
  assert.equal(usesBookingTimeChoiceCatalog('homepage'), true)
  assert.equal(usesBookingTimeChoiceCatalog('KLOOK'), true)
})

test('초이스 가격 저장 시 거주자 조합 키를 로어/엑스 키로만 남긴다', () => {
  const restricted = restrictChoicesPricingToCatalogCombinations(
    {
      'canyon+lower+resident+us': { ota_sale_price: 199, not_included_price: 0 },
      'canyon+lower+resident+non': { ota_sale_price: 199, not_included_price: 100 },
      'canyon+x+resident+us': { ota_sale_price: 219, not_included_price: 0 },
    },
    [
      { id: 'canyon+lower', combination_key: 'canyon+lower' },
      { id: 'canyon+x', combination_key: 'canyon+x' },
    ]
  )
  assert.deepEqual(Object.keys(restricted).sort(), ['canyon+lower', 'canyon+x'])
  assert.equal(restricted['canyon+lower']?.ota_sale_price, 199)
  assert.equal(restricted['canyon+x']?.ota_sale_price, 219)
})
