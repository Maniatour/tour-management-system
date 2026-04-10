'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { X, Ban, Loader2, RefreshCw, FileText, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  isCancellationRequestEmailSubject,
  extractChannelRnForCancellationLookup,
} from '@/lib/emailReservationParser'
import type { ExtractedReservationData } from '@/types/reservationImport'
import type { Product } from '@/types/reservation'
import { expandChannelRnMatchVariants } from '@/utils/channelRnMatch'
import { syncReservationPricingAggregates } from '@/lib/syncReservationPricingAggregates'

type ImportRow = {
  id: string
  subject: string | null
  source_email: string | null
  platform_key: string | null
  status: string
  raw_body_text: string | null
  raw_body_html?: string | null
  extracted_data: ExtractedReservationData
}

type MatchRow = {
  id: string
  status: string
  tour_date: string | null
  channel_rn: string | null
  product_id: string | null
  total_people: number | null
  customers?: {
    name?: string | null
    name_ko?: string | null
    name_en?: string | null
  } | null
}

function formatMatchCustomerName(c: MatchRow['customers']): string {
  if (!c) return '—'
  const ko = (c.name_ko ?? '').trim()
  const en = (c.name_en ?? '').trim()
  const n = (c.name ?? '').trim()
  return ko || en || n || '—'
}

/** 입금 내역 중복 방지 (동일 메모로 이미 기록된 경우 스킵) */
const IMPORT_CANCEL_PARTNER_REFUND_MEMO = '예약 가져오기 페이지에서 간단 취소됨.'

/**
 * 예약 가져오기 모달에서 취소로 저장 시: 파트너 환불 입금 1건 자동 추가
 * — payment_status Returned, payment_method PAYM033, 금액 commission_base_price
 */
