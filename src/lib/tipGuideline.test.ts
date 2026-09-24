import assert from 'node:assert/strict'
import test from 'node:test'
import { tipGuideOptions, tourFareUsdForTipGuide } from './tipGuideline'

test('tour fare uses customer total minus prepaid tip', () => {
  assert.equal(
    tourFareUsdForTipGuide({ total_price: 220, prepayment_tip: 20, product_price_total: 180 }),
    200
  )
})

test('tour fare falls back to product price when total is missing', () => {
  assert.equal(tourFareUsdForTipGuide({ total_price: 0, product_price_total: 199 }), 199)
})

test('tip guide is 15, 20, and 25 percent of the tour fare', () => {
  assert.deepEqual(tipGuideOptions(200), [
    { percent: 15, amountUsd: 30 },
    { percent: 20, amountUsd: 40 },
    { percent: 25, amountUsd: 50 },
  ])
})

test('small or missing fares do not invent a guide', () => {
  assert.equal(tourFareUsdForTipGuide(null), null)
  assert.deepEqual(tipGuideOptions(0), [])
})
