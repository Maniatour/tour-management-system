'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { Mail, ChevronRight, Loader2, FileText, CheckCircle, XCircle, RefreshCw, GripVertical, Inbox, Search, Filter } from 'lucide-react'
import { normalizeCustomerNameFromImport } from '@/utils/reservationUtils'
import type { ExtractedReservationData } from '@/types/reservationImport'

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
  created_at: string | null
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

export default function AdminReservationImportsPage({}: AdminReservationImportsProps) {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const locale = (params?.locale as string) || 'ko'
  const [items, setItems] = useState<ImportItem[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('pending')
  /** 탭: 'all' = 전체, 'booking' = 예약 접수 메일만 */
  const [activeTab, setActiveTab] = useState<'all' | 'booking'>('all')
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [patchingId, setPatchingId] = useState<string | null>(null)
  // 날짜별 페이지: 표시 기간 끝날짜(7일 단위). 기본값 = 오늘
  const [dateEnd, setDateEnd] = useState<string>(() => todayLocal())
  /** true면 날짜 필터 없이 최신순 1000건만 조회 (최신 메일이 안 보일 때 사용) */
  const [noDateFilter, setNoDateFilter] = useState(false)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteSubject, setPasteSubject] = useState('')
  const [pasteBody, setPasteBody] = useState('')
  const [pasteFrom, setPasteFrom] = useState('')
  const [pasteSubmitting, setPasteSubmitting] = useState(false)
  const [gmailStatus, setGmailStatus] = useState<{ connected: boolean; email: string | null; updated_at: string | null }>(emptyGmailStatus)
  const [gmailSyncing, setGmailSyncing] = useState(false)
  const [gmailMessage, setGmailMessage] = useState<string | null>(null)
  const [optimisticConnected, setOptimisticConnected] = useState(false)
  /** 검색어 (제목·발신·추출 요약 대상) */
  const [searchQuery, setSearchQuery] = useState('')
  /** 플랫폼 필터: '' = 전체, 'kkday' 등 = 해당 플랫폼만, 'other' = 기타(플랫폼 미지정) */
  const [platformFilter, setPlatformFilter] = useState('')

  const summary = (extracted: ExtractedReservationData) => {
    const parts = []
    if (extracted.customer_name) parts.push(normalizeCustomerNameFromImport(extracted.customer_name) || extracted.customer_name)
    if (extracted.customer_email) parts.push(extracted.customer_email)
    if (extracted.tour_date) parts.push(extracted.tour_date)
    if (extracted.adults != null) parts.push(`성인 ${extracted.adults}`)
    return parts.length ? parts.join(' · ') : '-'
  }

  const dateStart = addDays(dateEnd, -6)

  const loadList = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ status: statusFilter })
    if (!noDateFilter) {
      params.set('from_utc', localDateToUtcStart(dateStart))
      params.set('to_utc', localDateToUtcEnd(dateEnd))
    }
    fetch(`/api/reservation-imports?${params}`)
      .then((res) => res.json())
      .then((json) => setItems(json.data ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [statusFilter, dateStart, dateEnd, noDateFilter])

  /** KKday 메일인지 (platform_key 또는 발신/제목으로 판별, 기존에 파서 적용 전 저장된 행 보정) */
  const isKKdayRow = (row: ImportItem) =>
    row.platform_key === 'kkday' ||
    (row.source_email ?? '').toLowerCase().includes('kkday') ||
    (row.subject ?? '').trim().startsWith('[KKday]')

  /** [KKday] 예약번호: ... 주문이 접수되었습니다 형식 여부 */
  const isKKdayBookingSubject = (row: ImportItem) =>
    /^\[KKday\]\s*예약번호\s*[：:].*주문이\s*접수되었습니다/i.test((row.subject ?? '').trim())

  /** Viator 예약 접수: Please Respond: New Booking Request: */
  const isViatorBookingSubject = (row: ImportItem) =>
    (row.subject ?? '').trim().toLowerCase().includes('please respond: new booking request:')

  /** 홈페이지(maniatour) 메일: vegasmaniatour@wixsiteautomations.com */
  const isManiaTourRow = (row: ImportItem) =>
    row.platform_key === 'maniatour' || (row.source_email ?? '').toLowerCase().includes('wixsiteautomations.com')

  /** 홈페이지 예약 접수: 제목 You got a new booking */
  const isManiaTourBookingSubject = (row: ImportItem) =>
    (row.subject ?? '').trim().toLowerCase() === 'you got a new booking'

  /** 목록에 표시할 플랫폼 (KKday / maniatour 보정 포함) */
  const displayPlatform = (row: ImportItem) =>
    isKKdayRow(row) ? 'kkday' : isManiaTourRow(row) ? 'maniatour' : (row.platform_key ?? '-')

  /** 예약 접수 여부 (파서 자동 + 사용자 드래그 분류 + KKday/Viator/maniatour 제목 보정) */
  const isBookingConfirmed = (row: ImportItem) =>
    Boolean(row.extracted_data?.is_booking_confirmed === true) ||
    (isKKdayRow(row) && isKKdayBookingSubject(row)) ||
    (row.platform_key === 'viator' && isViatorBookingSubject(row)) ||
    (isManiaTourRow(row) && isManiaTourBookingSubject(row))

  const filteredItems = activeTab === 'booking'
    ? items.filter((row) => isBookingConfirmed(row))
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
      if (platform !== platformFilter) return false
    }
    return true
  })

  const bookingCount = items.filter((row) => isBookingConfirmed(row)).length

  /** 플랫폼 필터 옵션 (전체 + 주요 플랫폼 + 기타) */
  const PLATFORM_FILTER_OPTIONS: { value: string; label: string }[] = [
    { value: '', label: '전체 플랫폼' },
    { value: 'getyourguide', label: 'GetYourGuide' },
    { value: 'klook', label: 'Klook' },
    { value: 'kkday', label: 'KKday' },
    { value: 'viator', label: 'Viator' },
    { value: 'maniatour', label: 'Maniatour (홈페이지)' },
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

  const gmailStartAuthUrl = `/api/email/gmail/start?locale=${locale}`

  const handleGmailSync = async (fullSync = false) => {
    setGmailSyncing(true)
    setGmailMessage(null)
    try {
      const res = await fetch('/api/email/gmail/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullSync }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || res.statusText)
      setGmailMessage(
        fullSync
          ? `전체 재동기화 완료: ${data.queryUsed ?? 'after:날짜'} 검색, ${data.total ?? 0}건 중 새로 추가 ${data.imported ?? 0}건.`
          : `동기화 완료: 새 메일 ${data.imported ?? 0}건이 예약 가져오기 목록에 추가되었습니다.`
      )
      loadList()
    } catch (e) {
      setGmailMessage(e instanceof Error ? e.message : '동기화 실패')
    } finally {
      setGmailSyncing(false)
    }
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
                title="최근 24시간 메일 전부 검색해 DB와 비교 후 누락분만 추가 (최신 메일이 안 보일 때 사용)"
                className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2.5 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 disabled:opacity-50 touch-manipulation"
              >
                {gmailSyncing ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : <RefreshCw className="w-4 h-4 shrink-0" />}
                전체 재동기화 (최근 24시간)
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
            onChange={(e) => setStatusFilter(e.target.value)}
            className="min-h-[44px] border border-gray-300 rounded-lg px-3 py-2 text-sm touch-manipulation"
          >
            <option value="pending">대기 중</option>
            <option value="confirmed">확정됨</option>
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

      {/* 탭: 전체 / 예약 접수 (드래그하여 분류) - 모바일 터치 영역 확대 */}
      <div className="flex gap-1 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setActiveTab('all')}
          onDragOver={handleTabDragOver}
          onDrop={(e) => handleTabDrop(e, 'all')}
          className={`flex-1 sm:flex-none min-h-[44px] px-4 py-3 text-sm font-medium rounded-t-lg border-b-2 transition-colors touch-manipulation ${
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
          onClick={() => setActiveTab('booking')}
          onDragOver={handleTabDragOver}
          onDrop={(e) => handleTabDrop(e, 'booking')}
          title="항목을 이 탭에 드래그하면 예약 접수로 분류됩니다"
          className={`flex-1 sm:flex-none min-h-[44px] px-4 py-3 text-sm font-medium rounded-t-lg border-b-2 transition-colors flex items-center justify-center gap-1.5 touch-manipulation ${
            activeTab === 'booking'
              ? 'border-blue-600 text-blue-600 bg-blue-50/50'
              : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          <Inbox className="w-4 h-4 shrink-0" />
          예약 접수
          <span className="text-gray-500 font-normal">({bookingCount})</span>
        </button>
      </div>
      <p className="text-xs text-gray-500 mt-1">
        예약 접수 메일만 보려면 &quot;예약 접수&quot; 탭을 선택하세요. 목록에서 행을 드래그해 해당 탭에 놓으면 분류됩니다.
      </p>

      {/* 검색 + 플랫폼 필터 */}
      <div className="flex flex-col sm:flex-row gap-3 py-3 border-b border-gray-100">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" aria-hidden />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="제목, 발신자, 고객명·날짜 등 검색..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            aria-label="이메일 목록 검색"
          />
        </div>
        <div className="flex items-center gap-2 min-w-0 sm:min-w-[200px]">
          <Filter className="w-4 h-4 text-gray-400 shrink-0" aria-hidden />
          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
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
            onClick={() => { setNoDateFilter(false); setDateEnd(addDays(dateStart, -1)); }}
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
            onClick={() => { setNoDateFilter(false); setDateEnd(addDays(dateEnd, 7)); }}
            disabled={noDateFilter || dateEnd >= todayLocal()}
            className="min-h-[44px] inline-flex items-center gap-1 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
          >
            다음 ▶
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { setNoDateFilter(true); }}
            className="min-h-[44px] text-sm text-amber-600 hover:underline py-2 touch-manipulation font-medium"
          >
            최신순 전체
          </button>
          <button
            type="button"
            onClick={() => { setNoDateFilter(false); setDateEnd(todayLocal()); }}
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
          <p>{activeTab === 'booking' ? '예약 접수로 분류된 메일이 없습니다. 목록에서 항목을 드래그해 이 탭에 놓아 보관하세요.' : '해당 기간 항목이 없습니다.'}</p>
        </div>
      ) : searchedAndFilteredItems.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center text-gray-600">
          <Search className="w-12 h-12 mx-auto mb-3 text-gray-400" />
          <p>검색·플랫폼 필터 조건에 맞는 항목이 없습니다.</p>
          <button
            type="button"
            onClick={() => { setSearchQuery(''); setPlatformFilter(''); }}
            className="mt-3 text-sm text-blue-600 hover:underline"
          >
            검색·필터 초기화
          </button>
        </div>
      ) : (
        <>
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
                {searchedAndFilteredItems.map((row) => {
                  const isGyGBooking =
                    (row.source_email || '').toLowerCase().includes('getyourguide') &&
                    (row.subject || '').trimStart().toLowerCase().startsWith('booking -')
                  const isKlookOrderReceived = (row.subject || '').trimStart().toLowerCase().startsWith('klook order received -')
                  const isChannelReservationEmail = isGyGBooking || isKlookOrderReceived || isBookingConfirmed(row)
                  const isRegistered =
                    (row.status === 'confirmed' && !!row.reservation_id) || !!row.reservation_exists_by_channel_rn
                  const rowBg =
                    !isChannelReservationEmail
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
                      onClick={() => router.push(`/${locale}/admin/reservation-imports/${row.id}`)}
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
                      <td className="px-4 py-3 text-sm text-gray-900 min-w-[320px] max-w-[480px] truncate" title={row.subject ?? ''}>
                        {row.subject ?? '-'}
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
            {searchedAndFilteredItems.map((row) => {
              const isGyGBooking =
                (row.source_email || '').toLowerCase().includes('getyourguide') &&
                (row.subject || '').trimStart().toLowerCase().startsWith('booking -')
              const isKlookOrderReceived = (row.subject || '').trimStart().toLowerCase().startsWith('klook order received -')
              const isChannelReservationEmail = isGyGBooking || isKlookOrderReceived || isBookingConfirmed(row)
              const isRegistered =
                (row.status === 'confirmed' && !!row.reservation_id) || !!row.reservation_exists_by_channel_rn
              const cardBg =
                !isChannelReservationEmail
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
                  onClick={() => router.push(`/${locale}/admin/reservation-imports/${row.id}`)}
                  onKeyDown={(e) => e.key === 'Enter' && router.push(`/${locale}/admin/reservation-imports/${row.id}`)}
                  className={`min-h-[72px] rounded-lg border p-4 active:bg-gray-50 ${cardBg} ${isPatching ? 'opacity-70' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 line-clamp-2">{row.subject ?? '-'}</p>
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
        </>
      )}
    </div>
  )
}
