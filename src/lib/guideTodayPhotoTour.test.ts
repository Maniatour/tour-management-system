import assert from 'node:assert/strict'
import test from 'node:test'
import { pickTodayPhotoTour, type TodayPhotoTourRow } from '@/lib/guideTodayPhotoTour'

const email = 'guide@example.com'

function tour(partial: Partial<TodayPhotoTourRow> & { id: string }): TodayPhotoTourRow {
  return {
    tour_date: '2026-09-05',
    tour_status: 'confirmed',
    assignment_status: 'confirmed',
    tour_guide_id: email,
    assistant_id: null,
    tour_start_datetime: null,
    reservation_ids: ['res-1'],
    product_id: 'p1',
    ...partial,
  }
}

test('returns null when the guide has no assigned tour today', () => {
  const picked = pickTodayPhotoTour(
    [tour({ id: 'a', tour_guide_id: 'other@example.com' })],
    email,
    Date.parse('2026-09-05T18:00:00.000Z')
  )
  assert.equal(picked, null)
})

test('returns the only assigned non-cancelled tour', () => {
  const picked = pickTodayPhotoTour(
    [
      tour({ id: 'skip', tour_status: 'cancelled' }),
      tour({ id: 'keep' }),
    ],
    email,
    Date.parse('2026-09-05T18:00:00.000Z')
  )
  assert.equal(picked?.id, 'keep')
})

test('prefers the tour that already started over a later one', () => {
  const now = Date.parse('2026-09-05T18:00:00.000Z')
  const picked = pickTodayPhotoTour(
    [
      tour({
        id: 'morning',
        tour_start_datetime: '2026-09-05T14:00:00.000Z',
      }),
      tour({
        id: 'evening',
        tour_start_datetime: '2026-09-05T23:00:00.000Z',
      }),
    ],
    email,
    now
  )
  assert.equal(picked?.id, 'morning')
})

test('ignores backup tours when a guest tour exists', () => {
  const picked = pickTodayPhotoTour(
    [
      tour({ id: 'backup', reservation_ids: [] }),
      tour({ id: 'real', reservation_ids: ['res-1'] }),
    ],
    email,
    Date.parse('2026-09-05T18:00:00.000Z')
  )
  assert.equal(picked?.id, 'real')
})
