import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assignmentFromRoster,
  flippedAssignmentFromPartner,
  isHorseshoeBendCourse,
  overlapDrivingIds,
  parseActivityDetails,
  rosterFromAssignment,
  sunrisePointKeyFromCourse,
  unassignedDrivingIds,
} from '@/lib/tourReportActivityDetails'

test('detects horseshoe bend and sunrise viewpoint names', () => {
  assert.equal(
    isHorseshoeBendCourse({
      name_ko: '홀스슈 밴드',
      name_en: 'Horseshoe Bend',
      customer_name_ko: '홀스슈 밴드',
      customer_name_en: 'Horseshoe Bend',
    }),
    true
  )
  assert.equal(
    sunrisePointKeyFromCourse({
      name_ko: '그랜드뷰 포인트',
      name_en: 'Grandview',
      customer_name_ko: '그랜드뷰 포인트',
      customer_name_en: 'Grandview point',
    }),
    'grandview'
  )
  assert.equal(
    sunrisePointKeyFromCourse({
      name_ko: '매더 포인트',
      name_en: 'Mather point',
      customer_name_ko: '매더 포인트',
      customer_name_en: 'Mather point',
    }),
    'mather'
  )
  assert.equal(
    sunrisePointKeyFromCourse({
      name_ko: '매더 - 야바파이 림 트레일',
      name_en: 'Rim Trails(Mather - Yavapai)',
      customer_name_ko: null,
      customer_name_en: 'Rim Trails(Mather - Yavapai)',
    }),
    null
  )
})

test('first submitter assigning partner driving does not create a claim', () => {
  const roster = rosterFromAssignment(
    { a: 'me', b: 'partner', c: 'none' },
    [],
    '',
    'Partner',
    []
  )
  assert.deepEqual(roster.selfSegmentIds, ['a'])
  assert.deepEqual(roster.partnerSegmentIds, ['b'])
  assert.equal(roster.claims.length, 0)
})

test('taking a segment the partner claimed as their own records a claim', () => {
  const roster = rosterFromAssignment(
    { a: 'me', b: 'partner', c: 'none' },
    ['a', 'b'],
    'sean@example.com',
    'Sean',
    []
  )
  assert.deepEqual(roster.selfSegmentIds, ['a'])
  assert.deepEqual(roster.partnerSegmentIds, ['b'])
  assert.equal(roster.claims.length, 1)
  assert.equal(roster.claims[0]?.segmentId, 'a')
  assert.equal(roster.claims[0]?.fromEmail, 'sean@example.com')
})

test('partner roster flips into the second writer viewpoint', () => {
  const assignment = flippedAssignmentFromPartner(['a', 'b', 'c', 'd'], {
    id: 'r1',
    user_email: 'sean@example.com',
    userName: 'Sean',
    driving_segment_ids: ['a'],
    activity_details: {
      drivingRoster: {
        selfSegmentIds: ['a', 'b'],
        partnerSegmentIds: ['c'],
        claims: [],
      },
    },
    submitted_on: null,
    updated_at: null,
  })
  assert.equal(assignment.a, 'partner')
  assert.equal(assignment.b, 'partner')
  assert.equal(assignment.c, 'me')
  assert.equal(assignment.d, 'none')
})

test('assignment hydrates from partner report and detects gaps', () => {
  const assignment = assignmentFromRoster(['a', 'b', 'c'], undefined, [], ['a'])
  assert.equal(assignment.a, 'partner')
  assert.equal(assignment.b, 'none')
  assert.deepEqual(unassignedDrivingIds(['a', 'b', 'c'], assignment), ['b', 'c'])
  assert.deepEqual(overlapDrivingIds(['a'], ['a', 'b']), ['a'])
})

test('parseActivityDetails keeps sunrise and horseshoe choices', () => {
  const parsed = parseActivityDetails({
    horseshoeBend: { 'course-1': 'hiking' },
    sunrise: { pointKey: 'yavapai', courseId: 'c2', activity: 'photography' },
  })
  assert.equal(parsed.horseshoeBend?.['course-1'], 'hiking')
  assert.equal(parsed.sunrise?.pointKey, 'yavapai')
  assert.equal(parsed.sunrise?.activity, 'photography')
})
