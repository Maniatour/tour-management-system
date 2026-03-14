'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, Hash, Calendar, Users, User, Mail, Phone, Globe, MapPin, DollarSign, ChevronDown, ChevronUp, FileText } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { getChannelIdForPlatform } from '@/lib/platformChannelMapping'
import { matchPickupHotelId, normalizeCustomerNameFromImport } from '@/utils/reservationUtils'
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
  const [showEmailBody, setShowEmailBody] = useState(true)
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
    let res = await fetch(`/api/reservation-imports/${id}`)
    let data = await res.json()
    if (!res.ok) throw new Error(data?.error || 'Failed to load')
    const ext = (data.extracted_data || {}) as ExtractedReservationData
    const hasBody = !!(data.raw_body_text || data.raw_body_html)
    const bodyHasWhatsApp = hasBody && /WhatsApp\s*:\s*[^\n]+/i.test(data.raw_body_text || data.raw_body_html || '')
    const effectiveKey =
      data.platform_key ||
      ((data.source_email ?? '').toLowerCase().includes('kkday') || (data.subject ?? '').trim().startsWith('[KKday]')
        ? 'kkday'
        : null)
    const looksIncomplete =
      hasBody &&
      (((effectiveKey === 'getyourguide' && (!ext.customer_name || ext.adults == null)) ||
        (effectiveKey === 'klook' && (!ext.customer_name && !ext.customer_email && !ext.adults)) ||
        (effectiveKey === 'kkday' && (!ext.customer_name || ext.adults == null || !ext.tour_date || !ext.product_name)) ||
        (effectiveKey === 'viator' && (!ext.customer_name || !ext.pickup_hotel))) ||
        (bodyHasWhatsApp && !ext.emergency_contact))
    if (looksIncomplete) {
      const reparseRes = await fetch(`/api/reservation-imports/${id}/reparse`, { method: 'POST' })
      if (reparseRes.ok) {
        const reparsed = await reparseRes.json()
        data = reparsed
      }
    }
    setRow(data)
    const extFinal = (data.extracted_data || {}) as ExtractedReservationData
    const noteParts = [
      extFinal.note,
      extFinal.special_requests,
      extFinal.amount ? `금액: ${extFinal.amount}` : '',
      extFinal.amount_excluded ? `불포함: ${extFinal.amount_excluded}` : '',
      extFinal.language ? `언어: ${extFinal.language}` : '',
      extFinal.product_choices ? `옵션: ${extFinal.product_choices}` : '',
      extFinal.product_name ? `상품(이메일): ${extFinal.product_name}` : '',
    ].filter(Boolean)
    setForm((prev) => ({
      ...prev,
      customer_name: normalizeCustomerNameFromImport(extFinal.customer_name) || prev.customer_name,
      customer_email: extFinal.customer_email ?? prev.customer_email,
      customer_phone: extFinal.customer_phone ?? prev.customer_phone,
      tour_date: extFinal.tour_date ?? prev.tour_date,
      tour_time: extFinal.tour_time ?? prev.tour_time,
      adults: extFinal.adults ?? 1,
      child: extFinal.children ?? 0,
      infant: extFinal.infants ?? 0,
      total_people: extFinal.total_people ?? extFinal.adults ?? 1,
      channel_rn: extFinal.channel_rn ?? prev.channel_rn,
      pickup_hotel: extFinal.pickup_hotel ?? prev.pickup_hotel,
      event_note: noteParts.join(' · ') || prev.event_note,
      product_id: extFinal.product_id ?? prev.product_id,
    }))
  }, [id])

  const channelsSafe = channelsList ?? []
  const productsSafe = productsList ?? []
  /** KKday 보정: DB에 platform_key가 없어도 발신/제목이 KKday면 kkday로 간주 */
  const effectivePlatformKey =
    row?.platform_key ||
    (row && ((row.source_email ?? '').toLowerCase().includes('kkday') || (row.subject ?? '').trim().startsWith('[KKday]'))
      ? 'kkday'
      : null)

  useEffect(() => {
    if (!effectivePlatformKey || !channelsSafe.length || form.channel_id) return
    const mappedId = getChannelIdForPlatform(effectivePlatformKey)
    const channel = mappedId
      ? channelsSafe.find((c: { id: string; name?: string }) => c.id === mappedId || c.name?.toLowerCase().includes(mappedId))
      : channelsSafe.find((c: { id: string; name?: string }) => c.name?.toLowerCase().includes(effectivePlatformKey.toLowerCase()))
    if (channel) setForm((f) => ({ ...f, channel_id: channel.id }))
  }, [effectivePlatformKey, channelsSafe, form.channel_id])

  // 픽업 호텔 매칭 실패 시 사용할 기본 id
  const DEFAULT_PICKUP_HOTEL_ID = '518e504f-04d4-420a-bf45-f23210e38039'

  // 이메일에서 추출한 픽업 호텔 문자열을 pickup_hotels 목록과 매칭해 드롭다운 id로 치환 (매칭 실패 시 기본 id 사용)
  useEffect(() => {
    const raw = form.pickup_hotel
    if (!raw || !pickupHotelsList?.length) return
    const isAlreadyId = pickupHotelsList.some((h: PickupHotel) => h.id === raw)
    if (isAlreadyId) return
    const matchedId = matchPickupHotelId(raw, pickupHotelsList as Array<{ id: string; hotel?: string | null; pick_up_location?: string | null; address?: string | null }>)
    const idToSet = matchedId ?? (pickupHotelsList.some((h: PickupHotel) => h.id === DEFAULT_PICKUP_HOTEL_ID) ? DEFAULT_PICKUP_HOTEL_ID : null)
    if (idToSet) setForm((f) => ({ ...f, pickup_hotel: idToSet }))
  }, [form.pickup_hotel, pickupHotelsList])

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
          variant_key: (payload.variantKey as string) || undefined,
          // 새 예약 추가와 동일: 가격·입금 정보 전달 → reservation_pricing + payment_record 저장
          pricingInfo: payload.pricingInfo ?? undefined,
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

      {/* 2열 그리드: 왼쪽 1/3 = 예약 접수 카드, 오른쪽 2/3 = 이메일 본문 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 왼쪽(1/3): 예약 접수 요약 카드 */}
        <div className="lg:col-span-1 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          {/* 상단: 플랫폼 · 제목 */}
          <div className="px-4 py-2 border-b border-gray-100 bg-amber-50 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-amber-800 uppercase tracking-wide">
                {effectivePlatformKey || '이메일'}
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
              {(ext?.customer_name || ext?.customer_email || ext?.customer_phone || ext?.emergency_contact || ext?.language) && (
                <>
                  {ext.customer_name && (
                    <div className="flex items-start gap-3">
                      <User className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <dt className="text-xs font-medium text-gray-500">Main customer</dt>
                        <dd className="text-sm font-medium text-gray-900 mt-0.5">{normalizeCustomerNameFromImport(ext.customer_name) || ext.customer_name}</dd>
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
                  {ext.emergency_contact && (
                    <div className="flex items-start gap-3 pl-7">
                      <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-1" aria-hidden />
                      <dd className="text-sm text-gray-700">WhatsApp (비상): {ext.emergency_contact}</dd>
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
              {(ext?.amount || ext?.amount_excluded) && (
                <div className="flex items-start gap-3">
                  <DollarSign className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <dt className="text-xs font-medium text-gray-500">Price</dt>
                    <dd className="text-sm font-semibold text-gray-900 mt-0.5">
                      {ext.amount ?? '–'}
                      {ext.amount_excluded && (
                        <span className="block text-xs font-normal text-gray-500 mt-0.5">불포함: {ext.amount_excluded}</span>
                      )}
                    </dd>
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

        {/* 오른쪽(2/3): 이메일 본문 */}
        {row.raw_body_text ? (
          <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden flex flex-col min-h-0">
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
                  <div className="bg-gray-100 p-4 flex-1 min-h-0 overflow-auto">
                    <iframe
                      title="이메일 미리보기"
                      sandbox="allow-same-origin allow-popups allow-scripts"
                      srcDoc={row.raw_body_text}
                      className="w-full min-h-[520px] border-0 rounded-lg bg-white shadow-sm"
                      style={{ height: '560px' }}
                    />
                  </div>
                ) : (
                  <div className="p-0 flex-1 min-h-[520px] overflow-auto bg-[#1e1e1e]">
                    <pre className="p-4 text-xs text-[#d4d4d4] whitespace-pre-wrap font-mono break-words leading-relaxed block m-0">
                      <code className="text-[#d4d4d4]">{row.raw_body_text}</code>
                    </pre>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center min-h-[200px]">
            <p className="text-sm text-gray-500">이메일 본문 없음</p>
          </div>
        )}
      </div>

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
                // 채널 RN: "ID" 단어만 있으면 잘못 파싱된 값이므로 제외, 실제 예약번호만 전달
                channel_rn: (() => {
                  const rn = ext?.channel_rn ?? form.channel_rn
                  if (!rn || String(rn).trim().toLowerCase() === 'id') return undefined
                  return String(rn).trim() || undefined
                })(),
                adults: form.adults,
                child: form.child,
                infant: form.infant,
                total_people: form.total_people || form.adults + form.child + form.infant,
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
          customer_name: (ext?.customer_name ?? form.customer_name) || undefined,
          customer_email: (ext?.customer_email ?? form.customer_email) || undefined,
          customer_phone: (ext?.customer_phone ?? form.customer_phone) || undefined,
          emergency_contact: ext?.emergency_contact || undefined,
          customer_language: ext?.language || undefined,
        }}
        initialShowNewCustomerForm={Boolean(normalizeCustomerNameFromImport(ext?.customer_name) || ext?.customer_name)}
        initialChoiceOptionNamesFromImport={ext?.import_choice_option_names}
        initialChoiceUndecidedGroupNamesFromImport={ext?.import_choice_undecided_groups}
      />
    </div>
  )
}
