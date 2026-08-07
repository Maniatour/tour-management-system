'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import {
  BedDouble,
  Building2,
  CalendarRange,
  DollarSign,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  TriangleAlert,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { HotelSupplierCode } from '@/lib/hotels/types'
import {
  HotelManagementHelpButton,
  HotelManagementHelpModal,
} from '@/components/hotels/HotelManagementHelpModal'

type TabId = 'catalog' | 'rates' | 'reservations' | 'assignments' | 'alerts'

type HotelRow = {
  hotel_id: string
  supplier: string
  supplier_hotel_id: string
  name: string
  city: string | null
  state: string | null
  is_active: boolean
  metadata_source: string | null
}

type RateRow = {
  rate_id: string
  hotel_id: string
  supplier: string
  stay_date: string
  price: number
  currency: string
  checked_at: string
  hotels?: { name: string; city: string | null; state: string | null } | null
}

type ReservationRow = {
  reservation_id: string
  supplier: string
  supplier_confirmation_number: string | null
  hotel_id: string
  check_in: string
  check_out: string
  status: string
  total_cost: number | null
  guest_name: string | null
  hotels?: { name: string } | null
}

type AlertRow = {
  id: string
  message: string
  previous_price: number
  new_price: number
  stay_date: string
  created_at: string
  hotels?: { name: string } | null
}

type AssignmentRow = {
  id: string
  tour_id: string
  reservation_id: string
  assigned_date: string
}

type WyndhamStatus = {
  liveFlag: boolean
  credentialsConfigured: boolean
  playwrightInstalled: boolean
  authStateSaved?: boolean
  authStateAgeMinutes?: number | null
  readyForLive: boolean
  canScrapeRates?: boolean
  mode?: 'public' | 'worker'
  workerUrl?: string | null
  blockers: string[]
  hint: string
}

