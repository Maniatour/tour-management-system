'use client'

import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type FormEvent,
  type ForwardedRef,
  type MutableRefObject,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import {
  AlertTriangle,
  Banknote,
  CalendarClock,
  Check,
  CreditCard,
  FileText,
  Landmark,
  Scale,
  Wallet,
  XCircle,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import {
  applyTicketBookingAction,
  applyTicketBookingIssueFlag,
  isTicketBookingIssueReported,
  reportTicketBookingIssueWithNote,
} from '@/lib/ticketBookingActions'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  showChangeRequestButton,
  showCreditReceivedButton,
  showPaymentCompleteButton,
  showVendorChangeActions,
  showVendorInitialActions,
} from '@/lib/ticketBookingWorkflow'

const iconBtnBase =
  'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

function mergeButtonRefs(
  local: MutableRefObject<HTMLButtonElement | null> | { current: HTMLButtonElement | null },
  forwarded: ForwardedRef<HTMLButtonElement>
) {
  return (node: HTMLButtonElement | null) => {
    local.current = node
    if (typeof forwarded === 'function') forwarded(node)
    else if (forwarded) forwarded.current = node
  }
}

type Booking = {
  id: string
  booking_status?: string | null
  vendor_status?: string | null
  change_status?: string | null
  payment_status?: string | null
  refund_status?: string | null
  operation_status?: string | null
  note?: string | null
  expense?: number | null
  paid_amount?: number | null
  credit_amount?: number | null
}

function defaultCreditAmount(b: Booking): string {
  const credit = Number(b.credit_amount ?? 0)
  if (Number.isFinite(credit) && credit > 0) return String(credit)
  const paid = Number(b.paid_amount ?? 0)
  if (Number.isFinite(paid) && paid > 0) return String(paid)
  const expense = Number(b.expense ?? 0)
  if (Number.isFinite(expense) && expense > 0) return String(expense)
  return ''
}

export type TicketBookingCardActionHandlers = {
  onQtyTimeChange: (booking: Booking) => void
  onVendorConfirmInitial?: (booking: Booking) => void
  onVendorRejectInitial?: (booking: Booking) => void
  onVendorConfirmChange?: (booking: Booking) => void
  onVendorRejectChange?: (booking: Booking) => void
  onAddPayment: (booking: Booking) => void
  onInvoice: (booking: Booking) => void
  onZelle: (booking: Booking) => void
  onStatement: (booking: Booking) => void
  onApplied: () => void
  hasInvoiceAttachment?: (booking: Booking) => boolean
  hasZelleAttachment?: (booking: Booking) => boolean
  statementMatched?: (booking: Booking) => boolean
  savingId?: string | null
}

function showPaymentRequest(b: Booking): boolean {
  const bs = (b.booking_status ?? '').toLowerCase()
  const ps = (b.payment_status ?? 'not_due').toLowerCase()
  return bs === 'confirmed' && (ps === 'not_due' || ps === 'failed')
}

export const TicketBookingIconTipButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    label: string
    children: ReactNode
    pressed?: boolean
    /** 툴팁 위치. 기본은 버튼 위 */
    tip?: 'top' | 'bottom'
  }
>(function TicketBookingIconTipButton(
  {
    label,
    className = '',
    children,
    pressed,
    tip = 'top',
    onMouseEnter,
    onMouseLeave,
    onFocus,
    onBlur,
    ...props
  },
  ref
) {
  const localRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)

  const updatePosition = useCallback(() => {
    const el = localRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const left = Math.min(
      Math.max(8, r.left + r.width / 2),
      typeof window !== 'undefined' ? window.innerWidth - 8 : r.left + r.width / 2
    )
    setCoords({
      top: tip === 'bottom' ? r.bottom + 6 : r.top - 6,
      left,
    })
  }, [tip])

  const show = () => {
    updatePosition()
    setOpen(true)
  }
  const hide = () => setOpen(false)

  useEffect(() => {
    if (!open) return
    const onMove = () => updatePosition()
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
  }, [open, updatePosition])

  return (
    <>
      <button
        ref={mergeButtonRefs(localRef as MutableRefObject<HTMLButtonElement | null>, ref)}
        type="button"
        aria-label={label}
        aria-pressed={pressed}
        className={`${iconBtnBase} ${className}`}
        {...props}
        onMouseEnter={(e) => {
          show()
          onMouseEnter?.(e)
        }}
        onMouseLeave={(e) => {
          hide()
          onMouseLeave?.(e)
        }}
        onFocus={(e) => {
          show()
          onFocus?.(e)
        }}
        onBlur={(e) => {
          hide()
          onBlur?.(e)
        }}
      >
        {children}
      </button>
      {open && coords && typeof document !== 'undefined'
        ? createPortal(
            <span
              role="tooltip"
              className="pointer-events-none fixed z-[400] whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium text-white shadow-lg"
              style={{
                left: coords.left,
                top: coords.top,
                transform: tip === 'bottom' ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
              }}
            >
              {label}
            </span>,
            document.body
          )
        : null}
    </>
  )
})

