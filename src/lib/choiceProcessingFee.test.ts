import assert from 'node:assert/strict'
import test from 'node:test'
import {
  choiceProcessingFeeAmount,
  parseApplyProcessingFee,
  withChoiceProcessingFee,
} from '@/lib/choiceProcessingFee'

test('true일 때만 카드 수수료를 적용한다', () => {
  assert.equal(parseApplyProcessingFee(true), true)
  assert.equal(parseApplyProcessingFee(false), false)
  assert.equal(parseApplyProcessingFee(null), false)
  assert.equal(parseApplyProcessingFee(undefined), false)
})

test('5% 카드 수수료 금액을 반올림한다', () => {
  assert.equal(choiceProcessingFeeAmount(100), 5)
  assert.equal(choiceProcessingFeeAmount(10), 0.5)
  assert.equal(choiceProcessingFeeAmount(0), 0)
  assert.equal(choiceProcessingFeeAmount(-20), 0)
})

test('적용 그룹만 수수료를 포함한 가격을 만든다', () => {
  assert.equal(withChoiceProcessingFee(100, true), 105)
  assert.equal(withChoiceProcessingFee(100, false), 100)
  assert.equal(withChoiceProcessingFee(0, true), 0)
  assert.equal(withChoiceProcessingFee(null, true), null)
})
