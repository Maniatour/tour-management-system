import assert from 'node:assert/strict'
import test from 'node:test'
import type { CourseForMainStops } from '@/lib/tourReportMainStops'
import {
  countQualifyingVisitedStops,
  countRequiredReportStops,
  filterMainStopIdsByReportRoles,
  hasQuotaSkipReason,
  parseReportStopRole,
  reportStopQuotaShortfall,
  TOUR_REPORT_QUOTA_SKIP_KEY,
  type ReportStopRole,
} from '@/lib/tourReportStopRoles'

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

test('parseReportStopRole accepts required and alternate only', () => {
  assert.equal(parseReportStopRole('required'), 'required')
  assert.equal(parseReportStopRole('alternate'), 'alternate')
  assert.equal(parseReportStopRole(null), null)
  assert.equal(parseReportStopRole('itinerary'), null)
})

test('filterMainStopIdsByReportRoles keeps linked tour points even without a role', () => {
  const lipan = course('lipan')
  const grandview = course('grandview')
  const mather = course('mather')
  const horseshoe = course('horseshoe')
  const byId = new Map<string, CourseForMainStops>([
    [lipan.id, lipan],
    [grandview.id, grandview],
    [mather.id, mather],
    [horseshoe.id, horseshoe],
  ])
  const roles = new Map<string, ReportStopRole>([
    [lipan.id, 'required'],
    [grandview.id, 'required'],
    [mather.id, 'alternate'],
  ])
  assert.deepEqual(
    filterMainStopIdsByReportRoles(
      [lipan.id, grandview.id, mather.id, horseshoe.id],
      byId,
      roles
    ),
    [lipan.id, grandview.id, mather.id, horseshoe.id]
  )
})

test('filterMainStopIdsByReportRoles hides rest stops, pickup, and parent folders', () => {
  const canyon = course('canyon', { name_ko: '그랜드캐년' })
  const south = course('south', { parent_id: canyon.id, name_ko: '사우스림' })
  const grandview = course('grandview', { parent_id: south.id, name_ko: '그랜드뷰 포인트' })
  const bright = course('bright', { parent_id: south.id, name_ko: '브라이트 엔젤 포인트' })
  const rest = course('rest', {
    name_ko: '휴게소 (킹맨 TA)',
    category: '휴게소',
    tour_course_categories: { name_ko: '휴게소', name_en: 'Restroom Break' },
  })
  const drop = course('drop', {
    name_ko: '호텔 드롭',
    name_en: 'Hotel Drop off',
    category: '정차',
    tour_course_categories: { name_ko: '정차', name_en: 'Operational Stop' },
  })
  const byId = new Map<string, CourseForMainStops>([
    [canyon.id, canyon],
    [south.id, south],
    [grandview.id, grandview],
    [bright.id, bright],
    [rest.id, rest],
    [drop.id, drop],
  ])
  const roles = new Map<string, ReportStopRole>([
    [canyon.id, 'required'],
    [south.id, 'required'],
    [grandview.id, 'required'],
    [bright.id, 'alternate'],
    [rest.id, 'required'],
    [drop.id, 'required'],
  ])
  assert.deepEqual(
    filterMainStopIdsByReportRoles([], byId, roles),
    [grandview.id, bright.id]
  )
})

test('quota shortfall counts only displayed required stops', () => {
  const roles = new Map<string, ReportStopRole>([
    ['lipan', 'required'],
    ['grandview', 'required'],
    ['mather', 'alternate'],
  ])
  const byId = new Map<string, CourseForMainStops>([
    ['lipan', course('lipan')],
    ['grandview', course('grandview')],
    ['mather', course('mather')],
  ])
  const required = countRequiredReportStops(roles, ['lipan', 'grandview', 'mather'], byId)
  assert.equal(required, 2)
  assert.equal(
    reportStopQuotaShortfall(required, countQualifyingVisitedStops(['lipan', 'mather'], roles, byId)),
    0
  )
  assert.equal(
    reportStopQuotaShortfall(required, countQualifyingVisitedStops(['lipan'], roles, byId)),
    1
  )
  assert.equal(
    reportStopQuotaShortfall(required, countQualifyingVisitedStops([], roles, byId)),
    2
  )
})

test('hasQuotaSkipReason requires reason or note', () => {
  assert.equal(hasQuotaSkipReason({}), false)
  assert.equal(
    hasQuotaSkipReason({ [TOUR_REPORT_QUOTA_SKIP_KEY]: { reason: '', note: '' } }),
    false
  )
  assert.equal(
    hasQuotaSkipReason({ [TOUR_REPORT_QUOTA_SKIP_KEY]: { reason: 'weather', note: '' } }),
    true
  )
})
