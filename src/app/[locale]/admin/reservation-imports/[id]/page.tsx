'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, Hash, Calendar, Users, User, Mail, Phone, Globe, MapPin, DollarSign, ChevronDown, ChevronUp, FileText, RefreshCw } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { getChannelIdForPlatform } from '@/lib/platformChannelMapping'
import {
  isManiatourHomepageBookingEmail,
  isCancellationRequestEmailSubject,
  isTidesquareChannelEmailSubject,
  isMyrealtripNewBookingEmailSubject,
  isMyrealtripChannelFromEmail,
} from '@/lib/emailReservationParser'
import {
  extractPriceFromEmailBodyForImport,
  extractViatorNetRateFromEmailBodyForImport,
  matchPickupHotelId,
  normalizeCustomerNameFromImport,
} from '@/utils/reservationUtils'
import { resolveImportChannelVariantKey } from '@/lib/resolveImportChannelVariant'
import { fetchCustomerHintsForImportExtracted } from '@/lib/fetchImportCustomerHints'
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
  raw_body_html?: string | null
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
  const [notFound, setNotFound] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [reparsing, setReparsing] = useState(false)
  /** 재파싱 후 폼이 새 extracted_data(상품·초이스)를 다시 받도록 */
  const [reparseKey, setReparseKey] = useState(0)
  const [showEmailBody, setShowEmailBody] = useState(true)
  const [emailBodyView, setEmailBodyView] = useState<'preview' | 'code'>('preview')
  const [showProcessedNotice, setShowProcessedNotice] = useState(false)
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
    mergeCustomers,
  } = useReservationData({ disableReservationsAutoLoad: true, customersByReservationIds: true })

  /** loadImport는 [id]만 deps로 두기 위해 — ref로 최신 채널 목록만 읽고, 목록 도착마다 GET을 반복하지 않음 */
  const channelsListRef = useRef<typeof channelsList>(channelsList)
  channelsListRef.current = channelsList

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
    setNotFound(false)
    let res = await fetch(`/api/reservation-imports/${id}`)
    let data = await res.json()
    if (res.status === 404) {
      setRow(null)
      setNotFound(true)
      return
    }
    if (!res.ok) throw new Error(data?.error || 'Failed to load')
    const ext = (data.extracted_data || {}) as ExtractedReservationData
    const hasBody = !!(data.raw_body_text || data.raw_body_html)
    const bodyHasWhatsApp = hasBody && /WhatsApp\s*:\s*[^\n]+/i.test(data.raw_body_text || data.raw_body_html || '')
    const effectiveKey =
      data.platform_key ||
      ((data.source_email ?? '').toLowerCase().includes('kkday') || (data.subject ?? '').trim().startsWith('[KKday]')
        ? 'kkday'
        : null) ||
      (/@trip\.com\b/i.test(String(data.source_email || '')) ? 'tripcom' : null) ||
      (isManiatourHomepageBookingEmail(data.source_email, data.subject) ? 'maniatour' : null) ||
      (isTidesquareChannelEmailSubject(data.subject) ? 'tidesquare' : null) ||
      (isMyrealtripChannelFromEmail(data.source_email) || isMyrealtripNewBookingEmailSubject(data.subject)
        ? 'myrealtrip'
        : null)
    const rawCombinedForGyG = `${data.subject || ''}\n${data.raw_body_text || ''}\n${data.raw_body_html || ''}`
    // GetYourGuide: DB에 옛날 extracted_data만 있으면 고객 정보는 있는데 product_id/초이스가 비어 재파싱이 스킵되던 경우 보완
    const gygLikelyHasVariantLine =
      /group\s*tour\s*with|antelope\s*canyon|lower\s*antelope|grand\s*canyon\s*sunrise|horseshoe/i.test(rawCombinedForGyG)
    const gygNeedsStructuredFields =
      effectiveKey === 'getyourguide' &&
      hasBody &&
      (!ext.product_id || (!ext.import_choice_option_names?.length && gygLikelyHasVariantLine))
    const isViatorMail =
      data.platform_key === 'viator' || /viator\.com/i.test(String(data.source_email || ''))
    // 옛 파싱: 당일 투어로만 저장됐는데 본문은 Lower Antelope + 00:00 일출 패턴 → 재파싱으로 MDGCSUNRISE 보정
    const viatorSunriseWasStoredAsDayTour =
      isViatorMail &&
      hasBody &&
      ext?.product_name === '그랜드서클 당일 투어' &&
      /Shared\s*Van\s*with\s*Lower\s*Antelope|Lower\s*Antelope/i.test(rawCombinedForGyG) &&
      /\b00\s*:\s*00\b|00:00/i.test(rawCombinedForGyG)
    const looksIncomplete =
      hasBody &&
      (((effectiveKey === 'getyourguide' && (!ext.customer_name || ext.adults == null)) ||
        gygNeedsStructuredFields ||
        viatorSunriseWasStoredAsDayTour ||
        (effectiveKey === 'klook' && (!ext.customer_name && !ext.customer_email && !ext.adults)) ||
        (effectiveKey === 'kkday' && (!ext.customer_name || ext.adults == null || !ext.tour_date || !ext.product_name)) ||
        (effectiveKey === 'viator' && (!ext.customer_name || !ext.pickup_hotel)) ||
        (effectiveKey === 'tripcom' && (!ext.customer_name || ext.adults == null))) ||
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
    const effectiveKeyForChannel =
      data.platform_key ||
      ((data.source_email ?? '').toLowerCase().includes('kkday') || (data.subject ?? '').trim().startsWith('[KKday]')
        ? 'kkday'
        : null) ||
      (/@trip\.com\b/i.test(String(data.source_email || '')) ? 'tripcom' : null) ||
      (isManiatourHomepageBookingEmail(data.source_email, data.subject) ? 'maniatour' : null) ||
      (isTidesquareChannelEmailSubject(data.subject) ? 'tidesquare' : null) ||
      (isMyrealtripChannelFromEmail(data.source_email) || isMyrealtripNewBookingEmailSubject(data.subject)
        ? 'myrealtrip'
        : null)
    const ch = channelsListRef.current
    const channelsSafe = Array.isArray(ch) ? ch : []
    const mappedChannelId = effectiveKeyForChannel ? getChannelIdForPlatform(effectiveKeyForChannel) : null
    const channelForImport = mappedChannelId
      ? channelsSafe.find((c: { id: string; name?: string }) => c.id === mappedChannelId || (c.name || '').toLowerCase().includes(mappedChannelId))
      : effectiveKeyForChannel
        ? channelsSafe.find((c: { id: string; name?: string }) => (c.name || '').toLowerCase().includes((effectiveKeyForChannel as string).toLowerCase()))
        : null
    const channelIdFromPlatform = channelForImport ? (channelForImport as { id: string }).id : ''

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
      channel_id: channelIdFromPlatform || prev.channel_id,
      channel_rn: extFinal.channel_rn ?? prev.channel_rn,
      pickup_hotel: extFinal.pickup_hotel ?? prev.pickup_hotel,
      event_note: noteParts.join(' · ') || prev.event_note,
      product_id: extFinal.product_id ?? prev.product_id,
    }))
    // channel_id는 channels 목록이 늦게 오는 경우 아래 useEffect에서 보완. channelsList 를 deps에 넣으면
    // 목록 도착 시마다 GET+재파싱이 한 번 더 돌아 모바일에서 체감 로딩이 들쭉날쭉해짐.
  }, [id])

  const channelsSafe = channelsList ?? []
  const productsSafe = productsList ?? []
  /** KKday 보정: DB에 platform_key가 없어도 발신/제목이 KKday면 kkday로 간주 */
  const effectivePlatformKey =
    row?.platform_key ||
    (row && ((row.source_email ?? '').toLowerCase().includes('kkday') || (row.subject ?? '').trim().startsWith('[KKday]'))
      ? 'kkday'
      : null) ||
    (row && isManiatourHomepageBookingEmail(row.source_email, row.subject) ? 'maniatour' : null) ||
    (row && isTidesquareChannelEmailSubject(row.subject) ? 'tidesquare' : null) ||
    (row && (isMyrealtripChannelFromEmail(row.source_email) || isMyrealtripNewBookingEmailSubject(row.subject))
      ? 'myrealtrip'
      : null)

  /** Viator만 Net Rate ↔ 채널 정산 비교 쿠폰 경로 사용 */
  const isViatorEmailImport =
    row?.platform_key === 'viator' || /viator\.com/i.test(String(row?.source_email ?? ''))

  useEffect(() => {
    if (!effectivePlatformKey || !channelsSafe.length || form.channel_id) return
    const mappedId = getChannelIdForPlatform(effectivePlatformKey)
    const channel = mappedId
      ? channelsSafe.find((c: { id: string; name?: string }) => c.id === mappedId || c.name?.toLowerCase().includes(mappedId))
      : channelsSafe.find((c: { id: string; name?: string }) => c.name?.toLowerCase().includes(effectivePlatformKey.toLowerCase()))
    if (channel) setForm((f) => ({ ...f, channel_id: channel.id }))
  }, [effectivePlatformKey, channelsSafe, form.channel_id])

  // 이메일에서 추출한 픽업 호텔 문자열을 pickup_hotels 목록과 매칭해 드롭다운 id로 치환.
  // 매칭 실패 시 임의 기본 id로 넣지 않음 → 목록 로드 순서에 따라 잘못 고정되고 재매칭이 막히는 문제 방지.
  useEffect(() => {
    const raw = form.pickup_hotel
    if (!raw || !pickupHotelsList?.length) return
    const isAlreadyId = pickupHotelsList.some((h: PickupHotel) => h.id === raw)
    if (isAlreadyId) return
    const matchedId = matchPickupHotelId(raw, pickupHotelsList as Array<{ id: string; hotel?: string | null; pick_up_location?: string | null; address?: string | null }>)
    if (matchedId) setForm((f) => (f.pickup_hotel === matchedId ? f : { ...f, pickup_hotel: matchedId }))
  }, [form.pickup_hotel, pickupHotelsList])

  const ext = row ? ((row as ImportRow).extracted_data || {}) as ExtractedReservationData : null
  /** 라벨(All Inclusive)과 키(with_exclusions) 불일치 시 키 보정 — 폼 초기값·동적가격·채널 모달 공통 */
  const resolvedImportVariantKey =
    ext != null
      ? resolveImportChannelVariantKey(ext.channel_variant_key, ext.channel_variant_label) ??
        (ext.channel_variant_key?.trim() || undefined)
      : undefined
  /** extracted_data의 product_id를 폼 state보다 우선 (상품 목록 로드 전에도 MDGCSUNRISE 등 반영) */
  const resolvedImportProductId =
    ext?.product_id &&
    (!productsSafe.length || productsSafe.some((p) => p.id === ext.product_id))
      ? ext.product_id
      : form.product_id
  /** 홈페이지(Wix) 예약: 채널 목록 로드 전에도 M00001(Homepage)로 초이스·가격 조회 가능하게 */
  const resolvedImportChannelId =
    form.channel_id ||
    (row && isManiatourHomepageBookingEmail(row.source_email, row.subject) ? 'M00001' : '')

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
  }, [ext?.product_id, ext?.product_name, productsSafe, form.product_id])

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

  useEffect(() => {
    if (row && row.status !== 'pending') {
      setShowProcessedNotice(true)
    }
  }, [row?.id, row?.status])

  const importCustomerHintKey = row
    ? [
        row.id,
        reparseKey,
        String((row.extracted_data as ExtractedReservationData)?.customer_email || ''),
        String((row.extracted_data as ExtractedReservationData)?.customer_phone || ''),
        normalizeCustomerNameFromImport((row.extracted_data as ExtractedReservationData)?.customer_name) ||
          String((row.extracted_data as ExtractedReservationData)?.customer_name || ''),
      ].join('|')
    : ''

  const refreshImportCustomerHints = useCallback(async () => {
    if (!mergeCustomers || !row) return
    try {
      const hints = await fetchCustomerHintsForImportExtracted(row.extracted_data)
      if (hints.length > 0) mergeCustomers(hints)
    } catch {
      /* 고객 힌트는 부가 기능 */
    }
  }, [mergeCustomers, row])

  useEffect(() => {
    if (!importCustomerHintKey || !mergeCustomers || !row) return
    let cancelled = false
    void (async () => {
      try {
        const hints = await fetchCustomerHintsForImportExtracted(row.extracted_data)
        if (cancelled || hints.length === 0) return
        mergeCustomers(hints)
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [importCustomerHintKey, mergeCustomers, row])

  /** 취소 요청 메일은 상세 대신 목록에서 모달로 처리 */
  useEffect(() => {
    if (notFound || loading || dataLoading || !row || !id) return
    if (!isCancellationRequestEmailSubject(row.subject)) return
    router.replace(`/${locale}/admin/reservation-imports?cancellationImport=${encodeURIComponent(id)}`)
  }, [notFound, loading, dataLoading, row, id, locale, router])

  if (notFound) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <p className="text-gray-600 mb-4">해당 예약 가져오기 항목을 찾을 수 없습니다. (삭제되었거나 ID가 잘못되었을 수 있습니다.)</p>
        <button
          type="button"
          onClick={() => router.push(`/${locale}/admin/reservation-imports`)}
          className="px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800"
        >
          목록으로 돌아가기
        </button>
      </div>
    )
  }

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
      // 저장 후에는 예약 상세가 아니라 이메일 목록(예약 가져오기)으로 이동
      router.push(`/${locale}/admin/reservation-imports`)
    },
    [id, locale, row, user?.email, router]
  )

  /** 저장된 원문으로 파서를 다시 돌려 extracted_data 갱신 (상품 매핑·파서 수정 반영용). pending만 가능. */
  const handleReparse = async () => {
    if (!row || row.status !== 'pending' || !id) return
    setReparsing(true)
    try {
      const reparseRes = await fetch(`/api/reservation-imports/${id}/reparse`, { method: 'POST' })
      const data = await reparseRes.json()
      if (!reparseRes.ok) throw new Error((data as { error?: string })?.error || '재파싱 실패')
      setReparseKey((k) => k + 1)
      await loadImport()
    } catch (e) {
      alert(e instanceof Error ? e.message : '재파싱 실패')
    } finally {
      setReparsing(false)
    }
  }

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

  if (isCancellationRequestEmailSubject(row.subject)) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-sm text-gray-600">취소 메일은 목록에서 모달로 열립니다…</p>
      </div>
    )
  }

  const isImportProcessed = row.status !== 'pending'

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
              <span className="text-xs font-medium text-amber-800 tracking-wide">
                {effectivePlatformKey === 'klook'
                  ? (ext?.channel_variant_label?.trim()
                      ? `Klook - ${ext.channel_variant_label.trim()}`
                      : 'Klook')
                  : (effectivePlatformKey || '이메일')}
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

      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <p className="text-sm text-gray-600">이메일에서 가져온 내용을 확인·수정한 뒤 저장하면 예약으로 생성됩니다.</p>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleReparse}
            disabled={reparsing || isImportProcessed}
            title="저장된 이메일 본문으로 추출 로직을 다시 실행합니다. 파서·상품 매핑을 바꾼 뒤에 사용하세요."
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-blue-200 text-blue-800 bg-blue-50/80 rounded-md text-sm hover:bg-blue-100 disabled:opacity-50"
          >
            {reparsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            본문 다시 파싱
          </button>
          <button
            type="button"
            onClick={handleReject}
            disabled={rejecting || isImportProcessed}
            className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-md text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {rejecting ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null}
            무시
          </button>
        </div>
      </div>
      <ReservationForm
        formTitle="이메일에서 예약 가져오기"
        key={`import-${row.id}-${reparseKey}`}
        reservation={
          row
            ? ({
                id: `import-${row.id}`,
                product_id: resolvedImportProductId,
                tour_date: form.tour_date,
                tour_time: form.tour_time || undefined,
                channel_id: resolvedImportChannelId,
                variant_key: resolvedImportVariantKey,
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
        onRefreshCustomers={refreshImportCustomerHints}
        onDelete={() => {}}
        layout="page"
        isNewReservation
        initialDataFromImport={{
          customer_name: (normalizeCustomerNameFromImport(ext?.customer_name ?? form.customer_name) || (ext?.customer_name ?? form.customer_name)) || undefined,
          customer_email: (ext?.customer_email ?? form.customer_email) || undefined,
          customer_phone: (ext?.customer_phone ?? form.customer_phone) || undefined,
          emergency_contact: ext?.emergency_contact || undefined,
          customer_language: ext?.language || undefined,
        }}
        initialShowNewCustomerForm={Boolean(normalizeCustomerNameFromImport(ext?.customer_name) || ext?.customer_name || form.customer_name)}
        initialChoiceOptionNamesFromImport={ext?.import_choice_option_names}
        initialChoiceUndecidedGroupNamesFromImport={ext?.import_choice_undecided_groups}
        initialViatorNetRateFromImport={
          isViatorEmailImport
            ? ext?.viator_net_rate_usd ??
              extractViatorNetRateFromEmailBodyForImport(row?.raw_body_text) ??
              extractViatorNetRateFromEmailBodyForImport(row?.raw_body_html ?? null)
            : undefined
        }
        initialChannelVariantLabelFromImport={ext?.channel_variant_label}
        initialVariantKeyFromImport={resolvedImportVariantKey ?? ext?.channel_variant_key}
        initialAmountFromImport={
          ext?.amount ??
          extractPriceFromEmailBodyForImport(row?.raw_body_text) ??
          extractPriceFromEmailBodyForImport(row?.raw_body_html ?? null)
        }
        importSubmitDisabled={isImportProcessed}
        useServerCustomerInsert
      />

      {showProcessedNotice && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-processed-notice-title"
        >
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6 space-y-4 border border-gray-100">
            <h2 id="import-processed-notice-title" className="text-base font-semibold text-gray-900">
              안내
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              처리된 항목입니다. (상태: {row.status})
            </p>
            <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
              {row.reservation_id ? (
                <a
                  href={`/${locale}/admin/reservations/${row.reservation_id}`}
                  className="text-sm text-blue-600 hover:underline mr-auto"
                >
                  생성된 예약 보기 →
                </a>
              ) : null}
              <button
                type="button"
                onClick={() => setShowProcessedNotice(false)}
                className="px-4 py-2 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-800"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
