'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { loadStripe } from '@stripe/stripe-js'
import { Elements } from '@stripe/react-stripe-js'
import {
  AlertCircle,
  BadgeCheck,
  Calendar,
  CheckCircle,
  CreditCard,
  FileUp,
  Lock,
  Shield,
  Upload,
  User,
} from 'lucide-react'
import ResidentCheckStripePay from '@/components/resident-check/ResidentCheckStripePay'
import CustomerPageShell from '@/components/customer/CustomerPageShell'
import { Button } from '@/components/ui/button'
import { residentCheckFinalizeBlockers } from '@/lib/residentCheckFinalize'
import type { ResidentCheckSubmissionRow } from '@/lib/residentCheckTokenService'

type SessionReservation = {
  id: string
  tour_date: string
  channel_rn: string | null
  adults: number | null
  child: number | null
  infant: number | null
  productName: string | null
  customerName: string | null
  customerEmail: string | null
}

type SessionPayload = {
  ok: boolean
  expired: boolean
  completed: boolean
  expiresAt: string
  reservation: SessionReservation
  submission: ResidentCheckSubmissionRow | null
}

type Residency = 'us_resident' | 'non_resident' | 'mixed'

function formatUsd(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    cents / 100
  )
}

function formatExpiry(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'ko-KR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function residencyLabel(
  value: string,
  t: ReturnType<typeof useTranslations<'residentCheck'>>
): string {
  if (value === 'us_resident') return t('usResident')
  if (value === 'non_resident') return t('nonResidentAll')
  if (value === 'mixed') return t('mixed')
  return value
}

