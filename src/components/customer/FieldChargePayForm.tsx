'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { CreditCard, Heart, Loader2, ShieldCheck, Wallet } from 'lucide-react'
import { CHOICE_CARD_PROCESSING_FEE_RATE } from '@/lib/choiceProcessingFee'
import type { FieldPayMode } from '@/lib/fieldChargePayChoice'
import { normalizeSiteLocale } from '@/lib/siteLocales'
import { tipAmountsMatch, tipGuideOptions } from '@/lib/tipGuideline'

type FieldChargePayFormProps = {
  locale: string
  token: string
  invoiceNumber: string
  description: string
  balancePayable: boolean
  balanceUsd: number
  cardChargeUsd: number
  cardFeeUsd: number
  tourFareUsd?: number | null
  canceled?: boolean
  thanks?: FieldPayMode | null
}

const FEE_PERCENT = Math.round(CHOICE_CARD_PROCESSING_FEE_RATE * 100)

function money(amount: number): string {
  return `$${amount.toFixed(2)}`
}

export default function FieldChargePayForm({
  locale,
  token,
  invoiceNumber,
  description,
  balancePayable,
  balanceUsd,
  cardChargeUsd,
  cardFeeUsd,
  tourFareUsd = null,
  canceled = false,
  thanks = null,
}: FieldChargePayFormProps) {
  const t = useTranslations('invoicePay')
  const payLocale = normalizeSiteLocale(locale, 'en')
  const guideOptions = useMemo(() => tipGuideOptions(tourFareUsd), [tourFareUsd])
  const [mode, setMode] = useState<FieldPayMode | null>(balancePayable ? null : 'tip')
  const [tipPreset, setTipPreset] = useState<number | 'custom'>(() =>
    tipGuideOptions(tourFareUsd).length === 0 ? 'custom' : 0
  )
  const [customAmount, setCustomAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedTip = useMemo(() => {
    if (tipPreset === 'custom') {
      const n = Number(customAmount)
      return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0
    }
    return tipPreset
  }, [tipPreset, customAmount])

  const includesBalance = mode === 'balance' || mode === 'both'
  const includesTip = mode === 'tip' || mode === 'both'
  const tipUsd = includesTip ? selectedTip : 0
  const payUsd = Math.round(((includesBalance ? cardChargeUsd : 0) + tipUsd) * 100) / 100
  const fareLabel = tourFareUsd != null && tourFareUsd > 0 ? money(tourFareUsd) : ''

  const thanksText =
    thanks === 'tip' ? t('thanksTip') : thanks === 'both' ? t('thanksBoth') : thanks === 'balance' ? t('thanksBalance') : ''

  const handlePay = async () => {
    if (submitting || !mode) return
    setError(null)
    if (includesTip && tipUsd < 0.5) {
      setError(t('minTipError'))
      return
    }
    setSubmitting(true)
    try {
      const response = await fetch(`/api/invoices/pay/${token}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locale: payLocale,
          payMode: mode,
          tipUsd: includesTip ? tipUsd : 0,
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

  const choiceButton = (value: FieldPayMode, label: string, amount: string, icon: ReactNode) => {
    const active = mode === value
    return (
      <button
        type="button"
        onClick={() => setMode(value)}
        className={`flex min-h-16 w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
          active
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-border bg-background text-foreground hover:border-primary/50'
        }`}
        aria-pressed={active}
      >
        <span className="shrink-0" aria-hidden>
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{label}</span>
          <span className={`mt-0.5 block text-base font-semibold tabular-nums ${active ? '' : 'text-foreground'}`}>
            {amount}
          </span>
        </span>
      </button>
    )
  }

  return (
    <div className="min-h-dvh bg-muted/30 px-4 py-5 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-lg">
        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm sm:p-8">
          <p className="text-xs font-medium tracking-wide text-muted-foreground">
            {t('invoiceLabel')} {invoiceNumber}
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            {balancePayable ? t('choiceTitle') : t('tipTitle')}
          </h1>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            {balancePayable ? t('choiceHint') : t('balanceSettled')}
          </p>
          {description ? <p className="mt-2 text-sm text-muted-foreground">{description}</p> : null}

          {thanksText ? (
            <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              {thanksText}
            </p>
          ) : null}
          {canceled ? (
            <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {t('canceled')}
            </p>
          ) : null}

          {balancePayable ? (
            <div className="mt-6 space-y-2" role="group" aria-label={t('choiceTitle')}>
              {choiceButton('balance', t('payBalance'), money(cardChargeUsd), <Wallet className="h-5 w-5" />)}
              {choiceButton('tip', t('payTip'), t('custom'), <Heart className="h-5 w-5" />)}
              {choiceButton(
                'both',
                t('payBoth'),
                `${money(cardChargeUsd)} + ${t('tipWord')}`,
                <CreditCard className="h-5 w-5" />
              )}
              {includesBalance ? (
                <p className="px-1 text-xs leading-5 text-muted-foreground">
                  {t('cardFeeNote', { percent: FEE_PERCENT })} {money(balanceUsd)} + {money(cardFeeUsd)}
                </p>
              ) : null}
            </div>
          ) : null}

          {includesTip ? (
            guideOptions.length > 0 ? (
              <div className="mt-6 rounded-2xl border border-border/60 bg-muted/40 p-4">
                <p className="text-sm font-medium text-foreground">{t('tipGuideTitle')}</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {t('tipGuideBody', { fare: fareLabel })}
                </p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {guideOptions.map((option) => {
                    const active = tipPreset !== 'custom' && tipAmountsMatch(selectedTip, option.amountUsd)
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
                        <span className="text-base font-semibold tabular-nums">{money(option.amountUsd)}</span>
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
                {tipPreset === 'custom' ? (
                  <div className="relative mt-3">
                    <label htmlFor="field-tip-custom" className="sr-only">
                      {t('customTipAria')}
                    </label>
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      $
                    </span>
                    <input
                      id="field-tip-custom"
                      type="number"
                      min={0.5}
                      step={0.01}
                      inputMode="decimal"
                      value={customAmount}
                      onChange={(e) => {
                        setTipPreset('custom')
                        setCustomAmount(e.target.value)
                      }}
                      className="h-11 w-full rounded-lg border border-input bg-background pl-7 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder="0.00"
                    />
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="relative mt-6">
                <label htmlFor="field-tip-custom" className="mb-2 block text-sm font-medium text-foreground">
                  {t('tipAmount')}
                </label>
                <span className="pointer-events-none absolute left-3 top-[2.35rem] -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <input
                  id="field-tip-custom"
                  type="number"
                  min={0.5}
                  step={0.01}
                  inputMode="decimal"
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
          ) : null}

          <div className="mt-6 flex items-end justify-between gap-4 border-t border-border/60 pt-5">
            <div>
              <p className="text-xs font-medium text-muted-foreground">{t('total')}</p>
              <p className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">{money(payUsd)}</p>
              {includesBalance && tipUsd > 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {money(cardChargeUsd)} + {t('tipWord')} {money(tipUsd)}
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
            disabled={submitting || !mode || payUsd < 0.5}
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
