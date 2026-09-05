import assert from 'node:assert/strict'
import test from 'node:test'
import { buildDailyReportTourReportEntry } from '@/lib/dailyReport/buildDailyReportTourReports'

test('buildDailyReportTourReportEntry flags issues and skips empty lost-item labels', () => {
  const entry = buildDailyReportTourReportEntry(
    {
      id: 'r1',
      tour_id: 't1',
      user_email: 'guide@example.com',
      submitted_on: '2026-09-04T18:00:00.000Z',
      weather: 'sunny',
      overall_mood: 'poor',
      customer_count: 12,
      booked_customer_count: 14,
      incidents_delays_health: ['교통 지연'],
      lost_items_damage: ['분실물 없음', '휴대폰 분실'],
      vehicle_condition_tags: ['ok', 'needs_wash'],
      vehicle_condition_note: '세차 필요',
      skipped_stops: { stop1: { reason: 'time', note: '일몰 시간 부족' } },
      guest_comments: '고객이 더위를 호소함',
      handoff_note: null,
      comments: null,
      suggestions_followup: null,
      narration_not_played: true,
      narration_explained_in_person: true,
      narration_skip_reason: null,
      issue_photo_urls: ['https://example.com/a.jpg'],
    },
    '가이드A',
    'guide'
  )

  assert.equal(entry.hasIssues, true)
  assert.deepEqual(entry.lostItems, ['휴대폰 분실'])
  assert.equal(entry.skippedStops.length, 1)
  assert.equal(entry.photoCount, 1)
  assert.match(entry.narrationSkipTitleKo || '', /나레이션/)
  assert.equal(entry.weather, 'sunny')
  assert.equal(entry.overallMood, 'poor')
})

test('buildDailyReportTourReportEntry treats all-clear reports as no issues', () => {
  const entry = buildDailyReportTourReportEntry(
    {
      id: 'r2',
      tour_id: 't2',
      user_email: 'guide@example.com',
      submitted_on: null,
      weather: 'sunny',
      overall_mood: 'good',
      customer_count: 8,
      booked_customer_count: 8,
      incidents_delays_health: [],
      lost_items_damage: ['분실물 없음'],
      vehicle_condition_tags: ['ok'],
      vehicle_condition_note: null,
      skipped_stops: {},
      guest_comments: null,
      handoff_note: null,
      comments: null,
      suggestions_followup: null,
      narration_not_played: false,
      narration_explained_in_person: false,
      narration_skip_reason: null,
      issue_photo_urls: [],
    },
    '가이드B',
    'guide'
  )

  assert.equal(entry.hasIssues, false)
  assert.deepEqual(entry.lostItems, [])
  assert.equal(entry.narrationSkipTitleKo, null)
})
