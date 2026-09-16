import assert from 'node:assert/strict'
import test from 'node:test'
import {
  addScheduleProductCellPulseReason,
  collectStaffScheduleLocales,
  customerLanguageToScheduleBucket,
  findTourGuideLanguageMismatch,
  reservationToScheduleBucket,
  scheduleGuideLanguageMismatchLine,
  scheduleProductCellLangBgClass,
  scheduleProductCellPulseReasonLabel,
} from './scheduleGuideLanguageMatch'

test('customerLanguageToScheduleBucket maps Korean, Japanese, and fallback English', () => {
  assert.equal(customerLanguageToScheduleBucket('한국어'), 'ko')
  assert.equal(customerLanguageToScheduleBucket('KR'), 'ko')
  assert.equal(customerLanguageToScheduleBucket('일본어'), 'ja')
  assert.equal(customerLanguageToScheduleBucket('JP'), 'ja')
  assert.equal(customerLanguageToScheduleBucket('日本語'), 'ja')
  assert.equal(customerLanguageToScheduleBucket('EN'), 'en')
  assert.equal(customerLanguageToScheduleBucket(null), 'en')
})

test('reservationToScheduleBucket uses stored tour language, not customer nationality', () => {
  assert.equal(reservationToScheduleBucket('en', 'JA'), 'en')
  assert.equal(reservationToScheduleBucket('ja', 'EN'), 'ja')
  assert.equal(reservationToScheduleBucket(null, 'KR'), 'ko')
  assert.equal(reservationToScheduleBucket(null, 'JA'), 'en')
})

test('collectStaffScheduleLocales reads KR/EN/JP team codes', () => {
  const locales = collectStaffScheduleLocales([{ languages: ['KR', 'EN'] }, { languages: ['JP'] }])
  assert.deepEqual(locales, ['ko', 'ja', 'en'])
})

test('Japanese guests with Korean-only guide are a mismatch', () => {
  const staffByEmail = new Map([['guide@x.com', { languages: ['KR'] }]])
  const mismatch = findTourGuideLanguageMismatch({
    tourId: 't1',
    teamIndex: 1,
    guideName: '민수',
    assistantName: '—',
    guideEmail: 'guide@x.com',
    guestPeople: { ko: 0, ja: 4, en: 0 },
    staffByEmail,
  })
  assert.ok(mismatch)
  assert.deepEqual(mismatch?.missingLocales, ['ja'])
})

test('Korean guests with English-only guide are a mismatch', () => {
  const staffByEmail = new Map([['guide@x.com', { languages: ['EN'] }]])
  const mismatch = findTourGuideLanguageMismatch({
    tourId: 't1',
    teamIndex: 1,
    guideName: 'Alex',
    assistantName: '—',
    guideEmail: 'guide@x.com',
    guestPeople: { ko: 3, ja: 0, en: 0 },
    staffByEmail,
  })
  assert.ok(mismatch)
  assert.deepEqual(mismatch?.missingLocales, ['ko'])
})

test('1guide team type still counts assistant or driver languages', () => {
  const staffByEmail = new Map([
    ['guide@x.com', { languages: ['EN'] }],
    ['driver@x.com', { languages: ['JP'] }],
  ])
  const mismatch = findTourGuideLanguageMismatch({
    tourId: 't1',
    teamIndex: 1,
    guideName: 'Alex',
    assistantName: '유키',
    guideEmail: 'guide@x.com',
    assistantEmail: 'driver@x.com',
    teamType: '1guide',
    guestPeople: { ko: 0, ja: 4, en: 0 },
    staffByEmail,
  })
  assert.equal(mismatch, null)
})

