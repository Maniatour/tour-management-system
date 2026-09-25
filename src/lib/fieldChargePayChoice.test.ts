import assert from 'node:assert/strict'
import test from 'node:test'
import {
  canPayFieldBalance,
  fieldBalanceCardCharge,
  fieldCheckoutSettlesInvoice,
  isFieldChargeInvoiceItems,
  resolveFieldCheckout,
} from '@/lib/fieldChargePayChoice'

test('현장 잔금 청구만 선택 화면 대상이다', () => {
  assert.equal(isFieldChargeInvoiceItems([{ fieldCharge: true, itemType: 'product' }]), true)
  assert.equal(isFieldChargeInvoiceItems([{ fieldCharge: true, openAmount: true }]), false)
  assert.equal(isFieldChargeInvoiceItems([{ itemType: 'tip_open_amount' }]), false)
  assert.equal(isFieldChargeInvoiceItems([{ fieldCharge: false }]), false)
})

test('잔금 카드 청구액에 5% 수수료를 더한다', () => {
  assert.deepEqual(fieldBalanceCardCharge(100), {
    balanceUsd: 100,
    cardFeeUsd: 5,
    cardChargeUsd: 105,
  })
  assert.deepEqual(fieldBalanceCardCharge(0), {
    balanceUsd: 0,
    cardFeeUsd: 0,
    cardChargeUsd: 0,
  })
})

test('잔금이 없거나 이미 결제된 청구서는 잔금을 다시 받지 않는다', () => {
  assert.equal(canPayFieldBalance({ invoicePaid: false, balanceUsd: 40, currency: 'USD' }), true)
  assert.equal(canPayFieldBalance({ invoicePaid: true, balanceUsd: 40, currency: 'USD' }), false)
  assert.equal(canPayFieldBalance({ invoicePaid: false, balanceUsd: 0, currency: 'USD' }), false)
  assert.equal(canPayFieldBalance({ invoicePaid: false, balanceUsd: 40, currency: 'KRW' }), false)
})

test('팁만 결제는 잔금 청구를 닫지 않는다', () => {
  const tip = resolveFieldCheckout({
    mode: 'tip',
    invoicePaid: false,
    balanceUsd: 80,
    currency: 'USD',
    tipUsd: 20,
  })
  assert.equal(tip.ok, true)
  if (tip.ok) {
    assert.equal(tip.plan.invoiceAmountUsd, 0)
    assert.equal(tip.plan.tipUsd, 20)
    assert.equal(tip.plan.retireHostedInvoice, false)
  }
  assert.equal(fieldCheckoutSettlesInvoice('tip'), false)

  const settled = resolveFieldCheckout({
    mode: 'tip',
    invoicePaid: false,
    balanceUsd: 0,
    currency: 'USD',
    tipUsd: 15,
  })
  assert.equal(settled.ok, true)
  if (settled.ok) assert.equal(settled.plan.retireHostedInvoice, true)
})

test('잔금과 함께 결제는 카드 수수료 포함 잔금에 팁을 더한다', () => {
  const both = resolveFieldCheckout({
    mode: 'both',
    invoicePaid: false,
    balanceUsd: 100,
    currency: 'USD',
    tipUsd: 20,
  })
  assert.equal(both.ok, true)
  if (both.ok) {
    assert.equal(both.plan.invoiceAmountUsd, 105)
    assert.equal(both.plan.tipUsd, 20)
    assert.equal(both.plan.cardFeeUsd, 5)
  }
  assert.equal(fieldCheckoutSettlesInvoice('both'), true)

  const balanceOnly = resolveFieldCheckout({
    mode: 'balance',
    invoicePaid: false,
    balanceUsd: 100,
    currency: 'USD',
    tipUsd: 20,
  })
  assert.equal(balanceOnly.ok, true)
  if (balanceOnly.ok) assert.equal(balanceOnly.plan.tipUsd, 0)

  const noBalance = resolveFieldCheckout({
    mode: 'balance',
    invoicePaid: false,
    balanceUsd: 0,
    currency: 'USD',
    tipUsd: 0,
  })
  assert.deepEqual(noBalance, { ok: false, reason: 'balance_settled' })
})
