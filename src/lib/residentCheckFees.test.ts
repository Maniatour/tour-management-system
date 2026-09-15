import assert from 'node:assert/strict'
import test from 'node:test'
import {
  computeResidentCheckUsdCents,
  impliedResidentCheckCardFeeUsdFromRecords,
  mergeResidentCheckCardFeeUsd,
  residentCheckCardFeeUsdFromPayment,
} from '@/lib/residentCheckFees'

test('카드 결제 1인은 NPS $100 + 수수료 $5 = $105', () => {
  assert.deepEqual(
    computeResidentCheckUsdCents({
      residency: 'non_resident',
      non_resident_16_plus_count: 1,
      has_annual_pass: false,
      payment_method: 'card',
    }),
    {
      nps_fee_usd_cents: 10000,
      card_processing_fee_usd_cents: 500,
      total_charge_usd_cents: 10500,
    }
  )
})

test('현금 결제는 카드 수수료가 없다', () => {
  const fees = computeResidentCheckUsdCents({
    residency: 'non_resident',
    non_resident_16_plus_count: 1,
    has_annual_pass: false,
    payment_method: 'cash',
  })
  assert.equal(fees.card_processing_fee_usd_cents, 0)
  assert.equal(fees.total_charge_usd_cents, 10000)
})

test('제출 수수료를 가격 정보용 USD로 변환한다', () => {
  assert.equal(
    residentCheckCardFeeUsdFromPayment({
      cardProcessingFeeUsdCents: 500,
      amountUsdCents: 10500,
    }),
    5
  )
  assert.equal(
    residentCheckCardFeeUsdFromPayment({
      cardProcessingFeeUsdCents: 1000,
      amountUsdCents: 21000,
    }),
    10
  )
})

test('제출 수수료가 없으면 총액에서 5%를 역산한다', () => {
  assert.equal(
    residentCheckCardFeeUsdFromPayment({
      cardProcessingFeeUsdCents: 0,
      amountUsdCents: 10500,
    }),
    5
  )
})

test('기존 카드 수수료에 비거주자 결제 수수료를 더한다', () => {
  assert.equal(mergeResidentCheckCardFeeUsd(0, 5), 5)
  assert.equal(mergeResidentCheckCardFeeUsd(12, 5), 17)
  assert.equal(mergeResidentCheckCardFeeUsd(null, 5), 5)
})

test('비거주자 카드 입금 내역에서 수수료를 합산한다', () => {
  assert.equal(
    impliedResidentCheckCardFeeUsdFromRecords([
      { note: 'pi_abc; resident_check_nps', amount: 105 },
    ]),
    5
  )
  assert.equal(
    impliedResidentCheckCardFeeUsdFromRecords([
      { note: 'deposit', amount: 200 },
      { note: 'pi_abc; resident_check_nps', amount: 105 },
      { note: 'pi_def; resident_check_nps', amount: 105 },
    ]),
    10
  )
  assert.equal(impliedResidentCheckCardFeeUsdFromRecords([]), 0)
})
