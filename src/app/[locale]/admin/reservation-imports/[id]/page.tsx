'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, Hash, Calendar, Users, User, Mail, Phone, Globe, MapPin, DollarSign, ChevronDown, ChevronUp, FileText } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { getChannelIdForPlatform } from '@/lib/platformChannelMapping'
import ReservationForm from '@/components/reservation/ReservationForm'
import { useReservationData } from '@/hooks/useReservationData'
import type { ExtractedReservationData } from '@/types/reservationImport'
import type { Channel, Customer, PickupHotel } from '@/types/reservation'

interface ImportRow {
  id: string
  subject: string | null
  source_email: string | null
  platform_key: string | null
  received_at: string | null
  raw_body_text: string | null
  extracted_data: ExtractedReservationData
  status: string
  reservation_id: string | null
}

export default function ReservationImportDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const locale = (params?.locale as string) || 'ko'
  const id = params?.id as string

  const [row, setRow] = useState<ImportRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [rejecting, setRejecting] = useState(false)
  const [showEmailBody, setShowEmailBody] = useState(false)
  const [emailBodyView, setEmailBodyView] = useState<'preview' | 'code'>('preview')
  const isEmailHtml = Boolean(
    row?.raw_body_text &&
    (row.raw_body_text.trimStart().startsWith('<') || /<\/html>|<\/body>|<body/i.test(row.raw_body_text))
  )

  const {
    customers: customersList = [],
    products: productsList = [],
    channels: channelsList = [],
    productOptions = [],
    options = [],
    pickupHotels: pickupHotelsList = [],
    coupons: couponsList = [],
    loading: dataLoading,
    refreshCustomers,
  } = useReservationData()

  const [form, setForm] = useState({
    customer_id: '',
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    product_id: '',
    tour_date: '',
    tour_time: '',
    adults: 1,
    child: 0,
    infant: 0,
    total_people: 1,
    channel_id: '',
    channel_rn: '',
    event_note: '',
    pickup_hotel: '',
    pickup_time: '',
  })

  const loadImport = useCallback(async () => {
    if (!id) return
    const res = await fetch(`/api/reservation-imports/${id}`)
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error || 'Failed to load')
    setRow(data)
    const ext = (data.extracted_data || {}) as ExtractedReservationData
    const noteParts = [
      ext.note,
      ext.special_requests,
      ext.amount ? `금액: ${ext.amount}` : '',
      ext.language ? `언어: ${ext.language}` : '',
      ext.product_choices ? `옵션: ${ext.product_choices}` : '',
      ext.product_name ? `상품(이메일): ${ext.product_name}` : '',
    ].filter(Boolean)
    setForm((prev) => ({
      ...prev,
      customer_name: ext.customer_name ?? prev.customer_name,
      customer_email: ext.customer_email ?? prev.customer_email,
      customer_phone: ext.customer_phone ?? prev.customer_phone,
      tour_date: ext.tour_date ?? prev.tour_date,
      tour_time: ext.tour_time ?? prev.tour_time,
      adults: ext.adults ?? 1,
      child: ext.children ?? 0,
      infant: ext.infants ?? 0,
      total_people: ext.total_people ?? ext.adults ?? 1,
      channel_rn: ext.channel_rn ?? prev.channel_rn,
      pickup_hotel: ext.pickup_hotel ?? prev.pickup_hotel,
      event_note: noteParts.join(' · ') || prev.event_note,
      product_id: ext.product_id ?? prev.product_id,
    }))
  }, [id])

  const channelsSafe = channelsList ?? []
  const productsSafe = productsList ?? []

  useEffect(() => {
    if (!row?.platform_key || !channelsSafe.length || form.channel_id) return
    const mappedId = getChannelIdForPlatform(row.platform_key)
    const channel = mappedId
      ? channelsSafe.find((c: { id: string; name?: string }) => c.id === mappedId || c.name?.toLowerCase().includes(mappedId))
      : channelsSafe.find((c: { id: string; name?: string }) => c.name?.toLowerCase().includes(row.platform_key!.toLowerCase()))
    if (channel) setForm((f) => ({ ...f, channel_id: channel.id }))
  }, [row?.platform_key, channelsSafe, form.channel_id])

  const ext = row ? ((row as ImportRow).extracted_data || {}) as ExtractedReservationData : null
  // product_id: 이메일 파서에서 직접 설정된 값(제목 S코드 매핑) 우선, 없으면 상품명으로 매칭
  useEffect(() => {
    if (ext?.product_id && productsSafe.some((p: { id: string }) => p.id === ext.product_id)) {
      setForm((f) => (f.product_id === ext.product_id ? f : { ...f, product_id: ext.product_id! }))
      return
    }
    if (!ext?.product_name || !productsSafe.length || form.product_id) return
    const nameLower = ext.product_name.toLowerCase()
    const matched = productsSafe.find(
      (p: { name?: string; name_ko?: string | null }) =>
        (p.name && p.name.toLowerCase().includes(nameLower)) ||
        (p.name_ko && p.name_ko.toLowerCase().includes(nameLower)) ||
        (p.name && nameLower.includes(p.name.toLowerCase())) ||
        (p.name_ko && nameLower.includes(p.name_ko.toLowerCase()))
    )
    if (matched) setForm((f) => ({ ...f, product_id: (matched as { id: string }).id }))
  }, [ext?.product_name, productsSafe, form.product_id])

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      try {
        await loadImport()
      } catch {
        if (!cancelled) setRow(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [loadImport])

  const handleImportSubmit = useCallback(
    async (payload: Record<string, unknown>) => {
      if (!row || row.status !== 'pending' || !user?.email) return
      const totalPeople = (Number(payload.adults) || 0) + (Number(payload.child) || 0) + (Number(payload.infant) || 0)
      const res = await fetch(`/api/reservation-imports/${id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: (payload.customerId as string) || undefined,
          customer_name: (payload.customerName as string) || undefined,
          customer_email: (payload.customerEmail as string) || undefined,
          customer_phone: (payload.customerPhone as string) || undefined,
          product_id: payload.productId,
          tour_date: payload.tourDate,
          tour_time: (payload.tourTime as string) || null,
          adults: Number(payload.adults) || 0,
          child: Number(payload.child) || 0,
          infant: Number(payload.infant) || 0,
          total_people: totalPeople || 1,
          channel_id: payload.channelId,
          channel_rn: (payload.channelRN as string) || null,
          event_note: (payload.eventNote as string) || null,
          pickup_hotel: (payload.pickUpHotel as string) || null,
          pickup_time: (payload.pickUpTime as string) || null,
          added_by: user.email,
          status: 'confirmed',
          selected_choices: payload.selectedChoices ?? undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || res.statusText)
      if (data.reservation_id) {
        router.push(`/${locale}/admin/reservations/${data.reservation_id}`)
      } else {
        router.push(`/${locale}/admin/reservation-imports`)
      }
    },
    [id, locale, row, user?.email, router]
  )

  const handleReject = async () => {
    if (!row || row.status !== 'pending') return
    if (!confirm('이 항목을 무시하시겠습니까?')) return
    setRejecting(true)
    try {
      const res = await fetch(`/api/reservation-imports/${id}/reject`, { method: 'POST' })
      if (!res.ok) throw new Error('Reject failed')
      router.push(`/${locale}/admin/reservation-imports`)
    } catch {
      alert('처리 실패')
    } finally {
      setRejecting(false)
    }
  }

  if (loading || dataLoading || !row) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (row.status !== 'pending') {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => router.push(`/${locale}/admin/reservation-imports`)}
          className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" /> 목록으로
        </button>
        <p className="text-gray-600">이미 처리된 항목입니다. (상태: {row.status})</p>
        {row.reservation_id && (
          <a
            href={`/${locale}/admin/reservations/${row.reservation_id}`}
            className="text-blue-600 hover:underline"
          >
            예약 보기 →
          </a>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => router.push(`/${locale}/admin/reservation-imports`)}
          className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" /> 목록으로
        </button>
      </div>

      {/* 이메일 요약 · 사용자 친화적 예약 카드 (GetYourGuide 스타일) */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {/* 상단: 플랫폼 · 제목 */}
        <div className="px-4 py-2 border-b border-gray-100 bg-amber-50 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-amber-800 uppercase tracking-wide">
              {row.platform_key || '이메일'}
            </span>
            {row.subject && (
              <span className="text-xs text-gray-500 truncate max-w-[280px]" title={row.subject}>
                {row.subject}
              </span>
            )}
          </div>
          {row.source_email && (
            <span className="text-xs text-gray-500">발신: {row.source_email}</span>
          )}
        </div>

        {/* 카드 본문: Your offer has been booked 스타일 */}
        <div className="p-4 sm:p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            예약이 접수되었습니다
          </h2>

          {/* 상품 정보 */}
          {(ext?.product_name || ext?.product_choices) && (
            <div className="mb-4 pb-4 border-b border-gray-100">
              {ext.product_name && (
                <p className="text-sm font-medium text-gray-900">{ext.product_name}</p>
              )}
              {ext.product_choices && (
                <p className="text-xs text-gray-600 mt-0.5">{ext.product_choices}</p>
              )}
            </div>
          )}

          {/* 항목별 행: 아이콘 · 레이블 · 값 */}
          <dl className="space-y-3">
            {ext?.channel_rn && (
              <div className="flex items-start gap-3">
                <Hash className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" aria-hidden />
                <div className="min-w-0 flex-1">
                  <dt className="text-xs font-medium text-gray-500">Reference number</dt>
                  <dd className="text-sm font-semibold text-gray-900 bg-amber-100/80 inline-block px-2 py-0.5 rounded mt-0.5">
                    {ext.channel_rn}
                  </dd>
                </div>
              </div>
            )}
            {(ext?.tour_date || ext?.tour_time) && (
              <div className="flex items-start gap-3">
                <Calendar className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" aria-hidden />
                <div className="min-w-0 flex-1">
                  <dt className="text-xs font-medium text-gray-500">Date</dt>
                  <dd className="text-sm text-gray-900 mt-0.5">
                    {[ext.tour_date, ext.tour_time].filter(Boolean).join(' ') || '–'}
                  </dd>
                </div>
              </div>
            )}
            {((ext?.adults != null) || (ext?.children != null) || (ext?.infants != null)) && (
              <div className="flex items-start gap-3">
                <Users className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" aria-hidden />
                <div className="min-w-0 flex-1">
                  <dt className="text-xs font-medium text-gray-500">Number of participants</dt>
                  <dd className="text-sm text-gray-900 mt-0.5">
                    {[
                      ext.adults != null && `${ext.adults} x Adults`,
                      ext.children != null && `${ext.children} x Children`,
                      ext.infants != null && `${ext.infants} x Infants`,
                    ].filter(Boolean).join(', ') || '–'}
                  </dd>
                </div>
              </div>
            )}
            {(ext?.customer_name || ext?.customer_email || ext?.customer_phone || ext?.language) && (
              <>
                {ext.customer_name && (
                  <div className="flex items-start gap-3">
                    <User className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <dt className="text-xs font-medium text-gray-500">Main customer</dt>
                      <dd className="text-sm font-medium text-gray-900 mt-0.5">{ext.customer_name}</dd>
                    </div>
                  </div>
                )}
                {ext.customer_email && (
                  <div className="flex items-start gap-3 pl-7">
                    <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-1" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <dd className="text-sm text-gray-700 break-all">{ext.customer_email}</dd>
                    </div>
                  </div>
                )}
                {ext.customer_phone && (
                  <div className="flex items-start gap-3 pl-7">
                    <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-1" aria-hidden />
                    <dd className="text-sm text-gray-700">Phone: {ext.customer_phone}</dd>
                  </div>
                )}
                {ext.language && (
                  <div className="flex items-start gap-3 pl-7">
                    <Globe className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-1" aria-hidden />
                    <dd className="text-sm text-gray-700">Language: {ext.language}</dd>
                  </div>
                )}
              </>
            )}
            {ext?.pickup_hotel && (
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" aria-hidden />
                <div className="min-w-0 flex-1">
                  <dt className="text-xs font-medium text-gray-500">Pickup</dt>
                  <dd className="text-sm text-gray-900 mt-0.5">{ext.pickup_hotel}</dd>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ext.pickup_hotel)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline mt-1 inline-block"
                  >
                    Open in Google Maps
                  </a>
                </div>
              </div>
            )}
            {ext?.amount && (
              <div className="flex items-start gap-3">
                <DollarSign className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" aria-hidden />
                <div className="min-w-0 flex-1">
                  <dt className="text-xs font-medium text-gray-500">Price</dt>
                  <dd className="text-sm font-semibold text-gray-900 mt-0.5">{ext.amount}</dd>
                </div>
              </div>
            )}
          </dl>

          {/* 도움말 문구 */}
          <p className="text-xs text-gray-500 mt-4 pt-4 border-t border-gray-100">
            아래 입력 폼에서 내용을 확인·수정한 뒤 저장하면 예약으로 생성됩니다.
          </p>
        </div>
      </div>

      {/* 이메일 본문: 미리보기(렌더) / 코드 전환 */}
      {row.raw_body_text && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setShowEmailBody((v) => !v)}
            className="w-full px-4 py-3 flex items-center justify-between gap-2 text-left bg-gray-50 hover:bg-gray-100 border-b border-gray-200"
          >
            <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <FileText className="w-4 h-4 text-gray-500" aria-hidden />
              이메일 본문
            </span>
            {showEmailBody ? (
              <ChevronUp className="w-4 h-4 text-gray-500 shrink-0" aria-hidden />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" aria-hidden />
            )}
          </button>
          {showEmailBody && (
            <>
              {isEmailHtml && (
                <div className="flex border-b border-gray-200 bg-gray-50">
                  <button
                    type="button"
                    onClick={() => setEmailBodyView('preview')}
                    className={`px-4 py-2 text-sm font-medium ${emailBodyView === 'preview' ? 'text-blue-600 border-b-2 border-blue-600 bg-white' : 'text-gray-600 hover:text-gray-900'}`}
                  >
                    미리보기
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmailBodyView('code')}
                    className={`px-4 py-2 text-sm font-medium ${emailBodyView === 'code' ? 'text-blue-600 border-b-2 border-blue-600 bg-white' : 'text-gray-600 hover:text-gray-900'}`}
                  >
                    코드
                  </button>
                </div>
              )}
              {emailBodyView === 'preview' && isEmailHtml ? (
                <div className="bg-gray-100 p-4 max-h-[560px] overflow-auto">
                  <iframe
                    title="이메일 미리보기"
                    sandbox="allow-same-origin allow-popups"
                    srcDoc={row.raw_body_text}
                    className="w-full min-h-[480px] border-0 rounded-lg bg-white shadow-sm"
                    style={{ height: '520px' }}
                  />
                </div>
              ) : (
                <div className="p-0 max-h-[480px] overflow-auto bg-[#1e1e1e]">
                  <pre className="p-4 text-xs text-[#d4d4d4] whitespace-pre-wrap font-mono break-words leading-relaxed block m-0">
                    <code className="text-[#d4d4d4]">{row.raw_body_text}</code>
                  </pre>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-sm text-gray-600">아래는 실제 &quot;새 예약 추가&quot;와 동일한 입력 폼입니다. 수정 후 저장하면 예약으로 생성됩니다.</p>
        <button
          type="button"
          onClick={handleReject}
          disabled={rejecting}
          className="shrink-0 px-3 py-1.5 border border-gray-300 text-gray-700 rounded-md text-sm hover:bg-gray-50 disabled:opacity-50"
        >
          {rejecting ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null}
          무시
        </button>
      </div>
      <ReservationForm
        reservation={
          row
            ? ({
                id: `import-${row.id}`,
                product_id: form.product_id,
                tour_date: form.tour_date,
                tour_time: form.tour_time || undefined,
                channel_id: form.channel_id,
                channel_rn: form.channel_rn || undefined,
                adults: form.adults,
                child: form.child,
                infant: form.infant,
                pickup_hotel: form.pickup_hotel || undefined,
                event_note: form.event_note || undefined,
              } as any)
            : null
        }
        customers={(customersList ?? []) as Customer[]}
        products={(productsList ?? []) as import('@/types/reservation').Product[]}
        channels={(channelsList ?? []) as Channel[]}
        productOptions={productOptions ?? []}
        options={options ?? []}
        pickupHotels={(pickupHotelsList ?? []) as PickupHotel[]}
        coupons={(couponsList ?? []) as { id: string; coupon_code: string; discount_type: 'percentage' | 'fixed'; [key: string]: unknown }[]}
        onSubmit={(payload: unknown) => handleImportSubmit(payload as Record<string, unknown>)}
        onCancel={() => router.push(`/${locale}/admin/reservation-imports`)}
        onRefreshCustomers={refreshCustomers}
        onDelete={() => {}}
        layout="page"
        isNewReservation
        initialDataFromImport={{
          customer_name: form.customer_name || undefined,
          customer_email: form.customer_email || undefined,
          customer_phone: form.customer_phone || undefined,
          customer_language: ext?.language || undefined,
        }}
        initialShowNewCustomerForm={Boolean(ext?.customer_name)}
        initialChoiceOptionNamesFromImport={ext?.import_choice_option_names}
        initialChoiceUndecidedGroupNamesFromImport={ext?.import_choice_undecided_groups}
      />
    </div>
  )
}
