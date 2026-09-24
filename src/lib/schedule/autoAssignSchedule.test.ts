import assert from 'node:assert/strict'
import test from 'node:test'
import { mergeGuidePlan, sameGuidePlan } from './autoAssignGuidePlan'
import {
  autoAssignSchedule,
  clampAutoAssignRange,
  defaultAutoAssignRange,
  guestReviewRatePercentOf,
  previousCalendarMonth,
  reviewPriorityScore,
  type AutoAssignMember,
  type AutoAssignTour,
} from './autoAssignSchedule'
import { autoAssignContextDates, mergeAutoAssignOffRows, prepareAutoAssignSchedule } from './autoAssignScheduleInput'
import { buildAutoAssignPreviewGridModel, overlayAutoAssignScheduleTours } from './autoAssignPreviewGrid'

function member(email: string, overrides: Partial<AutoAssignMember> = {}): AutoAssignMember {
  return {
    email,
    name: email,
    languages: ['KR'],
    active: true,
    cdl: false,
    guideProductSkills: {
      DAY: { eligible: true, priorities: {} },
      MNGC1N: { eligible: true, priorities: {} },
      MDGCSUNRISE: { eligible: true, priorities: {} },
    },
    ...overrides,
  }
}

function tour(id: string, tourDate: string, overrides: Partial<AutoAssignTour> = {}): AutoAssignTour {
  return {
    id,
    tourDate,
    productId: 'DAY',
    teamType: '1guide',
    tourStatus: 'scheduled',
    guideEmail: null,
    assistantEmail: null,
    guideLocked: false,
    assistantLocked: false,
    spanDays: 1,
    isGoblin: false,
    guestPeople: { ko: 2, ja: 0, en: 0 },
    ...overrides,
  }
}

test('range defaults to 14 days after the visibility cutoff', () => {
  assert.deepEqual(defaultAutoAssignRange('2026-10-03', '2026-09-22'), {
    startDate: '2026-10-04',
    endDate: '2026-10-17',
  })
  assert.equal(clampAutoAssignRange('2026-10-04', '2026-11-01').endDate, '2026-10-17')
})

test('korean guests are not assigned an english-only guide', () => {
  const result = autoAssignSchedule({
    startDate: '2026-10-04',
    endDate: '2026-10-04',
    preset: 'equal',
    members: [
      member('en@x.com', { languages: ['EN'], name: 'Alex' }),
      member('ko@x.com', { languages: ['KR'], name: '민수' }),
    ],
    tours: [tour('t1', '2026-10-04')],
    offs: [],
  })
  assert.equal(result.assignmentsByTourId.t1.tour_guide_id, 'ko@x.com')
})

test('a product stays unassigned until a guide is explicitly selected for it', () => {
  const result = autoAssignSchedule({
    startDate: '2026-10-04',
    endDate: '2026-10-04',
    preset: 'equal',
    members: [
      member('open@x.com', { name: 'Open', guideProductSkills: {} }),
      member('picked@x.com', { name: 'Picked', guideProductSkills: { DAY: { eligible: true, priorities: {} } } }),
    ],
    tours: [tour('t1', '2026-10-04')],
    offs: [],
  })
  assert.equal(result.assignmentsByTourId.t1.tour_guide_id, 'picked@x.com')
})

test('english guests prefer a higher english priority and fall back to the next rank', () => {
  const english = { ko: 0, ja: 0, en: 4 }
  const result = autoAssignSchedule({
    startDate: '2026-10-04',
    endDate: '2026-10-04',
    preset: 'equal',
    members: [
      member('mid@x.com', {
        name: 'Sean',
        languages: ['KR', 'EN'],
        guideProductSkills: { DAY: { eligible: true, priorities: { ko: 1, en: 2 } } },
      }),
      member('top@x.com', {
        name: 'Top',
        languages: ['EN'],
        guideProductSkills: { DAY: { eligible: true, priorities: { en: 1 } } },
      }),
      member('no@x.com', {
        name: 'No',
        languages: ['EN'],
        guideProductSkills: { DAY: { eligible: false, priorities: {} } },
      }),
    ],
    tours: [
      tour('t1', '2026-10-04', { guestPeople: english }),
      tour('t2', '2026-10-04', { guestPeople: english }),
    ],
    offs: [],
  })
  assert.equal(result.assignmentsByTourId.t1.tour_guide_id, 'top@x.com')
  assert.equal(result.assignmentsByTourId.t2.tour_guide_id, 'mid@x.com')
  assert.ok(result.slots.some((slot) => slot.email === 'top@x.com' && slot.reasonLines.some((line) => line.includes('영어 우선순위 상'))))
})

