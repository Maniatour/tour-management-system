import assert from 'node:assert/strict'
import test from 'node:test'
import {
  countPhotosByStop,
  haversineKm,
  nearestPhotoStop,
  photoStopStatus,
  selectGuidePhotoStops,
} from '@/lib/guidePhotoStopCoverage'
import { nextPhotoRotation, normalizePhotoRotation } from '@/lib/guidePhotoRotation'
import type { CourseForMainStops } from '@/lib/tourReportMainStops'

test('photo stop status treats 0 as missing and 1 as low', () => {
  assert.equal(photoStopStatus(0), 'missing')
  assert.equal(photoStopStatus(1), 'low')
  assert.equal(photoStopStatus(2), 'ok')
})

test('nearest stop stays within max distance', () => {
  const horseshoe = { id: 'hs', label: 'Horseshoe', latitude: 36.876, longitude: -111.51 }
  const antelope = { id: 'al', label: 'Antelope', latitude: 36.86, longitude: -111.37 }
  const near = nearestPhotoStop([horseshoe, antelope], 36.875, -111.511, 3)
  assert.equal(near?.id, 'hs')
  const far = nearestPhotoStop([horseshoe, antelope], 36.17, -115.14, 3)
  assert.equal(far, null)
})

test('haversine is roughly 0 for the same point', () => {
  assert.ok(haversineKm(36.1, -115.1, 36.1, -115.1) < 0.001)
})

test('receipts are excluded from stop counts', () => {
  const counts = countPhotosByStop([
    { stopId: 'a', kind: 'photo' },
    { stopId: 'a', kind: 'receipt' },
    { stopId: 'b', kind: 'photo' },
    { kind: 'photo' },
  ])
  assert.equal(counts.a, 1)
  assert.equal(counts.b, 1)
})

test('selectGuidePhotoStops drops rest stops and parent folders', () => {
  const parent: CourseForMainStops = {
    id: 'gc',
    parent_id: null,
    name_ko: '그랜드캐년',
    name_en: 'Grand Canyon',
    customer_name_ko: '그랜드캐년',
    customer_name_en: 'Grand Canyon',
    category: 'tour point',
    category_id: null,
    path: null,
    sort_order: 1,
  }
  const child: CourseForMainStops = {
    id: 'south',
    parent_id: 'gc',
    name_ko: '사우스림',
    name_en: 'South Rim',
    customer_name_ko: '사우스림',
    customer_name_en: 'South Rim',
    category: 'tour point',
    category_id: null,
    path: null,
    sort_order: 2,
  }
  const rest: CourseForMainStops = {
    id: 'rest',
    parent_id: null,
    name_ko: '휴게소',
    name_en: 'Rest stop',
    customer_name_ko: '휴게소',
    customer_name_en: 'Rest stop',
    category: '휴게소',
    category_id: null,
    path: null,
    sort_order: 3,
  }
  const stops = selectGuidePhotoStops([parent, child, rest], 'ko')
  assert.deepEqual(stops.map((stop) => stop.id), ['south'])
})

test('rotation cycles 90 degrees', () => {
  assert.equal(normalizePhotoRotation(450), 0)
  assert.equal(nextPhotoRotation(0), 90)
  assert.equal(nextPhotoRotation(270), 0)
})
