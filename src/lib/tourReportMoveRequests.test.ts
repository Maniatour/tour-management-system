import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assignedRoleForEmail,
  buildMoveOfficeNote,
  getMoveBlockReason,
  sanitizeMoveReason,
  sortMoveCandidates,
  type TourReportMoveCandidate,
} from '@/lib/tourReportMoveRequests'

test('getMoveBlockReason blocks same tour, cancelled, and duplicate own report', () => {
  assert.equal(
    getMoveBlockReason({
      fromTourId: 't1',
      toTour: { id: 't1', tour_status: 'Confirmed' },
      hasOwnReportOnTarget: false,
    }),
    'same_tour'
  )
  assert.equal(
    getMoveBlockReason({
      fromTourId: 't1',
      toTour: { id: 't2', tour_status: 'Cancelled' },
      hasOwnReportOnTarget: false,
    }),
    'cancelled'
  )
  assert.equal(
    getMoveBlockReason({
      fromTourId: 't1',
      toTour: { id: 't2', tour_status: 'Confirmed' },
      hasOwnReportOnTarget: true,
    }),
    'own_report_exists'
  )
  assert.equal(
    getMoveBlockReason({
      fromTourId: 't1',
      toTour: { id: 't2', tour_status: 'Confirmed' },
      hasOwnReportOnTarget: false,
    }),
    null
  )
})

test('assignedRoleForEmail matches guide and assistant ignoring case', () => {
  const tour = { tour_guide_id: 'Guide@Kovegas.com', assistant_id: 'Asst@Kovegas.com' }
  assert.equal(assignedRoleForEmail(tour, 'guide@kovegas.com'), 'guide')
  assert.equal(assignedRoleForEmail(tour, 'asst@kovegas.com'), 'assistant')
  assert.equal(assignedRoleForEmail(tour, 'other@kovegas.com'), null)
})

test('sortMoveCandidates prefers assigned and unblocked tours', () => {
  const base = {
    id: 'a',
    tourDate: '2026-09-06',
    productName: 'B Tour',
    tourStatus: 'Confirmed',
    assignedRole: null,
    hasOwnReport: false,
    blockedReason: null,
  } satisfies TourReportMoveCandidate
  const assigned: TourReportMoveCandidate = {
    ...base,
    id: 'b',
    productName: 'A Tour',
    assignedRole: 'guide',
  }
  const blocked: TourReportMoveCandidate = {
    ...base,
    id: 'c',
    productName: 'C Tour',
    blockedReason: 'own_report_exists',
  }
  const sorted = [blocked, base, assigned].sort(sortMoveCandidates)
  assert.deepEqual(
    sorted.map((row) => row.id),
    ['b', 'a', 'c']
  )
})

test('buildMoveOfficeNote appends a bilingual move line', () => {
  const note = buildMoveOfficeNote({
    existing: 'Keep this.',
    fromTour: { id: 'from', tourDate: '2026-09-07', productName: 'Night Goblin', tourStatus: 'Confirmed' },
    toTour: { id: 'to', tourDate: '2026-09-06', productName: 'Grand Canyon', tourStatus: 'Confirmed' },
    reviewedBy: 'office@kovegas.com',
    locale: 'ko',
  })
  assert.match(note, /Keep this/)
  assert.match(note, /2026-09-07/)
  assert.match(note, /2026-09-06/)
  assert.match(note, /office@kovegas.com/)
})

test('sanitizeMoveReason trims and caps length', () => {
  assert.equal(sanitizeMoveReason('  9월 6일 투어  '), '9월 6일 투어')
  assert.equal(sanitizeMoveReason('   '), null)
  assert.equal(sanitizeMoveReason('x'.repeat(600))?.length, 500)
})