test('english-only tours go to guides whose first language is english, split evenly', () => {
  const english = { ko: 0, ja: 0, en: 4 }
  const result = autoAssignSchedule({
    startDate: '2026-10-05',
    endDate: '2026-10-08',
    preset: 'equal',
    existingMode: 'reset',
    members: [
      member('sean@x.com', {
        name: 'Sean',
        languages: ['KR', 'EN'],
        guideProductSkills: { DAY: { eligible: true, priorities: { ko: 1, en: 3 } } },
      }),
      member('dez@x.com', { name: 'Dez', languages: ['EN'], guideProductSkills: {} }),
      member('patricia@x.com', { name: 'Patricia', languages: ['EN', 'FR'], guideProductSkills: {} }),
    ],
    tours: ['05', '06', '07', '08'].map((day, index) =>
      tour(`t${index}`, `2026-10-${day}`, { guestPeople: english }),
    ),
    offs: [],
  })
  const guides = Object.values(result.assignmentsByTourId).map((row) => row.tour_guide_id)
  assert.equal(guides.filter((email) => email === 'sean@x.com').length, 0)
  assert.equal(guides.filter((email) => email === 'dez@x.com').length, 2)
  assert.equal(guides.filter((email) => email === 'patricia@x.com').length, 2)
  assert.ok(
    result.slots.some((slot) => slot.reasonLines.some((line) => line.includes('영어가 첫 언어라'))),
  )
})

test('english-only tour falls back when every english-first guide is off', () => {
  const result = autoAssignSchedule({
    startDate: '2026-10-05',
    endDate: '2026-10-05',
    preset: 'equal',
    existingMode: 'reset',
    members: [
      member('sean@x.com', {
        name: 'Sean',
        languages: ['KR', 'EN'],
        guideProductSkills: { DAY: { eligible: true, priorities: { ko: 1, en: 3 } } },
      }),
      member('dez@x.com', { name: 'Dez', languages: ['EN'], guideProductSkills: {} }),
    ],
    tours: [tour('t1', '2026-10-05', { guestPeople: { ko: 0, ja: 0, en: 4 } })],
    offs: [{ email: 'dez@x.com', date: '2026-10-05' }],
  })
  assert.equal(result.assignmentsByTourId.t1.tour_guide_id, 'sean@x.com')
})

test('korean tours still prefer the product-checked guide', () => {
  const result = autoAssignSchedule({
    startDate: '2026-10-05',
    endDate: '2026-10-05',
    preset: 'equal',
    existingMode: 'reset',
    members: [
      member('sean@x.com', {
        name: 'Sean',
        languages: ['KR', 'EN'],
        guideProductSkills: { DAY: { eligible: true, priorities: { ko: 1, en: 3 } } },
      }),
      member('dez@x.com', { name: 'Dez', languages: ['EN'], guideProductSkills: {} }),
    ],
    tours: [tour('t1', '2026-10-05')],
    offs: [],
  })
  assert.equal(result.assignmentsByTourId.t1.tour_guide_id, 'sean@x.com')
})

test('english-only pair uses an english-first guide', () => {
  const result = autoAssignSchedule({
    startDate: '2026-10-05',
    endDate: '2026-10-05',
    preset: 'equal',
    existingMode: 'reset',
    members: [
      member('sean@x.com', {
        name: 'Sean',
        languages: ['KR', 'EN'],
        guideProductSkills: { DAY: { eligible: true, priorities: { en: 1 } } },
      }),
      member('dez@x.com', { name: 'Dez', languages: ['EN'], guideProductSkills: {}, cdl: false }),
      member('driver@x.com', { name: 'Driver', languages: ['EN'], guideProductSkills: {}, cdl: true }),
    ],
    tours: [tour('t1', '2026-10-05', { teamType: 'guide+driver', guestPeople: { ko: 0, ja: 0, en: 4 } })],
    offs: [],
  })
  assert.equal(result.assignmentsByTourId.t1.tour_guide_id, 'dez@x.com')
  assert.equal(result.assignmentsByTourId.t1.assistant_id, 'driver@x.com')
})

