import assert from 'node:assert/strict'
import test from 'node:test'
import {
  googleReviewImportNotifyIdsAtOrBefore,
  mergeGoogleReviewImportNotifyRows,
  pickLatestGoogleReviewImportNotification,
} from '@/lib/googleReviewImportNotifyQueue'
import type { GoogleReviewImportNotifyRow } from '@/lib/googleReviewImportNotify'

function row(partial: Partial<GoogleReviewImportNotifyRow>): GoogleReviewImportNotifyRow {
  return {
    id: 'n1',
    operator_id: 'op-1',
    imported_count: 1,
    updated_count: 0,
    classified_count: 0,
    unclassified_count: 1,
    created_at: '2026-09-10T04:00:00.000Z',
    ...partial,
  }
}

test('닫을 때 현재 알림과 그 이전 건만 함께 닫는다', () => {
  const older = row({ id: 'n1', created_at: '2026-09-11T04:00:00.000Z' })
  const current = row({ id: 'n2', created_at: '2026-09-14T04:00:00.000Z' })
  const newer = row({ id: 'n3', created_at: '2026-09-15T04:00:00.000Z' })

  assert.deepEqual(googleReviewImportNotifyIdsAtOrBefore([older, current, newer], current.created_at).sort(), [
    'n1',
    'n2',
  ])
})

test('미열람 알림이 여러 건이면 최신 한 건만 고른다', () => {
  const rows = [
    row({ id: 'n1', created_at: '2026-09-11T04:00:00.000Z' }),
    row({ id: 'n5', created_at: '2026-09-15T04:00:00.000Z' }),
    row({ id: 'n2', created_at: '2026-09-12T04:00:00.000Z' }),
    row({ id: 'n4', created_at: '2026-09-14T04:00:00.000Z' }),
    row({ id: 'n3', created_at: '2026-09-13T04:00:00.000Z' }),
  ]

  const latest = pickLatestGoogleReviewImportNotification(rows, new Set())
  assert.equal(latest?.id, 'n5')
})

test('이미 닫은 최신 알림은 건너뛰고 그다음 최신을 고른다', () => {
  const rows = [
    row({ id: 'n1', created_at: '2026-09-11T04:00:00.000Z' }),
    row({ id: 'n2', created_at: '2026-09-15T04:00:00.000Z' }),
  ]

  const latest = pickLatestGoogleReviewImportNotification(rows, new Set(['n2']))
  assert.equal(latest?.id, 'n1')
})

test('같은 id는 최신 행으로 덮어쓴다', () => {
  const merged = mergeGoogleReviewImportNotifyRows(
    [row({ id: 'n1', imported_count: 1 })],
    [row({ id: 'n1', imported_count: 4 }), row({ id: 'n2', imported_count: 2 })]
  )

  assert.equal(merged.find((item) => item.id === 'n1')?.imported_count, 4)
  assert.equal(merged.length, 2)
})
