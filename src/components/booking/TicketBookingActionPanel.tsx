'use client'

import { useCallback, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/contexts/AuthContext'
import {
  applyTicketBookingAction,
  getSuggestedTicketBookingActions,
  type TicketBookingActionId,
  type TicketBookingAxisSnapshot,
} from '@/lib/ticketBookingActions'
import { formatTicketBookingAxisLabel } from '@/lib/ticketBookingAxisLabels'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

type Props = {
  bookingId: string
  axes: TicketBookingAxisSnapshot
  /** 액션 성공 후 목록 새로고침 등 */
  onApplied: () => void
  disabled?: boolean
}

/** 입력 폼이 필요한 액션 (그 외는 즉시 실행) */
const ACTIONS_WITH_FORM = new Set<TicketBookingActionId>([
  'mark_tentative',
  'confirm_booking',
  'request_change',
  'request_payment',
  'mark_paid',
  'request_refund',
  'mark_credit_received',
  'mark_refunded',
])

type ActionFormFields = {
  holdExpires: string
  vendorConfirmationNumber: string
  note: string
  paymentDue: string
  amount: string
  paidAmount: string
  creditAmount: string
  refundAmount: string
}

function emptyActionForm(): ActionFormFields {
  return {
    holdExpires: '',
    vendorConfirmationNumber: '',
    note: '',
    paymentDue: '',
    amount: '',
    paidAmount: '',
    creditAmount: '',
    refundAmount: '',
  }
}

/** `<input type="datetime-local">` 값 → ISO 문자열 (비우면 null) */
function datetimeLocalToIso(value: string): string | null {
  const v = value.trim()
  if (!v) return null
  const ms = Date.parse(v)
  if (Number.isNaN(ms)) return null
  return new Date(ms).toISOString()
}

function parseUsdAmount(value: string): number | undefined {
  const raw = value.trim()
  if (!raw) return undefined
  const n = Number(raw.replace(/,/g, ''))
  return Number.isFinite(n) ? n : undefined
}

/** 입력이 비어 있지 않은데 숫자로 쓸 수 없으면 true */
function isInvalidOptionalUsd(raw: string): boolean {
  const s = raw.trim()
  return s !== '' && parseUsdAmount(raw) === undefined
}

const inputClass =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500'

export default function TicketBookingActionPanel({ bookingId, axes, onApplied, disabled }: Props) {
  const { user } = useAuth()
  const t = useTranslations('booking.calendar.ticketBookingActions')
  const tAxis = useTranslations('booking.calendar.ticketBookingAxis')
  const [busy, setBusy] = useState<string | null>(null)
  const [lastError, setLastError] = useState<string | null>(null)
  const [dialogAction, setDialogAction] = useState<TicketBookingActionId | null>(null)
  const [dialogValidationError, setDialogValidationError] = useState<string | null>(null)
  const [form, setForm] = useState<ActionFormFields>(() => emptyActionForm())

  const actions = useMemo(() => getSuggestedTicketBookingActions(axes), [axes])

  const actionLabel = useCallback((action: TicketBookingActionId) => t(`actions.${action}`), [t])

  const closeDialog = () => {
    setDialogAction(null)
    setForm(emptyActionForm())
    setDialogValidationError(null)
  }

  const run = async (action: string, payload: Record<string, unknown> = {}): Promise<boolean> => {
    setLastError(null)
    setBusy(action)
    try {
      const res = await applyTicketBookingAction(bookingId, action, payload, user?.email ?? null)
      if (!res.ok) {
        setLastError(res.error ?? t('unknownError'))
        return false
      }
      onApplied()
      return true
    } finally {
      setBusy(null)
    }
  }

  const validateDialog = useCallback(
    (action: TicketBookingActionId, f: ActionFormFields): string | null => {
      switch (action) {
        case 'mark_tentative':
          if (f.holdExpires.trim() && !datetimeLocalToIso(f.holdExpires)) return t('invalidDatetime')
          return null
        case 'request_payment':
          if (f.paymentDue.trim() && !datetimeLocalToIso(f.paymentDue)) return t('invalidDatetime')
          if (isInvalidOptionalUsd(f.amount)) return t('invalidAmount')
          return null
        case 'mark_paid':
          if (isInvalidOptionalUsd(f.paidAmount)) return t('invalidAmount')
          return null
        case 'request_refund':
          if (isInvalidOptionalUsd(f.amount)) return t('invalidAmount')
          return null
        case 'mark_credit_received':
          if (isInvalidOptionalUsd(f.creditAmount)) return t('invalidAmount')
          return null
        case 'mark_refunded':
          if (isInvalidOptionalUsd(f.refundAmount)) return t('invalidAmount')
          return null
        default:
          return null
      }
    },
    [t]
  )

  const handleActionClick = (action: string) => {
    if (disabled || busy) return
    const id = action as TicketBookingActionId
    if (ACTIONS_WITH_FORM.has(id)) {
      setForm(emptyActionForm())
      setDialogValidationError(null)
      setDialogAction(id)
      return
    }
    void run(action, {})
  }

  const handleDialogSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!dialogAction || busy) return

    const verr = validateDialog(dialogAction, form)
    if (verr) {
      setDialogValidationError(verr)
      return
    }
    setDialogValidationError(null)

    let payload: Record<string, unknown> = {}

    switch (dialogAction) {
      case 'mark_tentative': {
        const iso = datetimeLocalToIso(form.holdExpires)
        if (iso) payload = { hold_expires_at: iso }
        break
      }
      case 'confirm_booking': {
        const num = form.vendorConfirmationNumber.trim()
        if (num) payload = { vendor_confirmation_number: num }
        break
      }
      case 'request_change': {
        const note = form.note.trim()
        if (note) payload = { note }
        break
      }
      case 'request_payment': {
        const dueIso = datetimeLocalToIso(form.paymentDue)
        const amt = parseUsdAmount(form.amount)
        if (dueIso) payload.payment_due_at = dueIso
        if (amt !== undefined) payload.amount = amt
        break
      }
      case 'mark_paid': {
        const paid = parseUsdAmount(form.paidAmount)
        if (paid !== undefined) payload.paid_amount = paid
        break
      }
      case 'request_refund': {
        const amt = parseUsdAmount(form.amount)
        const note = form.note.trim()
        if (amt !== undefined) payload.amount = amt
        if (note) payload.note = note
        break
      }
      case 'mark_credit_received': {
        const cr = parseUsdAmount(form.creditAmount)
        if (cr !== undefined) payload.credit_amount = cr
        break
      }
      case 'mark_refunded': {
        const rf = parseUsdAmount(form.refundAmount)
        if (rf !== undefined) payload.refund_amount = rf
        break
      }
      default:
        break
    }

    const ok = await run(dialogAction, payload)
    if (ok) closeDialog()
  }

  const dialogTitle = dialogAction ? actionLabel(dialogAction) : ''
  const ph = t('optionalPlaceholder')

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs">
      <div className="mb-2 font-semibold text-slate-800">{t('axisSummaryTitle')}</div>
      <dl className="grid grid-cols-1 gap-1 text-slate-700 sm:grid-cols-2">
        <div className="flex gap-2">
          <dt className="shrink-0 text-slate-500">{t('axisBooking')}</dt>
          <dd>{formatTicketBookingAxisLabel(tAxis, 'booking', axes.booking_status)}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="shrink-0 text-slate-500">{t('axisVendor')}</dt>
          <dd>{formatTicketBookingAxisLabel(tAxis, 'vendor', axes.vendor_status)}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="shrink-0 text-slate-500">{t('axisChange')}</dt>
          <dd>{formatTicketBookingAxisLabel(tAxis, 'change', axes.change_status)}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="shrink-0 text-slate-500">{t('axisPayment')}</dt>
          <dd>{formatTicketBookingAxisLabel(tAxis, 'payment', axes.payment_status)}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="shrink-0 text-slate-500">{t('axisRefund')}</dt>
          <dd>{formatTicketBookingAxisLabel(tAxis, 'refund', axes.refund_status)}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="shrink-0 text-slate-500">{t('axisOperation')}</dt>
          <dd>{formatTicketBookingAxisLabel(tAxis, 'operation', axes.operation_status)}</dd>
        </div>
      </dl>

      {!disabled && actions.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {actions.map((a) => (
            <button
              key={a}
              type="button"
              disabled={!!busy}
              onClick={() => handleActionClick(a)}
              className="rounded-md bg-slate-800 px-2 py-1 text-[11px] font-medium text-white shadow-sm hover:bg-slate-900 disabled:opacity-50"
            >
              {busy === a ? '…' : actionLabel(a)}
            </button>
          ))}
        </div>
      ) : null}

      {lastError ? <p className="mt-2 text-[11px] text-red-600">{lastError}</p> : null}

      <Dialog
        open={dialogAction !== null}
        onOpenChange={(open) => {
          if (!open) closeDialog()
        }}
      >
        <DialogContent className="max-w-md text-sm">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription className="text-xs text-gray-600">{t('modalOptionalHint')}</DialogDescription>
          </DialogHeader>

          {dialogValidationError ? (
            <p className="text-xs font-medium text-red-600" role="alert">
              {dialogValidationError}
            </p>
          ) : null}

          <form
            onSubmit={(e) => void handleDialogSubmit(e)}
            className="space-y-3"
            onChange={() => dialogValidationError && setDialogValidationError(null)}
          >
            {dialogAction === 'mark_tentative' ? (
              <div className="space-y-1">
                <label htmlFor="tb-hold-expires" className="text-xs font-medium text-gray-800">
                  {t('holdExpiresLabel')}
                </label>
                <input
                  id="tb-hold-expires"
                  type="datetime-local"
                  value={form.holdExpires}
                  onChange={(e) => setForm((f) => ({ ...f, holdExpires: e.target.value }))}
                  className={inputClass}
                />
                <p className="text-[11px] leading-snug text-gray-500">{t('datetimeLocalHint')}</p>
              </div>
            ) : null}

            {dialogAction === 'confirm_booking' ? (
              <div className="space-y-1">
                <label htmlFor="tb-vendor-conf" className="text-xs font-medium text-gray-800">
                  {t('vendorConfLabel')}
                </label>
                <input
                  id="tb-vendor-conf"
                  type="text"
                  value={form.vendorConfirmationNumber}
                  onChange={(e) => setForm((f) => ({ ...f, vendorConfirmationNumber: e.target.value }))}
                  className={inputClass}
                  placeholder={ph}
                  autoComplete="off"
                />
              </div>
            ) : null}

            {dialogAction === 'request_change' ? (
              <div className="space-y-1">
                <label htmlFor="tb-change-note" className="text-xs font-medium text-gray-800">
                  {t('changeNoteLabel')}
                </label>
                <textarea
                  id="tb-change-note"
                  rows={3}
                  value={form.note}
                  onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                  className={inputClass}
                  placeholder={ph}
                />
              </div>
            ) : null}

            {dialogAction === 'request_payment' ? (
              <>
                <div className="space-y-1">
                  <label htmlFor="tb-pay-due" className="text-xs font-medium text-gray-800">
                    {t('paymentDueLabel')}
                  </label>
                  <input
                    id="tb-pay-due"
                    type="datetime-local"
                    value={form.paymentDue}
                    onChange={(e) => setForm((f) => ({ ...f, paymentDue: e.target.value }))}
                    className={inputClass}
                  />
                  <p className="text-[11px] leading-snug text-gray-500">{t('datetimeLocalHint')}</p>
                </div>
                <div className="space-y-1">
                  <label htmlFor="tb-pay-amt" className="text-xs font-medium text-gray-800">
                    {t('amountUsdLabel')}
                  </label>
                  <input
                    id="tb-pay-amt"
                    type="text"
                    inputMode="decimal"
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    className={inputClass}
                    placeholder={ph}
                    autoComplete="off"
                  />
                </div>
              </>
            ) : null}

            {dialogAction === 'mark_paid' ? (
              <div className="space-y-1">
                <label htmlFor="tb-paid-amt" className="text-xs font-medium text-gray-800">
                  {t('paidAmountLabel')}
                </label>
                <input
                  id="tb-paid-amt"
                  type="text"
                  inputMode="decimal"
                  value={form.paidAmount}
                  onChange={(e) => setForm((f) => ({ ...f, paidAmount: e.target.value }))}
                  className={inputClass}
                  placeholder={ph}
                  autoComplete="off"
                />
              </div>
            ) : null}

            {dialogAction === 'request_refund' ? (
              <>
                <div className="space-y-1">
                  <label htmlFor="tb-refund-amt" className="text-xs font-medium text-gray-800">
                    {t('refundAmountLabel')}
                  </label>
                  <input
                    id="tb-refund-amt"
                    type="text"
                    inputMode="decimal"
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    className={inputClass}
                    placeholder={ph}
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="tb-refund-note" className="text-xs font-medium text-gray-800">
                    {t('refundNoteLabel')}
                  </label>
                  <textarea
                    id="tb-refund-note"
                    rows={2}
                    value={form.note}
                    onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                    className={inputClass}
                    placeholder={ph}
                  />
                </div>
              </>
            ) : null}

            {dialogAction === 'mark_credit_received' ? (
              <div className="space-y-1">
                <label htmlFor="tb-credit-amt" className="text-xs font-medium text-gray-800">
                  {t('creditAmountLabel')}
                </label>
                <input
                  id="tb-credit-amt"
                  type="text"
                  inputMode="decimal"
                  value={form.creditAmount}
                  onChange={(e) => setForm((f) => ({ ...f, creditAmount: e.target.value }))}
                  className={inputClass}
                  placeholder={ph}
                  autoComplete="off"
                />
              </div>
            ) : null}

            {dialogAction === 'mark_refunded' ? (
              <div className="space-y-1">
                <label htmlFor="tb-refunded-amt" className="text-xs font-medium text-gray-800">
                  {t('refundedAmountLabel')}
                </label>
                <input
                  id="tb-refunded-amt"
                  type="text"
                  inputMode="decimal"
                  value={form.refundAmount}
                  onChange={(e) => setForm((f) => ({ ...f, refundAmount: e.target.value }))}
                  className={inputClass}
                  placeholder={ph}
                  autoComplete="off"
                />
              </div>
            ) : null}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={closeDialog} disabled={!!busy}>
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={!!busy}>
                {busy ? t('submitting') : t('submit')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