test('english guests are not assigned a guide who does not speak english', () => {
  const tours = [
    tour('night', '2026-10-09', {
      productId: 'MNGC1N',
      spanDays: 2,
      guestPeople: { ko: 0, ja: 0, en: 4 },
    }),
  ]
  const members = [
    member('martin@x.com', { languages: ['KR'], name: '마틴' }),
    member('alex@x.com', { languages: ['EN'], name: 'Alex' }),
  ]
  for (const preset of ['equal', 'priority', 'reviews'] as const) {
    const result = autoAssignSchedule({
      startDate: '2026-10-09',
      endDate: '2026-10-09',
      preset,
      members,
      tours,
      offs: [],
      reviewStats:
        preset === 'reviews'
          ? [
              { email: 'martin@x.com', avgRating: 5, reviewCount: 30, guestReviewRatePercent: 40 },
              { email: 'alex@x.com', avgRating: 4.2, reviewCount: 4, guestReviewRatePercent: 8 },
            ]
          : [],
    })
    assert.equal(result.assignmentsByTourId.night.tour_guide_id, 'alex@x.com', preset)
    assert.equal(result.assignmentsByTourId.night.assistant_id, null)
  }

  const pair = autoAssignSchedule({
    startDate: '2026-10-09',
    endDate: '2026-10-09',
    preset: 'priority',
    members: [
      member('martin@x.com', { languages: ['KR'], name: '마틴' }),
      member('alex@x.com', { languages: ['EN'], name: 'Alex' }),
    ],
    tours: [tour('pair', '2026-10-09', { teamType: '2guide', guestPeople: { ko: 2, ja: 0, en: 4 } })],
    offs: [],
  })
  const assigned = [pair.assignmentsByTourId.pair.tour_guide_id, pair.assignmentsByTourId.pair.assistant_id].sort()
  assert.deepEqual(assigned, ['alex@x.com', 'martin@x.com'])
})

test('refresh variant makes a different equal assignment', () => {
  const input = {
    startDate: '2026-10-04',
    endDate: '2026-10-05',
    preset: 'equal' as const,
    members: [member('a@x.com', { name: 'A' }), member('b@x.com', { name: 'B' })],
    tours: [tour('t1', '2026-10-04'), tour('t2', '2026-10-05')],
    offs: [],
  }
  const first = autoAssignSchedule({ ...input, variant: 0 })
  const second = autoAssignSchedule({ ...input, variant: 1 })
  assert.notEqual(first.assignmentsByTourId.t1.tour_guide_id, second.assignmentsByTourId.t1.tour_guide_id)
  assert.equal(first.assignmentsByTourId.t1.tour_guide_id, 'a@x.com')
  assert.equal(second.assignmentsByTourId.t1.tour_guide_id, 'b@x.com')
})

test('off days are skipped', () => {
  const result = autoAssignSchedule({
    startDate: '2026-10-04',
    endDate: '2026-10-04',
    preset: 'equal',
    members: [member('a@x.com', { name: 'A' }), member('b@x.com', { name: 'B' })],
    tours: [tour('t1', '2026-10-04')],
    offs: [{ email: 'a@x.com', date: '2026-10-04' }],
  })
  assert.equal(result.assignmentsByTourId.t1.tour_guide_id, 'b@x.com')
  assert.equal(result.slots.find((slot) => slot.tourId === 't1')?.unfilledReason, null)
})

test('equal preset splits tours instead of filling the first guide', () => {
  const result = autoAssignSchedule({
    startDate: '2026-10-04',
    endDate: '2026-10-07',
    preset: 'equal',
    members: [member('a@x.com', { name: 'A' }), member('b@x.com', { name: 'B' })],
    tours: [
      tour('t1', '2026-10-04'),
      tour('t2', '2026-10-05'),
      tour('t3', '2026-10-06'),
      tour('t4', '2026-10-07'),
    ],
    offs: [],
  })
  const guides = Object.values(result.assignmentsByTourId).map((row) => row.tour_guide_id)
  assert.equal(guides.filter((email) => email === 'a@x.com').length, 2)
  assert.equal(guides.filter((email) => email === 'b@x.com').length, 2)
})

test('priority preset gives more tours to the higher row', () => {
  const result = autoAssignSchedule({
    startDate: '2026-10-04',
    endDate: '2026-10-09',
    preset: 'priority',
    members: [member('a@x.com', { name: 'A' }), member('b@x.com', { name: 'B' })],
    tours: ['04', '05', '06', '07', '08', '09'].map((day, index) => tour(`t${index}`, `2026-10-${day}`)),
    offs: [],
  })
  const guides = Object.values(result.assignmentsByTourId).map((row) => row.tour_guide_id)
  const aCount = guides.filter((email) => email === 'a@x.com').length
  const bCount = guides.filter((email) => email === 'b@x.com').length
  assert.ok(aCount > bCount, `${aCount} vs ${bCount}`)
})

test('review preset gives more tours to the higher rating', () => {
  const result = autoAssignSchedule({
    startDate: '2026-10-04',
    endDate: '2026-10-09',
    preset: 'reviews',
    members: [member('a@x.com', { name: 'A' }), member('b@x.com', { name: 'B' })],
    tours: ['04', '05', '06', '07', '08', '09'].map((day, index) => tour(`t${index}`, `2026-10-${day}`)),
    offs: [],
    reviewStats: [
      { email: 'a@x.com', avgRating: 3, reviewCount: 1, guestReviewRatePercent: 10 },
      { email: 'b@x.com', avgRating: 5, reviewCount: 20, guestReviewRatePercent: 10 },
    ],
  })
  const guides = Object.values(result.assignmentsByTourId).map((row) => row.tour_guide_id)
  const aCount = guides.filter((email) => email === 'a@x.com').length
  const bCount = guides.filter((email) => email === 'b@x.com').length
  assert.ok(bCount > aCount, `${bCount} vs ${aCount}`)
})

