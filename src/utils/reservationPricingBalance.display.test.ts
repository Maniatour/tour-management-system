import assert from 'node:assert/strict'
import test from 'node:test'
import { getBalanceAmountForDisplay, getStoredReservationPricingAmounts } from '@/utils/reservationPricingBalance'

const party = { adults: 1, children: 0, infants: 0 }
const depositRecord = { payment_status: 'Deposit Received', amount: 349 }

test('card balance keeps stored $100 even when live calculation would differ', () => {
  const amount = getBalanceAmountForDisplay(
    {
      total_price: 449,
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

test('card balance uses stored $0 instead of recomputing a non-resident fee', () => {
  const amount = getBalanceAmountForDisplay(
    {
      total_price: 349,
      product_price_total: 349,
      deposit_amount: 349,
      balance_amount: 0,
    },
    null,
    party,
    { paymentRecords: [depositRecord], residentFeeUsd: 100 }
  )
  assert.equal(amount, 0)
})

test('stored pricing helper returns DB total, deposit, and balance', () => {
  const stored = getStoredReservationPricingAmounts({
    total_price: 449.5,
    deposit_amount: 349,
    balance_amount: 100.5,
  })
  assert.equal(stored.totalPrice, 449.5)
  assert.equal(stored.depositAmount, 349)
  assert.equal(stored.balanceAmount, 100.5)
})

test('cancelled reservations show $0 stored balance', () => {
  const stored = getStoredReservationPricingAmounts(
    { total_price: 449, deposit_amount: 349, balance_amount: 100 },
    { reservationStatus: 'cancelled' }
  )
  assert.equal(stored.balanceAmount, 0)
})
