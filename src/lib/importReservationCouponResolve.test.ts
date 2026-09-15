import assert from 'node:assert/strict'
import test from 'node:test'
import {
  calculateImportCouponDiscount,
  findCouponToMatchEmailAmount,
  findViatorNinePercentCoupon,
  importCouponDiscountSubtotal,
} from '@/lib/importReservationCouponResolve'

const GYG = { id: 'Partner5', name: 'GetYourGuide', type: 'ota', category: 'OTA' }
const VIATOR = { id: 'Partner6', name: 'Viator', type: 'ota', category: 'OTA' }

const coupons = [
  {
    coupon_code: 'GYG5',
    discount_type: 'percentage',
    percentage_value: 5,
    channel_id: 'Partner5',
    product_id: null,
    status: 'active',
    start_date: '2020-01-01',
    end_date: '2026-12-31',
  },
  {
    coupon_code: 'GYG9',
    discount_type: 'percentage',
    percentage_value: 9,
    channel_id: 'Partner5',
    product_id: null,
    status: 'active',
    start_date: '2020-01-01',
    end_date: '2026-12-31',
  },
  {
    coupon_code: 'GYG10',
    discount_type: 'percentage',
    percentage_value: 10,
    channel_id: 'Partner5',
    product_id: null,
    status: 'active',
    start_date: '2020-01-01',
    end_date: '2026-12-31',
  },
]

test('GYG 이메일 금액이 9% 할인이면 GYG9을 역산한다', () => {
  const matched = findCouponToMatchEmailAmount({
    emailTarget: 349.44,
    couponBase: 384,
    coupons,
    channelId: 'Partner5',
    productId: 'MDGCSUNRISE',
    tourDate: '2026-09-15',
    channels: [GYG],
  })
  assert.equal(matched?.couponCode, 'GYG9')
  assert.equal(Number(matched?.couponDiscount.toFixed(2)), 34.56)
})

test('판매가와 이메일 금액이 같으면 쿠폰을 넣지 않는다', () => {
  const matched = findCouponToMatchEmailAmount({
    emailTarget: 768,
    couponBase: 768,
    coupons,
    channelId: 'Partner5',
    productId: 'MDGCSUNRISE',
    tourDate: '2026-10-30',
    channels: [GYG],
  })
  assert.equal(matched, null)
})

test('다른 채널 쿠폰은 쓰지 않는다', () => {
  const matched = findCouponToMatchEmailAmount({
    emailTarget: 349.44,
    couponBase: 384,
    coupons,
    channelId: 'Partner6',
    productId: 'MDGCSUNRISE',
    tourDate: '2026-09-15',
    channels: [GYG, VIATOR],
  })
  assert.equal(matched, null)
})

test('Viator 9% 쿠폰을 채널·기간 필터 후 찾는다', () => {
  const matched = findViatorNinePercentCoupon({
    couponBase: 349.44,
    coupons: [
      ...coupons,
      {
        coupon_code: 'VIATOR9',
        discount_type: 'percentage',
        percentage_value: 9,
        channel_id: 'Partner6',
        product_id: null,
        status: 'active',
        start_date: '2020-01-01',
        end_date: '2026-12-31',
      },
    ],
    channelId: 'Partner6',
    productId: 'MDGCSUNRISE',
    tourDate: '2026-10-20',
    channels: [GYG, VIATOR],
  })
  assert.equal(matched?.couponCode, 'VIATOR9')
  assert.equal(Number(matched?.couponDiscount.toFixed(2)), 31.45)
})

test('OTA 쿠폰 기준 금액은 상품가에서 불포함을 뺀다', () => {
  const base = importCouponDiscountSubtotal({
    productPriceTotal: 722,
    notIncludedPerPerson: 0,
    pricingAdults: 2,
    reservationAdults: 2,
    child: 0,
    infant: 0,
    channel: GYG,
  })
  assert.equal(base, 722)
  assert.equal(Number(calculateImportCouponDiscount(coupons[1], 722).toFixed(2)), 64.98)
})
