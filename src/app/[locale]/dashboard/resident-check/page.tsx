'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { loadStripe } from '@stripe/stripe-js'
import { Elements } from '@stripe/react-stripe-js'
import { AlertCircle, CheckCircle, Upload } from 'lucide-react'
import ResidentCheckStripePay from '@/components/resident-check/ResidentCheckStripePay'
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

function formatUsd(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    cents / 100
  )
}

function ResidentCheckInner() {
  const searchParams = useSearchParams()
  const t = useTranslations('residentCheck')

  const rawToken = searchParams.get('t') || ''

  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<SessionPayload | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [residency, setResidency] = useState<'us_resident' | 'non_resident' | 'mixed'>('us_resident')
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
        setResidency(s.submission.residency as typeof residency)
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
  }, [rawToken])

  useEffect(() => {
    void loadSession()
  }, [loadSession])

  const submission = session?.submission ?? null
  const blockers = submission ? residentCheckFinalizeBlockers(submission) : []

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
            (data.blockers?.length
              ? t('completeRequired')
              : t('completeFailed'))
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

  if (!rawToken.trim()) {
    return (
      <div className="min-h-screen bg-slate-50 py-10 px-4">
        <div className="mx-auto max-w-lg rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <AlertCircle className="mx-auto mb-3 h-10 w-10 text-amber-500" />
          <p className="text-slate-700">
            {t('noTokenHint')}
          </p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center text-slate-600">{t('loading')}</div>
      </div>
    )
  }

  if (loadError || !session) {
    return (
      <div className="min-h-screen bg-slate-50 py-10 px-4">
        <div className="mx-auto max-w-lg rounded-xl border border-red-200 bg-red-50 p-6 text-red-800">
          {loadError || t('sessionError')}
        </div>
      </div>
    )
  }

  if (session.expired) {
    return (
      <div className="min-h-screen bg-slate-50 py-10 px-4">
        <div className="mx-auto max-w-lg rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          {t('expired')}
        </div>
      </div>
    )
  }

  if (session.completed) {
    return (
      <div className="min-h-screen bg-slate-50 py-10 px-4">
        <div className="mx-auto max-w-lg rounded-xl border border-green-200 bg-green-50 p-6 text-center text-green-900">
          <CheckCircle className="mx-auto mb-3 h-12 w-12" />
          <p className="font-medium">
            {t('completed')}
          </p>
        </div>
      </div>
    )
  }

  const r = session.reservation
  const total = submission?.total_charge_usd_cents ?? 0
  const nps = submission?.nps_fee_usd_cents ?? 0
  const cardFee = submission?.card_processing_fee_usd_cents ?? 0

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {r.productName || '—'} · {t('tourDate')}: {r.tour_date}
            {r.channel_rn ? ` · RN: ${r.channel_rn}` : ''}
          </p>
          {r.customerName && (
            <p className="mt-2 text-sm text-slate-700">
              {t('guest')}: {r.customerName}
            </p>
          )}
        </div>

        <div className="rounded-xl border border-border/60 bg-primary/5/80 p-5 text-sm text-slate-800">
          <p className="font-semibold text-blue-950">{t('npsTitle')}</p>
          <p className="mt-2 leading-relaxed">
            {t('npsBody')}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">{t('questionnaire')}</h2>

          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">{t('residency')}</p>
            <div className="flex flex-col gap-2 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="res"
                  checked={residency === 'us_resident'}
                  onChange={() => setResidency('us_resident')}
                />
                {t('usResident')}
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="res"
                  checked={residency === 'non_resident'}
                  onChange={() => setResidency('non_resident')}
                />
                {t('nonResidentAll')}
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="res"
                  checked={residency === 'mixed'}
                  onChange={() => setResidency('mixed')}
                />
                {t('mixed')}
              </label>
            </div>
          </div>

          {(residency === 'non_resident' || residency === 'mixed') && (
            <div>
              <label className="block text-sm font-medium text-slate-700">
                {t('nonResidentCount')}
              </label>
              <input
                type="number"
                min={0}
                className="mt-1 w-32 rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={nonResidentCount}
                onChange={(e) => setNonResidentCount(Number(e.target.value))}
              />
            </div>
          )}

          {residency === 'non_resident' && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={hasAnnualPass}
                onChange={(e) => setHasAnnualPass(e.target.checked)}
              />
              {t('hasAnnualPass')}
            </label>
          )}

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={passAssistance}
              onChange={(e) => setPassAssistance(e.target.checked)}
            />
            {t('passAssistance')}
          </label>

          {residency !== 'us_resident' && (
            <div>
              <p className="mb-2 text-sm font-medium text-slate-700">{t('paymentMethod')}</p>
              <div className="flex flex-col gap-2 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="pm"
                    checked={paymentMethod === 'cash'}
                    onChange={() => setPaymentMethod('cash')}
                  />
                  {t('cashOnSite')}
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="pm"
                    checked={paymentMethod === 'card'}
                    onChange={() => setPaymentMethod('card')}
                  />
                  {t('payCardNow')}
                </label>
              </div>
            </div>
          )}

          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            <span>
              {t('agreeTerms')}
            </span>
          </label>

          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {saving ? t('saving') : t('save')}
          </button>
        </div>

        {submission && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">{t('uploadProof')}</h2>
            <p className="text-sm text-slate-600">
              {t('uploadHint')}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-medium text-slate-600">{t('idProof')}</p>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">
                  <Upload className="h-4 w-4" />
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
                  <p className="mt-1 truncate text-xs text-green-700">{t('uploadedLabel')}</p>
                )}
              </div>
              {(residency === 'non_resident' && hasAnnualPass) || submission.pass_photo_url ? (
                <div>
                  <p className="mb-1 text-xs font-medium text-slate-600">{t('passPhoto')}</p>
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">
                    <Upload className="h-4 w-4" />
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
                    <p className="mt-1 truncate text-xs text-green-700">{t('uploadedLabel')}</p>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        )}

        {submission && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">{t('amountSummary')}</h2>
            <p className="text-sm text-slate-700">
              {t('npsAddon')}: {formatUsd(nps)}
            </p>
            <p className="text-sm text-slate-700">
              {t('cardFee')}: {formatUsd(cardFee)}
            </p>
            <p className="text-base font-semibold text-slate-900">
              {t('totalCard')}: {formatUsd(total)}
            </p>
            {blockers.length > 0 && (
              <p className="text-xs text-amber-800">
                {t('beforeFinish')}{' '}
                {blockers.join(', ')}
              </p>
            )}
          </div>
        )}

        {submission && blockers.length === 0 && total === 0 && (
          <div className="rounded-xl border border-green-200 bg-white p-6 shadow-sm">
            <button
              type="button"
              disabled={saving}
              onClick={() => void finalizeZero()}
              className="w-full rounded-lg bg-green-600 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              {t('submitNoPayment')}
            </button>
          </div>
        )}

        {submission && blockers.length === 0 && total > 0 && paymentMethod === 'cash' && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-6 shadow-sm">
            <p className="mb-3 text-sm text-amber-950">
              {t('cashConfirmHint')}
            </p>
            <button
              type="button"
              disabled={saving}
              onClick={() => void completeCash()}
              className="w-full rounded-lg bg-amber-600 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {t('confirmCash')}
            </button>
          </div>
        )}

        {submission && blockers.length === 0 && total > 0 && paymentMethod === 'card' && stripePromise && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold text-slate-900">{t('cardPayment')}</h2>
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
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {t('stripeNotConfigured')}
          </div>
        )}

        {actionMsg && (
          <div className="rounded-lg border border-slate-200 bg-slate-100 px-4 py-2 text-sm text-slate-800">
            {actionMsg}
          </div>
        )}
      </div>
    </div>
  )
}

function ResidentCheckSuspenseFallback() {
  const t = useTranslations('residentCheck')
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
      {t('suspenseLoading')}
    </div>
  )
}

export default function ResidentCheckPage() {
  return (
    <Suspense fallback={<ResidentCheckSuspenseFallback />}>
      <ResidentCheckInner />
    </Suspense>
  )
}
