'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { useRoutePersistedState } from '@/hooks/useRoutePersistedState'
import { Mail, ChevronLeft, ChevronRight, Loader2, FileText, CheckCircle, XCircle, RefreshCw, GripVertical, Inbox, Search, Filter, Ban } from 'lucide-react'
import {
  isManiatourHomepageBookingEmail,
  isCancellationRequestEmailSubject,
  isViatorBookingRequestEmailSubject,
  isTidesquareChannelEmailSubject,
  isTidesquareNewBookingEmailSubject,
  isMyrealtripNewBookingEmailSubject,
  isMyrealtripChannelFromEmail,
  isTripComNewOrderEmailSubject,
} from '@/lib/emailReservationParser'
import { normalizeCustomerNameFromImport } from '@/utils/reservationUtils'
import { useReservationData } from '@/hooks/useReservationData'
import type { ExtractedReservationData } from '@/types/reservationImport'
import type { Product } from '@/types/reservation'
import { ReservationCancellationImportModal } from '@/components/reservation/ReservationCancellationImportModal'
import {
  GMAIL_RESERVATION_SYNC_COMPLETE,
  GMAIL_RESERVATION_SYNC_UNAUTHORIZED,
  useGmailReservationImportSync,
  type GmailReservationImportSyncDetail,
} from '@/contexts/GmailReservationImportSyncContext'

interface ImportItem {
  id: string
  message_id: string | null
  source_email: string | null
  platform_key: string | null
  subject: string | null
  received_at: string | null
  extracted_data: ExtractedReservationData
  status: string
  reservation_id: string | null
  reservation_exists_by_channel_rn?: boolean
  reservation_exists_by_customer_match?: boolean
  /** 취소 메일만: 채널 RN으로 예약 상태 조회 결과 */
  cancellation_list_badge?: 'needed' | 'done' | null
  created_at: string | null
}

/** 취소 알림 메일 목록 뱃지 (API cancellation_list_badge) */
function CancellationImportListBadge({ row }: { row: ImportItem }) {
  if (!isCancellationRequestEmailSubject(row.subject)) return null
  const badge = row.cancellation_list_badge ?? 'needed'
  if (badge === 'done') {
    return (
      <span
        className="shrink-0 text-[10px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded"
        title="채널 RN과 일치하는 예약이 모두 취소(또는 삭제) 처리됨"
      >
        취소 됨
      </span>
    )
  }
  return (
    <span
      className="shrink-0 text-[10px] font-semibold text-rose-800 bg-rose-100 px-1.5 py-0.5 rounded"
      title="채널 RN 미매칭·또는 예약이 아직 취소 상태가 아님. 모달에서 처리하세요."
    >
      취소 필요
    </span>
  )
}

