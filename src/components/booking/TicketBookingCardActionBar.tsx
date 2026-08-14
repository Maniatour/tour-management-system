'use client'

import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
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
  XCircle,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import {
  applyTicketBookingAction,
  applyTicketBookingIssueFlag,
  isTicketBookingIssueReported,
} from '@/lib/ticketBookingActions'
import {
  showChangeRequestButton,
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

  const muted = 'border-border/70 bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground'

  return (
    <div
      className="mt-2 flex flex-nowrap items-center gap-1 overflow-x-auto pb-0.5"
      onClick={(e) => e.stopPropagation()}
    >
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
        onClick={() =>
          void run('issue', async () => {
            const res = await applyTicketBookingIssueFlag(
              booking.id,
              booking,
              !issueOn,
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
      {extra ? (
        <>
          <span className="mx-0.5 h-4 w-px shrink-0 bg-border" aria-hidden />
          {extra}
        </>
      ) : null}
    </div>
  )
}
