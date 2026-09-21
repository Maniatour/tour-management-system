import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isOtaReviewPlatformDue,
  otaLastActivityAt,
  reviewClassificationWorkCount,
} from '@/lib/reviewClassificationTodo'

const TODAY = '2026-09-19'

test('오늘 가져온 OTA 리뷰는 업데이트가 필요 없다', () => {
  assert.equal(
    isOtaReviewPlatformDue(
      {
        lastImportedAt: '2026-09-19T16:05:00.000Z',
        checkStatus: null,
        checkedAt: null,
      },
      TODAY
    ),
    false
  )
})

test('오늘 리뷰없음이면 업데이트가 필요 없다', () => {
  assert.equal(
    isOtaReviewPlatformDue(
      {
        lastImportedAt: '2026-09-17T20:00:00.000Z',
        checkStatus: 'no_review',
        checkedAt: '2026-09-19T18:00:00.000Z',
      },
      TODAY
    ),
    false
  )
})

test('어제 리뷰없음이면 마지막 활동은 리뷰없음 시각이고 오늘은 다시 확인한다', () => {
  const platform = {
    lastImportedAt: '2026-09-17T20:00:00.000Z',
    checkStatus: 'no_review' as const,
    checkedAt: '2026-09-18T17:55:00.000Z',
  }
  assert.equal(otaLastActivityAt(platform), '2026-09-18T17:55:00.000Z')
  assert.equal(isOtaReviewPlatformDue(platform, TODAY), true)
})

test('가져오기가 리뷰없음보다 최근이면 가져오기 시각이 마지막 업데이트다', () => {
  assert.equal(
    otaLastActivityAt({
      lastImportedAt: '2026-09-19T16:00:00.000Z',
      checkStatus: 'no_review',
      checkedAt: '2026-09-18T17:55:00.000Z',
    }),
    '2026-09-19T16:00:00.000Z'
  )
})

test('어제 가져왔고 오늘 체크가 없으면 업데이트가 필요하다', () => {
  assert.equal(
    isOtaReviewPlatformDue(
      {
        lastImportedAt: '2026-09-18T20:00:00.000Z',
        checkStatus: null,
        checkedAt: null,
      },
      TODAY
    ),
    true
  )
})

test('미분류 구글 + 기한 지난 OTA 건수를 합친다', () => {
  assert.equal(
    reviewClassificationWorkCount(
      2,
      [
        { lastImportedAt: '2026-09-19T16:00:00.000Z', checkStatus: null, checkedAt: null },
        { lastImportedAt: '2026-09-17T16:00:00.000Z', checkStatus: null, checkedAt: null },
      ],
      TODAY
    ),
    3
  )
})
