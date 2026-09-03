import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildTourReportReminderCopy,
  groupMissingReminderRecipients,
  type TourReportStatusTour,
} from '@/lib/tourReportMissing'

const sampleTours: TourReportStatusTour[] = [
  {
    tourId: 't1',
    tourDate: '2026-09-01',
    productName: '밤도깨비',
    tourStatus: 'Confirmed',
    staff: [],
    missingStaff: [
      {
        email: 'a@example.com',
        name: '가이드A',
        role: 'guide',
        hasReport: false,
        reportId: null,
        submittedOn: null,
        phone: '7021112222',
        phoneE164: '+17021112222',
        locale: 'ko',
      },
    ],
  },
  {
    tourId: 't2',
    tourDate: '2026-09-02',
    productName: 'Grand Canyon',
    tourStatus: 'Confirmed',
    staff: [],
    missingStaff: [
      {
        email: 'a@example.com',
        name: '가이드A',
        role: 'guide',
        hasReport: false,
        reportId: null,
        submittedOn: null,
        phone: '7021112222',
        phoneE164: '+17021112222',
        locale: 'ko',
      },
      {
        email: 'b@example.com',
        name: '어시B',
        role: 'assistant',
        hasReport: false,
        reportId: null,
        submittedOn: null,
        phone: null,
        phoneE164: null,
        locale: 'en',
      },
    ],
  },
]

test('groupMissingReminderRecipients groups by email and can filter targets', () => {
  const all = groupMissingReminderRecipients(sampleTours, null)
  assert.equal(all.length, 2)
  const guide = all.find((row) => row.email === 'a@example.com')
  assert.ok(guide)
  assert.equal(guide?.tours.length, 2)

  const filtered = groupMissingReminderRecipients(sampleTours, [
    { tourId: 't2', email: 'b@example.com' },
  ])
  assert.equal(filtered.length, 1)
  assert.equal(filtered[0]?.email, 'b@example.com')
  assert.equal(filtered[0]?.tours.length, 1)
})

test('buildTourReportReminderCopy lists tours in Korean SMS', () => {
  const copy = buildTourReportReminderCopy({
    locale: 'ko',
    name: '가이드A',
    tours: [
      { tourDate: '2026-09-01', productName: '밤도깨비' },
      { tourDate: '2026-09-02', productName: 'Grand Canyon' },
    ],
    guideUrl: 'https://www.maniatour.com/ko/guide',
  })
  assert.match(copy.smsBody, /밤도깨비/)
  assert.match(copy.smsBody, /9\/1/)
  assert.match(copy.emailSubject, /2건/)
  assert.match(copy.pushTitle, /투어 리포트/)
})
