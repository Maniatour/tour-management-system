import assert from 'node:assert/strict'
import test from 'node:test'
import {
  channelIsOtaForPricingSection,
  channelPaymentLooksLikeNotIncludedDoubleSubtract,
  computeChannelSettlementAmount,
  computeOtaChannelPaymentFromDiscountedProduct,
} from '@/utils/channelSettlement'

test('channelIsOtaForPricingSection recognizes Klook by id and name', () => {
  assert.equal(channelIsOtaForPricingSection({ id: 'klook', name: 'Klook' }), true)
  assert.equal(
    channelIsOtaForPricingSection({ id: 'other', name: 'Klook - With Exclusions' }),
    true
  )
  assert.equal(channelIsOtaForPricingSection({ id: 'homepage', name: 'Homepage' }), false)
})

test('OTA channel payment is sale × pax, not sale minus not-included', () => {
  const channelPay = computeOtaChannelPaymentFromDiscountedProduct({
    productPriceTotal: 440,
    couponDiscount: 0,
    additionalDiscount: 0,
  })
  assert.equal(channelPay, 440)

  assert.equal(
    channelPaymentLooksLikeNotIncludedDoubleSubtract({
      storedChannelPayment: 250,
      productPriceTotal: 440,
      notIncludedTotalUsd: 190,
    }),
    true
  )
  assert.equal(
    channelPaymentLooksLikeNotIncludedDoubleSubtract({
      storedChannelPayment: 630,
      productPriceTotal: 440,
      notIncludedTotalUsd: 190,
    }),
    true
  )
  assert.equal(
    channelPaymentLooksLikeNotIncludedDoubleSubtract({
      storedChannelPayment: 440,
      productPriceTotal: 440,
      notIncludedTotalUsd: 190,
    }),
    false
  )
  // 폼 상품가가 불포함을 포함한 $630이어도, 저장된 $440(판매가×인원)은 오산식이 아님
  assert.equal(
    channelPaymentLooksLikeNotIncludedDoubleSubtract({
      storedChannelPayment: 440,
      productPriceTotal: 630,
      notIncludedTotalUsd: 190,
      canonicalSaleTimesPax: 440,
    }),
    false
  )
  assert.equal(
    channelPaymentLooksLikeNotIncludedDoubleSubtract({
      storedChannelPayment: 630,
      productPriceTotal: 630,
      notIncludedTotalUsd: 190,
      canonicalSaleTimesPax: 440,
    }),
    true
  )

  const cardFee = Math.round(440 * (22 / 100) * 100) / 100
  assert.equal(cardFee, 96.8)
  const settlement = computeChannelSettlementAmount({
    depositAmount: 440,
    onlinePaymentAmount: 440,
    productPriceTotal: 440,
    couponDiscount: 0,
    additionalDiscount: 0,
    optionTotalSum: 0,
    additionalCost: 0,
    tax: 0,
    cardFee: 0,
    prepaymentTip: 0,
    onSiteBalanceAmount: 190,
    returnedAmount: 0,
    commissionAmount: cardFee,
    isOTAChannel: true,
  })
  assert.equal(settlement, 343.2)
})
