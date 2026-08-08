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
      <DialogContent className="max-w-sm gap-3 p-4 sm:max-w-md" hideCloseButton={busy}>
        <DialogHeader className="space-y-1.5">
          <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
            {action === 'checkin' ? (
              <CheckCircle className="h-4 w-4 text-primary" />
            ) : showTodoWarning ? (
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            ) : (
              <XCircle className="h-4 w-4 text-red-600" />
            )}
          </div>
          <DialogTitle className="text-center text-base">{title}</DialogTitle>
          <DialogDescription className="text-center text-xs leading-snug">
            {action === 'checkin'
              ? isKo
                ? '출근을 시작하시겠습니까?'
                : 'Start your work session?'
              : loadingTodos
                ? isKo
                  ? '미처리 업무 확인 중…'
                  : 'Checking pending…'
                : showTodoWarning
                  ? isKo
                    ? `미처리 ${pendingTodos.length}건 · 보류 후 퇴근하거나 그대로 퇴근할 수 있습니다.`
                    : `${pendingTodos.length} pending · hold all or check out anyway.`
                  : isKo
                    ? '퇴근을 완료하시겠습니까?'
                    : 'Complete check-out?'}
          </DialogDescription>
        </DialogHeader>

        {action === 'checkout' && showTodoWarning ? (
          <div className="max-h-40 overflow-y-auto rounded-md border border-amber-200/80 bg-amber-50/60 px-2 py-1.5">
            <ul className="divide-y divide-amber-100/80">
              {pendingTodos.map((todo) => (
                <li
                  key={todo.id}
                  className="flex items-center gap-1.5 py-1 text-[11px] leading-tight text-amber-950"
                >
                  <ListTodo className="h-3 w-3 shrink-0 text-amber-700" aria-hidden />
                  <span className="min-w-0 truncate" title={todo.title}>
                    {todo.title}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <DialogFooter className="flex-col gap-1.5 sm:flex-col sm:space-x-0">
          {action === 'checkout' && showTodoWarning ? (
            <>
              {onHoldEnabled ? (
                <Button
                  type="button"
                  size="sm"
                  className="h-8 w-full text-xs"
                  onClick={() => void handleHoldAllAndCheckout()}
                  disabled={busy || loadingTodos}
                >
                  <PauseCircle className="mr-1.5 h-3.5 w-3.5" />
                  {holdingAll
                    ? isKo
                      ? '보류 처리 중…'
                      : 'Putting on hold…'
                    : isKo
                      ? '모두 보류 후 퇴근'
                      : 'Hold all & check out'}
                </Button>
              ) : null}
              {adminTodo ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 w-full text-xs"
                  onClick={handleOpenTodoPanel}
                  disabled={busy}
                >
                  <ListTodo className="mr-1.5 h-3.5 w-3.5" />
                  {isKo ? 'TODO 열기' : 'Open TODO'}
                </Button>
              ) : null}
              <div className="flex w-full gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 flex-1 text-xs"
                  onClick={onClose}
                  disabled={busy}
                >
                  {isKo ? '취소' : 'Cancel'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={onHoldEnabled ? 'outline' : 'default'}
                  className={`h-8 flex-1 text-xs ${onHoldEnabled ? '' : 'bg-red-600 hover:bg-red-700'}`}
                  onClick={() => void handleConfirmCheckout()}
                  disabled={busy || loadingTodos}
                >
                  {isProcessing
                    ? isKo
                      ? '처리 중…'
                      : 'Processing…'
                    : isKo
                      ? '그대로 퇴근'
                      : 'Check out'}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex w-full flex-col gap-1.5">
              {action === 'checkout' && onOpenDailyReport ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-8 w-full text-xs"
                  onClick={onOpenDailyReport}
                  disabled={busy}
                >
                  <FileBarChart className="mr-1.5 h-3.5 w-3.5" />
                  {isKo ? 'Daily Report 후 퇴근' : 'Daily Report first'}
                </Button>
              ) : null}
              <div className="flex w-full gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 flex-1 text-xs"
                  onClick={onClose}
                  disabled={busy}
                >
                  {isKo ? '취소' : 'Cancel'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className={`h-8 flex-1 text-xs ${
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
                        : 'Check in'
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
