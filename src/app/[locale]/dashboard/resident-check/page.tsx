'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
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
  const params = useParams()
  const searchParams = useSearchParams()
  const locale = (params.locale as string) || 'ko'
  const isEnglish = locale === 'en'
  const t = (ko: string, en: string) => (isEnglish ? en : ko)

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
        setLoadError(data.error || t('링크를 불러올 수 없습니다.', 'Unable to load this link.'))
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
      setLoadError(t('오류가 발생했습니다.', 'Something went wrong.'))
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
        setActionMsg(data.error || t('저장에 실패했습니다.', 'Save failed.'))
        return
      }
      setActionMsg(t('저장되었습니다.', 'Saved.'))
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
      setActionMsg(data.error || t('업로드 실패', 'Upload failed'))
      return
    }
    setActionMsg(t('업로드되었습니다.', 'Uploaded.'))
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
              ? t('필수 항목을 완료해 주세요.', 'Please complete required fields.')
              : t('완료 처리에 실패했습니다.', 'Could not complete.'))
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
        setActionMsg(data.error || t('완료 처리에 실패했습니다.', 'Could not complete.'))
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
            {t(
              '이 페이지는 이메일로 받은 개인 링크로만 열 수 있습니다. 메일의 버튼 또는 URL을 사용해 주세요.',
              'This page opens from the personal link in your email. Please use the button or URL from the message.'
            )}
          </p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center text-slate-600">{t('불러오는 중…', 'Loading…')}</div>
      </div>
    )
  }

  if (loadError || !session) {
    return (
      <div className="min-h-screen bg-slate-50 py-10 px-4">
        <div className="mx-auto max-w-lg rounded-xl border border-red-200 bg-red-50 p-6 text-red-800">
          {loadError || t('세션을 불러올 수 없습니다.', 'Could not load session.')}
        </div>
      </div>
    )
  }

  if (session.expired) {
    return (
      <div className="min-h-screen bg-slate-50 py-10 px-4">
        <div className="mx-auto max-w-lg rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          {t('이 링크는 만료되었습니다(14일). 새 링크가 필요하면 투어사에 문의해 주세요.', 'This link has expired (14 days). Please contact us for a new link.')}
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
            {t('제출이 완료되었습니다. 감사합니다.', 'Your response is complete. Thank you.')}
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
            {t('국립공원 입장 · 거주 확인', 'Park entry & residency')}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {r.productName || '—'} · {t('투어일', 'Tour date')}: {r.tour_date}
            {r.channel_rn ? ` · RN: ${r.channel_rn}` : ''}
          </p>
          {r.customerName && (
            <p className="mt-2 text-sm text-slate-700">
              {t('예약자', 'Guest')}: {r.customerName}
            </p>
          )}
        </div>

        <div className="rounded-xl border border-blue-100 bg-blue-50/80 p-5 text-sm text-slate-800">
          <p className="font-semibold text-blue-950">{t('NPS 안내', 'NPS policy')}</p>
          <p className="mt-2 leading-relaxed">
            {t(
              '2026년 1월 1일부터 일부 국립공원에서 비거주자(만 16세 이상)에게 추가 입장료가 부과될 수 있습니다. 미국 거주자는 표준 요금이 적용됩니다.',
              'Starting Jan 1, 2026, certain national parks may charge non-U.S. residents (16+) an additional entry fee. U.S. residents pay the standard fee.'
            )}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">{t('설문', 'Questionnaire')}</h2>

          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">{t('거주 구분', 'Residency')}</p>
            <div className="flex flex-col gap-2 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="res"
                  checked={residency === 'us_resident'}
                  onChange={() => setResidency('us_resident')}
                />
                {t('미국 거주자', 'U.S. resident')}
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="res"
                  checked={residency === 'non_resident'}
                  onChange={() => setResidency('non_resident')}
                />
                {t('비거주자(전원)', 'Non–U.S. resident (entire party)')}
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="res"
                  checked={residency === 'mixed'}
                  onChange={() => setResidency('mixed')}
                />
                {t('혼합(거주자+비거주자)', 'Mixed (residents & non-residents)')}
              </label>
            </div>
          </div>

          {(residency === 'non_resident' || residency === 'mixed') && (
            <div>
              <label className="block text-sm font-medium text-slate-700">
                {t('비거주자 만 16세 이상 인원 수', 'Non–U.S. residents age 16+ (count)')}
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
              {t('America the Beautiful 연간 패스 보유', 'I have an America the Beautiful Annual Pass')}
            </label>
          )}

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={passAssistance}
              onChange={(e) => setPassAssistance(e.target.checked)}
            />
            {t('비거주 연간 패스 구매 대행 요청', 'Request purchase assistance for a non-resident Annual Pass')}
          </label>

          {residency !== 'us_resident' && (
            <div>
              <p className="mb-2 text-sm font-medium text-slate-700">{t('결제 방식', 'Payment method')}</p>
              <div className="flex flex-col gap-2 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="pm"
                    checked={paymentMethod === 'cash'}
                    onChange={() => setPaymentMethod('cash')}
                  />
                  {t('현장 현금', 'Cash on tour day')}
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="pm"
                    checked={paymentMethod === 'card'}
                    onChange={() => setPaymentMethod('card')}
                  />
                  {t('지금 카드 결제 (해당 금액이 있을 때)', 'Pay by card now (when an amount is due)')}
                </label>
              </div>
            </div>
          )}

          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            <span>
              {t(
                '위 안내 및 금액 계산 방식에 동의합니다.',
                'I agree to the information above and how amounts are calculated.'
              )}
            </span>
          </label>

          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {saving ? t('저장 중…', 'Saving…') : t('저장', 'Save')}
          </button>
        </div>

        {submission && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">{t('증빙 업로드', 'Upload proof')}</h2>
            <p className="text-sm text-slate-600">
              {t(
                'JPEG/PNG/WebP, 최대 5MB. 먼저 설문을 저장한 뒤 업로드해 주세요.',
                'JPEG/PNG/WebP, max 5MB. Save the questionnaire first.'
              )}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-medium text-slate-600">{t('신분·거주 증빙', 'ID / residency')}</p>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">
                  <Upload className="h-4 w-4" />
                  <span>{t('파일 선택', 'Choose file')}</span>
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
                  <p className="mt-1 truncate text-xs text-green-700">{t('업로드됨', 'Uploaded')}</p>
                )}
              </div>
              {(residency === 'non_resident' && hasAnnualPass) || submission.pass_photo_url ? (
                <div>
                  <p className="mb-1 text-xs font-medium text-slate-600">{t('연간 패스 사진', 'Annual pass photo')}</p>
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">
                    <Upload className="h-4 w-4" />
                    <span>{t('파일 선택', 'Choose file')}</span>
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
                    <p className="mt-1 truncate text-xs text-green-700">{t('업로드됨', 'Uploaded')}</p>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        )}

        {submission && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">{t('금액 요약', 'Amount summary')}</h2>
            <p className="text-sm text-slate-700">
              {t('NPS 추가(해당 시)', 'NPS add-on (if applicable)')}: {formatUsd(nps)}
            </p>
            <p className="text-sm text-slate-700">
              {t('카드 수수료(카드 선택 시)', 'Card fee (if card)')}: {formatUsd(cardFee)}
            </p>
            <p className="text-base font-semibold text-slate-900">
              {t('오늘 카드로 결제할 총액', 'Total to charge today (card)')}: {formatUsd(total)}
            </p>
            {blockers.length > 0 && (
              <p className="text-xs text-amber-800">
                {t('완료 전 단계:', 'Before you can finish:')}{' '}
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
              {t('제출 완료 (추가 결제 없음)', 'Submit — no payment due')}
            </button>
          </div>
        )}

        {submission && blockers.length === 0 && total > 0 && paymentMethod === 'cash' && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-6 shadow-sm">
            <p className="mb-3 text-sm text-amber-950">
              {t(
                '현금 선택 시 투어 당일 가이드에게 약정 금액을 전달해 주세요. 아래를 누르면 접수가 완료됩니다.',
                'You chose cash. Please pay the guide on the tour day. Click below to confirm.'
              )}
            </p>
            <button
              type="button"
              disabled={saving}
              onClick={() => void completeCash()}
              className="w-full rounded-lg bg-amber-600 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {t('현장 현금으로 진행 확인', 'Confirm cash on site')}
            </button>
          </div>
        )}

        {submission && blockers.length === 0 && total > 0 && paymentMethod === 'card' && stripePromise && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold text-slate-900">{t('카드 결제', 'Card payment')}</h2>
            <Elements stripe={stripePromise}>
              <ResidentCheckStripePay
                token={rawToken}
                customerName={r.customerName || ''}
                customerEmail={r.customerEmail || ''}
                isEnglish={isEnglish}
                onPaid={() => void loadSession()}
              />
            </Elements>
          </div>
        )}

        {submission && blockers.length === 0 && total > 0 && paymentMethod === 'card' && !stripePromise && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {t('Stripe 키가 설정되지 않았습니다.', 'Stripe is not configured.')}
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

export default function ResidentCheckPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
          Loading…
        </div>
      }
    >
      <ResidentCheckInner />
    </Suspense>
  )
}
