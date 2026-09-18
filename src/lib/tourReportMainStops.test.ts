import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildMainStopCourseIds,
  excludeAncestorStopsWhenChildrenPresent,
  isRestOrMealStopCourse,
  productOrderForCourse,
  sortMainStopsIndented,
  type CourseForMainStops,
} from '@/lib/tourReportMainStops'

function course(
  id: string,
  extras: Partial<CourseForMainStops> = {}
): CourseForMainStops {
  return {
    id,
    parent_id: null,
    name_ko: id,
    name_en: id,
    customer_name_ko: null,
    customer_name_en: null,
    category: '투어 포인트',
    category_id: null,
    path: null,
    sort_order: 0,
    ...extras,
  }
}

test('does not add unlinked sibling stops such as Page stargazing', () => {
  const parent = course('stargazing', { name_ko: '별이 빛나는 밤에', name_en: 'Stargazing' })
  const willow = course('willow', {
    name_ko: '별이 빛나는 밤에 (윌로우 비치)',
    name_en: 'Star Gazing (Willow Beach)',
    parent_id: parent.id,
  })
  const page = course('page', {
    name_ko: '별이 빛나는 밤에 (Page)',
    name_en: 'Star Gazing (Page)',
    parent_id: parent.id,
  })
  const byId = new Map<string, CourseForMainStops>([
    [parent.id, parent],
    [willow.id, willow],
    [page.id, page],
  ])

  const ids = buildMainStopCourseIds(new Set([willow.id]), byId)
  assert.deepEqual(ids, [willow.id])
})

test('productOrderForCourse uses the nearest linked ancestor', () => {
  const canyon = course('canyon', { name_ko: '그랜드캐년' })
  const south = course('south', { parent_id: canyon.id, name_ko: '사우스림' })
  const grandview = course('grandview', { parent_id: south.id, name_ko: '그랜드뷰 포인트' })
  const byId = new Map<string, CourseForMainStops>([
    [canyon.id, canyon],
    [south.id, south],
    [grandview.id, grandview],
  ])
  const linkedOrder = new Map<string, number>([
    [canyon.id, 5],
    [grandview.id, 1],
  ])
  assert.equal(productOrderForCourse(grandview.id, byId, linkedOrder), 1)
  assert.equal(productOrderForCourse(south.id, byId, linkedOrder), 5)
})

test('hotel pickup is not a tour-point main stop', () => {
  const pickup = course('pickup', {
    name_ko: '호텔 픽업',
    name_en: 'Hotel Pickup',
    category: '투어 포인트',
  })
  const lipan = course('lipan', { name_ko: '리판 포인트' })
  const byId = new Map<string, CourseForMainStops>([
    [pickup.id, pickup],
    [lipan.id, lipan],
  ])
  assert.deepEqual(buildMainStopCourseIds(new Set([pickup.id, lipan.id]), byId), [lipan.id])
})

test('rest stops are not tour-point main stops', () => {
  const rest = course('rest', {
    name_ko: '휴게소 (킹맨 TA)',
    category: '휴게소',
    tour_course_categories: { name_ko: '휴게소', name_en: 'Restroom Break' },
  })
  assert.equal(isRestOrMealStopCourse(rest), true)
  assert.deepEqual(buildMainStopCourseIds(new Set([rest.id]), new Map([[rest.id, rest]])), [])
})

test('excludeAncestorStopsWhenChildrenPresent keeps leaf viewpoints', () => {
  const canyon = course('canyon', { name_ko: '그랜드캐년' })
  const south = course('south', { parent_id: canyon.id, name_ko: '사우스림' })
  const grandview = course('grandview', { parent_id: south.id, name_ko: '그랜드뷰 포인트' })
  const byId = new Map<string, CourseForMainStops>([
    [canyon.id, canyon],
    [south.id, south],
    [grandview.id, grandview],
  ])
  assert.deepEqual(
    excludeAncestorStopsWhenChildrenPresent([canyon.id, south.id, grandview.id], byId),
    [grandview.id]
  )
})

test('sortMainStopsIndented follows product_order first', () => {
  const pickup = course('pickup', { name_ko: '호텔 픽업' })
  const willow = course('willow', { name_ko: '별이 빛나는 밤에 (윌로우 비치)' })
  const byId = new Map<string, CourseForMainStops>([
    [pickup.id, pickup],
    [willow.id, willow],
  ])
  const sorted = sortMainStopsIndented(byId, [
    { id: willow.id, course: willow, sort_order: 0, product_order: 12 },
    { id: pickup.id, course: pickup, sort_order: 0, product_order: 0 },
  ])
  assert.deepEqual(
    sorted.map((row) => row.id),
    [pickup.id, willow.id]
  )
})