async function authHeaders(): Promise<HeadersInit> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const headers: HeadersInit = { 'Content-Type': 'application/json' }
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`
  }
  return headers
}

export default function HotelManagementPage() {
  const params = useParams() as { locale?: string }
  const locale = params?.locale || 'ko'
  const [tab, setTab] = useState<TabId>('catalog')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hotels, setHotels] = useState<HotelRow[]>([])
  const [rates, setRates] = useState<RateRow[]>([])
  const [reservations, setReservations] = useState<ReservationRow[]>([])
  const [alerts, setAlerts] = useState<AlertRow[]>([])
  const [assignments, setAssignments] = useState<AssignmentRow[]>([])
  const [helpOpen, setHelpOpen] = useState(false)
  const [wyndhamStatus, setWyndhamStatus] = useState<WyndhamStatus | null>(null)

  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [rateBusyId, setRateBusyId] = useState<string | null>(null)
  const [batchBusy, setBatchBusy] = useState(false)
  const [enrichBusyId, setEnrichBusyId] = useState<string | null>(null)
  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null)

  const [newName, setNewName] = useState('Super 8 by Wyndham Page')
  const [newCity, setNewCity] = useState('Page')
  const [newState, setNewState] = useState('AZ')
  const [newSupplierHotelId, setNewSupplierHotelId] = useState('Super 8 Page AZ')
  const [addBusy, setAddBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any
      const [h, r, res, a, asn] = await Promise.all([
        db.from('hotels').select('*').eq('is_active', true).order('name').limit(200),
        db
          .from('hotel_rates')
          .select('*, hotels(name, city, state)')
          .order('checked_at', { ascending: false })
          .limit(100),
        db
          .from('hotel_reservations')
          .select('*, hotels(name)')
          .order('check_in', { ascending: true })
          .limit(100),
        db
          .from('hotel_price_alerts')
          .select('*, hotels(name)')
          .order('created_at', { ascending: false })
          .limit(50),
        db
          .from('tour_hotel_assignments')
          .select('*')
          .order('assigned_date', { ascending: false })
          .limit(50),
      ])

      if (h.error) throw new Error(h.error.message)
      if (r.error) throw new Error(r.error.message)
      if (res.error) throw new Error(res.error.message)
      if (a.error) throw new Error(a.error.message)
      if (asn.error) throw new Error(asn.error.message)

      setHotels((h.data || []) as HotelRow[])
      setRates((r.data || []) as RateRow[])
      setReservations((res.data || []) as ReservationRow[])
      setAlerts((a.data || []) as AlertRow[])
      setAssignments((asn.data || []) as AssignmentRow[])
    } catch (err) {
      setError(err instanceof Error ? err.message : '데이터 로드 실패')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadWyndhamStatus = useCallback(async () => {
    try {
      const headers = await authHeaders()
      const res = await fetch('/api/hotels/wyndham/status', { headers })
      const json = await res.json()
      if (res.ok) setWyndhamStatus(json.status as WyndhamStatus)
    } catch {
      /* ignore banner errors */
    }
  }, [])

  useEffect(() => {
    void load()
    void loadWyndhamStatus()
  }, [load, loadWyndhamStatus])

  useEffect(() => {
    const today = new Date()
    const inDate = new Date(today)
    inDate.setDate(inDate.getDate() + 14)
    const outDate = new Date(inDate)
    outDate.setDate(outDate.getDate() + 1)
    setCheckIn(inDate.toISOString().slice(0, 10))
    setCheckOut(outDate.toISOString().slice(0, 10))
  }, [])

  async function addHotel() {
    if (!newName.trim() || !newSupplierHotelId.trim()) {
      toast.error('호텔명과 검색용 ID/이름을 입력하세요.')
      return
    }
    setAddBusy(true)
    try {
      const headers = await authHeaders()
      const res = await fetch('/api/hotels', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'upsert',
          supplier: 'wyndham' satisfies HotelSupplierCode,
          name: newName.trim(),
          supplierHotelId: newSupplierHotelId.trim(),
          city: newCity.trim() || undefined,
          state: newState.trim() || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '호텔 추가 실패')
      toast.success(`카탈로그에 추가됨: ${json.hotel?.name || newName}`)
      await load()
      setTab('catalog')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '호텔 추가 실패')
    } finally {
      setAddBusy(false)
    }
  }

  async function fetchMemberRates(hotel: HotelRow) {
    if (!checkIn || !checkOut) {
      toast.error('체크인/체크아웃 날짜를 먼저 선택하세요.')
      return
    }
    setRateBusyId(hotel.hotel_id)
    const toastId = toast.loading(
      `${hotel.name}: 공개 요금 조회 중… (최대 약 2분)`
    )
    const controller = new AbortController()
    const abortTimer = window.setTimeout(() => controller.abort(), 110_000)
    try {
      const headers = await authHeaders()
      // Prefer city/state for Wyndham autocomplete — full hotel names often stall suggestions
      const destination =
        [hotel.city, hotel.state].filter(Boolean).join(' ').trim() ||
        hotel.supplier_hotel_id ||
        hotel.name
      const res = await fetch('/api/hotels/rates', {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          supplier: hotel.supplier,
          hotelId: hotel.hotel_id,
          supplierHotelId: hotel.supplier_hotel_id,
          destination,
          checkIn,
          checkOut,
          rooms: 1,
          guests: 2,
          forceLive: true,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '요금 조회 실패')

      const count = json.quotes?.length ?? json.persisted?.saved ?? 0
      const sample = json.quotes?.[0]
      toast.success(
        sample
          ? `${hotel.name}: ${count}건 저장 · 예) $${Number(sample.price).toFixed(0)} (${sample.roomType || 'rate'})`
          : `${hotel.name}: 요금 ${count}건 저장`,
        { id: toastId }
      )
      await load()
      setTab('rates')
    } catch (err) {
      const aborted =
        err instanceof DOMException && err.name === 'AbortError'
      toast.error(
        aborted
          ? '요금 조회 시간 초과(110초). 다시 시도해 주세요.'
          : err instanceof Error
            ? err.message
            : '요금 조회 실패',
        { id: toastId }
      )
    } finally {
      window.clearTimeout(abortTimer)
      setRateBusyId(null)
    }
  }

  async function fetchAllWyndhamRates() {
    if (!checkIn || !checkOut) {
      toast.error('체크인/체크아웃 날짜를 먼저 선택하세요.')
      return
    }
    const targets = hotels.filter((h) => h.supplier === 'wyndham')
    if (targets.length === 0) {
      toast.error('Wyndham 호텔이 카탈로그에 없습니다.')
      return
    }

    setBatchBusy(true)
    const toastId = toast.loading(
      `주요 Wyndham ${targets.length}곳 요금 일괄 조회 중… (Page·Kanab 목적지별 1회)`
    )
    const controller = new AbortController()
    const abortTimer = window.setTimeout(() => controller.abort(), 170_000)
    try {
      const headers = await authHeaders()
      const res = await fetch('/api/hotels/rates', {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          batch: true,
          forceLive: true,
          checkIn,
          checkOut,
          hotels: targets.map((h) => ({
            hotelId: h.hotel_id,
            supplier: h.supplier,
            supplierHotelId: h.supplier_hotel_id,
            name: h.name,
            city: h.city,
            state: h.state,
          })),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '일괄 요금 조회 실패')

      const ok = json.okCount ?? 0
      const total = json.total ?? targets.length
      const lines = (json.results || [])
        .map(
          (r: {
            name: string
            ok: boolean
            price?: number
            error?: string
          }) =>
            r.ok
              ? `✓ ${r.name}: $${Number(r.price || 0).toFixed(0)}`
              : `✗ ${r.name}: ${r.error || '실패'}`
        )
        .join('\n')

      if (ok === 0) {
        toast.error(`일괄 조회 실패 (0/${total})\n${lines}`, { id: toastId })
      } else {
        toast.success(`일괄 저장 ${ok}/${total}\n${lines}`, { id: toastId })
        await load()
        setTab('rates')
      }
    } catch (err) {
      const aborted = err instanceof DOMException && err.name === 'AbortError'
      toast.error(
        aborted
          ? '일괄 요금 조회 시간 초과. 다시 시도해 주세요.'
          : err instanceof Error
            ? err.message
            : '일괄 요금 조회 실패',
        { id: toastId }
      )
    } finally {
      window.clearTimeout(abortTimer)
      setBatchBusy(false)
    }
  }

  async function enrichHotel(hotelId: string) {
    setEnrichBusyId(hotelId)
    const toastId = toast.loading('StayAPI 메타데이터 조회 중…')
    try {
      const headers = await authHeaders()
      const res = await fetch('/api/hotels', {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'enrich', hotelId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Enrich 실패')

      if (json.status === 'not_configured' || json.status === 'not_found') {
        toast.message(json.message || 'StayAPI 결과 없음', { id: toastId })
      } else {
        toast.success(json.message || '메타데이터 저장됨', { id: toastId })
      }
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Enrich 실패', { id: toastId })
    } finally {
      setEnrichBusyId(null)
    }
  }

  async function removeHotel(hotel: HotelRow) {
    const ok = window.confirm(
      `"${hotel.name}"을(를) 카탈로그에서 제거할까요?\n\n목록에서만 숨깁니다. 이미 가져온 요금·예약 기록은 남습니다.`
    )
    if (!ok) return

    setDeleteBusyId(hotel.hotel_id)
    const toastId = toast.loading(`${hotel.name} 삭제 중…`)
    try {
      const headers = await authHeaders()
      const res = await fetch('/api/hotels', {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'delete', hotelId: hotel.hotel_id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '삭제 실패')
      toast.success(`${hotel.name}을(를) 카탈로그에서 제거했습니다.`, { id: toastId })
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '삭제 실패', { id: toastId })
    } finally {
      setDeleteBusyId(null)
    }
  }

  const tabs: Array<{ id: TabId; label: string; icon: typeof Building2 }> = [
    { id: 'catalog', label: '호텔 목록', icon: Building2 },
    { id: 'rates', label: '요금', icon: CalendarRange },
    { id: 'reservations', label: '예약', icon: BedDouble },
    { id: 'assignments', label: '투어 배정', icon: Link2 },
    { id: 'alerts', label: '가격 알림', icon: TriangleAlert },
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <p className="text-sm font-medium text-muted-foreground tracking-wide">
            투어 운영 · 숙박 조달
          </p>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground mt-1">
            호텔 관리 (투어 숙박)
          </h1>
          <p className="mt-2 text-base text-muted-foreground max-w-2xl leading-7">
            Wyndham 사이트에서 <strong className="text-foreground font-medium">공개 요금</strong>을
            가져와 비교합니다. (로그인/멤버가는 Rate Support로 막혀 현재 사용하지 않습니다)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <HotelManagementHelpButton onClick={() => setHelpOpen(true)} />
          <button
            type="button"
            onClick={() => {
              void load()
              void loadWyndhamStatus()
            }}
            className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl border border-border/60 bg-card text-sm font-medium hover:shadow-md transition duration-200"
          >
            <RefreshCw className="h-4 w-4" />
            새로고침
          </button>
        </div>
      </div>

      <HotelManagementHelpModal
        open={helpOpen}
        onOpenChange={setHelpOpen}
        locale={locale}
      />

      {/* Wyndham readiness */}
      <section
        className={`rounded-2xl border shadow-sm p-5 mb-6 ${
          wyndhamStatus?.readyForLive
            ? 'border-border/60 bg-card'
            : 'border-warning/40 bg-warning/5'
        }`}
      >
        <h2 className="text-base font-semibold tracking-tight mb-2">
          1단계 · Wyndham 준비 (로그인 없음 · 공개 요금)
        </h2>
        {wyndhamStatus ? (
          <div className="space-y-3 text-sm text-muted-foreground">
            <p className="text-foreground">{wyndhamStatus.hint}</p>
            <ul className="grid gap-1 sm:grid-cols-2">
              {wyndhamStatus.mode === 'worker' ? (
                <li>
                  원격 worker:{' '}
                  <StatusDot ok={Boolean(wyndhamStatus.canScrapeRates)} labelOk="연결 설정됨" labelNo="SECRET 필요" />
                </li>
              ) : (
                <li>
                  Playwright:{' '}
                  <StatusDot ok={wyndhamStatus.playwrightInstalled} />
                </li>
              )}
              <li>
                HOTEL_WYNDHAM_LIVE:{' '}
                <StatusDot ok={wyndhamStatus.liveFlag} labelOk="on" labelNo="off (수동은 가능)" />
              </li>
            </ul>
            {wyndhamStatus.mode === 'worker' && wyndhamStatus.workerUrl ? (
              <p className="text-xs font-mono break-all text-muted-foreground">
                {wyndhamStatus.workerUrl}
              </p>
            ) : null}
            {wyndhamStatus.blockers.length > 0 ? (
              <ul className="list-disc pl-5 space-y-1">
                {wyndhamStatus.blockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            ) : null}
            <p className="text-xs leading-5 pt-1">
              Rewards 로그인은 현재 Rate Support(
              <code className="text-[11px]">improper-route</code>)로 막혀 사용하지 않습니다. 날짜
              선택 후 호텔 행의 「요금 가져오기」만 누르면 됩니다.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">상태 확인 중…</p>
        )}
      </section>

      {/* Dates + add hotel */}
      <section className="rounded-2xl border border-border/60 bg-card shadow-sm p-5 mb-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold tracking-tight mb-1">
            2단계 · 숙박 날짜 (요금 조회에 사용)
          </h2>
          <p className="text-sm text-muted-foreground mb-3">
            「요금 가져오기」는 이 날짜로 Wyndham 공개가를 검색합니다. 로그인 불필요합니다.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg">
            <label className="text-sm font-medium space-y-1.5">
              <span>체크인</span>
              <input
                type="date"
                className="w-full h-11 rounded-lg border border-input bg-background px-3"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
              />
            </label>
            <label className="text-sm font-medium space-y-1.5">
              <span>체크아웃</span>
              <input
                type="date"
                className="w-full h-11 rounded-lg border border-input bg-background px-3"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
              />
            </label>
          </div>
        </div>

        <div className="border-t border-border/50 pt-5">
          <h2 className="text-base font-semibold tracking-tight mb-1">
            3단계 · 호텔을 카탈로그에 추가
          </h2>
          <p className="text-sm text-muted-foreground mb-3">
            자주 쓰는 호텔(예: Super 8 Page)을 먼저 등록한 뒤, 목록에서 요금을 가져오세요.
            StayAPI Enrich는 이미지/설명용이며 <em>요금과 무관</em>합니다.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <label className="text-sm font-medium space-y-1.5 md:col-span-2">
              <span>호텔명</span>
              <input
                className="w-full h-11 rounded-lg border border-input bg-background px-3"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </label>
            <label className="text-sm font-medium space-y-1.5">
              <span>도시</span>
              <input
                className="w-full h-11 rounded-lg border border-input bg-background px-3"
                value={newCity}
                onChange={(e) => setNewCity(e.target.value)}
              />
            </label>
            <label className="text-sm font-medium space-y-1.5">
              <span>주</span>
              <input
                className="w-full h-11 rounded-lg border border-input bg-background px-3"
                value={newState}
                onChange={(e) => setNewState(e.target.value)}
              />
            </label>
            <label className="text-sm font-medium space-y-1.5 md:col-span-3">
              <span>Wyndham 검색용 이름/코드</span>
              <input
                className="w-full h-11 rounded-lg border border-input bg-background px-3"
                value={newSupplierHotelId}
                onChange={(e) => setNewSupplierHotelId(e.target.value)}
                placeholder="사이트 검색창에 넣을 텍스트"
              />
            </label>
            <div className="flex items-end md:col-span-2">
              <button
                type="button"
                disabled={addBusy}
                onClick={() => void addHotel()}
                className="w-full inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl border border-border/60 bg-background font-medium hover:shadow-md disabled:opacity-50 transition duration-200"
              >
                {addBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                카탈로그에 추가
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-2 mb-4">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`inline-flex items-center gap-2 h-10 px-4 rounded-full text-sm font-medium transition duration-200 ${
              tab === id
                ? 'bg-foreground text-background'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'catalog' ? (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <p className="text-sm text-muted-foreground">
            4단계 ·{' '}
            <strong className="text-foreground font-medium">주요 호텔 요금 한 번에 가져오기</strong>
            로 Page·Kanab 공개가를 저장합니다. (행별 조회도 가능)
          </p>
          <button
            type="button"
            disabled={
              batchBusy ||
              !!rateBusyId ||
              !checkIn ||
              !checkOut ||
              hotels.filter((h) => h.supplier === 'wyndham').length === 0
            }
            onClick={() => void fetchAllWyndhamRates()}
            className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 hover:opacity-95 transition duration-200 shrink-0"
          >
            {batchBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <DollarSign className="h-4 w-4" />
            )}
            {batchBusy
              ? '일괄 조회 중…'
              : `주요 호텔 요금 한 번에 가져오기 (${hotels.filter((h) => h.supplier === 'wyndham').length}곳)`}
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="mb-4 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm">
          {error}
          <p className="mt-1 text-muted-foreground">
            테이블이 없다면 마이그레이션{' '}
            <code className="text-xs">20260805020000_hotel_management_module.sql</code>을
            적용하세요.
          </p>
        </div>
      ) : null}

      {loading ? (
        <div className="py-16 text-center text-muted-foreground">로딩 중…</div>
      ) : (
        <>
          {tab === 'catalog' && (
            <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card shadow-sm">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/40 text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium">호텔</th>
                    <th className="px-4 py-3 font-medium">공급사</th>
                    <th className="px-4 py-3 font-medium">도시</th>
                    <th className="px-4 py-3 font-medium">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {hotels.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                        아직 호텔이 없습니다. 위에서 「카탈로그에 추가」를 먼저 하세요.
                      </td>
                    </tr>
                  ) : (
                    hotels.map((hotel) => (
                      <tr key={hotel.hotel_id} className="border-t border-border/50">
                        <td className="px-4 py-3">
                          <div className="font-medium">{hotel.name}</div>
                          <div className="text-xs text-muted-foreground">
                            ID: {hotel.supplier_hotel_id}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
                            {hotel.supplier}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {[hotel.city, hotel.state].filter(Boolean).join(', ') || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col sm:flex-row gap-2">
                            <button
                              type="button"
                              disabled={
                                rateBusyId === hotel.hotel_id ||
                                batchBusy ||
                                !checkIn ||
                                !checkOut
                              }
                              onClick={() => void fetchMemberRates(hotel)}
                              className="inline-flex items-center justify-center gap-1.5 h-10 px-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 hover:opacity-95 transition duration-200"
                            >
                              {rateBusyId === hotel.hotel_id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <DollarSign className="h-4 w-4" />
                              )}
                              요금 가져오기
                            </button>
                            <button
                              type="button"
                              disabled={enrichBusyId === hotel.hotel_id}
                              onClick={() => void enrichHotel(hotel.hotel_id)}
                              className="inline-flex items-center justify-center h-10 px-3 rounded-xl border border-border/60 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                              title="선택 사항 · 이미지/설명만 (요금 아님)"
                            >
                              {enrichBusyId === hotel.hotel_id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                '메타데이터 (StayAPI · 선택)'
                              )}
                            </button>
                            <button
                              type="button"
                              disabled={deleteBusyId === hotel.hotel_id}
                              onClick={() => void removeHotel(hotel)}
                              className="inline-flex items-center justify-center gap-1.5 h-10 px-3 rounded-xl border border-danger/30 text-xs text-danger hover:bg-danger/5 disabled:opacity-50"
                              title="카탈로그에서 제거"
                            >
                              {deleteBusyId === hotel.hotel_id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                              삭제
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'rates' && (
            <DataTable
              empty="아직 저장된 요금이 없습니다. 호텔 목록에서 「요금 가져오기」를 실행하세요."
              headers={['호텔', '도시', '공급사', '날짜', '가격', '조회 시각']}
              rows={rates.map((rate) => [
                rate.hotels?.name || rate.hotel_id.slice(0, 8),
                [rate.hotels?.city, rate.hotels?.state].filter(Boolean).join(', ') || '—',
                rate.supplier,
                rate.stay_date,
                `${rate.currency} ${Number(rate.price).toFixed(2)}`,
                new Date(rate.checked_at).toLocaleString(),
              ])}
            />
          )}

          {tab === 'reservations' && (
            <DataTable
              empty="공급사 예약이 없습니다."
              headers={['호텔', '공급사', '기간', '상태', '확정번호', '비용']}
              rows={reservations.map((row) => [
                row.hotels?.name || row.guest_name || row.reservation_id.slice(0, 8),
                row.supplier,
                `${row.check_in} → ${row.check_out}`,
                row.status,
                row.supplier_confirmation_number || '—',
                row.total_cost != null ? `$${Number(row.total_cost).toFixed(2)}` : '—',
              ])}
            />
          )}

          {tab === 'assignments' && (
            <DataTable
              empty="투어 ↔ 호텔 배정이 없습니다."
              headers={['Tour ID', 'Reservation', '배정일']}
              rows={assignments.map((row) => [
                row.tour_id,
                row.reservation_id,
                row.assigned_date,
              ])}
            />
          )}

          {tab === 'alerts' && (
            <div className="space-y-3">
              {alerts.length === 0 ? (
                <p className="text-muted-foreground text-sm py-10 text-center">
                  가격 하락 알림이 없습니다. ($20 이상 하락 시 생성)
                </p>
              ) : (
                alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="rounded-xl border border-border/60 bg-card shadow-sm px-4 py-3"
                  >
                    <p className="font-medium text-sm">{alert.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {alert.hotels?.name || 'Hotel'} · {alert.stay_date} ·{' '}
                      {new Date(alert.created_at).toLocaleString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}

      <p className="mt-10 text-xs text-muted-foreground">
        운영 장부:{' '}
        <Link href={`/${locale}/admin/booking`} className="underline underline-offset-2">
          Booking → Hotels
        </Link>
        · 픽업:{' '}
        <Link
          href={`/${locale}/admin/pickup-hotels`}
          className="underline underline-offset-2"
        >
          Pickup Hotels
        </Link>
      </p>
    </div>
  )
}

function StatusDot({
  ok,
  labelOk = 'OK',
  labelNo = '필요',
}: {
  ok: boolean
  labelOk?: string
  labelNo?: string
}) {
  return (
    <span className={ok ? 'text-foreground font-medium' : 'text-warning font-medium'}>
      {ok ? labelOk : labelNo}
    </span>
  )
}

function DataTable({
  headers,
  rows,
  empty,
}: {
  headers: string[]
  rows: string[][]
  empty: string
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card shadow-sm">
      <table className="min-w-full text-sm">
        <thead className="bg-muted/40 text-left">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-4 py-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={headers.length}
                className="px-4 py-10 text-center text-muted-foreground"
              >
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row, idx) => (
              <tr key={idx} className="border-t border-border/50">
                {row.map((cell, cIdx) => (
                  <td key={cIdx} className="px-4 py-3">
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
