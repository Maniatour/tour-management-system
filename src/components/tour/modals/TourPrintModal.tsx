'use client'

import { useEffect, useMemo, useState } from 'react'
import { X, Printer } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fetchReservationOptionLinesBatch } from '@/lib/reservationOptionsForEmail'
import { getBalanceAmountForDisplay } from '@/utils/reservationPricingBalance'

// ---------------------------------------------------------------------------
// 타입
// ---------------------------------------------------------------------------

export interface PrintReservation {
  id: string
  customer_id: string | null
  pickup_hotel: string | null
  pickup_time: string | null
  adults?: number | null
  child?: number | null
  children?: number | null
  infant?: number | null
  infants?: number | null
  status?: string | null
}

export interface PrintPickupHotel {
  id: string
  hotel: string
  pick_up_location?: string
}

export interface PrintTicketBooking {
  id: string
  company?: string | null
  category?: string | null
  check_in_date?: string | null
  time?: string | null
  ea?: number | null
  reservation_id?: string | null
  rn_number?: string | null
  bookingDetails?: Array<{
    check_in_date: string | null
    time: string | null
    ea: number
    reservation_id: string | null
    rn_number: string | null
  }>
}

export interface PrintHotelBooking {
  id: string
  hotel?: string | null
  room_type?: string | null
  rooms?: number | null
  check_in_date?: string | null
  check_out_date?: string | null
  rn_number?: string | null
  booking_reference?: string | null
  reservation_name?: string | null
}

export interface TourPrintModalProps {
  isOpen: boolean
  onClose: () => void
  locale?: string
  tourDate: string
  productNameKo: string
  productNameEn: string
  /** 가이드 표시명 */
  guideName: string | null
  /** 팀 타입 (2차 가이드/드라이버 라벨 현지화에 사용) */
  teamType?: '1guide' | '2guide' | 'guide+driver' | string | null
  /** 2차 가이드 / 드라이버 표시명 */
  secondMemberName: string | null
  /** 차량 정보 표시명 */
  vehicleLabel: string | null
  assignedReservations: PrintReservation[]
  pickupHotels: PrintPickupHotel[]
  getCustomerName: (customerId: string) => string
  ticketBookings: PrintTicketBooking[]
  tourHotelBookings: PrintHotelBooking[]
}

// ---------------------------------------------------------------------------
// 유틸
// ---------------------------------------------------------------------------

