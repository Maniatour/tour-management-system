'use client'

import React, { useEffect, useState } from 'react'
import { X, Printer } from 'lucide-react'
import { supabase } from '@/lib/supabase'

/** 봉투 1장당 데이터 (고객명, 잔금, 고객 언어 등) */
export type EnvelopeRow = {
  reservationId: string
  customerName: string
  customerLanguage: string | null
  balanceAmount: number
  currency: string
}

function formatMoney(amount: number, currency: string): string {
  if (currency === 'KRW') return `₩${Math.round(amount).toLocaleString()}`
  return `$${amount.toFixed(2)}`
}

/** 봉투 크기: 3 5/8" x 6 1/2" (인치) → mm */
const ENVELOPE_WIDTH_MM = 3.625 * 25.4   // 92.075
const ENVELOPE_HEIGHT_MM = 6.5 * 25.4   // 165.1

/** 봉투 인쇄용 이미지 URL: .env.local에 NEXT_PUBLIC_ENVELOPE_IMAGE_URL 설정 또는 public/envelope-image.png 사용 */
const ENVELOPE_IMAGE_URL =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_ENVELOPE_IMAGE_URL) ||
  '/envelope-image.png'

const labels = {
  ko: {
    title: '투어 봉투 인쇄',
    print: '인쇄',
    close: '닫기',
    printMode: '인쇄 방식',
    withImage: '이미지와 함께 인쇄',
    textOnly: '글자만 인쇄 (이미 인쇄된 봉투용)',
    selectCustomers: '인쇄할 고객 선택',
    selectAll: '전체 선택',
    deselectAll: '전체 해제',
  },
  en: {
    title: 'Tour Envelope Print',
    print: 'Print',
    close: 'Close',
    printMode: 'Print mode',
    withImage: 'Print with image',
    textOnly: 'Text only (for pre-printed envelopes)',
    selectCustomers: 'Select customers to print',
    selectAll: 'Select all',
    deselectAll: 'Deselect all',
  },
}

/** 날짜를 YYYY.MM.DD 형식으로 (봉투 표기용) */
function formatDateForEnvelope(dateStr: string): string {
  if (!dateStr) return ''
  return dateStr.replace(/-/g, '.')
}

interface TourEnvelopeModalProps {
  isOpen: boolean
  onClose: () => void
  /** 예약 ID 목록 (봉투는 예약별 1장) */
  reservationIds: string[]
  /** 투어 날짜 */
  tourDate: string
  /** 투어(상품) 이름 - 한글 (고객 언어가 한글일 때 사용) */
  productNameKo: string
  /** 투어(상품) 이름 - 영문 (고객 언어가 영문일 때 사용) */
  productNameEn: string
  /** 가이드 & 어시스턴트 표시 - 한글 */
  guideAndAssistantKo: string
  /** 가이드 & 어시스턴트 표시 - 영문 */
  guideAndAssistantEn: string
  locale?: string
}

function isCustomerEnglish(lang: string | null | undefined): boolean {
  if (!lang) return false
  const l = lang.toString().toLowerCase()
  return l === 'en' || l.startsWith('en-') || l === 'english'
}

