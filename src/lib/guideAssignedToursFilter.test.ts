import assert from 'node:assert/strict'
import test from 'node:test'
import { assignedToursOrFilter, GUIDE_PORTAL_TOUR_LIST_SELECT } from '@/lib/guideAssignedToursFilter'

test('empty email does not match every tour', () => {
  assert.equal(assignedToursOrFilter('  '), 'id.eq.__none__')
})

test('lowercases and quotes the assigned-email filter', () => {
  const filter = assignedToursOrFilter('Guide@Example.com')
  assert.match(filter, /tour_guide_id\.eq\."guide@example\.com"/)
  assert.match(filter, /assistant_id\.eq\."guide@example\.com"/)
  assert.match(filter, /tour_guide_id\.eq\."Guide@Example\.com"/)
  assert.match(filter, /tour_guide_id\.ilike\."%guide@example\.com%"/)
})

test('escapes LIKE wildcards inside emails', () => {
  const filter = assignedToursOrFilter('a_b%c@x.com')
  assert.match(filter, /tour_guide_id\.ilike\."%a\\_b\\%c@x\.com%"/)
})

test('list select omits bulky JSON override columns', () => {
  assert.equal(GUIDE_PORTAL_TOUR_LIST_SELECT.includes('pickup_group_'), false)
  assert.match(GUIDE_PORTAL_TOUR_LIST_SELECT, /reservation_ids/)
})
