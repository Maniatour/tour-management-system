import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildDailyReportTodoClickIndex,
  isTodoHandledInPeriod,
  latestIso,
  resolveDailyReportTodoMatrixStatus,
} from '@/lib/dailyReport/todoMatrixStatus'

test('click logs mark a reset todo as handled even when completed flag is false', () => {
  const index = buildDailyReportTodoClickIndex([
    {
      todo_id: 'guide-confirm',
      user_email: 'somi@example.com',
      action: 'completed',
      timestamp: '2026-09-05T03:13:00.000Z',
    },
  ])

  const handled = isTodoHandledInPeriod({
    todoId: 'guide-confirm',
    lastActionByTodo: index.lastActionByTodo,
    currentlyCompleted: false,
    completedAt: null,
    rangeStartIso: '2026-09-05T07:00:00.000Z',
    rangeEndIso: '2026-09-06T06:59:59.999Z',
  })

  assert.equal(handled, true)
  assert.equal(
    resolveDailyReportTodoMatrixStatus({
      hasQueue: true,
      handledInPeriod: handled,
      onHold: false,
    }),
    'completed'
  )
  assert.equal(index.completedAtByTodoEmail.get('guide-confirm')?.get('somi@example.com'), '2026-09-05T03:13:00.000Z')
})

test('later uncompleted wins over earlier completed in the same period', () => {
  const index = buildDailyReportTodoClickIndex([
    {
      todo_id: 'print',
      user_email: 'somi@example.com',
      action: 'completed',
      timestamp: '2026-09-05T01:00:00.000Z',
    },
    {
      todo_id: 'print',
      user_email: 'somi@example.com',
      action: 'uncompleted',
      timestamp: '2026-09-05T02:00:00.000Z',
    },
  ])

  assert.equal(index.lastActionByTodo.get('print'), 'uncompleted')
  assert.equal(index.completersByTodo.get('print')?.has('somi@example.com'), false)
  assert.equal(
    isTodoHandledInPeriod({
      todoId: 'print',
      lastActionByTodo: index.lastActionByTodo,
      currentlyCompleted: false,
      completedAt: null,
      rangeStartIso: '2026-09-05T07:00:00.000Z',
      rangeEndIso: '2026-09-06T06:59:59.999Z',
    }),
    false
  )
})

test('non-queue todos stay N/A unless handled in the period', () => {
  assert.equal(
    resolveDailyReportTodoMatrixStatus({
      hasQueue: false,
      handledInPeriod: false,
      onHold: false,
    }),
    'na'
  )
  assert.equal(
    resolveDailyReportTodoMatrixStatus({
      hasQueue: false,
      handledInPeriod: true,
      onHold: false,
    }),
    'completed'
  )
})

test('latestIso prefers the newest timestamp', () => {
  assert.equal(latestIso(null, '2026-09-05T01:00:00.000Z', '2026-09-05T03:00:00.000Z'), '2026-09-05T03:00:00.000Z')
})