export default function TourEnvelopeModal({
  isOpen,
  onClose,
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
  /** true: 이미지+글자, false: 글자만(이미 인쇄된 봉투용) */
  const [printWithImage, setPrintWithImage] = useState(true)
  /** 인쇄할 예약 ID 집합 (기본: 전체) */
  const [selectedReservationIds, setSelectedReservationIds] = useState<Set<string>>(new Set())
  const L = locale === 'ko' ? labels.ko : labels.en

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
          if (!rez) {
            return { reservationId: id, customerName: '', customerLanguage: null, balanceAmount: 0, currency: 'USD' }
          }
          const customerId = rez.customer_id
          const customer = customerId ? customerById.get(customerId) : null
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
        setSelectedReservationIds(new Set(results.map((r) => r.reservationId)))
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [isOpen, reservationIds.join(',')])

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

    const printStyles = `
      *, *::before, *::after { box-sizing: border-box; }
      html, body { margin: 0 !important; padding: 0 !important; background: white !important; font-family: Arial, Helvetica, sans-serif !important; -webkit-font-smoothing: antialiased; text-rendering: geometricPrecision; }
      body * { font-family: Arial, Helvetica, sans-serif !important; }
      .absolute { position: absolute !important; }
      .relative { position: relative !important; }
      .flex { display: flex !important; }
      .flex-col { flex-direction: column !important; }
      .items-center { align-items: center !important; }
      .justify-center { justify-content: center !important; }
      .flex-shrink-0 { flex-shrink: 0 !important; }
      .z-0 { z-index: 0 !important; }
      .z-10 { z-index: 10 !important; }
      .inset-0 { top:0!important;right:0!important;bottom:0!important;left:0!important; }
      .w-full { width: 100% !important; }
      .h-full { height: 100% !important; }
      .object-contain { object-fit: contain !important; }
      .object-center { object-position: center !important; }
      .pointer-events-none { pointer-events: none !important; }
      .text-center { text-align: center !important; }
      .font-semibold { font-weight: 600 !important; }
      .text-xl { font-size: 1.25rem !important; }
      .leading-tight { line-height: 1.25 !important; }
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
        body, body *, .envelope-sheet, .envelope-sheet * { font-family: Arial, Helvetica, sans-serif !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; -webkit-font-smoothing: antialiased; text-rendering: geometricPrecision; }
      }
    `
    iframeDoc.open()
    iframeDoc.write(`
      <!DOCTYPE html><html><head><meta charset="utf-8"><title>Tour Envelope</title>
      <style>${printStyles}</style>
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-[min(95vw,520px)] max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
          <h2 className="text-lg font-bold text-gray-900">{L.title}</h2>
          <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 min-w-0">
          {loading && <p className="text-gray-500 py-4">로딩 중...</p>}
          {error && <p className="text-red-600 py-4">{error}</p>}
          {!loading && !error && rows.length === 0 && <p className="text-gray-500 py-4">예약이 없습니다.</p>}
          {!loading && !error && rows.length > 0 && (
            <>
              <p className="text-sm text-gray-600 mb-3">
                {selectedReservationIds.size > 0 ? `${selectedReservationIds.size}장 인쇄` : '인쇄할 고객을 선택하세요'} (3 5/8" × 6 1/2" 봉투)
              </p>
              <div className="flex flex-col gap-2 mb-3">
                <span className="text-sm font-medium text-gray-700">{L.selectCustomers}</span>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setSelectedReservationIds(new Set(rows.map((r) => r.reservationId)))} className="text-xs text-blue-600 hover:underline">
                    {L.selectAll}
                  </button>
                  <span className="text-gray-300">|</span>
                  <button type="button" onClick={() => setSelectedReservationIds(new Set())} className="text-xs text-gray-500 hover:underline">
                    {L.deselectAll}
                  </button>
                </div>
                <div className="max-h-32 overflow-y-auto border border-gray-200 rounded p-2 space-y-1">
                  {rows.map((row) => (
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
                  <input
                    type="radio"
                    name="envelope-print-mode"
                    checked={printWithImage}
                    onChange={() => setPrintWithImage(true)}
                    className="text-blue-600"
                  />
                  <span className="text-sm">{L.withImage}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="envelope-print-mode"
                    checked={!printWithImage}
                    onChange={() => setPrintWithImage(false)}
                    className="text-blue-600"
                  />
                  <span className="text-sm">{L.textOnly}</span>
                </label>
              </div>
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
                    {/* 전체 봉투 배경 이미지 (fit) - '글자만' 선택 시 미표시 */}
                    {printWithImage && (
                      <img
                        src={ENVELOPE_IMAGE_URL}
                        alt=""
                        className="absolute inset-0 w-full h-full object-contain object-center z-0 pointer-events-none"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                    )}
                    {/* 고객명: 고정 크기·위치로 모든 봉투 동일 배치, 시계 방향 90도 회전 */}
                    <div
                      className="absolute z-10 flex items-center justify-center flex-shrink-0"
                      style={{
                        pointerEvents: 'none',
                        right: '-13mm',
                        top: '28%',
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
                    {/* Tour / Tour guide / Balance: 봉투 왼쪽, 라벨 옆에 값 배치, 시계 방향 90도 회전 */}
                    <div
                      className="absolute z-10 flex items-center flex-shrink-0"
                      style={{
                        pointerEvents: 'none',
                        left: '-16mm',
                        top: '49%',
                        width: '75mm',
                        minWidth: '75mm',
                        transform: 'translateY(-50%) rotate(90deg)',
                        transformOrigin: 'center center',
                        fontFamily: 'Arial, Helvetica, sans-serif',
                        fontSize: '11px',
                      }}
                    >
                      <div className="flex flex-col text-gray-900 text-xl flex-shrink-0" style={{ lineHeight: 1.8, width: '100%' }}>
                        <div style={{ minHeight: '1.8em', whiteSpace: 'nowrap', overflow: 'visible' }}>{formatDateForEnvelope(tourDate)} {(isCustomerEnglish(row.customerLanguage) ? productNameEn : productNameKo) || '—'}</div>
                        <div style={{ minHeight: '1.8em' }}>{(isCustomerEnglish(row.customerLanguage) ? guideAndAssistantEn : guideAndAssistantKo) || '—'}</div>
                        <div style={{ minHeight: '1.8em' }}>{formatMoney(row.balanceAmount, row.currency)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        {!loading && !error && rows.length > 0 && (
          <div className="p-4 border-t flex justify-end gap-2 flex-shrink-0">
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
          </div>
        )}
      </div>
    </div>
  )
}