test('guest review rate from the previous month outranks a single five-star review', () => {
  assert.equal(previousCalendarMonth(new Date(2026, 8, 22)).year, 2026)
  assert.equal(previousCalendarMonth(new Date(2026, 8, 22)).month, 8)
  assert.deepEqual(previousCalendarMonth(new Date(2026, 0, 5)), { year: 2025, month: 12 })
  assert.equal(
    guestReviewRatePercentOf({ reviewCount: 8, totalTourGuests: 40, guestReviewRatePercent: null }),
    20,
  )
  assert.equal(guestReviewRatePercentOf({ reviewCount: 1, totalTourGuests: 0, guestReviewRatePercent: 50 }), null)
  assert.ok(
    reviewPriorityScore({ avgRating: 5, guestReviewRatePercent: 2 }) <
      reviewPriorityScore({ avgRating: 4.7, guestReviewRatePercent: 20 }),
  )
  assert.ok(
    reviewPriorityScore({ avgRating: 4.8, guestReviewRatePercent: 40 }) >
      reviewPriorityScore({ avgRating: 4.8, guestReviewRatePercent: 5 }),
  )
  assert.equal(reviewPriorityScore({ avgRating: 5, guestReviewRatePercent: 0 }), 0)
  const result = autoAssignSchedule({
    startDate: '2026-10-04',
    endDate: '2026-10-09',
    preset: 'reviews',
    members: [member('few@x.com', { name: 'Few' }), member('many@x.com', { name: 'Many' })],
    tours: ['04', '05', '06', '07', '08', '09'].map((day, index) => tour(`t${index}`, `2026-10-${day}`)),
    offs: [],
    reviewStats: [
      { email: 'few@x.com', avgRating: 5, reviewCount: 1, guestReviewRatePercent: 2 },
      { email: 'many@x.com', avgRating: 4.7, reviewCount: 20, guestReviewRatePercent: 18 },
    ],
  })
  const guides = Object.values(result.assignmentsByTourId).map((row) => row.tour_guide_id)
  const few = guides.filter((email) => email === 'few@x.com').length
  const many = guides.filter((email) => email === 'many@x.com').length
  assert.ok(many > few, `${many} vs ${few}`)
})

test('joey and chad are used only when nobody else can take the tour', () => {
  const result = autoAssignSchedule({
    startDate: '2026-10-04',
    endDate: '2026-10-06',
    preset: 'equal',
    members: [
      member('joey@x.com', { name: 'Joey' }),
      member('a@x.com', { name: 'A' }),
      member('chad@x.com', { nameKo: '채드', name: 'Chad' }),
    ],
    tours: [tour('t1', '2026-10-04'), tour('t2', '2026-10-05'), tour('t3', '2026-10-06')],
    offs: [{ email: 'a@x.com', date: '2026-10-06' }],
  })
  assert.equal(result.assignmentsByTourId.t1.tour_guide_id, 'a@x.com')
  assert.equal(result.assignmentsByTourId.t2.tour_guide_id, 'a@x.com')
  assert.notEqual(result.assignmentsByTourId.t3.tour_guide_id, 'a@x.com')
  assert.ok(
    result.assignmentsByTourId.t3.tour_guide_id === 'joey@x.com' ||
      result.assignmentsByTourId.t3.tour_guide_id === 'chad@x.com',
  )
})

test('goblin cannot follow a previous-day schedule and the next day is rest', () => {
  const result = autoAssignSchedule({
    startDate: '2026-10-02',
    endDate: '2026-10-04',
    preset: 'equal',
    members: [member('g1@x.com', { name: 'G1' }), member('g2@x.com', { name: 'G2' })],
    tours: [
      tour('before', '2026-10-01', { guideEmail: 'g1@x.com' }),
      tour('d2', '2026-10-02', { isGoblin: true, productId: 'MDGCSUNRISE', teamType: '1guide' }),
      tour('d3', '2026-10-03', { isGoblin: true, productId: 'MDGCSUNRISE', teamType: '1guide' }),
      tour('d4', '2026-10-04', { isGoblin: true, productId: 'MDGCSUNRISE', teamType: '1guide' }),
    ],
    offs: [],
  })
  assert.equal(result.assignmentsByTourId.d2.tour_guide_id, 'g2@x.com')
  assert.equal(result.assignmentsByTourId.d3.tour_guide_id, 'g1@x.com')
  assert.equal(result.assignmentsByTourId.d4.tour_guide_id, 'g2@x.com')
})

