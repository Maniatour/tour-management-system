import assert from 'node:assert/strict'
import test from 'node:test'
import {
  calculateCouponDiscountAmount,
  computeProductPriceTotal,
  resolveCouponDiscountBase,
} from './productPriceTotal'

test('단일가 OTA 상품 가격 합계는 단가×인원이며 불포함을 더하지 않는다', () => {
  const total = computeProductPriceTotal({
    isSinglePrice: true,
    adultProductPrice: 364,
    childProductPrice: 364,
    infantProductPrice: 364,
    pricingAdults: 2,
    reservationAdults: 2,
    child: 0,
    infant: 0,
  })
  assert.equal(total, 728)
})

test('GYG 9% 쿠폰 기준은 단가×인원($728)이지 불포함을 뺀 $384가 아니다', () => {
  const base = resolveCouponDiscountBase({
    isSinglePrice: true,
    isOta: true,
    adultProductPrice: 364,
    childProductPrice: 364,
    infantProductPrice: 364,
    pricingAdults: 2,
    reservationAdults: 2,
    child: 0,
    infant: 0,
  })
  assert.equal(base, 728)
  assert.equal(
    calculateCouponDiscountAmount(
      { discount_type: 'percentage', percentage_value: 9 },
      base
    ),
    65.52
  )
})

test('비 OTA 쿠폰 기준은 판매가×인원 + 필수옵션 (불포함 제외)', () => {
  const base = resolveCouponDiscountBase({
    isSinglePrice: false,
    isOta: false,
    adultProductPrice: 100,
    childProductPrice: 80,
    infantProductPrice: 0,
    pricingAdults: 2,
    reservationAdults: 2,
    child: 1,
    infant: 0,
    requiredOptionTotal: 20,
  })
  assert.equal(base, 100 * 2 + 80 * 1 + 20)
})