export default function TicketBookingCardActionBar({
  booking,
  locale,
  handlers,
  extra,
}: {
  booking: Booking
  locale: string
  handlers: TicketBookingCardActionHandlers
  extra?: ReactNode
}) {
  const { user } = useAuth()
  const isEn = locale.startsWith('en')
  const [busy, setBusy] = useState<string | null>(null)
  const [issueModalOpen, setIssueModalOpen] = useState(false)
  const [issueNote, setIssueNote] = useState('')
  const [issueError, setIssueError] = useState<string | null>(null)
  const [creditModalOpen, setCreditModalOpen] = useState(false)
  const [creditAmount, setCreditAmount] = useState('')
  const [creditError, setCreditError] = useState<string | null>(null)
  const saving = handlers.savingId === booking.id || Boolean(busy)
  const issueOn = isTicketBookingIssueReported(booking.operation_status)
  const hasInv = handlers.hasInvoiceAttachment?.(booking) === true
  const hasZelle = handlers.hasZelleAttachment?.(booking) === true
  const stmtOn = handlers.statementMatched?.(booking) === true

  const run = async (key: string, fn: () => Promise<boolean>) => {
    if (saving) return
    setBusy(key)
    try {
      const ok = await fn()
      if (ok) handlers.onApplied()
    } finally {
      setBusy(null)
    }
  }

  const openIssueModal = () => {
    setIssueNote(String(booking.note || ''))
    setIssueError(null)
    setIssueModalOpen(true)
  }

  const closeIssueModal = () => {
    if (busy === 'issue') return
    setIssueModalOpen(false)
    setIssueError(null)
  }

  const openCreditModal = () => {
    setCreditAmount(defaultCreditAmount(booking))
    setCreditError(null)
    setCreditModalOpen(true)
  }

  const closeCreditModal = () => {
    if (busy === 'credit') return
    setCreditModalOpen(false)
    setCreditError(null)
  }

  const submitCreditReceived = async (e: FormEvent) => {
    e.preventDefault()
    if (saving) return
    const parsed = Number(creditAmount.trim())
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setCreditError(isEn ? 'Enter a valid credit amount.' : '크레딧 금액을 숫자로 입력해 주세요.')
      return
    }
    setCreditError(null)
    setBusy('credit')
    try {
      const rs = (booking.refund_status ?? 'none').toLowerCase()
      if (rs === 'none') {
        const req = await applyTicketBookingAction(
          booking.id,
          'request_refund',
          { amount: parsed },
          user?.email ?? null
        )
        if (!req.ok) {
          setCreditError(req.error || (isEn ? 'Failed' : '실패했습니다.'))
          return
        }
      }
      const res = await applyTicketBookingAction(
        booking.id,
        'mark_credit_received',
        { credit_amount: parsed },
        user?.email ?? null
      )
      if (!res.ok) {
        setCreditError(res.error || (isEn ? 'Failed' : '실패했습니다.'))
        return
      }
      setCreditModalOpen(false)
      handlers.onApplied()
    } finally {
      setBusy(null)
    }
  }

  const submitIssueReport = async (e: FormEvent) => {
    e.preventDefault()
    if (saving) return
    const trimmed = issueNote.trim()
    if (!trimmed) {
      setIssueError(isEn ? 'Please write a memo before reporting the issue.' : '문제 내용을 메모로 작성해 주세요.')
      return
    }
    setIssueError(null)
    setBusy('issue')
    try {
      const res = await reportTicketBookingIssueWithNote(
        booking.id,
        booking,
        trimmed,
        user?.email ?? null
      )
      if (!res.ok) {
        setIssueError(
          res.error === 'note_required'
            ? isEn
              ? 'Please write a memo before reporting the issue.'
              : '문제 내용을 메모로 작성해 주세요.'
            : res.error || (isEn ? 'Failed' : '실패했습니다.')
        )
        return
      }
      setIssueModalOpen(false)
      handlers.onApplied()
    } finally {
      setBusy(null)
    }
  }

  const muted = 'border-border/70 bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground'

  return (
    <div className="mt-2 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
      <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-1 overflow-x-auto pb-0.5">
      {showChangeRequestButton(booking) ? (
        <TicketBookingIconTipButton
          label={isEn ? 'Qty/time change request' : '수량·시간 변경 요청'}
          className="border-amber-400 bg-amber-50 text-amber-950 hover:bg-amber-100"
          disabled={saving}
          onClick={() => handlers.onQtyTimeChange(booking)}
        >
          <CalendarClock className="h-3.5 w-3.5" aria-hidden />
        </TicketBookingIconTipButton>
      ) : null}
      {showVendorInitialActions(booking) && handlers.onVendorConfirmInitial ? (
        <>
          <TicketBookingIconTipButton
            label={isEn ? 'Vendor confirm' : '벤더 승인'}
            className="border-slate-700 bg-slate-800 text-white hover:bg-slate-900"
            disabled={saving}
            onClick={() => handlers.onVendorConfirmInitial?.(booking)}
          >
            <Check className="h-3.5 w-3.5" aria-hidden />
          </TicketBookingIconTipButton>
          <TicketBookingIconTipButton
            label={isEn ? 'Vendor reject' : '벤더 거절'}
            className="border-red-300 bg-red-50 text-red-900 hover:bg-red-100"
            disabled={saving}
            onClick={() => handlers.onVendorRejectInitial?.(booking)}
          >
            <XCircle className="h-3.5 w-3.5" aria-hidden />
          </TicketBookingIconTipButton>
        </>
      ) : null}
      {showVendorChangeActions(booking) && handlers.onVendorConfirmChange ? (
        <>
          <TicketBookingIconTipButton
            label={isEn ? 'Accept change' : '변경 승인'}
            className="border-slate-700 bg-slate-800 text-white hover:bg-slate-900"
            disabled={saving}
            onClick={() => handlers.onVendorConfirmChange?.(booking)}
          >
            <Check className="h-3.5 w-3.5" aria-hidden />
          </TicketBookingIconTipButton>
          <TicketBookingIconTipButton
            label={isEn ? 'Reject change' : '변경 거절'}
            className="border-red-300 bg-red-50 text-red-900 hover:bg-red-100"
            disabled={saving}
            onClick={() => handlers.onVendorRejectChange?.(booking)}
          >
            <XCircle className="h-3.5 w-3.5" aria-hidden />
          </TicketBookingIconTipButton>
        </>
      ) : null}
      {showPaymentRequest(booking) ? (
        <TicketBookingIconTipButton
          label={isEn ? 'Request payment' : '결제 요청'}
          className="border-slate-700 bg-slate-800 text-white hover:bg-slate-900"
          disabled={saving}
          onClick={() =>
            void run('pay-req', async () => {
              const res = await applyTicketBookingAction(
                booking.id,
                'request_payment',
                {},
                user?.email ?? null
              )
              if (!res.ok) {
                alert(res.error || (isEn ? 'Failed' : '실패했습니다.'))
                return false
              }
              return true
            })
          }
        >
          <CreditCard className="h-3.5 w-3.5" aria-hidden />
        </TicketBookingIconTipButton>
      ) : null}
      {showPaymentCompleteButton(booking) ? (
        <TicketBookingIconTipButton
          label={isEn ? 'Add payment record' : '결제 기록 추가'}
          className="border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
          disabled={saving}
          onClick={() => handlers.onAddPayment(booking)}
        >
          <Banknote className="h-3.5 w-3.5" aria-hidden />
        </TicketBookingIconTipButton>
      ) : null}
      {showCreditReceivedButton(booking) ? (
        <TicketBookingIconTipButton
          label={isEn ? 'Credit received' : '크레딧 받음'}
          className="border-cyan-300 bg-cyan-50 text-cyan-950 hover:bg-cyan-100"
          disabled={saving}
          onClick={openCreditModal}
        >
          <Wallet className="h-3.5 w-3.5" aria-hidden />
        </TicketBookingIconTipButton>
      ) : null}
      <TicketBookingIconTipButton
        label={isEn ? 'Issue occurred' : '문제 발생'}
        role="switch"
        aria-checked={issueOn}
        pressed={issueOn}
        className={
          issueOn
            ? 'border-red-300 bg-red-50 text-red-900 hover:bg-red-100'
            : muted
        }
        disabled={saving}
        onClick={() => {
          if (issueOn) {
            void run('issue', async () => {
              const res = await applyTicketBookingIssueFlag(
                booking.id,
                booking,
                false,
                user?.email ?? null
              )
              if (!res.ok) {
                alert(res.error || (isEn ? 'Failed' : '실패했습니다.'))
                return false
              }
              return true
            })
            return
          }
          openIssueModal()
        }}
      >
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
      </TicketBookingIconTipButton>
      <TicketBookingIconTipButton
        label={isEn ? 'Invoice attachment' : '인보이스 첨부'}
        className={
          hasInv
            ? 'border-sky-300 bg-sky-50 text-sky-900 hover:bg-sky-100'
            : muted
        }
        disabled={saving}
        onClick={() => handlers.onInvoice(booking)}
      >
        <FileText className="h-3.5 w-3.5" aria-hidden />
      </TicketBookingIconTipButton>
      <TicketBookingIconTipButton
        label={isEn ? 'Zelle attachment' : '젤첨부'}
        className={
          hasZelle
            ? 'border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
            : muted
        }
        disabled={saving}
        onClick={() => handlers.onZelle(booking)}
      >
        <Landmark className="h-3.5 w-3.5" aria-hidden />
      </TicketBookingIconTipButton>
      <TicketBookingIconTipButton
        label={isEn ? 'Statement match' : '명세 대조'}
        className={
          stmtOn
            ? 'border-violet-300 bg-violet-50 text-violet-900 hover:bg-violet-100'
            : muted
        }
        disabled={saving}
        onClick={() => handlers.onStatement(booking)}
      >
        <Scale className="h-3.5 w-3.5" aria-hidden />
      </TicketBookingIconTipButton>
      </div>
      {extra ? (
        <div className="ml-auto flex shrink-0 items-center justify-end gap-1">{extra}</div>
      ) : null}

      <Dialog
        open={issueModalOpen}
        onOpenChange={(open) => {
          if (!open) closeIssueModal()
        }}
      >
        <DialogContent
          className="max-w-md text-sm"
          stackLevel="nested"
          onClick={(e) => e.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle>{isEn ? 'Report issue' : '문제 발생'}</DialogTitle>
            <DialogDescription>
              {isEn
                ? 'Write a memo about the problem, then mark this booking as an issue.'
                : '문제 내용을 메모로 작성한 뒤 문제 발생으로 처리합니다.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void submitIssueReport(e)} className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor={`tb-issue-note-${booking.id}`} className="text-xs font-medium text-gray-800">
                {isEn ? 'Memo' : '메모'}
              </label>
              <textarea
                id={`tb-issue-note-${booking.id}`}
                rows={5}
                value={issueNote}
                onChange={(e) => {
                  setIssueNote(e.target.value)
                  if (issueError) setIssueError(null)
                }}
                disabled={busy === 'issue'}
                autoFocus
                className="w-full resize-y rounded-lg border border-border/70 bg-white px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:bg-muted/40"
                placeholder={
                  isEn ? 'Describe what went wrong…' : '어떤 문제가 있는지 작성해 주세요'
                }
              />
            </div>
            {issueError ? (
              <p className="text-xs font-medium text-red-600" role="alert">
                {issueError}
              </p>
            ) : null}
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={closeIssueModal} disabled={busy === 'issue'}>
                {isEn ? 'Cancel' : '취소'}
              </Button>
              <Button
                type="submit"
                disabled={busy === 'issue'}
                className="bg-red-700 text-white hover:bg-red-800"
              >
                {busy === 'issue'
                  ? isEn
                    ? 'Working…'
                    : '처리 중…'
                  : isEn
                    ? 'Mark as issue'
                    : '문제 발생으로 처리'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={creditModalOpen}
        onOpenChange={(open) => {
          if (!open) closeCreditModal()
        }}
      >
        <DialogContent
          className="max-w-md text-sm"
          stackLevel="nested"
          onClick={(e) => e.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle>{isEn ? 'Credit received' : '크레딧 받음'}</DialogTitle>
            <DialogDescription>
              {isEn
                ? 'Keep the payment as paid. Use this when the vendor issued credit instead of a cash refund.'
                : '결제는 완료 상태로 유지됩니다. 벤더가 현금 대신 크레딧을 준 경우에만 사용하세요.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void submitCreditReceived(e)} className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor={`tb-credit-amt-${booking.id}`} className="text-xs font-medium text-gray-800">
                {isEn ? 'Credit amount (USD)' : '크레딧 금액 (USD)'}
              </label>
              <input
                id={`tb-credit-amt-${booking.id}`}
                type="text"
                inputMode="decimal"
                value={creditAmount}
                onChange={(e) => {
                  setCreditAmount(e.target.value)
                  if (creditError) setCreditError(null)
                }}
                disabled={busy === 'credit'}
                autoFocus
                className="w-full rounded-lg border border-border/70 bg-white px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:bg-muted/40"
                placeholder="0.00"
                autoComplete="off"
              />
            </div>
            {creditError ? (
              <p className="text-xs font-medium text-red-600" role="alert">
                {creditError}
              </p>
            ) : null}
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={closeCreditModal} disabled={busy === 'credit'}>
                {isEn ? 'Cancel' : '취소'}
              </Button>
              <Button
                type="submit"
                disabled={busy === 'credit'}
                className="bg-cyan-700 text-white hover:bg-cyan-800"
              >
                {busy === 'credit'
                  ? isEn
                    ? 'Working…'
                    : '처리 중…'
                  : isEn
                    ? 'Mark credit received'
                    : '크레딧 받음으로 처리'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