test('never pairs are blocked and avoid pairs are a fallback', () => {
  const blocked = autoAssignSchedule({
    startDate: '2026-10-04',
    endDate: '2026-10-04',
    preset: 'equal',
    members: [
      member('a@x.com', { name: 'A', doNotTeamWith: ['b@x.com'] }),
      member('b@x.com', { name: 'B', doNotTeamWith: ['a@x.com'] }),
      member('c@x.com', { name: 'C' }),
    ],
    tours: [tour('t1', '2026-10-04', { teamType: '2guide' })],
    offs: [],
  })
  const pair = [
    blocked.assignmentsByTourId.t1.tour_guide_id,
    blocked.assignmentsByTourId.t1.assistant_id,
  ].sort()
  assert.deepEqual(pair, ['a@x.com', 'c@x.com'])
  assert.equal(blocked.slots.some((slot) => slot.avoidPair), false)

  const avoided = autoAssignSchedule({
    startDate: '2026-10-04',
    endDate: '2026-10-04',
    preset: 'equal',
    members: [
      member('a@x.com', { name: 'A', languages: ['KR'], avoidTeamWith: ['b@x.com'] }),
      member('b@x.com', { name: 'B', languages: ['JP'], avoidTeamWith: ['a@x.com'] }),
    ],
    tours: [tour('t1', '2026-10-04', { teamType: '2guide', guestPeople: { ko: 1, ja: 1, en: 0 } })],
    offs: [],
  })
  assert.equal(avoided.slots.every((slot) => slot.avoidPair), true)
})

test('keeping the current guide blocks that day and reset can move them', () => {
  const shared = {
    startDate: '2026-10-04',
    endDate: '2026-10-04',
    preset: 'equal' as const,
    members: [member('a@x.com', { name: 'A' }), member('b@x.com', { name: 'B' })],
    tours: [
      tour('taken', '2026-10-04', { guideEmail: 'a@x.com' }),
      tour('open', '2026-10-04'),
    ],
    offs: [],
  }
  const kept = autoAssignSchedule({ ...shared, existingMode: 'keep' })
  assert.equal(kept.assignmentsByTourId.taken.tour_guide_id, 'a@x.com')
  assert.equal(kept.assignmentsByTourId.open.tour_guide_id, 'b@x.com')
  const reset = autoAssignSchedule({ ...shared, existingMode: 'reset' })
  assert.equal(reset.assignmentsByTourId.open.tour_guide_id, 'a@x.com')
  assert.equal(reset.assignmentsByTourId.taken.tour_guide_id, 'b@x.com')
})

test('reset clears an assigned day and fills it again when the checked guide is already used', () => {
  const members = [
    member('skilled@x.com', { name: 'Skilled', guideProductSkills: { DAY: { eligible: true, priorities: {} } } }),
    member('other@x.com', { name: 'Other', guideProductSkills: {} }),
  ]
  const tours = [
    tour('first', '2026-10-04', { guideEmail: 'skilled@x.com' }),
    tour('second', '2026-10-04', { guideEmail: 'other@x.com' }),
  ]
  const reset = autoAssignSchedule({
    startDate: '2026-10-04',
    endDate: '2026-10-04',
    preset: 'equal',
    existingMode: 'reset',
    members,
    tours,
    offs: [],
  })
  const guides = [
    reset.assignmentsByTourId.first.tour_guide_id,
    reset.assignmentsByTourId.second.tour_guide_id,
  ]
  assert.equal(guides.filter(Boolean).length, 2)
  assert.equal(new Set(guides).size, 2)

  const kept = autoAssignSchedule({
    startDate: '2026-10-04',
    endDate: '2026-10-04',
    preset: 'equal',
    existingMode: 'keep',
    members,
    tours: [tour('held', '2026-10-04', { guideEmail: 'skilled@x.com' }), tour('open', '2026-10-04')],
    offs: [],
  })
  assert.equal(kept.assignmentsByTourId.held.tour_guide_id, 'skilled@x.com')
  assert.equal(kept.assignmentsByTourId.open.tour_guide_id, null)
})

test('locked guide stays and a free assistant is filled', () => {
  const result = autoAssignSchedule({
    startDate: '2026-10-04',
    endDate: '2026-10-04',
    preset: 'priority',
    members: [member('a@x.com', { name: 'A' }), member('b@x.com', { name: 'B' })],
    tours: [
      tour('t1', '2026-10-04', {
        teamType: '2guide',
        guideEmail: 'b@x.com',
        guideLocked: true,
      }),
    ],
    offs: [],
  })
  assert.equal(result.assignmentsByTourId.t1.tour_guide_id, 'b@x.com')
  assert.equal(result.assignmentsByTourId.t1.assistant_id, 'a@x.com')
})