test('guide+driver counts driver languages from assistant_id', () => {
  const staffByEmail = new Map([
    ['guide@x.com', { languages: ['KR'] }],
    ['driver@x.com', { languages: ['JP', 'EN'] }],
  ])
  const mismatch = findTourGuideLanguageMismatch({
    tourId: 't1',
    teamIndex: 2,
    guideName: '민수',
    assistantName: 'Ken',
    guideEmail: 'guide@x.com',
    assistantEmail: 'driver@x.com',
    teamType: 'guide+driver',
    guestPeople: { ko: 2, ja: 3, en: 0 },
    staffByEmail,
  })
  assert.equal(mismatch, null)
})

test('Japanese guests match when assistant speaks Japanese', () => {
  const staffByEmail = new Map([
    ['guide@x.com', { languages: ['KR', 'EN'] }],
    ['asst@x.com', { languages: ['JP'] }],
  ])
  const mismatch = findTourGuideLanguageMismatch({
    tourId: 't1',
    teamIndex: 1,
    guideName: '민수',
    assistantName: '유키',
    guideEmail: 'guide@x.com',
    assistantEmail: 'asst@x.com',
    guestPeople: { ko: 2, ja: 3, en: 0 },
    staffByEmail,
  })
  assert.equal(mismatch, null)
})

test('English-only guests do not require an English language flag', () => {
  const staffByEmail = new Map([['guide@x.com', { languages: ['KR'] }]])
  const mismatch = findTourGuideLanguageMismatch({
    tourId: 't1',
    teamIndex: 1,
    guideName: '민수',
    assistantName: '—',
    guideEmail: 'guide@x.com',
    guestPeople: { ko: 0, ja: 0, en: 6 },
    staffByEmail,
  })
  assert.equal(mismatch, null)
})

test('no assigned staff skips language mismatch', () => {
  const mismatch = findTourGuideLanguageMismatch({
    tourId: 't1',
    teamIndex: 1,
    guideName: '—',
    assistantName: '—',
    guestPeople: { ko: 0, ja: 2, en: 0 },
    staffByEmail: new Map(),
  })
  assert.equal(mismatch, null)
})

test('scheduleProductCellLangBgClass uses a distinct color per language mix', () => {
  assert.equal(scheduleProductCellLangBgClass(2, 0, 0), 'bg-yellow-100')
  assert.equal(scheduleProductCellLangBgClass(0, 2, 0), 'bg-red-100')
  assert.equal(scheduleProductCellLangBgClass(0, 0, 2), 'bg-sky-100')
  assert.equal(scheduleProductCellLangBgClass(2, 3, 0), 'bg-orange-100')
  assert.equal(scheduleProductCellLangBgClass(2, 0, 1), 'bg-lime-100')
  assert.equal(scheduleProductCellLangBgClass(0, 2, 1), 'bg-violet-100')
  assert.equal(scheduleProductCellLangBgClass(2, 3, 1), 'bg-amber-100')
})

test('pulse reason badges put guide language first and keep labels', () => {
  const map = new Map()
  addScheduleProductCellPulseReason(map, 'p1', '2026-09-16', { kind: 'capacity_overflow' })
  addScheduleProductCellPulseReason(map, 'p1', '2026-09-16', {
    kind: 'guide_language',
    missingLocales: ['ja'],
  })
  const reasons = map.get('p1|2026-09-16') || []
  assert.equal(reasons[0]?.kind, 'guide_language')
  assert.equal(scheduleProductCellPulseReasonLabel(reasons[0], 'ko'), '가이드 언어 · 일본어')
})

test('mismatch line is short: Japanese needed, no spoken-language clause', () => {
  const line = scheduleGuideLanguageMismatchLine(
    {
      tourId: 't1',
      teamIndex: 2,
      guideName: 'Patricia',
      assistantName: 'Jesus (헤이수스)',
      guestLocales: ['ja'],
      staffLocales: ['en'],
      missingLocales: ['ja'],
      guestPeople: { ko: 0, ja: 6, en: 0 },
    },
    'ko',
  )
  assert.equal(line, '팀2 Patricia, Jesus (헤이수스): 일본어 필요')
  assert.equal(line.includes('구사'), false)
})
