'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle, FileBarChart, ListTodo, PauseCircle, XCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { opTodoAudiencesForUser } from '@/lib/opTodoSchedule'
import {
  fetchPendingOpTodosForCheckout,
  setAllOpTodosOnHold,
  type PendingOpTodoSummary,
} from '@/lib/opTodoCheckoutGuard'
import { dispatchOpTodoRefresh } from '@/lib/opTodoRefresh'
import { isOpTodoOnHoldFeatureEnabled } from '@/lib/opTodoOnHoldColumn'
import { useAdminTodoOptional } from '@/contexts/AdminTodoContext'

type CheckoutAttendanceModalProps = {
  open: boolean
  onClose: () => void
  action: 'checkin' | 'checkout' | null
  onConfirm: () => Promise<void>
  isProcessing?: boolean
  userPosition?: string | null
  viewAllOpTodos?: boolean
  locale?: string
  onOpenDailyReport?: () => void
}

export default function CheckoutAttendanceModal({
  open,
  onClose,
  action,
  onConfirm,
  isProcessing = false,
  userPosition = null,
  viewAllOpTodos = false,
  locale = 'ko',
  onOpenDailyReport,
}: CheckoutAttendanceModalProps) {
  const isKo = locale === 'ko' || locale.startsWith('ko')
  const adminTodo = useAdminTodoOptional()

  const audiences = useMemo(
    () => opTodoAudiencesForUser(userPosition, { viewAll: viewAllOpTodos }),
    [userPosition, viewAllOpTodos]
  )

  const [loadingTodos, setLoadingTodos] = useState(false)
  const [pendingTodos, setPendingTodos] = useState<PendingOpTodoSummary[]>([])
  const [holdingAll, setHoldingAll] = useState(false)

  const onHoldEnabled = isOpTodoOnHoldFeatureEnabled()
  const showTodoWarning = action === 'checkout' && pendingTodos.length > 0

  const loadPendingTodos = useCallback(async () => {
    if (!open || action !== 'checkout') {
      setPendingTodos([])
      return
    }

    setLoadingTodos(true)
    try {
      const items = await fetchPendingOpTodosForCheckout({
        departments: viewAllOpTodos ? null : audiences,
      })
      setPendingTodos(items)
    } catch (e) {
      console.error('CheckoutAttendanceModal loadPendingTodos', e)
      setPendingTodos([])
    } finally {
      setLoadingTodos(false)
    }
  }, [action, audiences, open, viewAllOpTodos])

  useEffect(() => {
    void loadPendingTodos()
  }, [loadPendingTodos])

  const handleConfirmCheckout = async () => {
    await onConfirm()
    onClose()
  }

  const handleHoldAllAndCheckout = async () => {
    if (!pendingTodos.length) return

    setHoldingAll(true)
    try {
      const { failed } = await setAllOpTodosOnHold(pendingTodos.map((t) => t.id))
      dispatchOpTodoRefresh()

      if (failed > 0) {
        alert(
          isKo
            ? `${failed}개 항목 보류 처리에 실패했습니다. 나머지는 보류 처리되었습니다.`
            : `Failed to put ${failed} item(s) on hold. The rest were updated.`
        )
      }

      await onConfirm()
      onClose()
    } catch (e) {
      console.error('CheckoutAttendanceModal holdAll', e)
      alert(isKo ? '보류 처리 중 오류가 발생했습니다.' : 'Failed to update hold status.')
    } finally {
      setHoldingAll(false)
    }
  }

  const handleOpenTodoPanel = () => {
    adminTodo?.setPanelOpen(true)
    onClose()
  }

  const busy = isProcessing || holdingAll
  const title =
    action === 'checkin'
      ? isKo
        ? '출근 확인'
        : 'Check in'
      : showTodoWarning
        ? isKo
          ? '미처리 업무가 있습니다'
          : 'Pending tasks remain'
        : isKo
          ? '퇴근 확인'
          : 'Check out'

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !busy && onClose()}>
      <DialogContent className="max-w-md sm:max-w-lg" hideCloseButton={busy}>
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            {action === 'checkin' ? (
              <CheckCircle className="h-6 w-6 text-primary" />
            ) : showTodoWarning ? (
              <AlertTriangle className="h-6 w-6 text-amber-600" />
            ) : (
              <XCircle className="h-6 w-6 text-red-600" />
            )}
          </div>
          <DialogTitle className="text-center">{title}</DialogTitle>
          <DialogDescription className="text-center">
            {action === 'checkin'
              ? isKo
                ? '출근을 시작하시겠습니까?'
                : 'Start your work session?'
              : loadingTodos
                ? isKo
                  ? '처리하지 않은 업무를 확인하는 중…'
                  : 'Checking pending tasks…'
                : showTodoWarning
                  ? isKo
                    ? `TODO LIST에 처리하지 않은 업무가 ${pendingTodos.length}건 있습니다. 모두 보류 처리하거나 퇴근을 계속할 수 있습니다.`
                    : `You have ${pendingTodos.length} unprocessed task(s) in your TODO list. You can put them on hold or check out anyway.`
                  : isKo
                    ? '퇴근을 완료하시겠습니까?'
                    : 'Complete check-out?'}
          </DialogDescription>
        </DialogHeader>

        {action === 'checkout' && showTodoWarning ? (
          <div className="max-h-48 overflow-y-auto rounded-lg border border-amber-200/80 bg-amber-50/60 p-3">
            <ul className="space-y-2">
              {pendingTodos.map((todo) => (
                <li
                  key={todo.id}
                  className="flex items-start gap-2 text-sm text-amber-950"
                >
                  <ListTodo className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
                  <span className="leading-snug">{todo.title}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          {action === 'checkout' && showTodoWarning ? (
            <>
              {onHoldEnabled ? (
                <Button
                  type="button"
                  className="w-full"
                  onClick={() => void handleHoldAllAndCheckout()}
                  disabled={busy || loadingTodos}
                >
                  <PauseCircle className="mr-2 h-4 w-4" />
                  {holdingAll
                    ? isKo
                      ? '보류 처리 중…'
                      : 'Putting on hold…'
                    : isKo
                      ? '모두 보류 처리 후 퇴근'
                      : 'Put all on hold & check out'}
                </Button>
              ) : null}
              {adminTodo ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleOpenTodoPanel}
                  disabled={busy}
                >
                  <ListTodo className="mr-2 h-4 w-4" />
                  {isKo ? 'TODO LIST 열기' : 'Open TODO list'}
                </Button>
              ) : null}
              <Button
                type="button"
                variant={onHoldEnabled ? 'outline' : 'default'}
                className={`w-full ${onHoldEnabled ? '' : 'bg-red-600 hover:bg-red-700'}`}
                onClick={() => void handleConfirmCheckout()}
                disabled={busy || loadingTodos}
              >
                {isProcessing
                  ? isKo
                    ? '처리 중…'
                    : 'Processing…'
                  : isKo
                    ? '그대로 퇴근'
                    : 'Check out anyway'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={onClose}
                disabled={busy}
              >
                {isKo ? '취소' : 'Cancel'}
              </Button>
            </>
          ) : (
            <div className="flex w-full flex-col gap-2">
              {action === 'checkout' && onOpenDailyReport ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  onClick={onOpenDailyReport}
                  disabled={busy}
                >
                  <FileBarChart className="mr-2 h-4 w-4" />
                  {isKo ? 'Daily Report 작성 후 퇴근' : 'Write Daily Report'}
                </Button>
              ) : null}
              <div className="flex w-full gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={onClose}
                disabled={busy}
              >
                {isKo ? '취소' : 'Cancel'}
              </Button>
              <Button
                type="button"
                className={`flex-1 ${
                  action === 'checkin'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
                onClick={() => void handleConfirmCheckout()}
                disabled={busy || (action === 'checkout' && loadingTodos)}
              >
                {isProcessing
                  ? isKo
                    ? '처리 중…'
                    : 'Processing…'
                  : action === 'checkin'
                    ? isKo
                      ? '출근 시작'
                      : 'Start check-in'
                    : isKo
                      ? '퇴근 완료'
                      : 'Check out'}
              </Button>
              </div>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