function ReservationImportListPagination({
  listTotal,
  listRangeStart,
  listRangeEnd,
  listPageClamped,
  listTotalPages,
  onPrev,
  onNext,
  positionClass = '',
}: {
  listTotal: number
  listRangeStart: number
  listRangeEnd: number
  listPageClamped: number
  listTotalPages: number
  onPrev: () => void
  onNext: () => void
  positionClass?: string
}) {
  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-2 px-1 text-sm text-gray-600 border-gray-100 ${positionClass}`}
    >
      <span className="tabular-nums">
        {listTotal === 0 ? (
          '표시할 항목 없음'
        ) : (
          <>
            <span className="font-medium text-gray-800">
              {listRangeStart}–{listRangeEnd}
            </span>
            <span className="text-gray-500"> / 총 {listTotal}건</span>
            <span className="text-gray-400 hidden sm:inline"> · 페이지 {listPageClamped}/{listTotalPages}</span>
          </>
        )}
      </span>
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onPrev}
          disabled={listPageClamped <= 1 || listTotal === 0}
          className="inline-flex items-center gap-1 min-h-[40px] px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation"
        >
          <ChevronLeft className="w-4 h-4 shrink-0" aria-hidden />
          이전
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={listPageClamped >= listTotalPages || listTotal === 0}
          className="inline-flex items-center gap-1 min-h-[40px] px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation"
        >
          다음
          <ChevronRight className="w-4 h-4 shrink-0" aria-hidden />
        </button>
      </div>
    </div>
  )
}

interface AdminReservationImportsProps {
  params: Promise<{ locale: string }>
}

const emptyGmailStatus = { connected: false, email: null as string | null, updated_at: null as string | null }
const normalizeGmailStatus = (data: unknown) =>
  data && typeof (data as { connected?: boolean }).connected === 'boolean'
    ? (data as { connected: boolean; email: string | null; updated_at: string | null })
    : emptyGmailStatus

/** 오늘 날짜 YYYY-MM-DD (로컬) */
function todayLocal(): string {
  return new Date().toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-')
}
/** 날짜 문자열에 일수 더하기 */
function addDays(ymd: string, days: number): string {
  const d = new Date(ymd + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-')
}
/** YYYY-MM-DD(로컬 기준 날짜) → 해당일 00:00 로컬 시각의 UTC ISO 문자열 */
function localDateToUtcStart(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const start = new Date(y, m - 1, d, 0, 0, 0, 0)
  return start.toISOString()
}
/** YYYY-MM-DD(로컬 기준 날짜) → 해당일 23:59:59.999 로컬 시각의 UTC ISO 문자열 */
function localDateToUtcEnd(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const end = new Date(y, m - 1, d, 23, 59, 59, 999)
  return end.toISOString()
}

/** GetYourGuide 예약 접수 제목: "Booking - …" 또는 "Urgent : New Booking received - …" */
function isGyGReservationSubject(subject: string | null | undefined): boolean {
  const t = (subject ?? '').trimStart()
  const lower = t.toLowerCase()
  if (lower.startsWith('booking -')) return true
  return /^urgent\s*:\s*new\s*booking\s*received\s*-\s*[a-z0-9]+\s*-\s*[a-z0-9]+/i.test(t)
}

/** 추출 데이터 + 상품 목록으로 내부 상품명(name) 반환. 매칭 실패 시 추출된 product_name 그대로 반환 */
function productInternalName(extracted: ExtractedReservationData, products: Product[] | null | undefined): string {
  const list = products ?? []
  if (!extracted.product_id && !extracted.product_name) return ''
  if (extracted.product_id && list.length > 0) {
    const p = list.find((x) => x.id === extracted.product_id)
    if (p) return ((p.name ?? p.name_ko ?? '').trim() || (extracted.product_name ?? ''))
  }
  const name = (extracted.product_name ?? '').trim()
  if (!name || !list.length) return name
  const nameLower = name.toLowerCase()
  const matched = list.find(
    (p) =>
      (p.name && (p.name.toLowerCase() === nameLower || nameLower.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(nameLower))) ||
      (p.name_ko && (p.name_ko.toLowerCase() === nameLower || nameLower.includes(p.name_ko.toLowerCase()) || p.name_ko.toLowerCase().includes(nameLower))) ||
      (p.name_en && (p.name_en.toLowerCase() === nameLower || nameLower.includes(p.name_en.toLowerCase()) || p.name_en.toLowerCase().includes(nameLower)))
  )
  return matched ? ((matched.name ?? matched.name_ko ?? '').trim() || name) : name
}

type ReservationImportListTab = 'all' | 'booking' | 'cancellation'

const LIST_PAGE_SIZE = 25

const DEFAULT_LIST_PAGE_BY_TAB: Record<ReservationImportListTab, number> = {
  all: 1,
  booking: 1,
  cancellation: 1,
}

const RESERVATION_IMPORTS_UI_DEFAULT = {
  /** API: active = pending + confirmed (예약 저장 후에도 목록에 유지) */
  statusFilter: 'active',
  activeTab: 'all' as ReservationImportListTab,
  dateEnd: todayLocal(),
  noDateFilter: false,
  searchQuery: '',
  platformFilter: '',
  /** 탭(전체 / 예약 접수 / 취소 관련)마다 이메일 목록 페이지 — 1부터 */
  listPageByTab: { ...DEFAULT_LIST_PAGE_BY_TAB },
}

export default function AdminReservationImportsPage({}: AdminReservationImportsProps) {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const locale = (params?.locale as string) || 'ko'
  const { products: productsList = [] } = useReservationData({
    disableReservationsAutoLoad: true,
    customersByReservationIds: true,
  })
  const [items, setItems] = useState<ImportItem[]>([])
  const [loading, setLoading] = useState(true)
  const [listUi, setListUi] = useRoutePersistedState('reservation-imports-v2', RESERVATION_IMPORTS_UI_DEFAULT)
  const { statusFilter, activeTab, dateEnd, noDateFilter, searchQuery, platformFilter, listPageByTab: listPageByTabStored } = listUi
  const listPageByTab = { ...DEFAULT_LIST_PAGE_BY_TAB, ...(listPageByTabStored ?? {}) }
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [patchingId, setPatchingId] = useState<string | null>(null)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteSubject, setPasteSubject] = useState('')
  const [pasteBody, setPasteBody] = useState('')
  const [pasteFrom, setPasteFrom] = useState('')
  const [pasteSubmitting, setPasteSubmitting] = useState(false)
  const [gmailStatus, setGmailStatus] = useState<{ connected: boolean; email: string | null; updated_at: string | null }>(emptyGmailStatus)
  const [gmailMessage, setGmailMessage] = useState<string | null>(null)
  const { isSyncing: gmailSyncing, startGmailImportSync } = useGmailReservationImportSync()
  const [optimisticConnected, setOptimisticConnected] = useState(false)
  const [cancellationModalId, setCancellationModalId] = useState<string | null>(null)

  const cancellationImportFromUrl = searchParams.get('cancellationImport')

  const summary = (extracted: ExtractedReservationData) => {
    const parts = []
    if (extracted.tour_date) parts.push(extracted.tour_date)
    const productLabel = productInternalName(extracted, productsList)
    if (productLabel) parts.push(productLabel)
    const headcountParts = []
    if (extracted.adults != null) headcountParts.push(`성인 ${extracted.adults}`)
    if (extracted.children != null && extracted.children > 0) headcountParts.push(`아동 ${extracted.children}`)
    if (extracted.infants != null && extracted.infants > 0) headcountParts.push(`유아 ${extracted.infants}`)
    if (headcountParts.length) parts.push(headcountParts.join(' · '))
    if (extracted.customer_name) parts.push(normalizeCustomerNameFromImport(extracted.customer_name) || extracted.customer_name)
    if (extracted.customer_email) parts.push(extracted.customer_email)
    return parts.length ? parts.join(' · ') : '-'
  }

  const dateStart = addDays(dateEnd, -6)

  const loadList = useCallback(
    (opts?: { skipDateFilter?: boolean }) => {
      setLoading(true)
      const params = new URLSearchParams({ status: statusFilter })
      const omitDates = noDateFilter || opts?.skipDateFilter === true
      if (!omitDates) {
        params.set('from_utc', localDateToUtcStart(dateStart))
        params.set('to_utc', localDateToUtcEnd(dateEnd))
      }
      fetch(`/api/reservation-imports?${params}`)
        .then((res) => res.json())
        .then((json) => setItems(json.data ?? []))
        .catch(() => setItems([]))
        .finally(() => setLoading(false))
    },
    [statusFilter, dateStart, dateEnd, noDateFilter]
  )

  useEffect(() => {
    if (!cancellationImportFromUrl) return
    setCancellationModalId(cancellationImportFromUrl)
    router.replace(`/${locale}/admin/reservation-imports`, { scroll: false })
  }, [cancellationImportFromUrl, locale, router])

  const openImportRow = useCallback(
    (row: ImportItem) => {
      if (isCancellationRequestEmailSubject(row.subject)) {
        setCancellationModalId(row.id)
        return
      }
      router.push(`/${locale}/admin/reservation-imports/${row.id}`)
    },
    [locale, router]
  )

  /** KKday 메일인지 (platform_key 또는 발신/제목으로 판별, 기존에 파서 적용 전 저장된 행 보정) */
  const isKKdayRow = (row: ImportItem) =>
    row.platform_key === 'kkday' ||
    (row.source_email ?? '').toLowerCase().includes('kkday') ||
    (row.subject ?? '').trim().startsWith('[KKday]')

  /** [KKday] 예약번호: ... 주문이 접수되었습니다 형식 여부 */
  const isKKdayBookingSubject = (row: ImportItem) =>
    /^\[KKday\]\s*예약번호\s*[：:].*주문이\s*접수되었습니다/i.test((row.subject ?? '').trim())

  /** Viator 예약 접수 제목 (파서 is_booking_confirmed와 동일 규칙) */
  const isViatorBookingSubject = (row: ImportItem) => isViatorBookingRequestEmailSubject(row.subject)

  /** 홈페이지(maniatour): 플랫폼 키 또는 자사 Wix 발신 vegasmaniatour@wixsiteautomations.com */
  const isManiaTourRow = (row: ImportItem) =>
    row.platform_key === 'maniatour' ||
    /vegasmaniatour@wixsiteautomations\.com/i.test(row.source_email ?? '')

  /** 타이드스퀘어: platform_key 또는 제목 [타이드스퀘어] */
  const isTidesquareRow = (row: ImportItem) =>
    row.platform_key === 'tidesquare' || isTidesquareChannelEmailSubject(row.subject)

  /** 마이리얼트립: platform_key · 발신 · [확정대기] YYYY-MM-DD / 제목 */
  const isMyrealtripRow = (row: ImportItem) =>
    row.platform_key === 'myrealtrip' ||
    isMyrealtripChannelFromEmail(row.source_email) ||
    isMyrealtripNewBookingEmailSubject(row.subject)

  /** Trip.com: platform_key 또는 @trip.com 발신 */
  const isTripComRow = (row: ImportItem) =>
    row.platform_key === 'tripcom' || /@trip\.com\b/i.test(row.source_email ?? '')

  /** 목록에 표시할 플랫폼 (KKday / maniatour 보정 포함). Klook은 variant까지 표시 */
  const displayPlatform = (row: ImportItem) => {
    if (isKKdayRow(row)) return 'kkday'
    if (isManiaTourRow(row)) return 'maniatour'
    if (isTidesquareRow(row)) return '타이드스퀘어'
    if (isMyrealtripRow(row)) return '마이리얼트립'
    if (isTripComRow(row)) return 'Trip.com'
    const base = row.platform_key ?? '-'
    if (base === 'klook') {
      const label = (row.extracted_data?.channel_variant_label ?? '').trim()
      if (label) return `Klook - ${label}`
      return 'Klook'
    }
    return base
  }

  /** GetYourGuide 발신 + 예약 접수 제목 (DB에 is_booking_confirmed 없을 때 목록·탭 보정) */
  const isGyGBookingRow = (row: ImportItem) =>
    (row.source_email || '').toLowerCase().includes('getyourguide') && isGyGReservationSubject(row.subject)

  /** Trip.com 발신 + 신규 주문 제목 (옛 행 보정) */
  const isTripComBookingRow = (row: ImportItem) =>
    isTripComRow(row) && isTripComNewOrderEmailSubject(row.subject)

  /** 예약 접수 여부 (파서 자동 + 목록 API의 Klook 보강 + 사용자 드래그 + KKday/Viator/maniatour/GYG 제목 보정) */
  const isBookingConfirmed = (row: ImportItem) =>
    Boolean(row.extracted_data?.is_booking_confirmed === true) ||
    (row.platform_key === 'klook' &&
      (row.subject || '').trimStart().toLowerCase().startsWith('klook order received -')) ||
    (isKKdayRow(row) && isKKdayBookingSubject(row)) ||
    (row.platform_key === 'viator' && isViatorBookingSubject(row)) ||
    (isTidesquareRow(row) && isTidesquareNewBookingEmailSubject(row.subject)) ||
    (isMyrealtripRow(row) && isMyrealtripNewBookingEmailSubject(row.subject)) ||
    isManiatourHomepageBookingEmail(row.source_email, row.subject) ||
    isGyGBookingRow(row) ||
    isTripComBookingRow(row)

  const filteredItems =
    activeTab === 'booking'
      ? items.filter((row) => isBookingConfirmed(row))
      : activeTab === 'cancellation'
        ? items.filter((row) => isCancellationRequestEmailSubject(row.subject))
        : items

  /** 검색 + 플랫폼 필터 적용한 목록 (표시용) */
  const searchedAndFilteredItems = filteredItems.filter((row) => {
    const q = searchQuery.trim().toLowerCase()
    if (q) {
      const subject = (row.subject ?? '').toLowerCase()
      const from = (row.source_email ?? '').toLowerCase()
      const summaryStr = summary(row.extracted_data).toLowerCase()
      if (!subject.includes(q) && !from.includes(q) && !summaryStr.includes(q)) return false
    }
    const platform = displayPlatform(row)
    if (platformFilter === 'other') {
      if (platform !== '-') return false
    } else if (platformFilter) {
      if (platformFilter === 'klook') {
        if ((row.platform_key || '').toLowerCase() !== 'klook') return false
      } else if (platformFilter === 'tidesquare') {
        if (!isTidesquareRow(row)) return false
      } else if (platformFilter === 'myrealtrip') {
        if (!isMyrealtripRow(row)) return false
      } else if (platformFilter === 'tripcom') {
        if (!isTripComRow(row)) return false
      } else if (platform !== platformFilter) {
        return false
      }
    }
    return true
  })

  const listTotal = searchedAndFilteredItems.length
  const listTotalPages = Math.max(1, Math.ceil(listTotal / LIST_PAGE_SIZE))
  const storedListPage = Math.max(1, listPageByTab[activeTab])
  const listPageClamped = Math.min(storedListPage, listTotalPages)

  useEffect(() => {
    if (storedListPage !== listPageClamped) {
      setListUi((prev) => ({
        ...prev,
        listPageByTab: {
          ...DEFAULT_LIST_PAGE_BY_TAB,
          ...prev.listPageByTab,
          [activeTab]: listPageClamped,
        },
      }))
    }
  }, [activeTab, storedListPage, listPageClamped])

  const paginatedItems = useMemo(() => {
    const start = (listPageClamped - 1) * LIST_PAGE_SIZE
    return searchedAndFilteredItems.slice(start, start + LIST_PAGE_SIZE)
  }, [searchedAndFilteredItems, listPageClamped])

  const listRangeStart = listTotal === 0 ? 0 : (listPageClamped - 1) * LIST_PAGE_SIZE + 1
  const listRangeEnd = Math.min(listPageClamped * LIST_PAGE_SIZE, listTotal)

  const goListPage = (next: number) => {
    const p = Math.max(1, Math.min(listTotalPages, next))
    setListUi((prev) => ({
      ...prev,
      listPageByTab: {
        ...DEFAULT_LIST_PAGE_BY_TAB,
        ...prev.listPageByTab,
        [activeTab]: p,
      },
    }))
  }

  const bookingCount = items.filter((row) => isBookingConfirmed(row)).length
  const cancellationCount = items.filter((row) => isCancellationRequestEmailSubject(row.subject)).length

  /** 플랫폼 필터 옵션 (전체 + 주요 플랫폼 + 기타) */
  const PLATFORM_FILTER_OPTIONS: { value: string; label: string }[] = [
    { value: '', label: '전체 플랫폼' },
    { value: 'getyourguide', label: 'GetYourGuide' },
    { value: 'klook', label: 'Klook' },
    { value: 'kkday', label: 'KKday' },
    { value: 'viator', label: 'Viator' },
    { value: 'maniatour', label: 'Maniatour (홈페이지)' },
    { value: 'tidesquare', label: '타이드스퀘어' },
    { value: 'myrealtrip', label: '마이리얼트립' },
    { value: 'tripcom', label: 'Trip.com' },
    { value: 'tripadvisor', label: 'Tripadvisor' },
    { value: 'booking', label: 'Booking' },
    { value: 'expedia', label: 'Expedia' },
    { value: 'airbnb', label: 'Airbnb' },
    { value: 'other', label: '기타' },
  ]

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id)
    e.dataTransfer.setData('text/plain', id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragEnd = () => {
    setDraggedId(null)
  }

  const handleTabDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleTabDrop = useCallback(
    async (e: React.DragEvent, targetTab: 'all' | 'booking') => {
      e.preventDefault()
      const id = e.dataTransfer.getData('text/plain')
      if (!id) return
      const row = items.find((r) => r.id === id)
      if (!row) return
      const current = isBookingConfirmed(row)
      const want = targetTab === 'booking'
      if (current === want) return
      setPatchingId(id)
      try {
        const res = await fetch(`/api/reservation-imports/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_booking_confirmed: want }),
        })
        if (res.ok) loadList()
      } finally {
        setPatchingId(null)
      }
      setDraggedId(null)
    },
    [items, loadList]
  )

  const fetchGmailStatus = useCallback(() => {
    return fetch('/api/email/gmail/status')
      .then((res) => res.json().catch(() => ({})).then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        const status = normalizeGmailStatus(data)
        setGmailStatus(status)
        if (ok) setOptimisticConnected(false)
        return status
      })
      .catch(() => {
        setGmailStatus(emptyGmailStatus)
      })
  }, [])

  useEffect(() => {
    loadList()
  }, [loadList])

  useEffect(() => {
    let cancelled = false
    fetch('/api/email/gmail/status')
      .then((res) => res.json().catch(() => ({})))
      .then((data) => {
        if (!cancelled) setGmailStatus(normalizeGmailStatus(data))
      })
      .catch(() => {
        if (!cancelled) setGmailStatus(emptyGmailStatus)
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const success = searchParams.get('success')
    const error = searchParams.get('error')
    if (success === '1') {
      setGmailMessage('Gmail 연결이 완료되었습니다.')
      setOptimisticConnected(true)
      fetchGmailStatus()
    }
    if (error) setGmailMessage(`연결 실패: ${decodeURIComponent(error)}`)
  }, [searchParams, fetchGmailStatus])

  /** 레이아웃에서 백그라운드 동기화가 끝나면 목록·배너 갱신 */
  useEffect(() => {
    const onComplete = (ev: Event) => {
      const d = (ev as CustomEvent<GmailReservationImportSyncDetail>).detail
      if (!d) return
      setGmailMessage(
        d.fullSync
          ? `전체 재동기화 완료: ${d.queryUsed ?? 'after:날짜'} 검색, ${d.total ?? 0}건 중 새로 추가 ${d.imported ?? 0}건.`
          : `동기화 완료: 새 메일 ${d.imported ?? 0}건이 예약 가져오기 목록에 추가되었습니다.`
      )
      // 새 행이 생겼을 때 날짜 창 밖이면 목록에 안 보일 수 있음 → 한 번은 날짜 없이 최신 1000건으로 갱신
      const added = d.imported ?? 0
      loadList(added > 0 ? { skipDateFilter: true } : undefined)
    }
    const onUnauthorized = () => {
      setOptimisticConnected(false)
      void fetchGmailStatus()
    }
    window.addEventListener(GMAIL_RESERVATION_SYNC_COMPLETE, onComplete)
    window.addEventListener(GMAIL_RESERVATION_SYNC_UNAUTHORIZED, onUnauthorized)
    return () => {
      window.removeEventListener(GMAIL_RESERVATION_SYNC_COMPLETE, onComplete)
      window.removeEventListener(GMAIL_RESERVATION_SYNC_UNAUTHORIZED, onUnauthorized)
    }
  }, [loadList, fetchGmailStatus])

  const gmailStartAuthUrl = `/api/email/gmail/start?locale=${locale}`

  const handleGmailSync = (fullSync = false) => {
    setGmailMessage(null)
    startGmailImportSync(fullSync)
  }

  const handlePasteSubmit = async () => {
    if (!pasteSubject.trim() && !pasteBody.trim()) {
      alert('제목 또는 본문을 입력하세요.')
      return
    }
    setPasteSubmitting(true)
    try {
      const res = await fetch('/api/reservation-imports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: pasteSubject.trim() || '(제목 없음)',
          text: pasteBody.trim() || '',
          from: pasteFrom.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || res.statusText)
      setPasteOpen(false)
      setPasteSubject('')
      setPasteBody('')
      setPasteFrom('')
      loadList()
    } catch (e) {
      alert(e instanceof Error ? e.message : '등록 실패')
    } finally {
      setPasteSubmitting(false)
    }
  }

  const formatDate = (s: string | null) => {
    if (!s) return '-'
    try {
      const d = new Date(s)
      return d.toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US', {
        dateStyle: 'short',
        timeStyle: 'short',
      })
    } catch {
      return s
    }
  }

  return (
    <div className="space-y-4 px-2 sm:px-0">
      {/* 이메일 연동 (Gmail) 섹션 */}
      <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">이메일 연동 (Gmail)</h2>
        <p className="text-xs text-gray-600 mb-4">
          Gmail 받은편지함의 예약 알림 메일을 자동으로 읽어와 아래 목록에 넣습니다. 연결 후 &quot;지금 동기화&quot; 또는 Cron으로 주기 실행할 수 있습니다.
        </p>
        {gmailMessage && (
          <div className={`rounded-lg border p-3 text-sm mb-4 ${gmailMessage.startsWith('연결 실패') || gmailMessage.startsWith('동기화 실패') ? 'border-red-200 bg-red-50 text-red-800' : 'border-green-200 bg-green-50 text-green-800'}`}>
            {gmailMessage}
          </div>
        )}
        {gmailStatus?.connected || optimisticConnected ? (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-gray-700">
              <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
              <span className="text-sm">연결됨: <strong>{gmailStatus?.email ?? '확인 중…'}</strong></span>
            </div>
            {gmailStatus?.updated_at && (
              <span className="text-xs text-gray-500">
                마지막 연결: {new Date(gmailStatus.updated_at).toLocaleString('ko-KR')}
              </span>
            )}
            <div className="flex flex-wrap gap-2">
              <a
                href={gmailStartAuthUrl}
                className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 touch-manipulation"
              >
                <RefreshCw className="w-4 h-4 shrink-0" />
                다시 연결
              </a>
              <button
                type="button"
                onClick={() => handleGmailSync(false)}
                disabled={gmailSyncing}
                className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 touch-manipulation"
              >
                {gmailSyncing ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : <Mail className="w-4 h-4 shrink-0" />}
                지금 동기화
              </button>
              <button
                type="button"
                onClick={() => handleGmailSync(true)}
                disabled={gmailSyncing}
                title="최근 7일 수신함 메일을 검색해 DB와 비교 후 누락분만 추가합니다. History API만으로는 안 잡히는 메일도 포함합니다."
                className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2.5 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 disabled:opacity-50 touch-manipulation"
              >
                {gmailSyncing ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : <RefreshCw className="w-4 h-4 shrink-0" />}
                전체 재동기화 (최근 7일)
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-gray-600">
              <XCircle className="w-5 h-5 text-gray-400 shrink-0" />
              <span className="text-sm">Gmail이 연결되지 않았습니다.</span>
            </div>
            <a
              href={gmailStartAuthUrl}
              className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 touch-manipulation"
            >
              <Mail className="w-4 h-4 shrink-0" />
              Gmail 연결
            </a>
          </div>
        )}
      </section>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-lg sm:text-xl font-bold text-gray-900">예약 가져오기</h1>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPasteOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 active:bg-blue-800 touch-manipulation"
          >
            <FileText className="w-4 h-4 shrink-0" />
            이메일 붙여넣기
          </button>
          <span className="text-sm text-gray-600">상태:</span>
          <select
            value={statusFilter}
            onChange={(e) => setListUi((prev) => ({ ...prev, statusFilter: e.target.value }))}
            className="min-h-[44px] border border-gray-300 rounded-lg px-3 py-2 text-sm touch-manipulation"
          >
            <option value="active">대기 + 예약 생성됨</option>
            <option value="pending">대기 중만</option>
            <option value="confirmed">예약 생성됨만</option>
            <option value="rejected">무시됨</option>
          </select>
        </div>
      </div>

      {pasteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">이메일 붙여넣기</h2>
              <p className="text-sm text-gray-500 mt-0.5">Gmail 등에서 받은 예약 메일의 제목·본문을 복사해 붙여넣으면 자동으로 정보를 추출합니다. (Resend/도메인 없이 사용 가능)</p>
            </div>
            <div className="p-4 space-y-3 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">제목</label>
                <input
                  type="text"
                  value={pasteSubject}
                  onChange={(e) => setPasteSubject(e.target.value)}
                  placeholder="이메일 제목"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">발신 (선택, 플랫폼 식별용)</label>
                <input
                  type="text"
                  value={pasteFrom}
                  onChange={(e) => setPasteFrom(e.target.value)}
                  placeholder="예: noreply@viator.com"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">본문 *</label>
                <textarea
                  value={pasteBody}
                  onChange={(e) => setPasteBody(e.target.value)}
                  placeholder="이메일 본문 전체를 복사해 붙여넣으세요"
                  rows={10}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm resize-y"
                />
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPasteOpen(false)}
                className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-md"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handlePasteSubmit}
                disabled={pasteSubmitting}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {pasteSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                가져오기
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="text-sm text-gray-600">
        플랫폼에서 수신된 이메일로 자동 추출된 예약 후보입니다. 항목을 클릭해 정보를 보완한 뒤 예약으로 생성하세요.
      </p>

      {/* 탭: 전체 / 예약 접수 / 취소 관련 */}
      <div className="flex flex-wrap gap-1 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setListUi((prev) => ({ ...prev, activeTab: 'all' as const }))}
          onDragOver={handleTabDragOver}
          onDrop={(e) => handleTabDrop(e, 'all')}
          className={`flex-1 sm:flex-none min-h-[44px] px-3 sm:px-4 py-3 text-sm font-medium rounded-t-lg border-b-2 transition-colors touch-manipulation ${
            activeTab === 'all'
              ? 'border-blue-600 text-blue-600 bg-blue-50/50'
              : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          전체
          <span className="ml-1.5 text-gray-500 font-normal">({items.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setListUi((prev) => ({ ...prev, activeTab: 'booking' as const }))}
          onDragOver={handleTabDragOver}
          onDrop={(e) => handleTabDrop(e, 'booking')}
          title="항목을 이 탭에 드래그하면 예약 접수로 분류됩니다"
          className={`flex-1 sm:flex-none min-h-[44px] px-3 sm:px-4 py-3 text-sm font-medium rounded-t-lg border-b-2 transition-colors flex items-center justify-center gap-1.5 touch-manipulation ${
            activeTab === 'booking'
              ? 'border-blue-600 text-blue-600 bg-blue-50/50'
              : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          <Inbox className="w-4 h-4 shrink-0" />
          예약 접수
          <span className="text-gray-500 font-normal">({bookingCount})</span>
        </button>
        <button
          type="button"
          onClick={() => setListUi((prev) => ({ ...prev, activeTab: 'cancellation' as const }))}
          title="제목에 cancelled/canceled가 포함된 취소·취소 요청 메일만 표시합니다. 행을 누르면 모달에서 처리합니다."
          className={`flex-1 sm:flex-none min-h-[44px] px-3 sm:px-4 py-3 text-sm font-medium rounded-t-lg border-b-2 transition-colors flex items-center justify-center gap-1.5 touch-manipulation ${
            activeTab === 'cancellation'
              ? 'border-rose-600 text-rose-700 bg-rose-50/60'
              : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          <Ban className="w-4 h-4 shrink-0" aria-hidden />
          취소 관련
          <span className="text-gray-500 font-normal">({cancellationCount})</span>
        </button>
      </div>
      <p className="text-xs text-gray-500 mt-1">
        &quot;예약 접수&quot;는 접수 메일만, &quot;취소 관련&quot;은 취소 알림만 표시합니다. 예약 접수 분류는 전체·예약 접수 탭 사이에 행을 드래그해 설정할 수 있습니다.
      </p>

      {/* 검색 + 플랫폼 필터 */}
      <div className="flex flex-col sm:flex-row gap-3 py-3 border-b border-gray-100">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" aria-hidden />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setListUi((prev) => ({ ...prev, searchQuery: e.target.value }))}
            placeholder="제목, 발신자, 고객명·날짜 등 검색..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            aria-label="이메일 목록 검색"
          />
        </div>
        <div className="flex items-center gap-2 min-w-0 sm:min-w-[200px]">
          <Filter className="w-4 h-4 text-gray-400 shrink-0" aria-hidden />
          <select
            value={platformFilter}
            onChange={(e) => setListUi((prev) => ({ ...prev, platformFilter: e.target.value }))}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            aria-label="플랫폼 필터"
          >
            {PLATFORM_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {(searchQuery.trim() || platformFilter) && (
        <p className="text-xs text-gray-500 mt-1">
          검색·필터 결과 <strong>{searchedAndFilteredItems.length}</strong>건
        </p>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-3">
        <div className="flex items-center justify-between sm:justify-start gap-2">
          <button
            type="button"
            onClick={() => {
              setListUi((prev) => ({
                ...prev,
                noDateFilter: false,
                dateEnd: addDays(addDays(prev.dateEnd, -6), -1)
              }))
            }}
            disabled={noDateFilter}
            className="min-h-[44px] inline-flex items-center gap-1 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 disabled:opacity-50 touch-manipulation"
          >
            ◀ 이전
          </button>
          <span className="text-sm text-gray-600 font-medium flex-1 text-center shrink-0">
            {noDateFilter ? '날짜 필터 없음 (최신순 최대 1000건)' : `${dateStart} ~ ${dateEnd}`}
          </span>
          <button
            type="button"
            onClick={() => {
              setListUi((prev) => ({
                ...prev,
                noDateFilter: false,
                dateEnd: addDays(prev.dateEnd, 7)
              }))
            }}
            disabled={noDateFilter || dateEnd >= todayLocal()}
            className="min-h-[44px] inline-flex items-center gap-1 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
          >
            다음 ▶
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { setListUi((prev) => ({ ...prev, noDateFilter: true })) }}
            className="min-h-[44px] text-sm text-amber-600 hover:underline py-2 touch-manipulation font-medium"
          >
            최신순 전체
          </button>
          <button
            type="button"
            onClick={() => {
              setListUi((prev) => ({ ...prev, noDateFilter: false, dateEnd: todayLocal() }))
            }}
            className="min-h-[44px] text-sm text-blue-600 hover:underline py-2 touch-manipulation"
          >
            오늘 기준으로
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center text-gray-600">
          <Mail className="w-12 h-12 mx-auto mb-3 text-gray-400" />
          <p>해당 상태의 예약 가져오기 항목이 없습니다.</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center text-gray-600">
          <Inbox className="w-12 h-12 mx-auto mb-3 text-gray-400" />
          <p>
            {activeTab === 'booking'
              ? '예약 접수로 분류된 메일이 없습니다. 목록에서 항목을 드래그해 이 탭에 놓아 보관하세요.'
              : activeTab === 'cancellation'
                ? '이 기간에 취소 관련 제목(cancelled/canceled) 메일이 없습니다.'
                : '해당 기간 항목이 없습니다.'}
          </p>
        </div>
      ) : searchedAndFilteredItems.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center text-gray-600">
          <Search className="w-12 h-12 mx-auto mb-3 text-gray-400" />
          <p>검색·플랫폼 필터 조건에 맞는 항목이 없습니다.</p>
          <button
            type="button"
            onClick={() => {
              setListUi((prev) => ({ ...prev, searchQuery: '', platformFilter: '' }))
            }}
            className="mt-3 text-sm text-blue-600 hover:underline"
          >
            검색·필터 초기화
          </button>
        </div>
      ) : (
        <>
          <ReservationImportListPagination
            listTotal={listTotal}
            listRangeStart={listRangeStart}
            listRangeEnd={listRangeEnd}
            listPageClamped={listPageClamped}
            listTotalPages={listTotalPages}
            onPrev={() => goListPage(listPageClamped - 1)}
            onNext={() => goListPage(listPageClamped + 1)}
            positionClass="border-b"
          />

          {/* 데스크톱: 테이블 (가로 스크롤 대응) */}
          <div className="hidden md:block rounded-lg border border-gray-200 bg-white overflow-x-auto">
            <table className="min-w-full table-fixed divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 py-2 w-8" aria-label="드래그" />
                  <th className="px-3 py-2 w-28 text-left text-xs font-medium text-gray-500 uppercase">수신 일시</th>
                  <th className="px-4 py-2 min-w-[320px] text-left text-xs font-medium text-gray-500 uppercase">제목</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">플랫폼</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">추출 요약</th>
                  <th className="px-4 py-2 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paginatedItems.map((row) => {
                  /** 신규(빨강) / 처리됨(노랑): import 행의 채널 RN이 reservations.channel_rn과 일치할 때만 처리됨 */
                  const isRegistered = !!(row.reservation_exists_by_channel_rn || row.reservation_exists_by_customer_match)
                  /** 예약 저장 완료된 이메일 행 — 목록에 남기고 노란색 표시 */
                  const isSavedToReservation =
                    row.status === 'confirmed' || !!row.reservation_id
                  const rowBg = isSavedToReservation
                    ? 'bg-amber-50/90 border-l-4 border-l-amber-500'
                    : !isBookingConfirmed(row)
                      ? ''
                      : isRegistered
                        ? 'bg-amber-50/90 border-l-4 border-l-amber-500'
                        : 'bg-red-50/90 border-l-4 border-l-red-500'
                  const isDragging = draggedId === row.id
                  const isPatching = patchingId === row.id
                  return (
                    <tr
                      key={row.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, row.id)}
                      onDragEnd={handleDragEnd}
                      className={`hover:bg-gray-50 cursor-pointer ${rowBg} ${isDragging ? 'opacity-50' : ''} ${isPatching ? 'opacity-70' : ''}`}
                      onClick={() => openImportRow(row)}
                    >
                      <td
                        className="px-2 py-3 text-gray-400 cursor-grab active:cursor-grabbing"
                        onClick={(e) => e.stopPropagation()}
                        title="드래그하여 예약 접수 탭에 넣기"
                      >
                        <GripVertical className="w-4 h-4" />
                      </td>
                      <td className="px-3 py-3 w-28 text-sm text-gray-600 whitespace-nowrap">
                        {formatDate(row.received_at ?? row.created_at)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 min-w-[320px] max-w-[480px]" title={row.subject ?? ''}>
                        <div className="flex items-center gap-2 min-w-0">
                          <CancellationImportListBadge row={row} />
                          <span className="truncate">{row.subject ?? '-'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{displayPlatform(row)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 max-w-[280px] truncate" title={summary(row.extracted_data)}>
                        {summary(row.extracted_data)}
                      </td>
                      <td className="px-4 py-3">
                        {isPatching ? <Loader2 className="w-4 h-4 animate-spin text-blue-500" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* 모바일: 카드 리스트 (터치 친화) */}
          <div className="md:hidden space-y-2">
            {paginatedItems.map((row) => {
              const isRegistered = !!(row.reservation_exists_by_channel_rn || row.reservation_exists_by_customer_match)
              const isSavedToReservation =
                row.status === 'confirmed' || !!row.reservation_id
              const cardBg = isSavedToReservation
                ? 'bg-amber-50/90 border-l-4 border-l-amber-500 border-amber-200'
                : !isBookingConfirmed(row)
                  ? 'bg-white border-gray-200'
                  : isRegistered
                    ? 'bg-amber-50/90 border-l-4 border-l-amber-500 border-gray-200'
                    : 'bg-red-50/90 border-l-4 border-l-red-500 border-gray-200'
              const isPatching = patchingId === row.id
              return (
                <div
                  key={row.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openImportRow(row)}
                  onKeyDown={(e) => e.key === 'Enter' && openImportRow(row)}
                  className={`min-h-[72px] rounded-lg border p-4 active:bg-gray-50 ${cardBg} ${isPatching ? 'opacity-70' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2">
                        <CancellationImportListBadge row={row} />
                        <p className="text-sm font-medium text-gray-900 line-clamp-2 flex-1">{row.subject ?? '-'}</p>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{formatDate(row.received_at ?? row.created_at)}</p>
                      {(displayPlatform(row) !== '-' || summary(row.extracted_data) !== '-') && (
                        <p className="text-xs text-gray-600 mt-1 truncate">
                          {displayPlatform(row) !== '-' ? `${displayPlatform(row)} · ` : ''}{summary(row.extracted_data)}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 pt-1">
                      {isPatching ? <Loader2 className="w-5 h-5 animate-spin text-blue-500" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {listTotalPages > 1 ? (
            <ReservationImportListPagination
              listTotal={listTotal}
              listRangeStart={listRangeStart}
              listRangeEnd={listRangeEnd}
              listPageClamped={listPageClamped}
              listTotalPages={listTotalPages}
              onPrev={() => goListPage(listPageClamped - 1)}
              onNext={() => goListPage(listPageClamped + 1)}
              positionClass="border-t pt-1 mt-1"
            />
          ) : null}
        </>
      )}

      <ReservationCancellationImportModal
        importId={cancellationModalId}
        locale={locale}
        products={productsList}
        onClose={() => setCancellationModalId(null)}
        onResolved={loadList}
      />
    </div>
  )
}
