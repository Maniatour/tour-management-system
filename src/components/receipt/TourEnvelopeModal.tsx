'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { X, Printer } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fetchReservationOptionLinesBatch, type ReservationOptionLineBilingual } from '@/lib/reservationOptionsForEmail'
import {
  getBalanceAmountForDisplay,
  paymentRecordAmountToNumber,
  withNormalizedBalanceAmountForDisplay,
} from '@/utils/reservationPricingBalance'
import {
  buildBalanceEnvelopeBreakdownLines,
  countResidentLinesFromCustomers,
  formatBalanceEnvelopeLine,
  type BalanceEnvelopeLine,
} from '@/utils/balanceEnvelopeBreakdown'

// ---------------------------------------------------------------------------
// 상수
// ---------------------------------------------------------------------------

/** 봉투 크기: 3 5/8" x 6 1/2" (인치) → mm */
const ENVELOPE_WIDTH_MM = 3.625 * 25.4  // 92.075
const ENVELOPE_HEIGHT_MM = 6.5 * 25.4   // 165.1

/** Balance 봉투: 정보 블록이 들어가는 영역(빨간 박스) = 왼쪽 상단, mm */
const BALANCE_BLOCK_LEFT_MM = 42
const BALANCE_BLOCK_TOP_MM = 10
const BALANCE_BLOCK_WIDTH_MM = 176

const ENVELOPE_IMAGE_PATH = {
  tip: (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_TIP_ENVELOPE_IMAGE_URL) || '/tip-envelope-image.png',
  balance: (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_BALANCE_ENVELOPE_IMAGE_URL) || '/balance-envelope-image.png',
}

