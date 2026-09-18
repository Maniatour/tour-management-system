import assert from 'node:assert/strict'
import test from 'node:test'
import { isTourMaterialSoftDeleted } from '@/lib/tourMaterialSoftDelete'

test('isTourMaterialSoftDeleted treats false as deleted and everything else as visible', () => {
  assert.equal(isTourMaterialSoftDeleted(false), true)
  assert.equal(isTourMaterialSoftDeleted(true), false)
  assert.equal(isTourMaterialSoftDeleted(null), false)
  assert.equal(isTourMaterialSoftDeleted(undefined), false)
})
