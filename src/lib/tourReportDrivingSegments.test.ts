import assert from 'node:assert/strict'
import test from 'node:test'
import {
  approxDrivingMinutesForSegment,
  formatApproxDrivingDuration,
  sumApproxDrivingMinutes,
  type TourReportDrivingSegment,
} from '@/lib/tourReportDrivingSegments'
import { displayMainStopLabel, isOpaqueRecordId } from '@/lib/tourReportMainStops'

test('approx driving minutes match catalog labels', () => {
  assert.equal(
    approxDrivingMinutesForSegment({
      label_ko: '킹먼 → 윌리엄스',
      label_en: 'Kingman -> Williams',
    }),
    90
  )
  assert.equal(
    approxDrivingMinutesForSegment({
      label_ko: '허리케인 → 라스베이거스',
      label_en: 'Hurricane -> Las Vegas',
    }),
    150
  )
  assert.equal(
    approxDrivingMinutesForSegment({
      label_ko: '호텔 드롭',
      label_en: 'Hotel Drop',
    }),
    45
  )
})

test('sumApproxDrivingMinutes adds known segments and ignores unknown', () => {
  const byId = new Map<string, TourReportDrivingSegment>([
    [
      'a',
      {
        id: 'a',
        label_ko: '킹먼 → 윌리엄스',
        label_en: 'Kingman -> Williams',
        sort_order: 40,
        is_active: true,
      },
    ],
    [
      'b',
      {
        id: 'b',
        label_ko: '캐머런 → 페이지',
        label_en: 'Cameron -> Page',
        sort_order: 80,
        is_active: true,
      },
    ],
    [
      'c',
      {
        id: 'c',
        label_ko: '허리케인 → 라스베이거스',
        label_en: 'Hurricane -> Las Vegas',
        sort_order: 110,
        is_active: true,
      },
    ],
    [
      'd',
      {
        id: 'd',
        label_ko: '호텔 드롭',
        label_en: 'Hotel Drop',
        sort_order: 120,
        is_active: true,
      },
    ],
    [
      'e',
      {
        id: 'e',
        label_ko: '신규 구간',
        label_en: 'New Segment',
        sort_order: 200,
        is_active: true,
      },
    ],
  ])
  assert.equal(sumApproxDrivingMinutes(['a', 'b', 'c', 'd', 'e'], byId), 375)
})

test('formatApproxDrivingDuration uses approximate wording', () => {
  assert.equal(formatApproxDrivingDuration(375, 'ko'), '대략 6시간 15분')
  assert.equal(formatApproxDrivingDuration(375, 'en'), 'approx. 6h 15m')
  assert.equal(formatApproxDrivingDuration(45, 'ko'), '대략 45분')
  assert.equal(formatApproxDrivingDuration(120, 'ko'), '대략 2시간')
})

test('opaque ids are hidden when course names are missing', () => {
  const id = '34baa5d7-e5b8-462e-9ba6-0f1618f963b0'
  assert.equal(isOpaqueRecordId(id), true)
  assert.equal(displayMainStopLabel(id, new Map(), 'ko'), null)
})