function StepBadge({
  step,
  label,
  active,
  done,
}: {
  step: number
  label: string
  active: boolean
  done: boolean
}) {
  return (
    <div
      className={`flex flex-1 min-w-0 items-center gap-2 rounded-xl border px-3 py-2.5 text-xs sm:text-sm ${
        done
          ? 'border-success/30 bg-success/5 text-success'
          : active
            ? 'border-primary/30 bg-primary/5 text-primary'
            : 'border-border/60 bg-muted/30 text-muted-foreground'
      }`}
    >
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
          done
            ? 'bg-success text-white'
            : active
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground'
        }`}
      >
        {done ? '✓' : step}
      </span>
      <span className="truncate font-medium">{label}</span>
    </div>
  )
}

function StatusCard({
  tone,
  icon,
  title,
  children,
}: {
  tone: 'error' | 'warning' | 'success' | 'neutral'
  icon: React.ReactNode
  title?: string
  children: React.ReactNode
}) {
  const tones = {
    error: 'border-danger/30 bg-danger/5 text-danger',
    warning: 'border-warning/30 bg-warning/5 text-warning',
    success: 'border-success/30 bg-success/5 text-success',
    neutral: 'border-border/60 bg-card text-foreground',
  }
  return (
    <div className={`mx-auto max-w-lg rounded-2xl border p-6 text-center shadow-sm ${tones[tone]}`}>
      <div className="mx-auto mb-3 flex justify-center">{icon}</div>
      {title ? <p className="mb-2 font-semibold">{title}</p> : null}
      <div className="text-sm leading-relaxed">{children}</div>
    </div>
  )
}

function ReadOnlySummary({
  session,
  submission,
  t,
}: {
  session: SessionPayload
  submission: ResidentCheckSubmissionRow
  t: ReturnType<typeof useTranslations<'residentCheck'>>
}) {
  const r = session.reservation
  return (
    <div className="space-y-6">
      <StatusCard tone="success" icon={<CheckCircle className="h-12 w-12" />} title={t('completedTitle')}>
        {t('completedSubtitle')}
      </StatusCard>

      <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-foreground">{t('viewSubmission')}</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">{t('guest')}</dt>
            <dd className="font-medium">{r.customerName || '—'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('tourDate')}</dt>
            <dd className="font-medium">{r.tour_date}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">{t('residency')}</dt>
            <dd className="font-medium">{residencyLabel(submission.residency, t)}</dd>
          </div>
          {submission.residency !== 'us_resident' && (
            <div>
              <dt className="text-muted-foreground">{t('nonResidentCount')}</dt>
              <dd className="font-medium">{submission.non_resident_16_plus_count}</dd>
            </div>
          )}
          {submission.payment_method && (
            <div>
              <dt className="text-muted-foreground">{t('paymentMethod')}</dt>
              <dd className="font-medium">
                {submission.payment_method === 'card' ? t('payCardNow') : t('cashOnSite')}
              </dd>
            </div>
          )}
          <div>
            <dt className="text-muted-foreground">{t('idProof')}</dt>
            <dd className="font-medium">{submission.id_proof_url ? t('uploadedLabel') : '—'}</dd>
          </div>
          {submission.pass_photo_url && (
            <div>
              <dt className="text-muted-foreground">{t('passPhoto')}</dt>
              <dd className="font-medium">{t('uploadedLabel')}</dd>
            </div>
          )}
          {submission.total_charge_usd_cents > 0 && (
            <div>
              <dt className="text-muted-foreground">{t('totalCard')}</dt>
              <dd className="font-medium">{formatUsd(submission.total_charge_usd_cents)}</dd>
            </div>
          )}
        </dl>
        <p className="text-xs text-muted-foreground">{t('readOnlyBanner')}</p>
        <p className="text-sm text-muted-foreground">{t('contactHint')}</p>
      </div>
    </div>
  )
}

export default function ResidentCheckFlow() {
  const searchParams = useSearchParams()
  const locale = useLocale()
  const t = useTranslations('residentCheck')
  const rawToken = searchParams.get('t') || ''

  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<SessionPayload | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [residency, setResidency] = useState<Residency>('us_resident')
  const [nonResidentCount, setNonResidentCount] = useState(1)
  const [agreed, setAgreed] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'cash' | ''>('')
  const [passAssistance, setPassAssistance] = useState(false)
  const [hasAnnualPass, setHasAnnualPass] = useState(false)
  const [saving, setSaving] = useState(false)
  const [actionMsg, setActionMsg] = useState<string | null>(null)

  const stripePromise = useMemo(() => {
    const k = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    if (!k) return null
    return loadStripe(k)
  }, [])

  const loadSession = useCallback(async () => {
    if (!rawToken.trim()) {
      setLoading(false)
      setSession(null)
      return
    }
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch(`/api/resident-check/session?t=${encodeURIComponent(rawToken)}`)
      const data = await res.json()
      if (!res.ok) {
        setLoadError(data.error || t('linkLoadError'))
        setSession(null)
        return
      }
      const s = data as SessionPayload
      setSession(s)
      if (s.submission) {
        setResidency(s.submission.residency as Residency)
        setNonResidentCount(s.submission.non_resident_16_plus_count || 0)
        setAgreed(s.submission.agreed)
        setPaymentMethod((s.submission.payment_method as 'card' | 'cash') || '')
        setPassAssistance(s.submission.pass_assistance_requested)
        setHasAnnualPass(s.submission.has_annual_pass === true)
      }
    } catch {
      setLoadError(t('genericError'))
      setSession(null)
    } finally {
      setLoading(false)
    }
  }, [rawToken, t])

  useEffect(() => {
    void loadSession()
  }, [loadSession])

  const submission = session?.submission ?? null
  const blockers = submission ? residentCheckFinalizeBlockers(submission) : []

  const blockerLabels = useMemo(
    () =>
      blockers.map((key) => {
        if (key === 'agreed') return t('blockerAgreed')
        if (key === 'id_proof') return t('blockerIdProof')
        if (key === 'pass_photo') return t('blockerPassPhoto')
        if (key === 'payment_method') return t('blockerPaymentMethod')
        return key
      }),
    [blockers, t]
  )

  const step1Done = Boolean(submission)
  const step2Done = Boolean(submission?.id_proof_url) &&
    !(submission?.residency === 'non_resident' &&
      submission?.has_annual_pass === true &&
      !submission?.pass_photo_url)
  const step3Done = blockers.length === 0

  const handleSave = async () => {
    if (!rawToken.trim()) return
    setSaving(true)
    setActionMsg(null)
    try {
      const res = await fetch('/api/resident-check/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: rawToken,
          residency,
          non_resident_16_plus_count: nonResidentCount,
          agreed,
          payment_method: residency === 'us_resident' ? null : paymentMethod || null,
          pass_assistance_requested: passAssistance,
          has_annual_pass: residency === 'non_resident' ? hasAnnualPass : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setActionMsg(data.error || t('saveFailed'))
        return
      }
      setActionMsg(t('saved'))
      await loadSession()
    } finally {
      setSaving(false)
    }
  }

  const upload = async (kind: 'pass' | 'id', file: File) => {
    if (!rawToken.trim()) return
    setActionMsg(null)
    const fd = new FormData()
    fd.append('token', rawToken)
    fd.append('kind', kind)
    fd.append('file', file)
    const res = await fetch('/api/resident-check/upload', { method: 'POST', body: fd })
    const data = await res.json()
    if (!res.ok) {
      setActionMsg(data.error || t('uploadFailed'))
      return
    }
    setActionMsg(t('uploaded'))
    await loadSession()
  }

  const finalizeZero = async () => {
    if (!rawToken.trim()) return
    setSaving(true)
    setActionMsg(null)
    try {
      const res = await fetch('/api/resident-check/finalize-zero', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: rawToken }),
      })
      const data = await res.json()
      if (!res.ok) {
        setActionMsg(
          (data.error as string) ||
            (data.blockers?.length ? t('completeRequired') : t('completeFailed'))
        )
        return
      }
      await loadSession()
    } finally {
      setSaving(false)
    }
  }

  const completeCash = async () => {
    if (!rawToken.trim()) return
    setSaving(true)
    setActionMsg(null)
    try {
      const res = await fetch('/api/resident-check/complete-cash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: rawToken }),
      })
      const data = await res.json()
      if (!res.ok) {
        setActionMsg(data.error || t('completeFailed'))
        return
      }
      await loadSession()
    } finally {
      setSaving(false)
    }
  }

  const shell = (content: React.ReactNode) => (
    <CustomerPageShell locale={locale} hideFooter={false}>
      <div className="min-h-screen bg-muted/30 py-10 md:py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">{content}</div>
      </div>
    </CustomerPageShell>
  )

  if (!rawToken.trim()) {
    return shell(
      <StatusCard tone="warning" icon={<AlertCircle className="h-10 w-10" />}>
        {t('noTokenHint')}
      </StatusCard>
    )
  }

  if (loading) {
    return shell(
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        {t('loading')}
      </div>
    )
  }

  if (loadError || !session) {
    return shell(
      <StatusCard tone="error" icon={<AlertCircle className="h-10 w-10" />}>
        {loadError || t('sessionError')}
      </StatusCard>
    )
  }

  if (session.expired) {
    return shell(
      <StatusCard tone="warning" icon={<AlertCircle className="h-10 w-10" />}>
        {t('expired')}
      </StatusCard>
    )
  }

  if (session.completed && submission) {
    return shell(
      <ReadOnlySummary session={session} submission={submission} t={t} />
    )
  }

  const r = session.reservation
  const total = submission?.total_charge_usd_cents ?? 0
  const nps = submission?.nps_fee_usd_cents ?? 0
  const cardFee = submission?.card_processing_fee_usd_cents ?? 0

  return shell(
    <div className="space-y-6">
      <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('brandName')}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              {t('title')}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">{t('securePageNote')}</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <Lock className="h-4 w-4 shrink-0" />
            <span>{t('linkValidity', { date: formatExpiry(session.expiresAt, locale) })}</span>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-background px-3 py-2.5 text-sm">
            <Calendar className="h-4 w-4 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">{t('tourDate')}</p>
              <p className="font-medium">{r.tour_date}</p>
            </div>
          </div>
          {r.customerName && (
            <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-background px-3 py-2.5 text-sm">
              <User className="h-4 w-4 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">{t('guest')}</p>
                <p className="font-medium">{r.customerName}</p>
              </div>
            </div>
          )}
          {r.channel_rn && (
            <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-background px-3 py-2.5 text-sm">
              <BadgeCheck className="h-4 w-4 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Ref.</p>
                <p className="font-medium">{r.channel_rn}</p>
              </div>
            </div>
          )}
        </div>
        {r.productName && (
          <p className="mt-4 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{r.productName}</span>
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 text-sm leading-relaxed text-foreground">
        <p className="font-semibold text-primary">{t('npsTitle')}</p>
        <p className="mt-2 text-muted-foreground">{t('npsBody')}</p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <StepBadge step={1} label={t('stepResidency')} active={!step1Done} done={step1Done} />
        <StepBadge step={2} label={t('stepUpload')} active={step1Done && !step2Done} done={step2Done} />
        <StepBadge step={3} label={t('stepPayment')} active={step2Done && !step3Done} done={step3Done} />
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm space-y-5">
        <h2 className="text-lg font-semibold text-foreground">{t('questionnaire')}</h2>

        <div>
          <p className="mb-3 text-sm font-medium text-foreground">{t('residency')}</p>
          <div className="grid gap-2 sm:grid-cols-1">
            {(
              [
                ['us_resident', t('usResident')],
                ['non_resident', t('nonResidentAll')],
                ['mixed', t('mixed')],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors ${
                  residency === value
                    ? 'border-primary bg-primary/5'
                    : 'border-border/60 hover:border-primary/30'
                }`}
              >
                <input
                  type="radio"
                  name="res"
                  checked={residency === value}
                  onChange={() => setResidency(value)}
                  className="h-4 w-4 accent-primary"
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        {(residency === 'non_resident' || residency === 'mixed') && (
          <div>
            <label className="block text-sm font-medium text-foreground">
              {t('nonResidentCount')}
            </label>
            <input
              type="number"
              min={0}
              className="mt-2 w-full max-w-xs rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
              value={nonResidentCount}
              onChange={(e) => setNonResidentCount(Number(e.target.value))}
            />
          </div>
        )}

        {residency === 'non_resident' && (
          <label className="flex items-start gap-3 rounded-xl border border-border/60 px-4 py-3 text-sm">
            <input
              type="checkbox"
              checked={hasAnnualPass}
              onChange={(e) => setHasAnnualPass(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-primary"
            />
            {t('hasAnnualPass')}
          </label>
        )}

        <label className="flex items-start gap-3 rounded-xl border border-border/60 px-4 py-3 text-sm">
          <input
            type="checkbox"
            checked={passAssistance}
            onChange={(e) => setPassAssistance(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-primary"
          />
          {t('passAssistance')}
        </label>

        {residency !== 'us_resident' && (
          <div>
            <p className="mb-3 text-sm font-medium text-foreground">{t('paymentMethod')}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  ['cash', t('cashOnSite')],
                  ['card', t('payCardNow')],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm ${
                    paymentMethod === value
                      ? 'border-primary bg-primary/5'
                      : 'border-border/60'
                  }`}
                >
                  <input
                    type="radio"
                    name="pm"
                    checked={paymentMethod === value}
                    onChange={() => setPaymentMethod(value)}
                    className="h-4 w-4 accent-primary"
                  />
                  {value === 'card' ? (
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                  ) : null}
                  {label}
                </label>
              ))}
            </div>
          </div>
        )}

        <label className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-primary"
          />
          {t('agreeTerms')}
        </label>

        <Button
          type="button"
          variant="booking"
          size="booking"
          disabled={saving}
          onClick={() => void handleSave()}
          className="w-full sm:w-auto"
        >
          {saving ? t('saving') : t('saveAndContinue')}
        </Button>
      </div>

      {submission && (
        <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <FileUp className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">{t('uploadProof')}</h2>
          </div>
          <p className="text-sm text-muted-foreground">{t('uploadHint')}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t('idProof')}
              </p>
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-6 text-sm transition-colors hover:border-primary/40 hover:bg-muted/30">
                <Upload className="h-5 w-5 text-muted-foreground" />
                <span>{t('chooseFile')}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) void upload('id', f)
                    e.target.value = ''
                  }}
                />
              </label>
              {submission.id_proof_url && (
                <p className="mt-2 flex items-center gap-1 text-xs text-success">
                  <CheckCircle className="h-3.5 w-3.5" />
                  {t('uploadedLabel')}
                </p>
              )}
            </div>
            {((residency === 'non_resident' && hasAnnualPass) || submission.pass_photo_url) && (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t('passPhoto')}
                </p>
                <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-6 text-sm transition-colors hover:border-primary/40 hover:bg-muted/30">
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  <span>{t('chooseFile')}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) void upload('pass', f)
                      e.target.value = ''
                    }}
                  />
                </label>
                {submission.pass_photo_url && (
                  <p className="mt-2 flex items-center gap-1 text-xs text-success">
                    <CheckCircle className="h-3.5 w-3.5" />
                    {t('uploadedLabel')}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {submission && (
        <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm space-y-3">
          <h2 className="text-lg font-semibold text-foreground">{t('amountSummary')}</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('npsAddon')}</span>
              <span className="font-medium">{formatUsd(nps)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('cardFee')}</span>
              <span className="font-medium">{formatUsd(cardFee)}</span>
            </div>
            <div className="flex justify-between border-t border-border/60 pt-3 text-base">
              <span className="font-semibold">{t('totalCard')}</span>
              <span className="font-semibold text-primary">{formatUsd(total)}</span>
            </div>
          </div>
          {blockerLabels.length > 0 && (
            <div className="rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
              {t('beforeFinish')} {blockerLabels.join(' · ')}
            </div>
          )}
          <div className="flex flex-wrap gap-3 pt-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Shield className="h-3.5 w-3.5" />
              {t('trustSecure')}
            </span>
            <span className="inline-flex items-center gap-1">
              <Lock className="h-3.5 w-3.5" />
              {t('trustPrivate')}
            </span>
          </div>
        </div>
      )}

      {submission && blockers.length === 0 && total === 0 && (
        <div className="rounded-2xl border border-success/30 bg-card p-6 shadow-sm">
          <Button
            type="button"
            variant="booking"
            size="booking"
            disabled={saving}
            onClick={() => void finalizeZero()}
            className="w-full"
          >
            {t('submitNoPayment')}
          </Button>
        </div>
      )}

      {submission && blockers.length === 0 && total > 0 && paymentMethod === 'cash' && (
        <div className="rounded-2xl border border-warning/30 bg-warning/5 p-6 shadow-sm">
          <p className="mb-4 text-sm text-foreground">{t('cashConfirmHint')}</p>
          <Button
            type="button"
            variant="booking"
            size="booking"
            disabled={saving}
            onClick={() => void completeCash()}
            className="w-full"
          >
            {t('confirmCash')}
          </Button>
        </div>
      )}

      {submission && blockers.length === 0 && total > 0 && paymentMethod === 'card' && stripePromise && (
        <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-foreground">{t('cardPayment')}</h2>
          <Elements stripe={stripePromise}>
            <ResidentCheckStripePay
              token={rawToken}
              customerName={r.customerName || ''}
              customerEmail={r.customerEmail || ''}
              onPaid={() => void loadSession()}
            />
          </Elements>
        </div>
      )}

      {submission && blockers.length === 0 && total > 0 && paymentMethod === 'card' && !stripePromise && (
        <div className="rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          {t('stripeNotConfigured')}
        </div>
      )}

      <p className="text-center text-sm text-muted-foreground">{t('contactHint')}</p>

      {actionMsg && (
        <div className="rounded-xl border border-border/60 bg-muted/40 px-4 py-3 text-center text-sm text-foreground">
          {actionMsg}
        </div>
      )}
    </div>
  )
}
