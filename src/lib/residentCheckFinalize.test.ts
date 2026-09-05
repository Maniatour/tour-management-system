import assert from 'node:assert/strict'
import test from 'node:test'
import type { ResidentCheckSubmissionRow } from '@/lib/residentCheckTokenService'
import {
  residentCheckFinalizeBlockers,
  residentCheckRequiresIdProof,
  residentCheckRequiresPassPhoto,
  residentCheckUploadStepDone,
} from '@/lib/residentCheckFinalize'

function submission(
  patch: Partial<ResidentCheckSubmissionRow>
): ResidentCheckSubmissionRow {
  return {
    id: 'sub',
    token_id: 'tok',
    residency: 'us_resident',
    non_resident_16_plus_count: 0,
    agreed: true,
    payment_method: null,
    pass_assistance_requested: false,
    has_annual_pass: null,
    pass_photo_url: null,
    id_proof_url: null,
    stripe_payment_intent_id: null,
    stripe_payment_status: null,
    nps_fee_usd_cents: 0,
    card_processing_fee_usd_cents: 0,
    total_charge_usd_cents: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...patch,
  }
}

test('ID proof is required only for U.S. residents and mixed parties', () => {
  assert.equal(residentCheckRequiresIdProof('us_resident'), true)
  assert.equal(residentCheckRequiresIdProof('mixed'), true)
  assert.equal(residentCheckRequiresIdProof('non_resident'), false)
})

test('pass photo is required only for non-residents who already have the annual pass', () => {
  assert.equal(residentCheckRequiresPassPhoto('non_resident', true), true)
  assert.equal(residentCheckRequiresPassPhoto('non_resident', false), false)
  assert.equal(residentCheckRequiresPassPhoto('us_resident', true), false)
  assert.equal(residentCheckRequiresPassPhoto('mixed', true), false)
})

test('U.S. residents cannot finish without ID proof', () => {
  const blockers = residentCheckFinalizeBlockers(
    submission({ residency: 'us_resident', agreed: true })
  )
  assert.deepEqual(blockers, ['id_proof'])
})

test('non-residents without a pass pay the fee and do not upload ID', () => {
  const blockers = residentCheckFinalizeBlockers(
    submission({
      residency: 'non_resident',
      has_annual_pass: false,
      agreed: true,
      payment_method: 'card',
      non_resident_16_plus_count: 2,
      nps_fee_usd_cents: 20000,
      total_charge_usd_cents: 21000,
    })
  )
  assert.deepEqual(blockers, [])
  assert.equal(
    residentCheckUploadStepDone(
      submission({
        residency: 'non_resident',
        has_annual_pass: false,
      })
    ),
    true
  )
})

test('non-residents with a pass must upload the pass photo, not ID', () => {
  const missingPass = residentCheckFinalizeBlockers(
    submission({
      residency: 'non_resident',
      has_annual_pass: true,
      agreed: true,
    })
  )
  assert.deepEqual(missingPass, ['pass_photo'])

  const complete = residentCheckFinalizeBlockers(
    submission({
      residency: 'non_resident',
      has_annual_pass: true,
      agreed: true,
      pass_photo_url: 'https://example.com/pass.jpg',
    })
  )
  assert.deepEqual(complete, [])
})
