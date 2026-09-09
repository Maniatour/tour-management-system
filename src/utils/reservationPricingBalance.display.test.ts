import assert from 'node:assert/strict'
import test from 'node:test'
import { getBalanceAmountForDisplay } from '@/utils/reservationPricingBalance'

const party = { adults: 1, children: 0, infants: 0 }
const depositRecord = { payment_status: 'Deposit Received', amount: 349 }

test('card balance keeps stored $100 when computed missed the non-resident fee', () => {
  const amount = getBalanceAmountForDisplay(
    {
      product_price_total: 349,
      deposit_amount: 349,
      balance_amount: 100,
    },
    null,
    party,
    { paymentRecords: [depositRecord], residentFeeUsd: 0 }
  )
  assert.equal(amount, 100)
})

test('card balance uses computed non-resident fee when DB balance is still 0', () => {
  const amount = getBalanceAmountForDisplay(
    {
      product_price_total: 349,
      deposit_amount: 349,
      balance_amount: 0,
    },
    null,
    party,
    { paymentRecords: [depositRecord], residentFeeUsd: 100 }
  )
  assert.equal(amount, 100)
})
