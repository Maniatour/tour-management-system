import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assignedResidentPeopleFromForm,
  guestResidentCountsToFormPatch,
  leftoverUndecidedResidentCount,
  residentStatusCountsFromGuestSubmission,
  isGuestResidentCheckFilledByCustomer,
} from '@/lib/residentCheckGuestMapping'

test('entire non-resident party maps 16+ count to 비거주자 and remainder to under 16', () => {
  const counts = residentStatusCountsFromGuestSubmission(
    {
      residency: 'non_resident',
      non_resident_16_plus_count: 1,
      has_annual_pass: false,
      nps_fee_usd_cents: 10000,
    },
    1
  )
  assert.deepEqual(counts, {
    usResident: 0,
    nonResident: 1,
    nonResidentUnder16: 0,
    nonResidentWithPass: 0,
    residentStatusAmounts: {
      undecided: 0,
      us_resident: 0,
      non_resident: 100,
      non_resident_under_16: 0,
      non_resident_with_pass: 0,
      non_resident_purchase_pass: 0,
    },
  })
})

test('mixed party assigns remaining guests as U.S. residents', () => {
  const counts = residentStatusCountsFromGuestSubmission(
    {
      residency: 'mixed',
      non_resident_16_plus_count: 1,
      has_annual_pass: null,
      nps_fee_usd_cents: 10000,
    },
    3
  )
  assert.equal(counts?.usResident, 2)
  assert.equal(counts?.nonResident, 1)
  assert.equal(counts?.residentStatusAmounts.non_resident, 100)
})

test('U.S. resident party fills every guest as us_resident with no NPS amount', () => {
  const counts = residentStatusCountsFromGuestSubmission(
    {
      residency: 'us_resident',
      non_resident_16_plus_count: 0,
      has_annual_pass: null,
      nps_fee_usd_cents: 0,
    },
    2
  )
  assert.equal(counts?.usResident, 2)
  assert.equal(counts?.nonResident, 0)
  assert.equal(counts?.residentStatusAmounts.non_resident, 0)
})

test('non-resident with a pass covers the whole party without NPS', () => {
  const counts = residentStatusCountsFromGuestSubmission(
    {
      residency: 'non_resident',
      non_resident_16_plus_count: 0,
      has_annual_pass: true,
      nps_fee_usd_cents: 0,
    },
    5
  )
  assert.equal(counts?.nonResidentWithPass, 2)
  assert.equal(counts?.nonResident, 0)
  const patch = guestResidentCountsToFormPatch(counts!, 5)
  assert.equal(patch.passCoveredCount, 5)
  assert.equal(patch.undecidedResidentCount, 0)
})

test('form patch leaves no undecided people when the party is fully assigned', () => {
  const counts = residentStatusCountsFromGuestSubmission(
    {
      residency: 'non_resident',
      non_resident_16_plus_count: 1,
      has_annual_pass: false,
      nps_fee_usd_cents: 10000,
    },
    1
  )
  const patch = guestResidentCountsToFormPatch(counts!, 1)
  assert.equal(patch.undecidedResidentCount, 0)
  assert.equal(patch.nonResidentCount, 1)
  assert.equal(assignedResidentPeopleFromForm(patch), 1)
})

test('leftover undecided is zero once assigned people cover the party', () => {
  assert.equal(leftoverUndecidedResidentCount(1, 1), 0)
  assert.equal(leftoverUndecidedResidentCount(1, 2), 0)
  assert.equal(leftoverUndecidedResidentCount(3, 1), 2)
})

test('guest form icon only appears after the customer filled residency', () => {
  assert.equal(isGuestResidentCheckFilledByCustomer(null), false)
  assert.equal(
    isGuestResidentCheckFilledByCustomer({
      completedAt: null,
      submission: { residency: '', agreed: false } as never,
    }),
    false
  )
  assert.equal(
    isGuestResidentCheckFilledByCustomer({
      completedAt: null,
      submission: { residency: 'us_resident', agreed: false } as never,
    }),
    true
  )
  assert.equal(
    isGuestResidentCheckFilledByCustomer({
      completedAt: '2026-09-08T00:00:00.000Z',
      submission: { residency: '', agreed: false } as never,
    }),
    true
  )
})