function resolveEnvelopeImageUrl(pathOrUrl: string): string {
  const raw = (pathOrUrl || '').trim()
  if (!raw) return raw
  if (/^https?:\/\//i.test(raw) || raw.startsWith('data:') || raw.startsWith('blob:')) return raw
  if (typeof window === 'undefined') return raw.startsWith('/') ? raw : `/${raw}`
  const path = raw.startsWith('/') ? raw : `/${raw}`
  return `${window.location.origin}${path}`
}

type EnvelopeReservationRow = {
  id: string
  customer_id?: string | null
  adults?: number
  child?: number
  infant?: number
  total_people?: number
  status?: string | null
}

function customerForReservation(
  rez: EnvelopeReservationRow,
  customerMap: Map<string, { name: string; language: string | null }>
): { name: string; language: string | null } | null {
  const customerId = rez.customer_id?.trim()
  if (!customerId) return null
  return customerMap.get(customerId) ?? null
}

/** 가이드 픽업·투어 인쇄와 동일: API(사용자 RLS) 우선, 누락분만 직접 조회 */
async function fetchPricingByReservationIds(
  ids: string[]
): Promise<Map<string, Record<string, unknown> | null>> {
  const pricingByResId = new Map<string, Record<string, unknown> | null>()
  if (ids.length === 0) return pricingByResId

  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData?.session?.access_token?.trim()

  if (token && typeof window !== 'undefined') {
    try {
      const res = await fetch(
        `/api/reservation-pricing?reservation_ids=${encodeURIComponent(ids.join(','))}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (res.ok) {
        const json = (await res.json()) as {
          items?: Array<{ reservation_id: string; pricing: Record<string, unknown> | null }>
        }
        if (Array.isArray(json.items)) {
          for (const { reservation_id, pricing } of json.items) {
            pricingByResId.set(
              reservation_id,
              pricing && typeof pricing === 'object' ? pricing : null
            )
          }
        }
      }
    } catch (e) {
      console.warn('[TourEnvelopeModal] reservation-pricing API', e)
    }
  }

  const missing = ids.filter((id) => !pricingByResId.has(id))
  if (missing.length > 0) {
    const { data: pricingList, error: pricingErr } = await supabase
      .from('reservation_pricing')
      .select('*')
      .in('reservation_id', missing)
    if (pricingErr) {
      console.warn('[TourEnvelopeModal] reservation_pricing direct', pricingErr)
    }
    for (const row of pricingList || []) {
      const rid = (row as { reservation_id?: string }).reservation_id
      if (rid) pricingByResId.set(rid, row as Record<string, unknown>)
    }
  }

  for (const id of ids) {
    if (!pricingByResId.has(id)) pricingByResId.set(id, null)
  }

  return pricingByResId
}

const LABELS = {
  ko: {
    titleTip: '팁 봉투 인쇄',
    titleBalance: 'Balance 봉투 인쇄',
    tourLabel: '투어 :',
    tourGuideLabel: '투어 가이드 :',
    print: '인쇄',
    close: '닫기',
    printMode: '인쇄 방식',
    withImage: '이미지와 함께 인쇄',
    textOnly: '글자만 인쇄 (이미 인쇄된 봉투용)',
    selectCustomers: '인쇄할 고객 선택',
    selectAll: '전체 선택',
    deselectAll: '전체 해제',
    noBalanceCustomers: '잔금이 있는 고객이 없습니다.',
    preview: '미리보기',
  },
  en: {
    titleTip: 'Tip Envelope Print',
    titleBalance: 'Balance Envelope Print',
    tourLabel: 'TOUR :',
    tourGuideLabel: 'TOUR GUIDE :',
    print: 'Print',
    close: 'Close',
    printMode: 'Print mode',
    withImage: 'Print with image',
    textOnly: 'Text only (for pre-printed envelopes)',
    selectCustomers: 'Select customers to print',
    selectAll: 'Select all',
    deselectAll: 'Deselect all',
    noBalanceCustomers: 'No customers with balance.',
    preview: 'Preview',
  },
} as const

// ---------------------------------------------------------------------------
// 타입
// ---------------------------------------------------------------------------

export type EnvelopeRow = {
  reservationId: string
  customerName: string
  customerLanguage: string | null
  balanceAmount: number
  currency: string
  balanceLines: BalanceEnvelopeLine[]
}

export type EnvelopeVariant = 'tip' | 'balance'

export interface TourEnvelopeModalProps {
  isOpen: boolean
  onClose: () => void
  variant: EnvelopeVariant
  reservationIds: string[]
  tourDate: string
  productNameKo: string
  productNameEn: string
  guideAndAssistantKo: string
  guideAndAssistantEn: string
  locale?: string
}

// ---------------------------------------------------------------------------
// 유틸
// ---------------------------------------------------------------------------

function formatMoney(amount: number, currency: string): string {
  if (currency === 'KRW') return `₩${Math.round(amount).toLocaleString()}`
  return `$${amount.toFixed(2)}`
}

function formatDateForEnvelope(dateStr: string): string {
  if (!dateStr) return ''
  return dateStr.replace(/-/g, '.')
}

/** 고객 언어가 한국어이면 true (한국어가 아니면 봉투는 모두 영어로 표시) */
function isCustomerKorean(lang: string | null | undefined): boolean {
  if (!lang) return false
  const l = lang.toString().toLowerCase()
  return l === 'ko' || l.startsWith('ko-') || l === 'korean' || l === 'kr'
}

function useEnvelopeEnglish(lang: string | null | undefined): boolean {
  return !isCustomerKorean(lang)
}

/** Balance 상세(내역 + 합계 줄)이 많을 때 봉투 고정 높이 안에 들어가도록 글자·축소 조절 */
function getBalanceBlockCompaction(balanceLineCount: number): {
  fontSize: string
  lineHeight: number
  scale: number
  breakdownFontEm: number
} {
  const n = Math.max(0, Math.floor(balanceLineCount))
  // 내역 N줄 + 합계 1줄 (N>=1일 때 최소 2줄)
  const detailLines = n > 0 ? n + 1 : 0
  if (detailLines <= 0) {
    return { fontSize: '18px', lineHeight: 1.45, scale: 1, breakdownFontEm: 0.78 }
  }
  if (detailLines <= 4) {
    return { fontSize: '17px', lineHeight: 1.4, scale: 0.94, breakdownFontEm: 0.75 }
  }
  if (detailLines <= 7) {
    return { fontSize: '16px', lineHeight: 1.36, scale: 0.9, breakdownFontEm: 0.72 }
  }
  if (detailLines <= 10) {
    return { fontSize: '15px', lineHeight: 1.32, scale: 0.86, breakdownFontEm: 0.7 }
  }
  if (detailLines <= 15) {
    return { fontSize: '14px', lineHeight: 1.28, scale: 0.82, breakdownFontEm: 0.68 }
  }
  return { fontSize: '12px', lineHeight: 1.22, scale: 0.76, breakdownFontEm: 0.64 }
}

// ---------------------------------------------------------------------------
// 인쇄용 스타일 (Balance 블록 = 봉투 왼쪽 상단 빨간 박스 영역에 고정)
// ---------------------------------------------------------------------------

function getPrintStyles(): string {
  return `
    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0 !important; padding: 0 !important; background: white !important; font-family: Arial, Helvetica, sans-serif !important; -webkit-font-smoothing: antialiased; text-rendering: geometricPrecision; }
    body * { font-family: Arial, Helvetica, sans-serif !important; }
    .absolute { position: absolute !important; }
    .relative { position: relative !important; }
    .flex { display: flex !important; }
    .flex-col { flex-direction: column !important; }
    .flex-shrink-0 { flex-shrink: 0 !important; }
    .z-0 { z-index: 0 !important; }
    .z-10 { z-index: 10 !important; }
    .inset-0 { top:0!important;right:0!important;bottom:0!important;left:0!important; }
    .w-full { width: 100% !important; }
    .h-full { height: 100% !important; }
    .object-contain { object-fit: contain !important; }
    .object-center { object-position: center !important; }
    .pointer-events-none { pointer-events: none !important; }
    .break-words { overflow-wrap: break-word !important; word-break: break-word !important; }
    .text-gray-900 { color: #111827 !important; }
    .space-y-0 > * + * { margin-top: 0 !important; }
    .bg-white { background-color: #fff !important; }
    .overflow-visible { overflow: visible !important; }
    .envelope-sheet, .envelope-sheet * { font-family: Arial, Helvetica, sans-serif !important; }
    .envelope-sheet { width: ${ENVELOPE_WIDTH_MM}mm !important; height: ${ENVELOPE_HEIGHT_MM}mm !important; margin: 0 !important; padding: 0 !important; page-break-after: always !important; page-break-inside: avoid !important; overflow: visible !important; position: relative !important; }
    .envelope-sheet:last-child { page-break-after: auto !important; }
    .envelope-bg-image { position: absolute !important; top: 0 !important; right: 0 !important; bottom: 0 !important; left: 0 !important; width: 100% !important; height: 100% !important; object-fit: contain !important; object-position: center !important; z-index: 0 !important; pointer-events: none !important; display: block !important; }
    @page { size: ${ENVELOPE_WIDTH_MM}mm ${ENVELOPE_HEIGHT_MM}mm; margin: 0 !important; }
    @media print {
      html, body { width: ${ENVELOPE_WIDTH_MM}mm !important; margin: 0 !important; padding: 0 !important; overflow: visible !important; }
      body, body *, .envelope-sheet, .envelope-sheet * { font-family: Arial, Helvetica, sans-serif !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; -webkit-font-smoothing: antialiased; text-rendering: geometricPrecision; }
      .envelope-bg-image { visibility: visible !important; opacity: 1 !important; display: block !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
      .envelope-balance-block { left: ${BALANCE_BLOCK_LEFT_MM}mm !important; top: ${BALANCE_BLOCK_TOP_MM}mm !important; width: ${BALANCE_BLOCK_WIDTH_MM}mm !important; min-width: ${BALANCE_BLOCK_WIDTH_MM}mm !important; transform: rotate(90deg) scale(var(--env-balance-scale, 1)) !important; transform-origin: left top !important; }
    }
  `
}

// ---------------------------------------------------------------------------
// 컴포넌트
// ---------------------------------------------------------------------------

export default function TourEnvelopeModal({
  isOpen,
  onClose,
  variant,
  reservationIds,
  tourDate,
  productNameKo,
  productNameEn,
  guideAndAssistantKo,
  guideAndAssistantEn,
  locale = 'ko',
}: TourEnvelopeModalProps) {
  const [rows, setRows] = useState<EnvelopeRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [printWithImage, setPrintWithImage] = useState(true)
  const [selectedReservationIds, setSelectedReservationIds] = useState<Set<string>>(new Set())

  const L = locale === 'ko' ? LABELS.ko : LABELS.en
  const envelopeImageUrl = resolveEnvelopeImageUrl(ENVELOPE_IMAGE_PATH[variant])
  const displayRows = variant === 'balance' ? rows.filter((r) => r.balanceAmount > 0) : rows
  const hasBalanceRows = variant === 'balance' && displayRows.length === 0 && !loading && !error && rows.length > 0

  useEffect(() => {
    if (!isOpen) return
    const img = new Image()
    img.decoding = 'async'
    img.src = envelopeImageUrl
  }, [isOpen, envelopeImageUrl])

  useEffect(() => {
    if (!isOpen || !reservationIds.length) {
      setRows([])
      setError(null)
      return
    }
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const ids = [...new Set(reservationIds.filter(Boolean))]
        if (ids.length === 0) {
          if (!cancelled) setRows([])
          return
        }

        const { data: rezList, error: rezErr } = await supabase
          .from('reservations')
          .select('id, customer_id, adults, child, infant, total_people, status')
          .in('id', ids)

        if (cancelled) return
        if (rezErr || !rezList?.length) {
          setError('Reservation not found')
          return
        }

        const customerIds = [
          ...new Set(
            (rezList as EnvelopeReservationRow[])
              .map((r) => r.customer_id)
              .filter((id): id is string => Boolean(id && String(id).trim()))
          ),
        ]
        const customerMap = new Map<string, { name: string; language: string | null }>()
        if (customerIds.length > 0) {
          const { data: customersData, error: custErr } = await supabase
            .from('customers')
            .select('id, name, language')
            .in('id', customerIds)
          if (cancelled) return
          if (custErr) {
            setError('Customer not found')
            return
          }
          for (const row of customersData || []) {
            customerMap.set(row.id, {
              name: row.name ?? '',
              language: row.language ?? null,
            })
          }
        }

        const rezById = new Map<string, EnvelopeReservationRow>()
        for (const r of rezList as EnvelopeReservationRow[]) {
          rezById.set(r.id, r)
        }

        const needsBalanceData = variant === 'balance'
        const [
          pricingByResId,
          optionLinesByResId,
          payResult,
          rcResult,
        ] = await Promise.all([
          needsBalanceData ? fetchPricingByReservationIds(ids) : Promise.resolve(new Map()),
          needsBalanceData ? fetchReservationOptionLinesBatch(supabase, ids) : Promise.resolve(new Map()),
          needsBalanceData
            ? supabase
                .from('payment_records')
                .select('reservation_id, amount, payment_status')
                .in('reservation_id', ids)
            : Promise.resolve({ data: null as unknown[] | null, error: null }),
          needsBalanceData
            ? supabase
                .from('reservation_customers')
                .select('reservation_id, resident_status')
                .in('reservation_id', ids)
            : Promise.resolve({ data: null as unknown[] | null, error: null }),
        ])

        if (cancelled) return

        const optionsTotalByResId = new Map<string, number | null>()
        if (needsBalanceData) {
          for (const id of ids) {
            const lines = optionLinesByResId.get(id) || []
            if (!lines.length) {
              optionsTotalByResId.set(id, null)
            } else {
              const sum = lines.reduce(
                (s: number, o: { lineTotal?: number | null }) => s + (Number(o.lineTotal) || 0),
                0
              )
              optionsTotalByResId.set(id, sum)
            }
          }
        }

        const residentsByResId = new Map<string, Array<{ resident_status?: string | null }>>()
        for (const r of (rcResult.data || []) as Array<{ reservation_id: string; resident_status?: string | null }>) {
          const list = residentsByResId.get(r.reservation_id) || []
          list.push({ resident_status: r.resident_status ?? null })
          residentsByResId.set(r.reservation_id, list)
        }

        const paymentsByResId = new Map<string, Array<{ payment_status: string; amount: number }>>()
        for (const r of (payResult.data || []) as Array<{
          reservation_id: string
          amount?: unknown
          payment_status?: string | null
        }>) {
          const list = paymentsByResId.get(r.reservation_id) || []
          list.push({
            payment_status: r.payment_status || '',
            amount: paymentRecordAmountToNumber(r.amount),
          })
          paymentsByResId.set(r.reservation_id, list)
        }

        const results: EnvelopeRow[] = ids.map((id) => {
          const rez = rezById.get(id)
          if (!rez) {
            return {
              reservationId: id,
              customerName: '',
              customerLanguage: null,
              balanceAmount: 0,
              currency: 'USD',
              balanceLines: [],
            }
          }
          const customer = customerForReservation(rez, customerMap)
          const pricingRaw = pricingByResId.get(id) ?? null
          const pricing = pricingRaw ? withNormalizedBalanceAmountForDisplay(pricingRaw) : null
          const optionsSum = optionsTotalByResId.get(id) ?? null
          const balanceAmount = needsBalanceData
            ? getBalanceAmountForDisplay(
                pricing,
                optionsSum,
                {
                  adults: rez.adults ?? null,
                  child: rez.child ?? null,
                  infant: rez.infant ?? null,
                },
                {
                  paymentRecords: paymentsByResId.get(id) ?? [],
                  reservationStatus: rez.status ?? null,
                }
              )
            : 0
          const currency =
            pricing && typeof (pricing as { currency?: unknown }).currency === 'string'
              ? ((pricing as { currency: string }).currency || 'USD')
              : 'USD'
          const p = pricing as {
            not_included_price?: unknown
            pricing_adults?: unknown
          } | null
          const pricingAdultsRaw = p?.pricing_adults
          const pricingAdults =
            pricingAdultsRaw !== undefined &&
            pricingAdultsRaw !== null &&
            pricingAdultsRaw !== '' &&
            Number.isFinite(Number(pricingAdultsRaw))
              ? Math.max(0, Math.floor(Number(pricingAdultsRaw)))
              : rez.adults ?? 0
          const notIncludedPerPerson = Number(p?.not_included_price) || 0
          const residentCounts = countResidentLinesFromCustomers(residentsByResId.get(id))
          const reservationOptions = (optionLinesByResId.get(id) || []).map((o: ReservationOptionLineBilingual) => ({
            labelKo: o.labelKo,
            labelEn: o.labelEn,
            unitPrice: o.unitPrice,
            qty: o.quantity,
            subtotal: o.lineTotal,
          }))
          const balanceLines =
            needsBalanceData && balanceAmount > 0.005
              ? buildBalanceEnvelopeBreakdownLines({
                  balanceAmount,
                  notIncludedPerPerson,
                  pricingAdults,
                  child: rez.child ?? 0,
                  infant: rez.infant ?? 0,
                  residentCounts,
                  reservationOptions,
                })
              : []
          return {
            reservationId: id,
            customerName: customer?.name ?? '',
            customerLanguage: customer?.language ?? null,
            balanceAmount,
            currency: currency || 'USD',
            balanceLines,
          }
        })

        if (cancelled) return
        setRows(results)
        if (variant === 'balance') {
          setSelectedReservationIds(new Set(results.filter((r) => r.balanceAmount > 0).map((r) => r.reservationId)))
        } else {
          setSelectedReservationIds(new Set(results.map((r) => r.reservationId)))
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [isOpen, reservationIds.join(','), variant])

  const waitForDocumentImages = (doc: Document, timeoutMs = 2500): Promise<void> =>
    new Promise((resolve) => {
      const images = Array.from(doc.querySelectorAll('img'))
      if (images.length === 0) {
        resolve()
        return
      }
      let settled = false
      const finish = () => {
        if (settled) return
        settled = true
        resolve()
      }
      const timer = window.setTimeout(finish, timeoutMs)
      let pending = 0
      for (const img of images) {
        if (img.complete && img.naturalWidth > 0) continue
        pending += 1
        const done = () => {
          pending -= 1
          if (pending <= 0) {
            window.clearTimeout(timer)
            finish()
          }
        }
        img.addEventListener('load', done, { once: true })
        img.addEventListener('error', done, { once: true })
      }
      if (pending === 0) {
        window.clearTimeout(timer)
        finish()
      }
    })

  const handlePrint = async () => {
    const target = document.getElementById('envelope-batch-print')
    if (!target) return
    const clone = target.cloneNode(true) as HTMLElement
    clone.style.background = 'white'
    clone.style.border = 'none'
    clone.style.boxShadow = 'none'
    clone.removeAttribute('id')

    clone.querySelectorAll('img').forEach((img) => {
      const src = img.getAttribute('src')
      if (src) img.setAttribute('src', resolveEnvelopeImageUrl(src))
    })

    const iframe = document.createElement('iframe')
    iframe.title = 'Envelope Print'
    iframe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;border:none;overflow:hidden;'
    document.body.appendChild(iframe)
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
    if (!iframeDoc) {
      document.body.removeChild(iframe)
      return
    }

    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    iframeDoc.open()
    iframeDoc.write(`
      <!DOCTYPE html><html><head><meta charset="utf-8"><base href="${origin}/"><title>Tour Envelope</title>
      <style>${getPrintStyles()}</style>
      </head><body>${clone.outerHTML}</body></html>`)
    iframeDoc.close()

    const printWin = iframe.contentWindow
    if (!printWin) {
      document.body.removeChild(iframe)
      return
    }

    try {
      await waitForDocumentImages(iframeDoc)
      printWin.focus()
      printWin.print()
    } finally {
      window.setTimeout(() => {
        if (iframe.parentNode) document.body.removeChild(iframe)
      }, 500)
    }
  }

  if (!isOpen) return null

  const balanceBlockBase = {
    pointerEvents: 'none' as const,
    left: `${BALANCE_BLOCK_LEFT_MM}mm`,
    top: `${BALANCE_BLOCK_TOP_MM}mm`,
    width: `${BALANCE_BLOCK_WIDTH_MM}mm`,
    minWidth: `${BALANCE_BLOCK_WIDTH_MM}mm`,
    transformOrigin: 'left top' as const,
    fontFamily: 'Arial, Helvetica, sans-serif',
    color: '#111827',
    paddingLeft: '4mm',
    paddingRight: '4mm',
  }

  const buildBalanceBlockLayout = (balanceLineCount: number): { blockStyle: CSSProperties; breakdownFontEm: number } => {
    const c = getBalanceBlockCompaction(balanceLineCount)
    return {
      blockStyle: {
        ...balanceBlockBase,
        ['--env-balance-scale' as string]: String(c.scale),
        fontSize: c.fontSize,
        lineHeight: c.lineHeight,
        transform: `rotate(90deg) scale(${c.scale})`,
      },
      breakdownFontEm: c.breakdownFontEm,
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-[min(95vw,520px)] max-h-[90vh] overflow-hidden flex flex-col">
        <header className="flex items-center justify-between p-4 border-b flex-shrink-0">
          <h2 className="text-lg font-bold text-gray-900">{variant === 'tip' ? L.titleTip : L.titleBalance}</h2>
          <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className={`flex-1 overflow-y-auto p-4 min-w-0 ${variant === 'balance' ? 'overflow-x-auto' : 'overflow-x-hidden'}`}>
          {loading && <p className="text-gray-500 py-4">로딩 중...</p>}
          {error && <p className="text-red-600 py-4">{error}</p>}
          {!loading && !error && rows.length === 0 && <p className="text-gray-500 py-4">예약이 없습니다.</p>}
          {hasBalanceRows && <p className="text-gray-500 py-4">{L.noBalanceCustomers}</p>}

          {!loading && !error && rows.length > 0 && !hasBalanceRows && (
            <>
              <p className="text-sm text-gray-600 mb-3">
                {selectedReservationIds.size > 0 ? `${selectedReservationIds.size}장 인쇄` : '인쇄할 고객을 선택하세요'} (3 5/8" × 6 1/2" 봉투)
              </p>

              <div className="flex flex-col gap-2 mb-3">
                <span className="text-sm font-medium text-gray-700">{L.selectCustomers}</span>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setSelectedReservationIds(new Set(displayRows.map((r) => r.reservationId)))} className="text-xs text-primary hover:underline">
                    {L.selectAll}
                  </button>
                  <span className="text-gray-300">|</span>
                  <button type="button" onClick={() => setSelectedReservationIds(new Set())} className="text-xs text-gray-500 hover:underline">
                    {L.deselectAll}
                  </button>
                </div>
                <div className="max-h-32 overflow-y-auto border border-gray-200 rounded p-2 space-y-1">
                  {displayRows.map((row, idx) => (
                    <label key={`${row.reservationId}-${idx}`} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5">
                      <input
                        type="checkbox"
                        checked={selectedReservationIds.has(row.reservationId)}
                        onChange={(e) => {
                          const next = new Set(selectedReservationIds)
                          if (e.target.checked) next.add(row.reservationId)
                          else next.delete(row.reservationId)
                          setSelectedReservationIds(next)
                        }}
                        className="rounded text-primary"
                      />
                      <span className="text-sm truncate">{row.customerName || '—'}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2 mb-3">
                <span className="text-sm font-medium text-gray-700">{L.printMode}</span>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="envelope-print-mode" checked={printWithImage} onChange={() => setPrintWithImage(true)} className="text-primary" />
                  <span className="text-sm">{L.withImage}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="envelope-print-mode" checked={!printWithImage} onChange={() => setPrintWithImage(false)} className="text-primary" />
                  <span className="text-sm">{L.textOnly}</span>
                </label>
              </div>

              <div className="border-t border-gray-200 pt-6 mt-8 flex flex-col gap-2">
                <span className="text-sm font-medium text-gray-600">{L.preview}</span>
                <div className={variant === 'balance' ? 'flex justify-center overflow-x-auto overflow-visible' : ''}>
                  <div id="envelope-batch-print" className="space-y-0">
                  {rows.filter((row) => selectedReservationIds.has(row.reservationId)).map((row, idx) => {
                    const balanceLayout =
                      variant === 'balance' ? buildBalanceBlockLayout(row.balanceLines.length) : null
                    return (
                    <div
                      key={`${row.reservationId}-${idx}`}
                      className="envelope-sheet bg-white overflow-visible relative"
                      style={{
                        width: `${ENVELOPE_WIDTH_MM}mm`,
                        height: `${ENVELOPE_HEIGHT_MM}mm`,
                        minWidth: `${ENVELOPE_WIDTH_MM}mm`,
                        minHeight: `${ENVELOPE_HEIGHT_MM}mm`,
                      }}
                    >
                      {printWithImage && (
                        <img
                          src={envelopeImageUrl}
                          alt=""
                          className="envelope-bg-image absolute inset-0 w-full h-full object-contain object-center z-0 pointer-events-none"
                          loading="eager"
                          decoding="sync"
                        />
                      )}
                      {variant === 'balance' && balanceLayout ? (
                        <div
                          className="envelope-balance-block absolute z-10 flex flex-col flex-shrink-0"
                          style={balanceLayout.blockStyle}
                        >
                          <div style={{ display: 'flex', gap: '6px', minHeight: '2em' }}>
                            <span style={{ flexShrink: 0, fontWeight: 600 }}>NAME :</span>
                            <span className="break-words">{row.customerName || '—'}</span>
                          </div>
                          <div style={{ display: 'flex', gap: '6px', minHeight: '2em', alignItems: 'flex-start' }}>
                            <span style={{ flexShrink: 0, fontWeight: 600 }}>TOUR :</span>
                            <span className="break-words" style={{ minWidth: 0 }}>{formatDateForEnvelope(tourDate)} {(useEnvelopeEnglish(row.customerLanguage) ? productNameEn : productNameKo) || '—'}</span>
                          </div>
                          <div style={{ display: 'flex', gap: '6px', minHeight: '2em' }}>
                            <span style={{ flexShrink: 0, fontWeight: 600 }}>TOUR GUIDE :</span>
                            <span className="break-words">{(useEnvelopeEnglish(row.customerLanguage) ? guideAndAssistantEn : guideAndAssistantKo) || '—'}</span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.06em', minHeight: 0 }}>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                              <span style={{ flexShrink: 0, fontWeight: 600 }}>BALANCE :</span>
                              <span className="break-words" style={{ minWidth: 0, lineHeight: 1.25 }}>
                                {formatMoney(row.balanceAmount, row.currency)}
                              </span>
                            </div>
                            {row.balanceLines.length > 0 && (
                              <div
                                style={{
                                  fontSize: `${balanceLayout.breakdownFontEm}em`,
                                  lineHeight: 1.2,
                                  fontWeight: 400,
                                  color: '#374151',
                                }}
                              >
                                {row.balanceLines.map((line, lineIdx) => (
                                  <div key={lineIdx} className="break-words">
                                    {formatBalanceEnvelopeLine(
                                      line,
                                      row.currency,
                                      useEnvelopeEnglish(row.customerLanguage),
                                      formatMoney
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : variant === 'tip' ? (
                        <>
                          <div
                            className="absolute z-10 flex items-center justify-center flex-shrink-0"
                            style={{
                              pointerEvents: 'none',
                              right: '-4mm',
                              top: '32%',
                              width: '50mm',
                              height: '23mm',
                              minWidth: '38mm',
                              minHeight: '23mm',
                              transform: 'translateY(-50%) rotate(90deg)',
                              transformOrigin: 'center center',
                              fontFamily: 'Arial, Helvetica, sans-serif',
                            }}
                          >
                            <div className="font-semibold text-xl text-center leading-tight break-words" style={{ maxWidth: '100%', paddingTop: '1.2em' }}>
                              {row.customerName || '—'}
                            </div>
                          </div>
                          <div
                            className="absolute z-10 flex flex-col flex-shrink-0"
                            style={{
                              pointerEvents: 'none',
                              left: '-16mm',
                              top: '28%',
                              width: '75mm',
                              minWidth: '75mm',
                              transform: 'translateY(-50%) rotate(90deg)',
                              transformOrigin: 'center center',
                              fontFamily: 'Arial, Helvetica, sans-serif',
                              fontSize: '14px',
                              lineHeight: 1.9,
                            }}
                          >
                            <div style={{ display: 'flex', gap: '4px', minHeight: '1.9em', alignItems: 'flex-start' }}>
                              <span style={{ flexShrink: 0, fontWeight: 600 }}>{useEnvelopeEnglish(row.customerLanguage) ? LABELS.en.tourLabel : LABELS.ko.tourLabel}</span>
                              <span style={{ whiteSpace: 'nowrap', overflow: 'visible' }}>{formatDateForEnvelope(tourDate)} {(useEnvelopeEnglish(row.customerLanguage) ? productNameEn : productNameKo) || '—'}</span>
                            </div>
                            <div style={{ display: 'flex', gap: '4px', minHeight: '1.9em', alignItems: 'flex-start' }}>
                              <span style={{ flexShrink: 0, fontWeight: 600 }}>{useEnvelopeEnglish(row.customerLanguage) ? LABELS.en.tourGuideLabel : LABELS.ko.tourGuideLabel}</span>
                              <span>{(useEnvelopeEnglish(row.customerLanguage) ? guideAndAssistantEn : guideAndAssistantKo) || '—'}</span>
                            </div>
                          </div>
                        </>
                      ) : null}
                    </div>
                    )
                  })}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {!loading && !error && rows.length > 0 && !hasBalanceRows && (
          <footer className="p-4 border-t flex justify-end gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={handlePrint}
              disabled={selectedReservationIds.size === 0}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              {L.print}
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300">
              {L.close}
            </button>
          </footer>
        )}
      </div>
    </div>
  )
}
