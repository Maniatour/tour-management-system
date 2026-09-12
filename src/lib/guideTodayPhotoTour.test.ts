import assert from 'node:assert/strict'
import test from 'node:test'
import {
  earliestPickupTime,
  firstPickupMsFromParts,
  isTourEligibleForGuidePhotos,
  pickTodayPhotoTour,
  photoTourLookaheadEnd,
  photoTourLookbackStart,
  toursCoveringDate,
  type TodayPhotoTourRow,
} from '@/lib/guideTodayPhotoTour'

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

test('lookback start is 3 days before today so 3N4D still matches', () => {
  assert.equal(photoTourLookbackStart('2026-09-06'), '2026-09-03')
})

test('keeps overnight tour on day 2 and drops yesterday day tour', () => {
  const covering = toursCoveringDate(
    [
      tour({
        id: 'overnight',
        tour_date: '2026-09-05',
        product_id: 'MNGC1N',
      }),
      tour({
        id: 'yesterday-day',
        tour_date: '2026-09-05',
        product_id: 'MDGCSUNRISE',
      }),
    ],
    '2026-09-06'
  )
  assert.deepEqual(
    covering.map((item) => item.id),
    ['overnight']
  )
})

test('keeps 3 night tour on the last calendar day', () => {
  const covering = toursCoveringDate(
    [
      tour({
        id: 'three-night',
        tour_date: '2026-09-03',
        product_id: 'MNGC3N',
      }),
    ],
    '2026-09-06'
  )
  assert.equal(covering[0]?.id, 'three-night')
})

test('picks overnight day 2 when that is the only covering assigned tour', () => {
  const covering = toursCoveringDate(
    [
      tour({
        id: 'overnight',
        tour_date: '2026-09-05',
        product_id: 'MNGC1N',
        tour_start_datetime: '2026-09-05T14:00:00.000Z',
      }),
    ],
    '2026-09-06'
  )
  const picked = pickTodayPhotoTour(covering, email, Date.parse('2026-09-06T18:00:00.000Z'))
  assert.equal(picked?.id, 'overnight')
})

test('lookahead end includes the next Las Vegas calendar day', () => {
  assert.equal(photoTourLookaheadEnd('2026-09-11'), '2026-09-12')
})

test('pickup at 23:00 for a Sept 12 tour is on Sept 11 in Las Vegas', () => {
  assert.equal(firstPickupMsFromParts('2026-09-12', '23:00', null), Date.parse('2026-09-12T06:00:00.000Z'))
})

test('pickup at 05:00 stays on the tour date', () => {
  assert.equal(firstPickupMsFromParts('2026-09-12', '05:00', null), Date.parse('2026-09-12T12:00:00.000Z'))
})

test('earliest pickup is the previous-evening 23:00, not 00:30 the next morning', () => {
  assert.equal(earliestPickupTime('2026-09-12', ['00:30', '23:00']), '23:00')
})

test('Sept 12 tour with 23:00 pickup opens 30 minutes before on Sept 11', () => {
  const nightTour = tour({ id: 'night', tour_date: '2026-09-12', tour_start_datetime: null })
  assert.equal(
    isTourEligibleForGuidePhotos(nightTour, '2026-09-11', Date.parse('2026-09-12T05:29:00.000Z'), '23:00'),
    false
  )
  assert.equal(
    isTourEligibleForGuidePhotos(nightTour, '2026-09-11', Date.parse('2026-09-12T05:31:00.000Z'), '23:00'),
    true
  )
})

test('00:15 pickup on a Sept 12 tour opens at 23:45 on Sept 11', () => {
  const earlyTour = tour({ id: 'early', tour_date: '2026-09-12', tour_start_datetime: null })
  assert.equal(
    isTourEligibleForGuidePhotos(earlyTour, '2026-09-11', Date.parse('2026-09-12T06:46:00.000Z'), '00:15'),
    true
  )
})

test('today covering tour stays available even before the first pickup', () => {
  const todayTour = tour({
    id: 'today',
    tour_date: '2026-09-11',
    tour_start_datetime: '2026-09-11T18:00:00.000Z',
  })
  assert.equal(
    isTourEligibleForGuidePhotos(todayTour, '2026-09-11', Date.parse('2026-09-11T10:00:00.000Z'), '18:00'),
    true
  )
})

test('Sept 12 5am tour is not open yet at 11:54pm on Sept 11', () => {
  const morning = tour({ id: 'morning', tour_date: '2026-09-12', tour_start_datetime: null })
  assert.equal(
    isTourEligibleForGuidePhotos(morning, '2026-09-11', Date.parse('2026-09-12T06:54:00.000Z'), '05:00'),
    false
  )
})

