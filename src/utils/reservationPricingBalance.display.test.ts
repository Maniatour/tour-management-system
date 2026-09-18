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

test('잔금 수령 입금이 있으면 저장 잔액 $100이 아니라 미수 $0을 보여준다', () => {
  const amount = getBalanceAmountForDisplay(
    {
      total_price: 449,
      product_price_total: 349,
      deposit_amount: 349,
      balance_amount: 100,
    },
    null,
    party,
    {
      paymentRecords: [
        { payment_status: 'Deposit Received', amount: 349 },
        { payment_status: 'Balance Received', amount: 100 },
      ],
    }
  )
  assert.equal(amount, 0)
})

test('GYG 잔금 수령 $210이 있으면 저장 잔액 $210이 아니라 미수 $0을 보여준다', () => {
  const amount = getBalanceAmountForDisplay(
    {
      total_price: 908.88,
      product_price_total: 768,
      coupon_discount: 69.12,
      card_fee: 10,
      additional_cost: 200,
      deposit_amount: 698.88,
      balance_amount: 210,
    },
    null,
    { adults: 2, children: 0, infants: 0 },
    {
      paymentRecords: [
        { payment_status: 'Deposit Received', amount: 698.88 },
        { payment_status: 'Balance Received', amount: 210 },
      ],
    }
  )
  assert.equal(amount, 0)
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
