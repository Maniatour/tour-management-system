import assert from 'node:assert/strict'
import test from 'node:test'
import {
  canOpenGuidePage,
  isGuideHomePath,
  isOfficeStaffRole,
  officeStaffHomePath,
} from './staffLanding'

test('isOfficeStaffRole is admin or manager only', () => {
  assert.equal(isOfficeStaffRole('admin'), true)
  assert.equal(isOfficeStaffRole('manager'), true)
  assert.equal(isOfficeStaffRole('team_member'), false)
  assert.equal(isOfficeStaffRole('customer'), false)
  assert.equal(isOfficeStaffRole(null), false)
})

test('canOpenGuidePage includes office staff and guides', () => {
  assert.equal(canOpenGuidePage('admin'), true)
  assert.equal(canOpenGuidePage('manager'), true)
  assert.equal(canOpenGuidePage('team_member'), true)
  assert.equal(canOpenGuidePage('customer'), false)
})

test('isGuideHomePath matches locale guide home only', () => {
  assert.equal(isGuideHomePath('/ko/guide'), true)
  assert.equal(isGuideHomePath('/en/guide/'), true)
  assert.equal(isGuideHomePath('/ko/guide/tours'), false)
  assert.equal(isGuideHomePath('/ko/admin'), false)
})

test('officeStaffHomePath goes to admin', () => {
  assert.equal(officeStaffHomePath('ko'), '/ko/admin')
  assert.equal(officeStaffHomePath('en'), '/en/admin')
})