test('one person cannot take two tours on the same day or overlapping multi-day', () => {
  const result = autoAssignSchedule({
    startDate: '2026-10-04',
    endDate: '2026-10-05',
    preset: 'priority',
    members: [member('a@x.com', { name: 'A' }), member('b@x.com', { name: 'B' })],
    tours: [
      tour('long', '2026-10-04', { spanDays: 2 }),
      tour('next', '2026-10-05'),
    ],
    offs: [],
  })
  assert.notEqual(result.assignmentsByTourId.long.tour_guide_id, result.assignmentsByTourId.next.tour_guide_id)
})

test('overnight tours assign one guide even when the stored team type is two guides', () => {
  const direct = autoAssignSchedule({
    startDate: '2026-10-04',
    endDate: '2026-10-06',
    preset: 'equal',
    members: [member('a@x.com'), member('b@x.com')],
    tours: [tour('night', '2026-10-04', { productId: 'MNGC1N', teamType: '2guide', spanDays: 2 })],
    offs: [],
  })
  assert.equal(direct.assignmentsByTourId.night.assistant_id, null)
  assert.ok(direct.assignmentsByTourId.night.tour_guide_id)
  const preview = prepareAutoAssignSchedule({
    startDate: '2026-10-04',
    endDate: '2026-10-04',
    preset: 'equal',
    reviewStats: [],
    memberOrder: ['a@x.com', 'b@x.com'],
    teamMembers: [
      { email: 'a@x.com', name_ko: 'A', languages: ['KR'], is_active: true, guide_product_skills: { MNGC1N: { eligible: true, priorities: {} } } },
      { email: 'b@x.com', name_ko: 'B', languages: ['KR'], is_active: true, guide_product_skills: { MNGC1N: { eligible: true, priorities: {} } } },
    ],
    products: [{ id: 'MNGC1N', name_ko: '그랜드서클 1박 2일' }],
    productOrder: ['MNGC1N'],
    productColors: { MNGC1N: 'bg-sky-500' },
    tours: [
      {
        id: 'night',
        tour_date: '2026-10-04',
        product_id: 'MNGC1N',
        tour_status: 'scheduled',
        team_type: '2guide',
        reservation_ids: ['r1'],
      },
    ],
    reservations: [{ id: 'r1', status: 'confirmed', total_people: 6, tour_date: '2026-10-04', product_id: 'MNGC1N', tour_language: 'ko' }],
    customers: [],
    offs: [],
  })
  assert.equal(preview.result.assignmentsByTourId.night.assistant_id, null)
  const model = buildAutoAssignPreviewGridModel({
    preview,
    teamMembers: [
      { email: 'a@x.com', name_ko: 'A' },
      { email: 'b@x.com', name_ko: 'B' },
    ],
    products: [{ id: 'MNGC1N', name: '그랜드서클 1박 2일', name_ko: '그랜드서클 1박 2일' }],
    selectedProducts: ['MNGC1N'],
    miscTourProductIds: [],
    productColors: { MNGC1N: 'bg-sky-500' },
    defaultPresetIds: ['preset_0'],
    airportPickupMemberIdSet: new Set(),
    airportSendingMemberIdSet: new Set(),
    getMultiDayTourDays: (productId) => (productId.startsWith('MNGC1N') ? 2 : 1),
  })
  const guideEmail = preview.result.assignmentsByTourId.night.tour_guide_id || ''
  assert.equal(model.guideScheduleData[guideEmail]?.dailyData['2026-10-04']?.assignedPeople, 6)
  assert.equal(model.guideScheduleData[guideEmail]?.dailyData['2026-10-04']?.isMultiDay, true)
  assert.equal(model.guideScheduleData[guideEmail]?.dailyData['2026-10-04']?.productColors.MNGC1N, 'bg-sky-500')
})

test('guide+driver assistant slot requires a CDL', () => {
  const result = autoAssignSchedule({
    startDate: '2026-10-04',
    endDate: '2026-10-04',
    preset: 'equal',
    members: [
      member('guide@x.com', { name: 'Guide', languages: ['KR'], cdl: false }),
      member('nocdl@x.com', { name: 'No', languages: ['EN'], cdl: false }),
      member('driver@x.com', { name: 'Driver', languages: ['EN'], cdl: true }),
    ],
    tours: [tour('t1', '2026-10-04', { teamType: 'guide+driver' })],
    offs: [],
  })
  assert.equal(result.assignmentsByTourId.t1.assistant_id, 'driver@x.com')
})

test('missing review stats fall back to equal assignment', () => {
  const result = autoAssignSchedule({
    startDate: '2026-10-04',
    endDate: '2026-10-05',
    preset: 'reviews',
    members: [member('a@x.com'), member('b@x.com')],
    tours: [tour('t1', '2026-10-04'), tour('t2', '2026-10-05')],
    offs: [],
    reviewStats: null,
  })
  assert.equal(result.reviewStatsUnavailable, true)
  assert.equal(result.effectivePreset, 'equal')
  const guides = Object.values(result.assignmentsByTourId).map((row) => row.tour_guide_id)
  assert.equal(new Set(guides).size, 2)
})

