'use client'

import { useEffect, useState } from 'react'
import { X, Printer } from 'lucide-react'
import { supabase } from '@/lib/supabase'

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

const ENVELOPE_IMAGE_URL = {
  tip: (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_TIP_ENVELOPE_IMAGE_URL) || '/tip-envelope-image.png',
  balance: (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_BALANCE_ENVELOPE_IMAGE_URL) || '/balance-envelope-image.png',
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

function isCustomerEnglish(lang: string | null | undefined): boolean {
  if (!lang) return false
  const l = lang.toString().toLowerCase()
  return l === 'en' || l.startsWith('en-') || l === 'english'
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
    .envelope-sheet { width: ${ENVELOPE_WIDTH_MM}mm !important; height: ${ENVELOPE_HEIGHT_MM}mm !important; margin: 0 !important; padding: 0 !important; page-break-after: always !important; page-break-inside: avoid !important; }
    .envelope-sheet:last-child { page-break-after: auto !important; }
    @page { size: ${ENVELOPE_WIDTH_MM}mm ${ENVELOPE_HEIGHT_MM}mm; margin: 0 !important; }
    @media print {
      html, body { width: ${ENVELOPE_WIDTH_MM}mm !important; margin: 0 !important; padding: 0 !important; }
      body, body *, .envelope-sheet, .envelope-sheet * { font-family: Arial, Helvetica, sans-serif !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; -webkit-font-smoothing: antialiased; text-rendering: geometricPrecision; }
      .envelope-balance-block { left: ${BALANCE_BLOCK_LEFT_MM}mm !important; top: ${BALANCE_BLOCK_TOP_MM}mm !important; width: ${BALANCE_BLOCK_WIDTH_MM}mm !important; min-width: ${BALANCE_BLOCK_WIDTH_MM}mm !important; transform: rotate(90deg) !important; transform-origin: left top !important; }
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
  const envelopeImageUrl = ENVELOPE_IMAGE_URL[variant]
  const displayRows = variant === 'balance' ? rows.filter((r) => r.balanceAmount > 0) : rows
  const hasBalanceRows = variant === 'balance' && displayRows.length === 0 && !loading && !error && rows.length > 0

  useEffect(() => {
    if (!isOpen || !reservationIds.length) {
      setRows([])
      setError(null)
      return
    }
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const ids = reservationIds.filter(Boolean)
        if (ids.length === 0) {
          setRows([])
          setLoading(false)
          return
        }
        const { data: rezList, error: rezErr } = await supabase
          .from('reservations')
          .select('id, customer_id')
          .in('id', ids)
        if (rezErr || !rezList?.length) {
          setError('Reservation not found')
          setLoading(false)
          return
        }
        const customerIds = [...new Set((rezList as { customer_id?: string }[]).map((r) => r.customer_id).filter(Boolean))]
        const { data: customersData } = await supabase
          .from('customers')
          .select('id, name, language')
          .in('id', customerIds)
        const customerById = new Map<string, { name: string; language: string | null }>()
        if (customersData) {
          customersData.forEach((c: { id: string; name?: string; language?: string | null }) => {
            customerById.set(c.id, { name: c.name ?? '', language: c.language ?? null })
          })
        }
        const rezById = new Map<string, { id: string; customer_id?: string }>()
        rezList.forEach((r) => rezById.set((r as { id: string }).id, r as { id: string; customer_id?: string }))

        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData?.session?.access_token
        const pricingByResId = new Map<string, { balance_amount: number; currency: string }>()
        if (token) {
          const res = await fetch(`/api/reservation-pricing?reservation_ids=${encodeURIComponent(ids.join(','))}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (res.ok) {
            const json = await res.json()
            const items = json.items as Array<{ reservation_id: string; pricing: { balance_amount?: unknown; currency?: string } | null }> | undefined
            if (Array.isArray(items)) {
              items.forEach(({ reservation_id, pricing }) => {
                const balanceAmount = pricing != null && (pricing.balance_amount !== null && pricing.balance_amount !== undefined)
                  ? (typeof pricing.balance_amount === 'string' ? parseFloat(pricing.balance_amount) || 0 : Number(pricing.balance_amount) || 0)
                  : 0
                pricingByResId.set(reservation_id, { balance_amount: balanceAmount, currency: pricing?.currency ?? 'USD' })
              })
            }
          }
        }

        const results: EnvelopeRow[] = ids.map((id) => {
          const rez = rezById.get(id)
          if (!rez) return { reservationId: id, customerName: '', customerLanguage: null, balanceAmount: 0, currency: 'USD' }
          const customer = rez.customer_id ? customerById.get(rez.customer_id) : null
          const pricing = pricingByResId.get(id)
          const balanceAmount = pricing?.balance_amount ?? 0
          const currency = pricing?.currency ?? 'USD'
          return {
            reservationId: id,
            customerName: customer?.name ?? '',
            customerLanguage: customer?.language ?? null,
            balanceAmount,
            currency,
          }
        })
        setRows(results)
        if (variant === 'balance') {
          setSelectedReservationIds(new Set(results.filter((r) => r.balanceAmount > 0).map((r) => r.reservationId)))
        } else {
          setSelectedReservationIds(new Set(results.map((r) => r.reservationId)))
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [isOpen, reservationIds.join(','), variant])

  const handlePrint = () => {
    const target = document.getElementById('envelope-batch-print')
    if (!target) return
    const clone = target.cloneNode(true) as HTMLElement
    clone.style.background = 'white'
    clone.style.border = 'none'
    clone.style.boxShadow = 'none'
    clone.removeAttribute('id')

    const iframe = document.createElement('iframe')
    iframe.title = 'Envelope Print'
    iframe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;border:none;overflow:hidden;'
    document.body.appendChild(iframe)
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
    if (!iframeDoc) {
      document.body.removeChild(iframe)
      return
    }
    iframeDoc.open()
    iframeDoc.write(`
      <!DOCTYPE html><html><head><meta charset="utf-8"><title>Tour Envelope</title>
      <style>${getPrintStyles()}</style>
      </head><body>${clone.outerHTML}</body></html>`)
    iframeDoc.close()

    const printWin = iframe.contentWindow
    if (printWin) {
      printWin.onload = () => {
        printWin.focus()
        setTimeout(() => {
          printWin.print()
          document.body.removeChild(iframe)
        }, 250)
      }
    } else {
      document.body.removeChild(iframe)
    }
  }

  if (!isOpen) return null

  const balanceBlockStyle = {
    pointerEvents: 'none' as const,
    left: `${BALANCE_BLOCK_LEFT_MM}mm`,
    top: `${BALANCE_BLOCK_TOP_MM}mm`,
    width: `${BALANCE_BLOCK_WIDTH_MM}mm`,
    minWidth: `${BALANCE_BLOCK_WIDTH_MM}mm`,
    transform: 'rotate(90deg)',
    transformOrigin: 'left top',
    fontFamily: 'Arial, Helvetica, sans-serif',
    fontSize: '18px',
    lineHeight: 2,
    color: '#111827',
    paddingLeft: '4mm',
    paddingRight: '4mm',
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
                  <button type="button" onClick={() => setSelectedReservationIds(new Set(displayRows.map((r) => r.reservationId)))} className="text-xs text-blue-600 hover:underline">
                    {L.selectAll}
                  </button>
                  <span className="text-gray-300">|</span>
                  <button type="button" onClick={() => setSelectedReservationIds(new Set())} className="text-xs text-gray-500 hover:underline">
                    {L.deselectAll}
                  </button>
                </div>
                <div className="max-h-32 overflow-y-auto border border-gray-200 rounded p-2 space-y-1">
                  {displayRows.map((row) => (
                    <label key={row.reservationId} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5">
                      <input
                        type="checkbox"
                        checked={selectedReservationIds.has(row.reservationId)}
                        onChange={(e) => {
                          const next = new Set(selectedReservationIds)
                          if (e.target.checked) next.add(row.reservationId)
                          else next.delete(row.reservationId)
                          setSelectedReservationIds(next)
                        }}
                        className="rounded text-blue-600"
                      />
                      <span className="text-sm truncate">{row.customerName || '—'}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2 mb-3">
                <span className="text-sm font-medium text-gray-700">{L.printMode}</span>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="envelope-print-mode" checked={printWithImage} onChange={() => setPrintWithImage(true)} className="text-blue-600" />
                  <span className="text-sm">{L.withImage}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="envelope-print-mode" checked={!printWithImage} onChange={() => setPrintWithImage(false)} className="text-blue-600" />
                  <span className="text-sm">{L.textOnly}</span>
                </label>
              </div>

              <div className="border-t border-gray-200 pt-6 mt-8 flex flex-col gap-2">
                <span className="text-sm font-medium text-gray-600">{L.preview}</span>
                <div className={variant === 'balance' ? 'flex justify-center overflow-x-auto overflow-visible' : ''}>
                  <div id="envelope-batch-print" className="space-y-0">
                  {rows.filter((row) => selectedReservationIds.has(row.reservationId)).map((row) => (
                    <div
                      key={row.reservationId}
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
                          className="absolute inset-0 w-full h-full object-contain object-center z-0 pointer-events-none"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                      )}
                      {variant === 'balance' ? (
                        <div className="envelope-balance-block absolute z-10 flex flex-col flex-shrink-0" style={balanceBlockStyle}>
                          <div style={{ display: 'flex', gap: '6px', minHeight: '2em' }}>
                            <span style={{ flexShrink: 0, fontWeight: 600 }}>NAME :</span>
                            <span className="break-words">{row.customerName || '—'}</span>
                          </div>
                          <div style={{ display: 'flex', gap: '6px', minHeight: '2em', alignItems: 'flex-start' }}>
                            <span style={{ flexShrink: 0, fontWeight: 600 }}>TOUR :</span>
                            <span className="break-words" style={{ minWidth: 0 }}>{formatDateForEnvelope(tourDate)} {(isCustomerEnglish(row.customerLanguage) ? productNameEn : productNameKo) || '—'}</span>
                          </div>
                          <div style={{ display: 'flex', gap: '6px', minHeight: '2em' }}>
                            <span style={{ flexShrink: 0, fontWeight: 600 }}>TOUR GUIDE :</span>
                            <span className="break-words">{(isCustomerEnglish(row.customerLanguage) ? guideAndAssistantEn : guideAndAssistantKo) || '—'}</span>
                          </div>
                          <div style={{ display: 'flex', gap: '6px', minHeight: '2em' }}>
                            <span style={{ flexShrink: 0, fontWeight: 600 }}>BALANCE :</span>
                            <span className="break-words">{formatMoney(row.balanceAmount, row.currency)}</span>
                          </div>
                        </div>
                      ) : (
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
                              <span style={{ flexShrink: 0, fontWeight: 600 }}>{isCustomerEnglish(row.customerLanguage) ? LABELS.en.tourLabel : LABELS.ko.tourLabel}</span>
                              <span style={{ whiteSpace: 'nowrap', overflow: 'visible' }}>{formatDateForEnvelope(tourDate)} {(isCustomerEnglish(row.customerLanguage) ? productNameEn : productNameKo) || '—'}</span>
                            </div>
                            <div style={{ display: 'flex', gap: '4px', minHeight: '1.9em', alignItems: 'flex-start' }}>
                              <span style={{ flexShrink: 0, fontWeight: 600 }}>{isCustomerEnglish(row.customerLanguage) ? LABELS.en.tourGuideLabel : LABELS.ko.tourGuideLabel}</span>
                              <span>{(isCustomerEnglish(row.customerLanguage) ? guideAndAssistantEn : guideAndAssistantKo) || '—'}</span>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
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
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
