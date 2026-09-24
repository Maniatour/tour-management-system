'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { CreditCard, Heart, Loader2, ShieldCheck } from 'lucide-react'
import { normalizeSiteLocale } from '@/lib/siteLocales'
import { tipAmountsMatch, tipGuideOptions } from '@/lib/tipGuideline'

type InvoicePayWithTipFormProps = {
  locale: string
  token: string
  invoiceNumber: string
  description: string
  amountDueUsd: number
  isOpenAmount: boolean
  /** 예약 투어비. 있으면 15/20/25% 안내를 보여 준다. */
  tourFareUsd?: number | null
  canceled?: boolean
}

export default function InvoicePayWithTipForm({
  locale,
  token,
  invoiceNumber,
  description,
  amountDueUsd,
  isOpenAmount,
  tourFareUsd = null,
  canceled = false,
}: InvoicePayWithTipFormProps) {
  const t = useTranslations('invoicePay')
  const payLocale = normalizeSiteLocale(locale, 'en')
  const guideOptions = useMemo(() => tipGuideOptions(tourFareUsd), [tourFareUsd])
  const [tipPreset, setTipPreset] = useState<number | 'custom'>(() =>
    tipGuideOptions(tourFareUsd).length === 0 ? 'custom' : 0
  )
  const [customAmount, setCustomAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedAmount = useMemo(() => {
    if (tipPreset === 'custom') {
      const n = Number(customAmount)
      return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0
    }
    return tipPreset
  }, [tipPreset, customAmount])

  const tipUsd = isOpenAmount ? 0 : selectedAmount
  const payUsd = isOpenAmount ? selectedAmount : Math.round((amountDueUsd + tipUsd) * 100) / 100

  const handlePay = async () => {
    if (submitting) return
    setError(null)

    if (isOpenAmount) {
      if (!Number.isFinite(selectedAmount) || selectedAmount < 0.5) {
        setError(t('minTipError'))
        return
      }
    } else if (tipUsd > 0 && tipUsd < 0.5) {
      setError(t('tipRangeError'))
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch(`/api/invoices/pay/${token}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locale: payLocale,
          ...(isOpenAmount ? { amountUsd: selectedAmount } : { tipUsd }),
        }),
      })
      const data = (await response.json().catch(() => ({}))) as { url?: string; error?: string }
      if (!response.ok || !data.url) {
        throw new Error(data.error || t('checkoutError'))
      }
      window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : t('genericError'))
      setSubmitting(false)
    }
  }

  const fareLabel =
    tourFareUsd != null && tourFareUsd > 0 ? `$${tourFareUsd.toFixed(2)}` : ''

  const customAmountField = (
    <div className="relative mt-3">
      <label htmlFor="invoice-tip-custom" className="sr-only">
        {t('customTipAria')}
      </label>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
        $
      </span>
      <input
        id="invoice-tip-custom"
        type="number"
        min={0.5}
        step={0.01}
        value={customAmount}
        onChange={(e) => {
          setTipPreset('custom')
          setCustomAmount(e.target.value)
        }}
        className="h-11 w-full rounded-lg border border-input bg-background pl-7 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        placeholder="0.00"
      />
    </div>
  )

  return (
    <div className="min-h-dvh bg-muted/30 px-4 py-5 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-lg">
        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm sm:p-8">
          <p className="text-xs font-medium tracking-wide text-muted-foreground">
            {t('invoiceLabel')} {invoiceNumber}
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            {isOpenAmount ? t('tipTitle') : t('title')}
          </h1>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            {isOpenAmount ? t('tipHint') : description || t('reviewHint')}
          </p>

          {canceled ? (
            <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {t('canceled')}
            </p>
          ) : null}

          {!isOpenAmount ? (
            <div className="mt-6 rounded-xl border border-border/60 bg-muted/40 px-4 py-3">
              <p className="text-xs font-medium text-muted-foreground">{t('amountDue')}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                ${amountDueUsd.toFixed(2)}
              </p>
              {description ? (
                <p className="mt-1 text-sm text-muted-foreground">{description}</p>
              ) : null}
            </div>
          ) : null}

          {guideOptions.length > 0 ? (
            <div className="mt-6 rounded-2xl border border-border/60 bg-muted/40 p-4">
              <p className="text-sm font-medium text-foreground">{t('tipGuideTitle')}</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {t('tipGuideBody', { fare: fareLabel })}
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {guideOptions.map((option) => {
                  const active =
                    tipPreset !== 'custom' && tipAmountsMatch(selectedAmount, option.amountUsd)
                  return (
                    <button
                      key={option.percent}
                      type="button"
                      onClick={() => setTipPreset(option.amountUsd)}
                      className={`flex min-h-16 flex-col items-center justify-center rounded-xl border px-2 py-2 transition ${
                        active
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-background text-foreground hover:border-primary/50'
                      }`}
                      aria-pressed={active}
                      aria-label={t('tipGuideAria', {
                        percent: option.percent,
                        amount: option.amountUsd.toFixed(2),
                      })}
                    >
                      <span className="text-xs font-medium">{option.percent}%</span>
                      <span className="text-base font-semibold tabular-nums">
                        ${option.amountUsd.toFixed(2)}
                      </span>
                    </button>
                  )
                })}
              </div>
              <button
                type="button"
                onClick={() => setTipPreset('custom')}
                className={`mt-2 h-11 w-full rounded-xl border text-sm font-medium transition ${
                  tipPreset === 'custom'
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background text-foreground hover:border-primary/50'
                }`}
                aria-pressed={tipPreset === 'custom'}
              >
                {t('custom')}
              </button>
              {tipPreset === 'custom' ? customAmountField : null}
            </div>
          ) : (
            <div className="mt-6">
              <div className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-rose-500" aria-hidden />
                <p className="text-sm font-medium text-foreground">
                  {isOpenAmount ? t('tipAmount') : t('tipOptional')}
                </p>
              </div>
              <div className="mt-3">{customAmountField}</div>
            </div>
          )}

          <div className="mt-6 flex items-end justify-between gap-4 border-t border-border/60 pt-5">
            <div>
              <p className="text-xs font-medium text-muted-foreground">{t('total')}</p>
              <p className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                ${payUsd.toFixed(2)}
              </p>
              {!isOpenAmount && tipUsd > 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  ${amountDueUsd.toFixed(2)} + {t('tipWord')} ${tipUsd.toFixed(2)}
                </p>
              ) : null}
            </div>
          </div>

          {error ? (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            disabled={submitting || payUsd < 0.5}
            onClick={() => {
              void handlePay()
            }}
            className="mt-6 inline-flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-base font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                {t('openingPayment')}
              </>
            ) : (
              <>
                <CreditCard className="h-5 w-5" aria-hidden />
                {t('payAmount', { amount: payUsd.toFixed(2) })}
              </>
            )}
          </button>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            {t('secureNote')}
          </p>
        </div>
      </div>
    </div>
  )
}