test('preview keeps the three days before the range and pending off requests', () => {
  assert.deepEqual(autoAssignContextDates('2026-10-04'), ['2026-10-01', '2026-10-02', '2026-10-03'])
  const offs = mergeAutoAssignOffRows({
    rows: [
      { team_email: 'a@x.com', off_date: '2026-10-02', reason: '신청', status: 'pending' },
      { team_email: 'b@x.com', off_date: '2026-10-05', reason: '승인', status: 'approved' },
    ],
    pending: [{ team_email: 'c@x.com', off_date: '2026-10-06', reason: '추가', status: 'pending', action: 'approve' }],
  })
  assert.equal(offs.length, 3)
  assert.equal(offs.find((row) => row.team_email === 'a@x.com')?.status, 'pending')
  const preview = prepareAutoAssignSchedule({
    startDate: '2026-10-04',
    endDate: '2026-10-04',
    preset: 'equal',
    reviewStats: [],
    memberOrder: ['a@x.com'],
    teamMembers: [{ email: 'a@x.com', name_ko: 'A', languages: ['KR'], is_active: true, guide_product_skills: { DAY: { eligible: true, priorities: {} } } }],
    products: [{ id: 'DAY', name_ko: '데이' }],
    productOrder: ['DAY'],
    productColors: {},
    tours: [
      { id: 'before', tour_date: '2026-10-03', product_id: 'DAY', tour_status: 'scheduled', tour_guide_id: 'a@x.com' },
      { id: 'inside', tour_date: '2026-10-04', product_id: 'DAY', tour_status: 'scheduled', tour_guide_id: null },
    ],
    reservations: [],
    customers: [],
    offs: [],
    offRows: offs,
  })
  assert.deepEqual(preview.contextDates, ['2026-10-01', '2026-10-02', '2026-10-03'])
  assert.deepEqual(preview.dates, ['2026-10-04'])
  assert.equal(preview.offSchedules.length, 3)
  const overlaid = overlayAutoAssignScheduleTours(
    preview.sourceTours,
    preview.result.assignmentsByTourId,
    preview.dates[0],
    preview.dates[0],
  )
  assert.equal(overlaid.find((tour) => tour.id === 'before')?.tour_guide_id, 'a@x.com')
  assert.equal(overlaid.find((tour) => tour.id === 'inside')?.tour_guide_id, 'a@x.com')
})

test('saved guide columns stay in place when the guide list is rebuilt', () => {
  const guides = [
    { email: 'Sean@x.com', name: 'Sean' },
    { email: 'dez@x.com', name: 'Dez' },
    { email: 'new@x.com', name: 'New' },
  ]
  const saved = mergeGuidePlan(guides, [
    { email: 'dez@x.com', rank: 'priority', weeklyLoad: 2 },
    { email: 'sean@x.com', rank: 'low', weeklyLoad: 1 },
  ])
  assert.equal(saved.find((entry) => entry.email === 'dez@x.com')?.rank, 'priority')
  assert.equal(saved.find((entry) => entry.email === 'Sean@x.com')?.rank, 'low')
  assert.equal(saved.find((entry) => entry.email === 'Sean@x.com')?.weeklyLoad, 1)
  assert.equal(saved.find((entry) => entry.email === 'new@x.com')?.rank, 'normal')
  const again = mergeGuidePlan(
    [
      { email: 'new@x.com', name: 'New' },
      { email: 'Sean@x.com', name: 'Sean' },
      { email: 'dez@x.com', name: 'Dez' },
    ],
    saved,
  )
  assert.ok(sameGuidePlan(again, saved))
})

test('guide plan keeps a standby guide until nobody else can take the tour', () => {
  const plan = [
    { email: 'a@x.com', rank: 'normal' as const, weeklyLoad: 3 as const },
    { email: 'antony@x.com', rank: 'standby' as const, weeklyLoad: 3 as const },
  ]
  const open = autoAssignSchedule({
    startDate: '2026-10-05',
    endDate: '2026-10-05',
    preset: 'equal',
    members: [member('a@x.com', { name: 'A' }), member('antony@x.com', { name: 'Antony' })],
    tours: [tour('t1', '2026-10-05')],
    offs: [],
    guidePlan: plan,
  })
  assert.equal(open.assignmentsByTourId.t1.tour_guide_id, 'a@x.com')

  const fallback = autoAssignSchedule({
    startDate: '2026-10-05',
    endDate: '2026-10-05',
    preset: 'equal',
    members: [member('a@x.com', { name: 'A' }), member('antony@x.com', { name: 'Antony' })],
    tours: [tour('t1', '2026-10-05')],
    offs: [{ email: 'a@x.com', date: '2026-10-05' }],
    guidePlan: plan,
  })
  assert.equal(fallback.assignmentsByTourId.t1.tour_guide_id, 'antony@x.com')
  assert.ok(fallback.slots.some((slot) => slot.reasonLines.some((line) => line.includes('배정 안 함'))))
})