function formatMoney(amount: number): string {
  if (!amount || amount <= 0) return '$0'
  return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function getPeopleCount(r: PrintReservation): { total: number; adults: number; children: number; infants: number } {
  const adults = Number(r.adults || 0)
  const children = Number(r.children ?? r.child ?? 0)
  const infants = Number(r.infants ?? r.infant ?? 0)
  return { total: adults + children + infants, adults, children, infants }
}

function formatTimeHm(raw: string | null | undefined): string {
  if (!raw) return ''
  return typeof raw === 'string' ? raw.substring(0, 5) : String(raw)
}

function formatYmd(raw: string | null | undefined): string {
  if (raw == null || String(raw).trim() === '') return ''
  const s = String(raw).trim()
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : s
}

/** 오후 9시 이후 픽업은 전날 새벽으로 취급하여 정렬 */
function pickupSortValue(time: string | null): number {
  if (!time) return Number.MAX_SAFE_INTEGER
  const [h, m] = time.split(':').map(Number)
  const minutes = (h || 0) * 60 + (m || 0)
  const reference = 21 * 60
  // 21시 이후는 음수로 만들어 가장 앞으로
  return minutes >= reference ? minutes - 24 * 60 : minutes
}

// ---------------------------------------------------------------------------
// 인쇄용 스타일 (Letter)
// ---------------------------------------------------------------------------

/**
 * 클래스 전용 스타일. 모든 규칙을 `.tp-root` 스코프로 한정해 미리보기에서 인라인 주입해도
 * 앱 전역(html/body 등)에 영향을 주지 않도록 한다.
 */
function getScopedStyles(): string {
  return `
    .tp-root { width: 100%; color: #111; font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', Arial, sans-serif; }
    .tp-root *, .tp-root *::before, .tp-root *::after { box-sizing: border-box; }
    .tp-root h1.tp-title { font-size: 30px; font-weight: 800; margin: 0 0 4px; }
    .tp-root .tp-subtitle { font-size: 20px; font-weight: 600; color: #374151; margin: 0 0 18px; }
    .tp-root section.tp-section { margin-bottom: 26px; page-break-inside: avoid; }
    .tp-root h2.tp-h2 { font-size: 24px; font-weight: 800; margin: 0 0 12px; padding-bottom: 6px; border-bottom: 3px solid #111; }
    .tp-root .tp-team-grid { display: flex; flex-wrap: wrap; gap: 10px 28px; }
    .tp-root .tp-team-item { font-size: 22px; font-weight: 600; }
    .tp-root .tp-team-item .tp-label { color: #6b7280; font-weight: 600; margin-right: 8px; }
    .tp-root .tp-total-balance { font-size: 26px; font-weight: 800; margin-top: 10px; }
    .tp-root .tp-total-balance .tp-amt { color: #047857; }
    .tp-root .tp-hotel { margin-bottom: 16px; page-break-inside: avoid; border: 2px solid #d1d5db; border-radius: 8px; padding: 12px 14px; }
    .tp-root .tp-hotel-head { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
    .tp-root .tp-hotel-time { font-size: 26px; font-weight: 800; color: #1d4ed8; }
    .tp-root .tp-hotel-name { font-size: 24px; font-weight: 800; }
    .tp-root .tp-hotel-people { font-size: 20px; font-weight: 700; color: #1d4ed8; }
    .tp-root .tp-hotel-loc { font-size: 18px; color: #4b5563; margin: 4px 0 10px; }
    .tp-root .tp-pax-row { display: flex; justify-content: space-between; align-items: baseline; font-size: 20px; padding: 6px 0; border-top: 1px dashed #d1d5db; }
    .tp-root .tp-pax-row:first-of-type { border-top: none; }
    .tp-root .tp-pax-name { font-weight: 700; }
    .tp-root .tp-pax-meta { display: flex; gap: 18px; align-items: baseline; }
    .tp-root .tp-pax-people { color: #374151; font-weight: 600; }
    .tp-root .tp-pax-balance { font-weight: 800; color: #047857; min-width: 90px; text-align: right; }
    .tp-root table.tp-table { width: 100%; border-collapse: collapse; font-size: 20px; }
    .tp-root table.tp-table th, .tp-root table.tp-table td { border: 1px solid #9ca3af; padding: 8px 10px; text-align: left; }
    .tp-root table.tp-table th { background: #f3f4f6; font-weight: 800; font-size: 19px; }
    .tp-root table.tp-table td.tp-num { font-family: ui-monospace, Menlo, monospace; }
    .tp-root .tp-empty { font-size: 18px; color: #6b7280; }
  `
}

/** 인쇄(iframe) 전용: 전역 리셋 + @page + 스코프 스타일 */
function getPrintStyles(): string {
  return `
    html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
    @page { size: letter; margin: 12mm; }
    ${getScopedStyles()}
  `
}

// ---------------------------------------------------------------------------
// 컴포넌트
// ---------------------------------------------------------------------------

export default function TourPrintModal({
  isOpen,
  onClose,
  locale = 'ko',
  tourDate,
  productNameKo,
  productNameEn,
  guideName,
  teamType,
  secondMemberName,
  vehicleLabel,
  assignedReservations,
  pickupHotels,
  getCustomerName,
  ticketBookings,
  tourHotelBookings,
}: TourPrintModalProps) {
  const [balanceByResId, setBalanceByResId] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(false)
  const [printLang, setPrintLang] = useState<'ko' | 'en'>(locale === 'en' ? 'en' : 'ko')

  // 모달이 열릴 때 현재 locale로 초기화
  useEffect(() => {
    if (isOpen) setPrintLang(locale === 'en' ? 'en' : 'ko')
  }, [isOpen, locale])

  const isKo = printLang === 'ko'
  const productName = isKo
    ? productNameKo || productNameEn
    : productNameEn || productNameKo

  const secondMemberLabel =
    teamType === 'guide+driver'
      ? isKo
        ? '드라이버'
        : 'Driver'
      : teamType === '2guide'
        ? isKo
          ? '2차 가이드'
          : '2nd Guide'
        : isKo
          ? '어시스턴트'
          : 'Assistant'
  const L = useMemo(
    () => ({
      title: isKo ? '투어 정보' : 'Tour Information',
      teamSection: isKo ? '팀 구성 & 차량 배정' : 'Team & Vehicle',
      guide: isKo ? '가이드' : 'Guide',
      vehicle: isKo ? '차량' : 'Vehicle',
      totalBalance: isKo ? '총 투어 잔금' : 'Total Balance',
      pickupSection: isKo ? '픽업 스케줄' : 'Pickup Schedule',
      bookingSection: isKo ? '부킹 관리' : 'Booking Management',
      people: isKo ? '명' : 'pax',
      noPickup: isKo ? '배정된 픽업 정보가 없습니다.' : 'No pickup schedule.',
      noBooking: isKo ? '부킹 정보가 없습니다.' : 'No bookings.',
      company: isKo ? '업체' : 'Company',
      date: isKo ? '날짜' : 'Date',
      time: isKo ? '시간' : 'Time',
      count: isKo ? '인원' : 'Pax',
      resNo: isKo ? '예약 번호' : 'Reservation No.',
      hotel: isKo ? '호텔' : 'Hotel',
      checkInOut: isKo ? '체크인/아웃' : 'Check-in/out',
      print: isKo ? '인쇄' : 'Print',
      close: isKo ? '닫기' : 'Close',
      loading: isKo ? '잔금 정보를 불러오는 중...' : 'Loading balance...',
    }),
    [isKo]
  )

  // 잔금 정보 로드
  useEffect(() => {
    if (!isOpen) return
    const ids = [...new Set(assignedReservations.map((r) => r.id).filter(Boolean))]
    if (ids.length === 0) {
      setBalanceByResId(new Map())
      return
    }
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const { data: rezList } = await supabase
          .from('reservations')
          .select('id, adults, child, infant, status')
          .in('id', ids)
        type RezRow = { id: string; adults?: number; child?: number; infant?: number; status?: string | null }
        const rezById = new Map<string, RezRow>()
        ;(rezList || []).forEach((r) => rezById.set((r as RezRow).id, r as RezRow))

        // 가격 정보 (잔금)
        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData?.session?.access_token
        const pricingByResId = new Map<string, Record<string, unknown> | null>()
        if (token) {
          const res = await fetch(
            `/api/reservation-pricing?reservation_ids=${encodeURIComponent(ids.join(','))}`,
            { headers: { Authorization: `Bearer ${token}` } }
          )
          if (res.ok) {
            const json = await res.json()
            const items = json.items as
              | Array<{ reservation_id: string; pricing: Record<string, unknown> | null }>
              | undefined
            if (Array.isArray(items)) {
              items.forEach(({ reservation_id, pricing }) => {
                pricingByResId.set(reservation_id, pricing && typeof pricing === 'object' ? pricing : null)
              })
            }
          }
        }

        const optionLinesByResId = await fetchReservationOptionLinesBatch(supabase, ids)
        const optionsTotalByResId = new Map<string, number | null>()
        for (const id of ids) {
          const lines = optionLinesByResId.get(id) || []
          optionsTotalByResId.set(
            id,
            lines.length ? lines.reduce((s, o) => s + (Number(o.lineTotal) || 0), 0) : null
          )
        }

        const { data: payRows } = await supabase
          .from('payment_records')
          .select('reservation_id, amount, payment_status')
          .in('reservation_id', ids)
        const paymentsByResId = new Map<string, Array<{ payment_status: string; amount: number }>>()
        for (const r of payRows || []) {
          const row = r as { reservation_id: string; amount?: unknown; payment_status?: string | null }
          const list = paymentsByResId.get(row.reservation_id) || []
          list.push({ payment_status: row.payment_status || '', amount: Number(row.amount) || 0 })
          paymentsByResId.set(row.reservation_id, list)
        }

        const map = new Map<string, number>()
        for (const id of ids) {
          const rez = rezById.get(id)
          const pricing = pricingByResId.get(id) ?? null
          const optionsSum = optionsTotalByResId.get(id) ?? null
          const balance = getBalanceAmountForDisplay(
            pricing,
            optionsSum,
            {
              adults: rez?.adults ?? null,
              child: rez?.child ?? null,
              infant: rez?.infant ?? null,
            },
            {
              paymentRecords: paymentsByResId.get(id) ?? [],
              reservationStatus: rez?.status ?? null,
            }
          )
          map.set(id, balance)
        }
        if (!cancelled) setBalanceByResId(map)
      } catch (e) {
        console.error('[TourPrintModal] 잔금 로드 오류:', e)
        if (!cancelled) setBalanceByResId(new Map())
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [isOpen, assignedReservations])

  // 픽업 호텔별 그룹화 + 정렬
  const pickupGroups = useMemo(() => {
    const groups = new Map<string, PrintReservation[]>()
    for (const r of assignedReservations) {
      const key = r.pickup_hotel || ''
      if (!key) continue
      const list = groups.get(key) || []
      list.push(r)
      groups.set(key, list)
    }
    const result = [...groups.entries()].map(([hotelId, list]) => {
      const sorted = [...list].sort((a, b) => pickupSortValue(a.pickup_time) - pickupSortValue(b.pickup_time))
      const hotel = pickupHotels.find((h) => h.id === hotelId)
      const totalPeople = sorted.reduce((s, r) => s + getPeopleCount(r).total, 0)
      return {
        hotelId,
        hotelName: hotel?.hotel || hotelId,
        location: hotel?.pick_up_location || '',
        earliestTime: formatTimeHm(sorted[0]?.pickup_time) || '',
        reservations: sorted,
        totalPeople,
      }
    })
    return result.sort(
      (a, b) =>
        pickupSortValue(a.reservations[0]?.pickup_time || null) -
        pickupSortValue(b.reservations[0]?.pickup_time || null)
    )
  }, [assignedReservations, pickupHotels])

  const totalTourBalance = useMemo(() => {
    let sum = 0
    for (const r of assignedReservations) {
      sum += balanceByResId.get(r.id) || 0
    }
    return sum
  }, [assignedReservations, balanceByResId])

  // 부킹 관리: 입장권은 bookingDetails(집계) 우선, 없으면 단건
  const ticketRows = useMemo(() => {
    const rows: Array<{
      company: string
      date: string
      time: string
      ea: number
      resNo: string
    }> = []
    for (const b of ticketBookings) {
      const company = b.company || 'N/A'
      if (b.bookingDetails && b.bookingDetails.length > 0) {
        for (const d of b.bookingDetails) {
          rows.push({
            company,
            date: formatYmd(d.check_in_date),
            time: formatTimeHm(d.time),
            ea: Number(d.ea || 0),
            resNo: (d.reservation_id || d.rn_number || '').toString(),
          })
        }
      } else {
        rows.push({
          company,
          date: formatYmd(b.check_in_date),
          time: formatTimeHm(b.time),
          ea: Number(b.ea || 0),
          resNo: (b.reservation_id || b.rn_number || '').toString(),
        })
      }
    }
    return rows
  }, [ticketBookings])

  const handlePrint = () => {
    const target = document.getElementById('tour-print-content')
    if (!target) return
    const clone = target.cloneNode(true) as HTMLElement
    clone.removeAttribute('id')

    // Letter 인쇄 영역(96dpi 기준): 8.5" x 11", 여백 12mm
    const DPI = 96
    const MARGIN_MM = 12
    const mmToPx = (mm: number) => (mm * DPI) / 25.4
    const availW = Math.round(8.5 * DPI - 2 * mmToPx(MARGIN_MM))
    const availH = Math.round(11 * DPI - 2 * mmToPx(MARGIN_MM))

    const iframe = document.createElement('iframe')
    iframe.title = 'Tour Print'
    // 측정 가능하도록 실제 크기를 주되 화면 밖에 배치
    iframe.style.cssText =
      'position:fixed;left:-10000px;top:0;width:816px;height:1056px;border:none;overflow:hidden;'
    document.body.appendChild(iframe)
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
    if (!iframeDoc) {
      document.body.removeChild(iframe)
      return
    }
    iframeDoc.open()
    iframeDoc.write(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${productName} - ${tourDate}</title>` +
        `<style>${getPrintStyles()}</style></head><body>` +
        `<div id="tp-fit" style="width:${availW}px;">${clone.innerHTML}</div>` +
        `</body></html>`
    )
    iframeDoc.close()

    const printWin = iframe.contentWindow
    if (printWin) {
      printWin.onload = () => {
        // 내용 높이를 측정해 한 페이지(Letter)에 맞게 축소
        // (transform이 아닌 zoom: Chromium에서 레이아웃·인쇄 페이지 분할에 실제 반영됨)
        const fit = iframeDoc.getElementById('tp-fit')
        if (fit) {
          const contentH = fit.scrollHeight
          // 6px 안전 여백을 두어 반올림으로 2페이지로 넘어가는 것 방지
          if (contentH > availH - 6) {
            const scale = Math.max(0.4, (availH - 6) / contentH)
            ;(fit.style as CSSStyleDeclaration & { zoom?: string }).zoom = String(scale)
          }
        }
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
      <div className="bg-white rounded-lg shadow-xl w-full max-w-[820px] max-h-[92vh] overflow-hidden flex flex-col">
        <header className="flex items-center justify-between p-4 border-b flex-shrink-0">
          <h2 className="text-lg font-bold text-gray-900">{L.title}</h2>
          <div className="flex items-center gap-3">
            {/* 언어 선택 토글 */}
            <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden text-sm">
              <button
                type="button"
                onClick={() => setPrintLang('ko')}
                className={`px-3 py-1.5 font-medium transition-colors ${
                  isKo ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                한글
              </button>
              <button
                type="button"
                onClick={() => setPrintLang('en')}
                className={`px-3 py-1.5 font-medium transition-colors ${
                  !isKo ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                English
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 bg-gray-100">
          {loading && <p className="text-sm text-gray-500 mb-3">{L.loading}</p>}

          {/* 인쇄 콘텐츠 (미리보기 겸용) */}
          <div
            id="tour-print-content"
            className="bg-white mx-auto shadow"
            style={{ width: '100%', maxWidth: '720px', padding: '28px 32px' }}
          >
            <style>{getScopedStyles()}</style>
            <div className="tp-root">
              <h1 className="tp-title">{productName || L.title}</h1>
              <p className="tp-subtitle">{tourDate}</p>

              {/* 팀 구성 & 차량 배정 + 총 잔금 */}
              <section className="tp-section">
                <h2 className="tp-h2">{L.teamSection}</h2>
                <div className="tp-team-grid">
                  <div className="tp-team-item">
                    <span className="tp-label">{L.guide}</span>
                    {guideName || '—'}
                  </div>
                  {secondMemberName && (
                    <div className="tp-team-item">
                      <span className="tp-label">{secondMemberLabel}</span>
                      {secondMemberName}
                    </div>
                  )}
                  <div className="tp-team-item">
                    <span className="tp-label">{L.vehicle}</span>
                    {vehicleLabel || '—'}
                  </div>
                </div>
                <div className="tp-total-balance">
                  {L.totalBalance} : <span className="tp-amt">{formatMoney(totalTourBalance)}</span>
                </div>
              </section>

              {/* 픽업 스케줄 */}
              <section className="tp-section">
                <h2 className="tp-h2">{L.pickupSection}</h2>
                {pickupGroups.length === 0 ? (
                  <p className="tp-empty">{L.noPickup}</p>
                ) : (
                  pickupGroups.map((g) => (
                    <div key={g.hotelId} className="tp-hotel">
                      <div className="tp-hotel-head">
                        <span className="tp-hotel-time">{g.earliestTime}</span>
                        <span className="tp-hotel-name">{g.hotelName}</span>
                        <span className="tp-hotel-people">
                          {g.totalPeople}
                          {L.people}
                        </span>
                      </div>
                      {g.location && <div className="tp-hotel-loc">{g.location}</div>}
                      {g.reservations.map((r) => {
                        const pc = getPeopleCount(r)
                        const balance = balanceByResId.get(r.id) || 0
                        return (
                          <div key={r.id} className="tp-pax-row">
                            <span className="tp-pax-name">
                              {getCustomerName(r.customer_id || '') || '—'}
                            </span>
                            <span className="tp-pax-meta">
                              <span className="tp-pax-people">
                                {pc.total}
                                {L.people}
                              </span>
                              <span className="tp-pax-balance">{formatMoney(balance)}</span>
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  ))
                )}
              </section>

              {/* 부킹 관리 */}
              <section className="tp-section">
                <h2 className="tp-h2">{L.bookingSection}</h2>
                {ticketRows.length === 0 && tourHotelBookings.length === 0 ? (
                  <p className="tp-empty">{L.noBooking}</p>
                ) : (
                  <>
                    {ticketRows.length > 0 && (
                      <table className="tp-table" style={{ marginBottom: tourHotelBookings.length > 0 ? '16px' : 0 }}>
                        <thead>
                          <tr>
                            <th>{L.company}</th>
                            <th>{L.date}</th>
                            <th>{L.time}</th>
                            <th>{L.count}</th>
                            <th>{L.resNo}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ticketRows.map((row, i) => (
                            <tr key={i}>
                              <td>{row.company}</td>
                              <td>{row.date || '—'}</td>
                              <td>{row.time || '—'}</td>
                              <td>
                                {row.ea}
                                {L.people}
                              </td>
                              <td className="tp-num">{row.resNo || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    {tourHotelBookings.length > 0 && (
                      <table className="tp-table">
                        <thead>
                          <tr>
                            <th>{L.hotel}</th>
                            <th>{L.checkInOut}</th>
                            <th>{L.resNo}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tourHotelBookings.map((b) => (
                            <tr key={b.id}>
                              <td>
                                {b.hotel || '—'}
                                {b.room_type ? ` (${b.room_type}${b.rooms ? `, ${b.rooms}` : ''})` : ''}
                              </td>
                              <td>
                                {formatYmd(b.check_in_date) || '—'} ~ {formatYmd(b.check_out_date) || '—'}
                              </td>
                              <td className="tp-num">{b.rn_number || b.booking_reference || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </>
                )}
              </section>
            </div>
          </div>
        </div>

        <footer className="p-4 border-t flex justify-end gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            {L.print}
          </button>
          <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300">
            {L.close}
          </button>
        </footer>
      </div>
    </div>
  )
}