async function ensurePartnerRefundPaymentOnImportCancel(reservationId: string): Promise<void> {
  const { data: dup } = await supabase
    .from('payment_records')
    .select('id')
    .eq('reservation_id', reservationId)
    .eq('note', IMPORT_CANCEL_PARTNER_REFUND_MEMO)
    .limit(1)
  if (dup && dup.length > 0) return

  const { data: sessionData } = await supabase.auth.getSession()
  const submitBy = sessionData?.session?.user?.email ?? null

  const { data: pricingRows } = await supabase
    .from('reservation_pricing')
    .select('commission_base_price')
    .eq('reservation_id', reservationId)
    .order('updated_at', { ascending: false })
    .limit(1)

  const rawBase = pricingRows?.[0]?.commission_base_price
  const amount =
    rawBase != null && rawBase !== '' && !Number.isNaN(Number(rawBase)) ? Number(rawBase) : 0

  const paymentId = `payment_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  const { error } = await supabase.from('payment_records').insert({
    id: paymentId,
    reservation_id: reservationId,
    payment_status: 'Returned',
    amount,
    payment_method: 'PAYM033',
    note: IMPORT_CANCEL_PARTNER_REFUND_MEMO,
    submit_by: submitBy,
  })
  if (error) throw error

  const sync = await syncReservationPricingAggregates(supabase, reservationId)
  if (!sync.ok && sync.error) {
    console.warn('[import cancel] reservation_pricing 동기화 실패:', reservationId, sync.error)
  }
}

type ReservationBaseRow = {
  id: string
  status: string
  tour_date: string | null
  channel_rn: string | null
  product_id: string | null
  total_people: number | null
  customer_id: string | null
}

/**
 * 예약당 대표 이름: reservation_customers(첫 order_index) → customers,
 * 없으면 reservations.customer_id → customers.
 * (최신 예약은 customer가 reservation_customers에만 있는 경우가 많음)
 */
async function enrichRowsWithCustomerNames(
  baseRows: ReservationBaseRow[]
): Promise<MatchRow[]> {
  if (baseRows.length === 0) return []

  const resIds = baseRows.map((r) => r.id)

  const { data: rcRows } = await supabase
    .from('reservation_customers')
    .select('reservation_id, customer_id, name, name_ko, name_en, order_index')
    .in('reservation_id', resIds)
    .order('order_index', { ascending: true })

  const firstRcByReservation = new Map<
    string,
    { customer_id?: string | null; name?: string | null; name_ko?: string | null; name_en?: string | null }
  >()
  for (const rc of (rcRows || []) as Array<{
    reservation_id: string
    customer_id?: string | null
    name?: string | null
    name_ko?: string | null
    name_en?: string | null
  }>) {
    if (!firstRcByReservation.has(rc.reservation_id)) {
      firstRcByReservation.set(rc.reservation_id, rc)
    }
  }

  const customerIds = new Set<string>()
  for (const r of baseRows) {
    if (r.customer_id) customerIds.add(r.customer_id)
  }
  for (const rc of firstRcByReservation.values()) {
    if (rc.customer_id) customerIds.add(rc.customer_id)
  }

  const custMap: Record<string, { name?: string | null; name_ko?: string | null; name_en?: string | null }> =
    {}
  if (customerIds.size > 0) {
    const { data: custRows } = await supabase
      .from('customers')
      .select('id, name, name_ko, name_en')
      .in('id', [...customerIds])
    for (const c of custRows || []) {
      const row = c as { id: string; name?: string | null; name_ko?: string | null; name_en?: string | null }
      custMap[row.id] = row
    }
  }

  const pickDisplay = (
    r: ReservationBaseRow,
    rc?: { customer_id?: string | null; name?: string | null; name_ko?: string | null; name_en?: string | null }
  ): MatchRow['customers'] => {
    if (rc?.customer_id && custMap[rc.customer_id]) {
      return custMap[rc.customer_id]
    }
    if (
      rc &&
      ((rc.name_ko ?? '').trim() || (rc.name_en ?? '').trim() || (rc.name ?? '').trim())
    ) {
      return { name: rc.name ?? null, name_ko: rc.name_ko ?? null, name_en: rc.name_en ?? null }
    }
    if (r.customer_id && custMap[r.customer_id]) {
      return custMap[r.customer_id]
    }
    return null
  }

  return baseRows.map((r) => ({
    id: r.id,
    status: r.status,
    tour_date: r.tour_date,
    channel_rn: r.channel_rn,
    product_id: r.product_id,
    total_people: r.total_people,
    customers: pickDisplay(r, firstRcByReservation.get(r.id)),
  }))
}

export function ReservationCancellationImportModal({
  importId,
  locale,
  products,
  onClose,
  onResolved,
}: {
  importId: string | null
  locale: string
  products: Product[]
  onClose: () => void
  onResolved?: () => void
}) {
  const open = Boolean(importId)
  const [row, setRow] = useState<ImportRow | null>(null)
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [reparsing, setReparsing] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [matches, setMatches] = useState<MatchRow[] | null>(null)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [statusDraft, setStatusDraft] = useState<Record<string, string>>({})
  const [statusSaving, setStatusSaving] = useState<string | null>(null)
  const [hadNoRn, setHadNoRn] = useState(false)
  const [lookupQueryError, setLookupQueryError] = useState<string | null>(null)
  const [showBody, setShowBody] = useState(false)
  /** 본문: 사용자 친화 뷰 | 원문 */
  const [emailBodyTab, setEmailBodyTab] = useState<'friendly' | 'source'>('friendly')

  const loadRow = useCallback(async () => {
    if (!importId) return
    setFetchError(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/reservation-imports/${importId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || '불러오기 실패')
      if (!isCancellationRequestEmailSubject(data.subject)) {
        setFetchError('취소 요청 이메일이 아닙니다. 목록에서 다시 열어 주세요.')
        setRow(null)
        return
      }
      setRow(data as ImportRow)
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : '오류')
      setRow(null)
    } finally {
      setLoading(false)
    }
  }, [importId])

  useEffect(() => {
    if (!importId) {
      setRow(null)
      setMatches(null)
      setStatusDraft({})
      setHadNoRn(false)
      setLookupQueryError(null)
      setFetchError(null)
      setShowBody(false)
      return
    }
    void loadRow()
  }, [importId, loadRow])

  const ext = row?.extracted_data ?? null
  const channelRnFromExtracted = (ext as ExtractedReservationData | null)?.channel_rn
  const displayRn =
    row && isCancellationRequestEmailSubject(row.subject)
      ? (() => {
          const fromExt = ext?.channel_rn?.trim()
          if (fromExt && fromExt.toLowerCase() !== 'id') return fromExt
          return extractChannelRnForCancellationLookup(row.subject, row.raw_body_text || row.raw_body_html || '')
        })()
      : null

  useEffect(() => {
    if (!row || !isCancellationRequestEmailSubject(row.subject)) {
      setMatches(null)
      setStatusDraft({})
      setHadNoRn(false)
      setLookupQueryError(null)
      return
    }
    const extracted = (row.extracted_data || {}) as ExtractedReservationData
    const fromExt = extracted.channel_rn?.trim()
    const rnRaw =
      fromExt && fromExt.toLowerCase() !== 'id'
        ? fromExt
        : extractChannelRnForCancellationLookup(row.subject, row.raw_body_text || row.raw_body_html || '')
    if (!rnRaw?.trim()) {
      setHadNoRn(true)
      setMatches([])
      setLookupLoading(false)
      return
    }
    setHadNoRn(false)
    const rn = rnRaw.trim()
    const variants = expandChannelRnMatchVariants(rn)
    let cancelled = false
    setLookupLoading(true)
    setLookupQueryError(null)
    ;(async () => {
      const { data, error } = await supabase
        .from('reservations')
        .select('id, status, tour_date, channel_rn, product_id, total_people, customer_id')
        .in('channel_rn', variants)
        .order('tour_date', { ascending: false })
        .limit(10)

      if (cancelled) return

      if (error) {
        setLookupLoading(false)
        setLookupQueryError(error.message)
        setMatches([])
        return
      }

      const base = (data ?? []).map((r) => {
        const x = r as Record<string, unknown>
        return {
          id: String(x.id ?? ''),
          status: String(x.status ?? ''),
          tour_date: (x.tour_date as string | null) ?? null,
          channel_rn: (x.channel_rn as string | null) ?? null,
          product_id: (x.product_id as string | null) ?? null,
          total_people: (x.total_people as number | null) ?? null,
          customer_id: (x.customer_id as string | null | undefined) ?? null,
        }
      }) satisfies ReservationBaseRow[]
      const rows = await enrichRowsWithCustomerNames(base)

      setLookupLoading(false)
      setMatches(rows)
      setStatusDraft((prev) => {
        const next = { ...prev }
        for (const r of rows) {
          if (next[r.id] === undefined) next[r.id] = r.status
        }
        return next
      })
    })()
    return () => {
      cancelled = true
    }
  }, [row?.id, row?.subject, row?.raw_body_text, row?.raw_body_html, channelRnFromExtracted])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const handleReparse = async () => {
    if (!importId || !row || row.status !== 'pending') return
    setReparsing(true)
    try {
      const reparseRes = await fetch(`/api/reservation-imports/${importId}/reparse`, { method: 'POST' })
      const data = await reparseRes.json()
      if (!reparseRes.ok) throw new Error((data as { error?: string })?.error || '재파싱 실패')
      await loadRow()
    } catch (e) {
      alert(e instanceof Error ? e.message : '재파싱 실패')
    } finally {
      setReparsing(false)
    }
  }

  const handleReject = async () => {
    if (!row || row.status !== 'pending' || !importId) return
    if (!confirm('이 항목을 무시하시겠습니까?')) return
    setRejecting(true)
    try {
      const res = await fetch(`/api/reservation-imports/${importId}/reject`, { method: 'POST' })
      if (!res.ok) throw new Error('Reject failed')
      onResolved?.()
      onClose()
    } catch {
      alert('처리 실패')
    } finally {
      setRejecting(false)
    }
  }

  const handleSaveStatus = async (reservationId: string) => {
    const match = matches?.find((r) => r.id === reservationId)
    if (!match) return
    const next = statusDraft[reservationId] ?? match.status
    if (next === match.status) return
    const wasCancelled = match.status === 'cancelled'
    const becomesCancelled = next === 'cancelled'
    setStatusSaving(reservationId)
    try {
      const { error } = await supabase.from('reservations').update({ status: next }).eq('id', reservationId)
      if (error) throw error
      if (!wasCancelled && becomesCancelled) {
        try {
          await ensurePartnerRefundPaymentOnImportCancel(reservationId)
        } catch (payErr) {
          console.error('[cancellation-import] partner refund payment_record:', payErr)
          alert(
            payErr instanceof Error
              ? `예약은 취소되었으나 입금 내역(파트너 환불) 자동 추가에 실패했습니다: ${payErr.message}`
              : '예약은 취소되었으나 입금 내역 자동 추가에 실패했습니다.'
          )
        }
      }
      setMatches((prev) =>
        prev ? prev.map((r) => (r.id === reservationId ? { ...r, status: next } : r)) : prev
      )
      onResolved?.()
    } catch (e) {
      alert(e instanceof Error ? e.message : '상태 저장 실패')
    } finally {
      setStatusSaving(null)
    }
  }

  if (!open) return null

  const isPending = row?.status === 'pending'

  const rawHtmlStored = row ? (row.raw_body_html ?? '').trim() : ''
  const rawTextStored = row ? (row.raw_body_text ?? '').trim() : ''
  const bodyProbe = rawHtmlStored || rawTextStored
  const isHtmlEmail =
    Boolean(bodyProbe) &&
    (bodyProbe.trimStart().startsWith('<') || /<\/html>|<\/body>|<body/i.test(bodyProbe))
  const htmlSrcDoc = rawHtmlStored || (isHtmlEmail ? rawTextStored : '')
  const plainContent = isHtmlEmail ? '' : rawTextStored
  const sourceCodeContent = rawTextStored || rawHtmlStored

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancellation-import-modal-title"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[min(92vh,800px)] flex flex-col border border-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-gray-100 shrink-0">
          <div className="min-w-0 flex items-start gap-2">
            <Ban className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" aria-hidden />
            <div className="min-w-0">
              <h2 id="cancellation-import-modal-title" className="text-base font-semibold text-gray-900">
                취소 요청 이메일
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">채널 RN으로 예약을 찾아 상태를 변경합니다.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3">
          {loading && (
            <div className="flex justify-center py-10">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          )}
          {!loading && fetchError && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{fetchError}</p>
          )}
          {!loading && row && (
            <>
              <div className="text-sm space-y-1">
                <p className="font-medium text-gray-900 break-words">{row.subject ?? '(제목 없음)'}</p>
                {row.source_email && <p className="text-xs text-gray-500">발신: {row.source_email}</p>}
                {displayRn ? (
                  <p className="text-xs font-mono text-rose-900 bg-rose-50 border border-rose-100 rounded px-2 py-1 mt-2">
                    조회 RN: <strong>{displayRn}</strong>
                  </p>
                ) : null}
              </div>

              {bodyProbe ? (
                <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
                  <button
                    type="button"
                    onClick={() => setShowBody((v) => !v)}
                    className="w-full flex items-center justify-between gap-2 text-left px-3 py-2.5 bg-gray-50 hover:bg-gray-100 border-b border-gray-100"
                  >
                    <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
                      <FileText className="w-4 h-4 text-gray-500 shrink-0" aria-hidden />
                      이메일 본문
                    </span>
                    {showBody ? (
                      <ChevronUp className="w-4 h-4 text-gray-500 shrink-0" aria-hidden />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" aria-hidden />
                    )}
                  </button>
                  {showBody && (
                    <>
                      <div className="flex border-b border-gray-200 bg-gray-50/90">
                        <button
                          type="button"
                          onClick={() => setEmailBodyTab('friendly')}
                          className={`px-3 py-2 text-xs sm:text-sm font-medium shrink-0 ${
                            emailBodyTab === 'friendly'
                              ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                              : 'text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          {isHtmlEmail ? '미리보기' : '읽기 쉬운 보기'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEmailBodyTab('source')}
                          className={`px-3 py-2 text-xs sm:text-sm font-medium shrink-0 ${
                            emailBodyTab === 'source'
                              ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                              : 'text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          원문
                        </button>
                      </div>
                      {emailBodyTab === 'friendly' && isHtmlEmail && htmlSrcDoc ? (
                        <div className="bg-slate-100 p-3 max-h-[min(55vh,480px)] overflow-auto">
                          <iframe
                            title="이메일 미리보기"
                            sandbox="allow-same-origin allow-popups allow-scripts"
                            srcDoc={htmlSrcDoc}
                            className="w-full min-h-[280px] rounded-lg border border-gray-200/80 bg-white shadow-sm"
                            style={{ height: 'min(42vh, 420px)' }}
                          />
                        </div>
                      ) : null}
                      {emailBodyTab === 'friendly' && !isHtmlEmail && plainContent ? (
                        <div className="max-h-[min(55vh,480px)] overflow-auto px-3 py-3 bg-gradient-to-b from-slate-50/80 to-white">
                          <div
                            className="rounded-lg border border-gray-100 bg-white px-4 py-3.5 shadow-sm text-[13px] sm:text-sm text-gray-800 leading-[1.65] whitespace-pre-wrap break-words"
                            style={{ fontFamily: 'system-ui, "Segoe UI", "Apple SD Gothic Neo", sans-serif' }}
                          >
                            {plainContent.length > 150000 ? `${plainContent.slice(0, 150000)}…` : plainContent}
                          </div>
                        </div>
                      ) : null}
                      {emailBodyTab === 'source' ? (
                        <div className="max-h-[min(55vh,480px)] overflow-auto bg-[#1e1e1e]">
                          <pre className="p-3 text-[11px] text-[#d4d4d4] whitespace-pre-wrap font-mono break-words leading-relaxed m-0">
                            <code className="text-[#d4d4d4]">
                              {sourceCodeContent.length > 150000
                                ? `${sourceCodeContent.slice(0, 150000)}…`
                                : sourceCodeContent}
                            </code>
                          </pre>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              ) : null}

              <div className="rounded-lg border border-rose-200 bg-rose-50/90 px-3 py-2.5 text-sm text-rose-950 space-y-2">
                {lookupLoading && (
                  <div className="flex items-center gap-2 text-rose-800">
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    예약 조회 중…
                  </div>
                )}
                {!lookupLoading && matches !== null && hadNoRn && (
                  <p className="text-rose-800">
                    채널 RN을 제목·본문에서 찾지 못했습니다. 「본문 다시 파싱」을 시도하거나 RN을 확인해 주세요.
                  </p>
                )}
                {lookupQueryError && (
                  <p className="text-red-800 text-xs bg-red-50 border border-red-100 rounded px-2 py-1.5">
                    예약 조회 오류: {lookupQueryError}
                  </p>
                )}
                {!lookupLoading &&
                  !lookupQueryError &&
                  matches !== null &&
                  !hadNoRn &&
                  displayRn &&
                  matches.length === 0 && <p className="text-rose-800">이 RN과 일치하는 예약이 없습니다.</p>}
                {!lookupLoading && matches && matches.length > 0 && (
                  <ul className="space-y-2 pt-1">
                    {matches.map((m) => {
                      const productLabel =
                        (products.find((p) => p.id === m.product_id)?.name_ko ||
                          products.find((p) => p.id === m.product_id)?.name ||
                          m.product_id) ?? '—'
                      const draft = statusDraft[m.id] ?? m.status
                      return (
                        <li
                          key={m.id}
                          className="flex flex-col gap-2 rounded-md bg-white/90 border border-rose-100 px-2.5 py-2"
                        >
                          <div className="min-w-0">
                            <a
                              href={`/${locale}/admin/reservations/${m.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-700 font-medium text-sm hover:underline"
                            >
                              예약 상세 열기
                            </a>
                            <span className="text-xs text-gray-600 block mt-0.5">
                              {m.tour_date ?? '날짜 없음'} · {productLabel}
                            </span>
                            <span className="text-xs text-gray-700 block mt-1">
                              고객: <span className="font-medium text-gray-900">{formatMatchCustomerName(m.customers)}</span>
                              <span className="text-gray-400 mx-1.5">·</span>
                              총 인원:{' '}
                              <span className="font-medium text-gray-900">
                                {m.total_people != null && m.total_people > 0 ? `${m.total_people}명` : '—'}
                              </span>
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              className="border border-gray-300 rounded-md text-sm px-2 py-1.5 bg-white min-w-[7rem]"
                              value={draft}
                              onChange={(e) =>
                                setStatusDraft((prev) => ({ ...prev, [m.id]: e.target.value }))
                              }
                            >
                              <option value="pending">대기</option>
                              <option value="confirmed">확정</option>
                              <option value="completed">완료</option>
                              <option value="cancelled">취소</option>
                            </select>
                            <button
                              type="button"
                              disabled={statusSaving === m.id || draft === m.status}
                              onClick={() => void handleSaveStatus(m.id)}
                              className="inline-flex items-center justify-center min-w-[5.5rem] px-3 py-1.5 rounded-md bg-rose-700 text-white text-sm hover:bg-rose-800 disabled:opacity-50"
                            >
                              {statusSaving === m.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                '상태 저장'
                              )}
                            </button>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => void handleReparse()}
                  disabled={reparsing || !isPending}
                  title={isPending ? '저장된 이메일 본문으로 추출을 다시 실행합니다.' : '처리 대기 중인 항목만 재파싱할 수 있습니다.'}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-blue-200 text-blue-800 bg-blue-50/80 rounded-md text-sm hover:bg-blue-100 disabled:opacity-50"
                >
                  {reparsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  본문 다시 파싱
                </button>
                <button
                  type="button"
                  onClick={() => void handleReject()}
                  disabled={rejecting || !isPending}
                  className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-md text-sm hover:bg-gray-50 disabled:opacity-50"
                >
                  {rejecting ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null}
                  무시
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