test('equal assignment shares tours across ranks and only breaks ties', () => {
  const result = autoAssignSchedule({
    startDate: '2026-10-05',
    endDate: '2026-10-09',
    preset: 'equal',
    members: [
      member('first@x.com', { name: 'First' }),
      member('second@x.com', { name: 'Second' }),
      member('third@x.com', { name: 'Third' }),
    ],
    tours: ['05', '06', '07', '08', '09'].map((day, index) => tour(`t${index}`, `2026-10-${day}`)),
    offs: [],
    guidePlan: [
      { email: 'first@x.com', rank: 'priority', weeklyLoad: 3 },
      { email: 'second@x.com', rank: 'normal', weeklyLoad: 3 },
      { email: 'third@x.com', rank: 'low', weeklyLoad: 3 },
    ],
  })
  const guides = Object.values(result.assignmentsByTourId).map((row) => row.tour_guide_id)
  const count = (email: string) => guides.filter((item) => item === email).length
  assert.equal(count('first@x.com'), 2)
  assert.equal(count('second@x.com'), 2)
  assert.equal(count('third@x.com'), 1)
  const odd = autoAssignSchedule({
    startDate: '2026-10-05',
    endDate: '2026-10-09',
    preset: 'equal',
    members: [member('high@x.com', { name: 'High' }), member('low@x.com', { name: 'Low' })],
    tours: ['05', '06', '07', '08', '09'].map((day, index) => tour(`t${index}`, `2026-10-${day}`)),
    offs: [],
    guidePlan: [
      { email: 'high@x.com', rank: 'priority', weeklyLoad: 3 },
      { email: 'low@x.com', rank: 'low', weeklyLoad: 3 },
    ],
  })
  const oddGuides = Object.values(odd.assignmentsByTourId).map((row) => row.tour_guide_id)
  assert.equal(oddGuides.filter((email) => email === 'high@x.com').length, 3)
  assert.equal(oddGuides.filter((email) => email === 'low@x.com').length, 2)
})

test('a one-tour week stops before a lower rank is skipped for a second tour', () => {
  const result = autoAssignSchedule({
    startDate: '2026-10-05',
    endDate: '2026-10-06',
    preset: 'equal',
    members: [member('once@x.com', { name: 'Once' }), member('open@x.com', { name: 'Open' })],
    tours: [tour('t1', '2026-10-05'), tour('t2', '2026-10-06')],
    offs: [],
    guidePlan: [
      { email: 'once@x.com', rank: 'priority', weeklyLoad: 1 },
      { email: 'open@x.com', rank: 'normal', weeklyLoad: 3 },
    ],
  })
  const guides = [result.assignmentsByTourId.t1.tour_guide_id, result.assignmentsByTourId.t2.tour_guide_id].sort()
  assert.deepEqual(guides, ['once@x.com', 'open@x.com'])
})

test('duplicate reservation rows are counted once on the preview', () => {
  const preview = prepareAutoAssignSchedule({
    startDate: '2026-10-04',
    endDate: '2026-10-04',
    preset: 'equal',
    reviewStats: [],
    memberOrder: ['a@x.com'],
    teamMembers: [{ email: 'a@x.com', name_ko: 'A', languages: ['KR'], is_active: true }],
    products: [{ id: 'DAY', name_ko: '데이' }],
    productOrder: ['DAY'],
    productColors: {},
    tours: [{ id: 't1', tour_date: '2026-10-04', product_id: 'DAY', tour_status: 'scheduled' }],
    reservations: [
      { id: 'r1', status: 'confirmed', total_people: 5 },
      { id: 'r1', status: 'confirmed', total_people: 5 },
    ],
    customers: [],
    offs: [],
  })
  assert.equal(preview.sourceReservations.length, 1)
  const model = buildAutoAssignPreviewGridModel({
    preview: {
      ...preview,
      sourceReservations: [
        { id: 'r1', status: 'confirmed', total_people: 5, product_id: 'DAY', tour_date: '2026-10-04' },
        { id: 'r1', status: 'confirmed', total_people: 5, product_id: 'DAY', tour_date: '2026-10-04' },
      ],
    },
    teamMembers: [{ email: 'a@x.com', name_ko: 'A' }],
    products: [{ id: 'DAY', name: '데이', name_ko: '데이' }],
    selectedProducts: ['DAY'],
    miscTourProductIds: [],
    productColors: {},
    defaultPresetIds: ['preset_0'],
    airportPickupMemberIdSet: new Set(),
    airportSendingMemberIdSet: new Set(),
    getMultiDayTourDays: () => 1,
  })
  assert.equal(model.productScheduleData.DAY?.dailyData['2026-10-04']?.totalPeople, 5)
})
