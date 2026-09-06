'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslations } from 'next-intl'
import {
  CheckCircle2,
  Copy,
  CreditCard,
  Loader2,
  QrCode,
  RefreshCw,
  X,
} from 'lucide-react'
import { fetchApiWithAuthWhenReady } from '@/lib/api-client-bearer'
import { DIALOG_Z_INDEX } from '@/lib/dialogZIndex'

export type GuidePickupChargeTarget = {
  reservationId: string
  customerName: string
  recordedBalanceUsd: number
  tourDate?: string | null
  productName?: string | null
}

type GuidePickupChargeModalProps = {
  open: boolean
  onClose: () => void
  locale: string
  target: GuidePickupChargeTarget | null
  onPaid?: () => void
}

type ChargeResult = {
  invoiceId: string
  sitePayUrl: string
  amountUsd: number
  description: string
}

function parseUsdAmount(raw: string): number {
  const n = Number(String(raw).replace(/[^0-9.]/g, ''))
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

function formatUsd(amount: number): string {
  return `$${amount.toFixed(2)}`
}

function qrImageUrl(data: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=8&data=${encodeURIComponent(data)}`
}

export default function GuidePickupChargeModal({
  open,
  onClose,
  locale,
  target,
  onPaid,
}: GuidePickupChargeModalProps) {
  const t = useTranslations('guideTour.fieldCharge')
  const isKo = locale.startsWith('ko')
  const [mounted, setMounted] = useState(false)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ChargeResult | null>(null)
  const [copied, setCopied] = useState(false)
  const [paid, setPaid] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const defaultNote = useMemo(() => {
    if (!target) return ''
    const name = target.customerName.trim() || 'Guest'
    const date = (target.tourDate || '').trim()
    return date ? `On-site balance · ${name} · ${date}` : `On-site balance · ${name}`
  }, [target])

  useEffect(() => {
    if (!open || !target) return
    setAmount(target.recordedBalanceUsd > 0 ? target.recordedBalanceUsd.toFixed(2) : '')
    setNote(defaultNote)
    setError(null)
    setResult(null)
    setCopied(false)
    setPaid(false)
    setSubmitting(false)
  }, [open, target, defaultNote])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  useEffect(() => {
    if (!open || !result?.invoiceId || paid) return
    let cancelled = false

    const checkPaid = async () => {
      const res = await fetchApiWithAuthWhenReady(
        `/api/invoices/quick-payment-request?invoiceId=${encodeURIComponent(result.invoiceId)}&locale=${isKo ? 'ko' : 'en'}`
      )
      if (!res || cancelled) return
      const data = (await res.json().catch(() => null)) as { paid?: boolean } | null
      if (!cancelled && data?.paid) {
        setPaid(true)
        onPaid?.()
      }
    }

    void checkPaid()
    const timer = window.setInterval(() => {
      void checkPaid()
    }, 4000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [open, result?.invoiceId, paid, isKo, onPaid])

  const amountUsd = parseUsdAmount(amount)

  const createCharge = useCallback(async () => {
    if (!target) return
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setError(t('offline'))
      return
    }
    if (amountUsd <= 0) {
      setError(t('invalidAmount'))
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetchApiWithAuthWhenReady('/api/invoices/quick-payment-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fieldCharge: true,
          preserveReservationCustomer: true,
          sendEmail: false,
          sendSms: false,
          reservationId: target.reservationId,
          recipientName: target.customerName,
          amountUsd,
          description: note.trim() || defaultNote,
          locale: 'en',
        }),
      })
      if (!res) {
        setError(t('offline'))
        return
      }
      const data = (await res.json().catch(() => null)) as
        | { error?: string; invoiceId?: string; sitePayUrl?: string; hostedInvoiceUrl?: string; amountUsd?: number; description?: string }
        | null
      if (!res.ok || !data?.invoiceId) {
        setError(data?.error || t('error'))
        return
      }
      const payUrl = String(data.sitePayUrl || data.hostedInvoiceUrl || '').trim()
      if (!payUrl) {
        setError(t('error'))
        return
      }
      setResult({
        invoiceId: data.invoiceId,
        sitePayUrl: payUrl,
        amountUsd: Number(data.amountUsd) || amountUsd,
        description: String(data.description || note.trim() || defaultNote),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error'))
    } finally {
      setSubmitting(false)
    }
  }, [amountUsd, defaultNote, isKo, note, t, target])

  const copyLink = useCallback(async () => {
    const url = result?.sitePayUrl
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }, [result?.sitePayUrl])

  if (!open || !mounted || !target) return null

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/50 p-4"
      style={{ zIndex: DIALOG_Z_INDEX.elevated }}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-label={t('title')}
    >
      <div
        className="relative flex max-h-[92vh] w-full max-w-md flex-col overflow-y-auto rounded-2xl border border-border bg-background p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">{t('title')}</h2>
            <p className="mt-1 truncate text-sm text-muted-foreground">{target.customerName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted"
            aria-label={t('close')}
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        {result ? (
          <div className="space-y-4">
            <div
              className={`rounded-xl border px-3 py-2 text-sm ${
                paid
                  ? 'border-green-200 bg-green-50 text-green-800'
                  : 'border-amber-200 bg-amber-50 text-amber-900'
              }`}
              role="status"
            >
              {paid ? (
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                  {t('paid')}
                </span>
              ) : (
                t('waiting')
              )}
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/30 p-3 text-center">
              <p className="text-sm font-medium text-foreground">{formatUsd(result.amountUsd)}</p>
              {result.description ? (
                <p className="mt-1 text-xs text-muted-foreground">{result.description}</p>
              ) : null}
            </div>

            <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-white p-4">
              <p className="text-sm font-semibold text-foreground">{t('qrTitle')}</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrImageUrl(result.sitePayUrl)}
                alt={t('qrTitle')}
                width={280}
                height={280}
                className="h-[240px] w-[240px] rounded-xl bg-white sm:h-[280px] sm:w-[280px]"
              />
              <p className="text-center text-xs leading-5 text-muted-foreground">{t('qrHint')}</p>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => void copyLink()}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-medium hover:bg-muted"
              >
                <Copy className="h-4 w-4" aria-hidden />
                {copied ? t('copied') : t('copyLink')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setResult(null)
                  setPaid(false)
                  setError(null)
                }}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium text-muted-foreground hover:bg-muted"
              >
                <RefreshCw className="h-4 w-4" aria-hidden />
                {t('newCharge')}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-border/60 bg-muted/40 px-3 py-2.5">
              <p className="text-xs font-medium text-muted-foreground">{t('recordedBalance')}</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
                {formatUsd(target.recordedBalanceUsd)}
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="guide-field-charge-amount" className="text-sm font-medium text-foreground">
                {t('amount')}
              </label>
              <input
                id="guide-field-charge-amount"
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-12 w-full rounded-lg border border-input bg-background px-3 text-base tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="0.00"
              />
              <p className="text-xs leading-5 text-muted-foreground">{t('amountHint')}</p>
              {Math.abs(amountUsd - target.recordedBalanceUsd) > 0.005 ? (
                <button
                  type="button"
                  onClick={() => setAmount(target.recordedBalanceUsd.toFixed(2))}
                  className="text-xs font-medium text-primary underline-offset-2 hover:underline"
                >
                  {t('resetAmount')}
                </button>
              ) : null}
            </div>

            <div className="space-y-2">
              <label htmlFor="guide-field-charge-note" className="text-sm font-medium text-foreground">
                {t('note')}
              </label>
              <textarea
                id="guide-field-charge-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder={t('notePlaceholder')}
              />
            </div>

            {error ? (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="button"
              disabled={submitting}
              onClick={() => void createCharge()}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <QrCode className="h-4 w-4" aria-hidden />
              )}
              {submitting ? t('generating') : t('generateQr')}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

export function GuidePickupChargeButton({
  onClick,
  ariaLabel,
}: {
  onClick: () => void
  ariaLabel: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-500 text-white hover:bg-emerald-600"
      aria-label={ariaLabel}
    >
      <CreditCard className="h-3.5 w-3.5" aria-hidden />
    </button>
  )
}
