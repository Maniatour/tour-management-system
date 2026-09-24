import assert from 'node:assert/strict'
import test from 'node:test'
import {
  customerPaymentNotifyKindFromMessage,
  FIELD_CHARGE_PAYMENT_NOTIFY_MARKER,
  formatPaymentBreakdownLine,
  parsePaymentBreakdownFromMessage,
} from '@/lib/customerPaymentNotifyKind'
import {
  fieldChargePaymentIntentId,
  isFieldChargeInvoiceItems,
  isFieldChargeOfficePushRecipient,
  isFieldChargePaidNotifyInvoice,
} from '@/lib/fieldChargePaidNotify'

test('isFieldChargeInvoiceItems requires the fieldCharge item marker', () => {
  assert.equal(isFieldChargeInvoiceItems(null), false)
  assert.equal(isFieldChargeInvoiceItems([{ reservationId: 'R1' }]), false)
  assert.equal(isFieldChargeInvoiceItems([{ fieldCharge: true, reservationId: 'R1' }]), true)
})

test('isFieldChargePaidNotifyInvoice requires quick-payment notes and the marker', () => {
  assert.equal(
    isFieldChargePaidNotifyInvoice({
      notes: 'quick_payment_request',
      items: [{ reservationId: 'R1' }],
    }),
    false
  )
  assert.equal(
    isFieldChargePaidNotifyInvoice({
      notes: 'quick_payment_request',
      items: [{ fieldCharge: true, reservationId: 'R1' }],
    }),
    true
  )
})

test('isFieldChargeOfficePushRecipient matches op, office manager, and super', () => {
  assert.equal(
    isFieldChargeOfficePushRecipient({ email: 'op@example.com', position: 'op' }),
    true
  )
  assert.equal(
    isFieldChargeOfficePushRecipient({
      email: 'om@example.com',
      position: 'office manager',
    }),
    true
  )
  assert.equal(
    isFieldChargeOfficePushRecipient({ email: 'boss@example.com', position: 'super' }),
    true
  )
  assert.equal(
    isFieldChargeOfficePushRecipient({ email: 'guide@example.com', position: 'tour guide' }),
    false
  )
  assert.equal(
    isFieldChargeOfficePushRecipient({
      email: 'op@example.com',
      position: 'op',
      isActive: false,
    }),
    false
  )
})

test('field charge payment intent id is stable per invoice', () => {
  assert.equal(fieldChargePaymentIntentId('inv-1'), 'field-charge:inv-1')
})

test('parsePaymentBreakdownFromMessage reads charge and tip', () => {
  const line = formatPaymentBreakdownLine(100.5, 20)
  assert.deepEqual(parsePaymentBreakdownFromMessage(`금액\n${line}`), {
    chargeUsd: 100.5,
    tipUsd: 20,
  })
  assert.equal(parsePaymentBreakdownFromMessage('금액: $10'), null)
  assert.equal(parsePaymentBreakdownFromMessage('pay_breakdown:charge=no;tip=1'), null)
})

test('customerPaymentNotifyKindFromMessage detects field charge rows', () => {
  assert.equal(
    customerPaymentNotifyKindFromMessage(`${FIELD_CHARGE_PAYMENT_NOTIFY_MARKER}\npaid`),
    'field_charge'
  )
  assert.equal(customerPaymentNotifyKindFromMessage('고객 웹 결제가 완료되었습니다.'), 'web_checkout')
})
