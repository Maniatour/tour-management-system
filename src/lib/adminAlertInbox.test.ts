import assert from 'node:assert/strict'
import test from 'node:test'
import {
  adminAlertId,
  clampAdminAlertInboxPage,
  countUnreadAdminAlerts,
  filterAdminAlertInboxByTab,
  makeAdminAlertDraft,
  markAdminAlertRead,
  markAllAdminAlertsRead,
  parseAdminAlertInbox,
  sliceAdminAlertInboxPage,
  upsertAdminAlertInbox,
  type AdminAlertInboxItem,
} from '@/lib/adminAlertInbox'

function item(partial: Partial<AdminAlertInboxItem> = {}): AdminAlertInboxItem {
  return {
    id: 'customer_payment:p1',
    kind: 'customer_payment',
    title: '고객 결제 완료',
    body: 'Jane · $199',
    createdAt: '2026-09-15T10:00:00.000Z',
    read: false,
    ...partial,
  }
}

test('같은 id는 읽음 상태를 유지한 채 본문만 갱신한다', () => {
  const existing = [item({ read: true, body: '이전' })]
  const next = upsertAdminAlertInbox(
    existing,
    makeAdminAlertDraft('customer_payment', 'p1', {
      title: '고객 결제 완료',
      body: 'Jane · $250',
    })
  )
  assert.equal(next.length, 1)
  assert.equal(next[0].read, true)
  assert.equal(next[0].body, 'Jane · $250')
})

test('새 알림은 맨 앞에 쌓이고 읽지 않음으로 들어간다', () => {
  const next = upsertAdminAlertInbox(
    [item()],
    makeAdminAlertDraft('tour_chat', 'm1', {
      title: '새 투어 채팅 메시지',
      body: '안녕하세요',
      createdAt: '2026-09-15T11:00:00.000Z',
    })
  )
  assert.equal(next[0].id, adminAlertId('tour_chat', 'm1'))
  assert.equal(next[0].read, false)
  assert.equal(next.length, 2)
})

test('읽음 처리와 전체 읽음 처리가 맞다', () => {
  const items = [item({ id: 'a', read: false }), item({ id: 'b', read: false })]
  assert.equal(countUnreadAdminAlerts(items), 2)
  const one = markAdminAlertRead(items, 'a')
  assert.equal(countUnreadAdminAlerts(one), 1)
  assert.equal(countUnreadAdminAlerts(markAllAdminAlertsRead(one)), 0)
})

test('잘못된 저장 값은 건너뛴다', () => {
  const parsed = parseAdminAlertInbox([
    { id: 'x' },
    item({ id: 'customer_payment:ok' }),
    item({ id: 'customer_payment:ok' }),
  ])
  assert.equal(parsed.length, 1)
  assert.equal(parsed[0].id, 'customer_payment:ok')
})

test('읽음 탭과 안 읽음 탭으로 나눈다', () => {
  const items = [
    item({ id: 'a', read: false }),
    item({ id: 'b', read: true }),
    item({ id: 'c', read: false }),
  ]
  assert.deepEqual(
    filterAdminAlertInboxByTab(items, 'unread').map((row) => row.id),
    ['a', 'c']
  )
  assert.deepEqual(
    filterAdminAlertInboxByTab(items, 'read').map((row) => row.id),
    ['b']
  )
})

test('페이지는 8건 단위로 자르고 범위를 벗어난 페이지는 마지막 페이지로 맞춘다', () => {
  const items = Array.from({ length: 20 }, (_, i) => item({ id: `n${i}` }))
  assert.equal(sliceAdminAlertInboxPage(items, 1).length, 8)
  assert.equal(sliceAdminAlertInboxPage(items, 3).length, 4)
  assert.equal(clampAdminAlertInboxPage(9, 20), 3)
  assert.equal(sliceAdminAlertInboxPage(items, 9)[0]?.id, 'n16')
})
