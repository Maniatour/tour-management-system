'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { RefreshCw, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { supabase, isAbortLikeError } from '@/lib/supabase'
import { fetchReconciledSourceIds } from '@/lib/reconciliation-match-queries'
import type { ExpenseStatementReconContext } from '@/lib/expense-reconciliation-similar-lines'
import { ExpenseStatementReconIcon } from '@/components/reconciliation/ExpenseStatementReconIcon'
import ExpenseStatementSimilarLinesModal from '@/components/reconciliation/ExpenseStatementSimilarLinesModal'
import { usePaymentMethodOptions } from '@/hooks/usePaymentMethodOptions'
import { compareSortValues, type SortDir } from '@/lib/clientTableSort'
import TableSortHeaderButton from '@/components/expenses/TableSortHeaderButton'

type PaymentRecordRow = {
  id: string
  reservation_id: string
  amount: number | null
  amount_krw: number | null
  payment_method: string | null
  payment_status: string | null
  note: string | null
  submit_on: string | null
  submit_by: string | null
  created_at: string | null
}

type ReservationLite = {
  id: string
  product_id: string | null
  tour_date: string | null
  customer_id: string | null
  channel_id: string | null
}

type CustomerLite = { id: string; name: string | null; email: string | null }

type ChannelLite = { id: string; name: string }

/** PostgREST range 배치 크기 (전체 로드 시 반복) */
const FETCH_BATCH = 400
/** 화면 페이지당 행 수 */
const UI_PAGE_SIZE = 50

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function rowYmd(r: PaymentRecordRow): string {
  const iso = r.submit_on || r.created_at
  if (!iso) return ''
  return iso.slice(0, 10)
}

/** 예약 투어일 → YYYY-MM-DD (비교용) */
function tourDateYmd(tourDate: string | null | undefined): string {
  if (!tourDate || !String(tourDate).trim()) return ''
  return String(tourDate).trim().slice(0, 10)
}

/** 동일 id·빈 id 중복 행 제거(동기화 이슈 대비). 첫 행만 유지 */
function dedupePaymentRows(rows: PaymentRecordRow[]): PaymentRecordRow[] {
  const m = new Map<string, PaymentRecordRow>()
  for (const row of rows) {
    const id = String(row.id || '').trim()
    const key = id
      ? id
      : `noid:${row.reservation_id}|${row.created_at ?? ''}|${row.submit_on ?? ''}|${row.amount ?? ''}|${row.payment_method ?? ''}|${row.payment_status ?? ''}`
    if (!m.has(key)) m.set(key, row)
  }
  return [...m.values()]
}

function rowListKey(r: PaymentRecordRow, globalIndex: number): string {
  const id = String(r.id || '').trim()
  return `pr-${globalIndex}-${id || 'noid'}--${r.reservation_id}--${r.created_at ?? ''}--${r.submit_on ?? ''}`
}

/** DB payment_status → i18n statusSlug.* 키 */
const PAYMENT_STATUS_SLUG: Record<string, string> = {
  'Partner Received': 'partnerReceived',
  'Deposit Requested': 'depositRequested',
  'Deposit Received': 'depositReceived',
  'Balance Received': 'balanceReceived',
  /** DB 고정값 + 구버전 */
  '환불됨 (우리)': 'refunded',
  Refunded: 'refunded',
  "Customer's CC Charged": 'customerCcCharged',
  Deleted: 'deleted',
  'Refund Requested': 'refundRequested',
  '환불됨 (파트너)': 'returned',
  Returned: 'returned',
  'Balance Requested': 'balanceRequested',
  'Commission Received !': 'commissionReceived',
  pending: 'pending',
  Pending: 'pending',
}

/** 상태별 뱃지 색(서로 겹치지 않게 구분) */
const STATUS_BADGE_CLASSES: Record<string, string> = {
  'Partner Received': 'bg-indigo-50 text-indigo-900 border-indigo-200',
  'Deposit Requested': 'bg-amber-50 text-amber-950 border-amber-300',
  'Deposit Received': 'bg-emerald-50 text-emerald-900 border-emerald-200',
  'Balance Received': 'bg-lime-50 text-lime-900 border-lime-300',
  '환불됨 (우리)': 'bg-red-50 text-red-900 border-red-300',
  Refunded: 'bg-red-50 text-red-900 border-red-300',
  "Customer's CC Charged": 'bg-violet-50 text-violet-900 border-violet-200',
  Deleted: 'bg-zinc-200 text-zinc-800 border-zinc-400',
  'Refund Requested': 'bg-orange-50 text-orange-950 border-orange-300',
  '환불됨 (파트너)': 'bg-rose-50 text-rose-900 border-rose-300',
  Returned: 'bg-rose-50 text-rose-900 border-rose-300',
  'Balance Requested': 'bg-sky-50 text-sky-900 border-sky-300',
  'Commission Received !': 'bg-teal-50 text-teal-900 border-teal-300',
  pending: 'bg-slate-100 text-slate-800 border-slate-300',
  Pending: 'bg-slate-100 text-slate-800 border-slate-300',
}

const BADGE_BASE = 'border '

function statusBadgeClass(status: string | null | undefined): string {
  if (!status || !String(status).trim()) return `${BADGE_BASE}bg-neutral-100 text-neutral-600 border-neutral-200`
  const k = status.trim()
  if (STATUS_BADGE_CLASSES[k]) return BADGE_BASE + STATUS_BADGE_CLASSES[k]
  const found = Object.keys(STATUS_BADGE_CLASSES).find((x) => x.toLowerCase() === k.toLowerCase())
  if (found) return BADGE_BASE + STATUS_BADGE_CLASSES[found]
  return `${BADGE_BASE}bg-stone-100 text-stone-800 border-stone-300`
}

/** 우리·파트너 환불 및 Deleted 는 UI에서 음수(환급·역방향)로 표시 */
function shouldDisplayAmountAsNegative(status: string | null | undefined): boolean {
  if (!status || !String(status).trim()) return false
  const s = status.trim()
  if (s === '환불됨 (우리)' || s === '환불됨 (파트너)') return true
  const lower = s.toLowerCase()
  if (lower === 'deleted') return true
  return lower === 'refunded' || lower === 'returned' || s.includes('Refunded') || s.includes('Returned')
}

function signedDisplayNumber(n: number | null | undefined, status: string | null | undefined): number | null {
  if (n == null || !Number.isFinite(Number(n))) return null
  const v = Number(n)
  if (!shouldDisplayAmountAsNegative(status)) return v
  if (v === 0) return 0
  return -Math.abs(v)
}

function amountTextClass(signed: number | null): string {
  if (signed == null) return 'text-gray-500'
  if (signed < 0) return 'text-red-600'
  if (signed > 0) return 'text-green-700'
  return 'text-gray-600'
}

export default function PaymentRecordsHistoryTab() {
  const t = useTranslations('expenses.paymentRecords')
  const params = useParams()
  const locale = typeof params?.locale === 'string' ? params.locale : 'ko'
  const uiLocale = useLocale()
  const { paymentMethodMap } = usePaymentMethodOptions()

  const [allRows, setAllRows] = useState<PaymentRecordRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fetchedCount, setFetchedCount] = useState(0)
  const [resMap, setResMap] = useState<Map<string, ReservationLite>>(() => new Map())
  const [custMap, setCustMap] = useState<Map<string, CustomerLite>>(() => new Map())
  const [channelMap, setChannelMap] = useState<Map<string, ChannelLite>>(() => new Map())
  /** submit_by(이메일) → team 표시명 (display_name 우선, 없으면 name_ko) */
  const [teamSubmitByLabelMap, setTeamSubmitByLabelMap] = useState<Map<string, string>>(() => new Map())

  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterMethod, setFilterMethod] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [tourDateFrom, setTourDateFrom] = useState('')
  const [tourDateTo, setTourDateTo] = useState('')
  const [filterChannel, setFilterChannel] = useState<string>('all')
  const [uiPage, setUiPage] = useState(1)
  const tStmt = useTranslations('expenses.statementRecon')
  const [reconciledPaymentIds, setReconciledPaymentIds] = useState<Set<string>>(() => new Set())
  const [stmtReconOpen, setStmtReconOpen] = useState(false)
  const [stmtReconCtx, setStmtReconCtx] = useState<ExpenseStatementReconContext | null>(null)
  const [sortKey, setSortKey] = useState<string>('submitOn')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const statusLabel = useCallback(
    (raw: string | null | undefined) => {
      if (!raw || !String(raw).trim()) return '—'
      const key = String(raw).trim()
      const slug = PAYMENT_STATUS_SLUG[key]
      if (!slug) return key
      return t(`statusSlug.${slug}` as never)
    },
    [t]
  )

  const enrichMaps = useCallback(async (list: PaymentRecordRow[]) => {
    const resIds = [...new Set(list.map((r) => r.reservation_id).filter(Boolean))]
    const nextRes = new Map<string, ReservationLite>()
    const nextCust = new Map<string, CustomerLite>()
    const nextCh = new Map<string, ChannelLite>()

    for (const part of chunk(resIds, 100)) {
      if (part.length === 0) continue
      const { data: resvs, error: rErr } = await supabase
        .from('reservations')
        .select('id, product_id, tour_date, customer_id, channel_id')
        .in('id', part)
      if (rErr) {
        console.warn('[PaymentRecordsHistoryTab] reservations:', rErr)
        continue
      }
      ;(resvs || []).forEach((r: ReservationLite) => nextRes.set(r.id, r))
    }

    const chIds = [
      ...new Set(
        [...nextRes.values()]
          .map((r) => r.channel_id)
          .filter((id): id is string => Boolean(id && String(id).trim()))
      ),
    ]
    for (const part of chunk(chIds, 100)) {
      if (part.length === 0) continue
      const { data: chs, error: chErr } = await supabase.from('channels').select('id, name').in('id', part)
      if (chErr) {
        console.warn('[PaymentRecordsHistoryTab] channels:', chErr)
        continue
      }
      ;(chs || []).forEach((c: ChannelLite) => nextCh.set(c.id, c))
    }

    const custIds = [
      ...new Set(
        [...nextRes.values()]
          .map((r) => r.customer_id)
          .filter((id): id is string => Boolean(id && String(id).trim()))
      ),
    ]
    for (const part of chunk(custIds, 100)) {
      if (part.length === 0) continue
      const { data: custs, error: cErr } = await supabase
        .from('customers')
        .select('id, name, email')
        .in('id', part)
      if (cErr) {
        console.warn('[PaymentRecordsHistoryTab] customers:', cErr)
        continue
      }
      ;(custs || []).forEach((c: CustomerLite) => nextCust.set(c.id, c))
    }

    const nextTeamLabels = new Map<string, string>()
    if (list.length > 0) {
      const { data: teamRows, error: tErr } = await supabase.from('team').select('email, display_name, name_ko')
      if (tErr) {
        console.warn('[PaymentRecordsHistoryTab] team:', tErr)
      } else {
        for (const row of teamRows ?? []) {
          const rec = row as { email: string; display_name?: string | null; name_ko?: string | null }
          const email = String(rec.email || '').trim()
          if (!email) continue
          const dn = rec.display_name != null ? String(rec.display_name).trim() : ''
          const ko = rec.name_ko != null ? String(rec.name_ko).trim() : ''
          const label = dn || ko || email
          nextTeamLabels.set(email, label)
          nextTeamLabels.set(email.toLowerCase(), label)
        }
      }
    }

    setResMap(nextRes)
    setCustMap(nextCust)
    setChannelMap(nextCh)
    setTeamSubmitByLabelMap(nextTeamLabels)
  }, [])

  const loadAllBatches = useCallback(async () => {
    setLoading(true)
    setError(null)
    setFetchedCount(0)
    setUiPage(1)
    try {
      const acc: PaymentRecordRow[] = []
      let offset = 0
      for (;;) {
        const { data: batch, error: prErr } = await supabase
          .from('payment_records')
          .select(
            'id, reservation_id, amount, amount_krw, payment_method, payment_status, note, submit_on, submit_by, created_at'
          )
          .order('created_at', { ascending: false })
          .range(offset, offset + FETCH_BATCH - 1)

        if (prErr) throw prErr
        const rows = (batch || []) as PaymentRecordRow[]
        acc.push(...rows)
        setFetchedCount(acc.length)
        if (rows.length < FETCH_BATCH) break
        offset += FETCH_BATCH
      }

      const unique = dedupePaymentRows(acc)
      setFetchedCount(unique.length)
      await enrichMaps(unique)
      setAllRows(unique)
    } catch (e) {
      if (!isAbortLikeError(e)) {
        console.error(e)
        setError(t('loadError'))
      }
      setAllRows([])
    } finally {
      setLoading(false)
    }
  }, [enrichMaps, t])

  useEffect(() => {
    void loadAllBatches()
  }, [loadAllBatches])

  useEffect(() => {
    setUiPage(1)
  }, [searchTerm, filterStatus, filterMethod, dateFrom, dateTo, tourDateFrom, tourDateTo, filterChannel])

  const methodLabel = useCallback(
    (id: string | null | undefined) => {
      if (!id || !String(id).trim()) return '—'
      const s = String(id).trim()
      return paymentMethodMap[s] || s
    },
    [paymentMethodMap]
  )

  const customerLabel = useCallback(
    (rid: string) => {
      const res = resMap.get(rid)
      if (!res?.customer_id) return '—'
      const c = custMap.get(res.customer_id)
      if (!c) return '—'
      return c.name || c.email || '—'
    },
    [resMap, custMap]
  )

  const channelLabel = useCallback(
    (rid: string) => {
      const res = resMap.get(rid)
      if (!res?.channel_id) return '—'
      const ch = channelMap.get(res.channel_id)
      return ch?.name || res.channel_id
    },
    [resMap, channelMap]
  )

  const submitByDisplay = useCallback(
    (submitBy: string | null | undefined) => {
      const raw = String(submitBy || '').trim()
      if (!raw) return '—'
      return teamSubmitByLabelMap.get(raw) ?? teamSubmitByLabelMap.get(raw.toLowerCase()) ?? raw
    },
    [teamSubmitByLabelMap]
  )

  const distinctStatuses = useMemo(() => {
    const s = new Set<string>()
    allRows.forEach((r) => {
      if (r.payment_status && String(r.payment_status).trim()) s.add(String(r.payment_status).trim())
    })
    return [...s].sort((a, b) => a.localeCompare(b))
  }, [allRows])

  const distinctMethodIds = useMemo(() => {
    const s = new Set<string>()
    allRows.forEach((r) => {
      if (r.payment_method && String(r.payment_method).trim()) s.add(String(r.payment_method).trim())
    })
    return [...s].sort((a, b) => a.localeCompare(b))
  }, [allRows])

  /** 현재 로드된 행에 등장하는 채널(필터 옵션) */
  const distinctChannels = useMemo(() => {
    const ids = new Set<string>()
    allRows.forEach((r) => {
      const cid = resMap.get(r.reservation_id)?.channel_id
      if (cid && String(cid).trim()) ids.add(String(cid).trim())
    })
    return [...ids]
      .map((id) => ({ id, name: channelMap.get(id)?.name || id }))
      .sort((a, b) => a.name.localeCompare(b.name, uiLocale === 'en' ? 'en' : 'ko'))
  }, [allRows, resMap, channelMap, uiLocale])

  const handlePaymentSort = useCallback(
    (key: string) => {
      if (sortKey === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      } else {
        setSortKey(key)
        setSortDir('asc')
      }
    },
    [sortKey]
  )

  const filteredRows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    return allRows.filter((r) => {
      if (filterStatus !== 'all') {
        const st = (r.payment_status || '').trim()
        if (st !== filterStatus) return false
      }
      if (filterMethod !== 'all') {
        const pm = (r.payment_method || '').trim()
        if (pm !== filterMethod) return false
      }
      const ymd = rowYmd(r)
      if (dateFrom && ymd && ymd < dateFrom) return false
      if (dateTo && ymd && ymd > dateTo) return false

      const res = resMap.get(r.reservation_id)
      const tourY = tourDateYmd(res?.tour_date)
      if (tourDateFrom && (!tourY || tourY < tourDateFrom)) return false
      if (tourDateTo && (!tourY || tourY > tourDateTo)) return false
      if (filterChannel !== 'all') {
        const cid = (res?.channel_id || '').trim()
        if (cid !== filterChannel) return false
      }

      if (!q) return true
      const cust = customerLabel(r.reservation_id)
      const pmLabel = methodLabel(r.payment_method)
      const ch = channelLabel(r.reservation_id)
      const submitDisp = submitByDisplay(r.submit_by)
      const blob = [
        r.reservation_id,
        r.note,
        r.submit_by,
        submitDisp,
        r.payment_status,
        r.payment_method,
        pmLabel,
        cust,
        res?.product_id,
        r.id,
        tourY,
        ch,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return blob.includes(q)
    })
  }, [
    allRows,
    searchTerm,
    filterStatus,
    filterMethod,
    dateFrom,
    dateTo,
    tourDateFrom,
    tourDateTo,
    filterChannel,
    resMap,
    customerLabel,
    methodLabel,
    channelLabel,
    submitByDisplay,
  ])

  const sortLocale = uiLocale === 'en' ? 'en' : 'ko'

  const sortedFilteredRows = useMemo(() => {
    const rows = [...filteredRows]
    rows.sort((ra, rb) => {
      const resA = resMap.get(ra.reservation_id)
      const resB = resMap.get(rb.reservation_id)
      let va: unknown
      let vb: unknown
      switch (sortKey) {
        case 'status':
          va = ra.payment_status
          vb = rb.payment_status
          break
        case 'submitOn':
          va = ra.submit_on || ra.created_at || ''
          vb = rb.submit_on || rb.created_at || ''
          break
        case 'reservation':
          va = ra.reservation_id
          vb = rb.reservation_id
          break
        case 'customer':
          va = customerLabel(ra.reservation_id)
          vb = customerLabel(rb.reservation_id)
          break
        case 'product':
          va = resA?.product_id ?? ''
          vb = resB?.product_id ?? ''
          break
        case 'tourDate':
          va = tourDateYmd(resA?.tour_date)
          vb = tourDateYmd(resB?.tour_date)
          break
        case 'channel':
          va = channelLabel(ra.reservation_id)
          vb = channelLabel(rb.reservation_id)
          break
        case 'amount': {
          va = signedDisplayNumber(ra.amount, ra.payment_status)
          vb = signedDisplayNumber(rb.amount, rb.payment_status)
          break
        }
        case 'amountKrw': {
          va = signedDisplayNumber(ra.amount_krw, ra.payment_status)
          vb = signedDisplayNumber(rb.amount_krw, rb.payment_status)
          break
        }
        case 'method':
          va = methodLabel(ra.payment_method)
          vb = methodLabel(rb.payment_method)
          break
        case 'submitBy':
          va = submitByDisplay(ra.submit_by)
          vb = submitByDisplay(rb.submit_by)
          break
        case 'note':
          va = ra.note
          vb = rb.note
          break
        default:
          va = ra.submit_on || ra.created_at || ''
          vb = rb.submit_on || rb.created_at || ''
      }
      return compareSortValues(va, vb, sortDir, sortLocale)
    })
    return rows
  }, [
    filteredRows,
    sortKey,
    sortDir,
    sortLocale,
    resMap,
    customerLabel,
    channelLabel,
    methodLabel,
    submitByDisplay,
  ])

  const amountStats = useMemo(() => {
    let sumUsd = 0
    let sumKrw = 0
    let nUsd = 0
    let nKrw = 0
    for (const r of filteredRows) {
      const u = signedDisplayNumber(r.amount, r.payment_status)
      if (u != null) {
        sumUsd += u
        nUsd += 1
      }
      const k = signedDisplayNumber(r.amount_krw, r.payment_status)
      if (k != null) {
        sumKrw += k
        nKrw += 1
      }
    }
    return { sumUsd, sumKrw, nUsd, nKrw, rowCount: filteredRows.length }
  }, [filteredRows])

  const totalPages = Math.max(1, Math.ceil(sortedFilteredRows.length / UI_PAGE_SIZE))
  const safePage = Math.min(Math.max(1, uiPage), totalPages)
  const pageSlice = useMemo(() => {
    const start = (safePage - 1) * UI_PAGE_SIZE
    return sortedFilteredRows.slice(start, start + UI_PAGE_SIZE)
  }, [sortedFilteredRows, safePage])

  const paymentReconPageKey = useMemo(
    () =>
      pageSlice
        .map((r) => String(r.id || '').trim())
        .filter(Boolean)
        .join('|'),
    [pageSlice]
  )

  useEffect(() => {
    const ids = pageSlice.map((r) => String(r.id || '').trim()).filter(Boolean)
    if (ids.length === 0) {
      setReconciledPaymentIds(new Set())
      return
    }
    let cancelled = false
    void fetchReconciledSourceIds(supabase, 'payment_records', ids).then((s) => {
      if (!cancelled) setReconciledPaymentIds(s)
    })
    return () => {
      cancelled = true
    }
  }, [paymentReconPageKey])

  const openPaymentStmtRecon = (r: PaymentRecordRow) => {
    const id = String(r.id || '').trim()
    if (!id) return
    const ymd = rowYmd(r)
    if (!ymd) return
    setStmtReconCtx({
      sourceTable: 'payment_records',
      sourceId: id,
      dateYmd: ymd,
      amount: Math.abs(Number(r.amount ?? 0)),
      direction: 'inflow'
    })
    setStmtReconOpen(true)
  }

  useEffect(() => {
    if (uiPage > totalPages) setUiPage(totalPages)
  }, [uiPage, totalPages])

  const fmtUsd = useMemo(
    () =>
      new Intl.NumberFormat(uiLocale === 'en' ? 'en-US' : 'ko-KR', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 2,
      }),
    [uiLocale]
  )

  const fmtKrw = useMemo(
    () =>
      new Intl.NumberFormat('ko-KR', {
        style: 'currency',
        currency: 'KRW',
        maximumFractionDigits: 0,
      }),
    []
  )

  const formatSignedUsd = (n: number | null | undefined, status: string | null | undefined) => {
    const s = signedDisplayNumber(n, status)
    if (s == null) return '—'
    return fmtUsd.format(s)
  }

  const formatSignedKrw = (n: number | null | undefined, status: string | null | undefined) => {
    const s = signedDisplayNumber(n, status)
    if (s == null) return '—'
    return fmtKrw.format(s)
  }

  const formatDate = (iso: string | null | undefined) => {
    if (!iso) return '—'
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleString(uiLocale === 'en' ? 'en-US' : 'ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatTourDateOnly = (iso: string | null | undefined) => {
    const y = tourDateYmd(iso)
    if (!y) return '—'
    const d = new Date(y + 'T12:00:00')
    if (Number.isNaN(d.getTime())) return y
    return d.toLocaleDateString(uiLocale === 'en' ? 'en-US' : 'ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  }

  const resetFilters = () => {
    setSearchTerm('')
    setFilterStatus('all')
    setFilterMethod('all')
    setDateFrom('')
    setDateTo('')
    setTourDateFrom('')
    setTourDateTo('')
    setFilterChannel('all')
    setUiPage(1)
  }

  const fromIdx = sortedFilteredRows.length === 0 ? 0 : (safePage - 1) * UI_PAGE_SIZE + 1
  const toIdx = sortedFilteredRows.length === 0 ? 0 : Math.min(sortedFilteredRows.length, safePage * UI_PAGE_SIZE)

  const StatusBadge = ({ status }: { status: string | null | undefined }) => (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap max-w-[200px] truncate ${statusBadgeClass(status)}`}
      title={status || ''}
    >
      {statusLabel(status)}
    </span>
  )

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <p className="text-xs sm:text-sm text-gray-600">{t('hint')}</p>
        <button
          type="button"
          onClick={() => void loadAllBatches()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white hover:bg-gray-50 text-gray-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {t('refresh')}
        </button>
      </div>

      {!loading && allRows.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-3 sm:p-4 space-y-3 border border-gray-100">
          <div className="flex flex-col lg:flex-row gap-2 lg:gap-3 lg:items-end">
            <div className="flex-1 min-w-0 relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t('searchPlaceholder')}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2 flex-[2]">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-0.5">{t('filterStatus')}</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg bg-white"
                >
                  <option value="all">{t('filterAll')}</option>
                  {distinctStatuses.map((st) => (
                    <option key={st} value={st}>
                      {statusLabel(st)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-0.5">{t('filterMethod')}</label>
                <select
                  value={filterMethod}
                  onChange={(e) => setFilterMethod(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg bg-white"
                >
                  <option value="all">{t('filterAll')}</option>
                  {distinctMethodIds.map((mid) => (
                    <option key={mid} value={mid}>
                      {methodLabel(mid)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-0.5">{t('filterDateFrom')}</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-0.5">{t('filterDateTo')}</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-0.5">{t('filterTourDateFrom')}</label>
                <input
                  type="date"
                  value={tourDateFrom}
                  onChange={(e) => setTourDateFrom(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-0.5">{t('filterTourDateTo')}</label>
                <input
                  type="date"
                  value={tourDateTo}
                  onChange={(e) => setTourDateTo(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg bg-white"
                />
              </div>
              <div className="col-span-2 sm:col-span-1 lg:col-span-2 xl:col-span-1">
                <label className="block text-xs font-medium text-gray-600 mb-0.5">{t('filterChannel')}</label>
                <select
                  value={filterChannel}
                  onChange={(e) => setFilterChannel(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg bg-white"
                >
                  <option value="all">{t('filterAll')}</option>
                  {distinctChannels.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      {ch.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button
              type="button"
              onClick={resetFilters}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white hover:bg-gray-100 text-gray-700 whitespace-nowrap"
            >
              {t('filterReset')}
            </button>
          </div>
          <p className="text-xs text-gray-600">
            {t('summaryLoaded', { total: allRows.length })}
            {filteredRows.length !== allRows.length && (
              <span className="ml-1 text-blue-700">{t('summaryFiltered', { n: filteredRows.length })}</span>
            )}
          </p>
          <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
            <div>
              <div className="text-xs font-medium text-gray-500">{t('statsRowCount')}</div>
              <div className="tabular-nums font-semibold text-gray-900">{amountStats.rowCount}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-gray-500">{t('statsSumUsd')}</div>
              <div
                className={`tabular-nums font-semibold ${amountTextClass(amountStats.nUsd ? amountStats.sumUsd : null)}`}
              >
                {amountStats.nUsd ? fmtUsd.format(amountStats.sumUsd) : '—'}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-gray-500">{t('statsSumKrw')}</div>
              <div
                className={`tabular-nums font-semibold ${amountTextClass(amountStats.nKrw ? amountStats.sumKrw : null)}`}
              >
                {amountStats.nKrw ? fmtKrw.format(amountStats.sumKrw) : '—'}
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}

      {loading ? (
        <div className="text-center py-10 text-gray-500 text-sm space-y-2">
          <div>{t('loading')}</div>
          {fetchedCount > 0 && <div className="text-xs text-gray-400">{t('loadingBatches', { count: fetchedCount })}</div>}
        </div>
      ) : sortedFilteredRows.length === 0 ? (
        <div className="text-center py-10 text-gray-500 text-sm">{allRows.length === 0 ? t('empty') : t('emptyFiltered')}</div>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs sm:text-sm text-gray-600">
            <span>{t('pageRange', { from: fromIdx, to: toIdx, total: sortedFilteredRows.length })}</span>
            <div className="flex items-center gap-1 flex-wrap justify-end">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setUiPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-0.5 px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:pointer-events-none"
              >
                <ChevronLeft className="w-4 h-4" />
                {t('prev')}
              </button>
              <span className="px-2 py-1 tabular-nums">
                {safePage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setUiPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex items-center gap-0.5 px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:pointer-events-none"
              >
                {t('next')}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="md:hidden space-y-2">
            {pageSlice.map((r, idx) => {
              const res = resMap.get(r.reservation_id)
              const gIdx = (safePage - 1) * UI_PAGE_SIZE + idx
              return (
                <div
                  key={rowListKey(r, gIdx)}
                  className="border border-gray-200 rounded-lg p-3 bg-white text-sm space-y-2 shadow-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={r.payment_status} />
                    <ExpenseStatementReconIcon
                      matched={Boolean(r.id) && reconciledPaymentIds.has(String(r.id))}
                      disabled={!String(r.id || '').trim()}
                      titleMatched={tStmt('matchedTitle')}
                      titleUnmatched={tStmt('unmatchedTitle')}
                      titleDisabled={tStmt('disabledTitle')}
                      onClick={() => openPaymentStmtRecon(r)}
                    />
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-500 text-xs">{t('columns.submitOn')}</span>
                    <span className="font-medium text-right">{formatDate(r.submit_on || r.created_at)}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-500 text-xs">{t('columns.amount')}</span>
                    <span className={`font-semibold ${amountTextClass(signedDisplayNumber(r.amount, r.payment_status))}`}>
                      {formatSignedUsd(r.amount, r.payment_status)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2 text-xs">
                    <span className="text-gray-500">{t('columns.amountKrw')}</span>
                    <span className={amountTextClass(signedDisplayNumber(r.amount_krw, r.payment_status))}>
                      {formatSignedKrw(r.amount_krw, r.payment_status)}
                    </span>
                  </div>
                  <div className="text-xs">
                    <span className="text-gray-500">{t('columns.customer')}: </span>
                    <span>{customerLabel(r.reservation_id)}</span>
                  </div>
                  <div className="text-xs truncate">
                    <Link
                      href={`/${locale}/admin/reservations/${r.reservation_id}`}
                      className="text-blue-600 hover:underline font-mono"
                    >
                      {r.reservation_id}
                    </Link>
                    {res?.product_id ? <span className="text-gray-500"> · {res.product_id}</span> : null}
                  </div>
                  <div className="flex justify-between gap-2 text-xs">
                    <span className="text-gray-500 shrink-0">{t('columns.tourDate')}</span>
                    <span className="font-medium text-right">{formatTourDateOnly(res?.tour_date)}</span>
                  </div>
                  <div className="flex justify-between gap-2 text-xs min-w-0">
                    <span className="text-gray-500 shrink-0">{t('columns.channel')}</span>
                    <span className="truncate text-right" title={channelLabel(r.reservation_id)}>
                      {channelLabel(r.reservation_id)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 truncate" title={methodLabel(r.payment_method)}>
                    {methodLabel(r.payment_method)}
                  </div>
                  {r.submit_by ? (
                    <div className="text-xs text-gray-500" title={r.submit_by}>
                      {t('columns.submitBy')}: {submitByDisplay(r.submit_by)}
                    </div>
                  ) : null}
                  {r.note ? <p className="text-xs text-gray-500 line-clamp-2">{r.note}</p> : null}
                </div>
              )
            })}
          </div>

          <div className="hidden md:block overflow-x-auto border border-gray-200 rounded-lg">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-12" title={tStmt('unmatchedTitle')}>
                    {tStmt('columnHeaderShort')}
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs uppercase tracking-wider align-bottom">
                    <TableSortHeaderButton
                      label={t('columns.status')}
                      active={sortKey === 'status'}
                      dir={sortDir}
                      onClick={() => handlePaymentSort('status')}
                    />
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs uppercase tracking-wider align-bottom">
                    <TableSortHeaderButton
                      label={t('columns.submitOn')}
                      active={sortKey === 'submitOn'}
                      dir={sortDir}
                      onClick={() => handlePaymentSort('submitOn')}
                    />
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs uppercase tracking-wider align-bottom">
                    <TableSortHeaderButton
                      label={t('columns.reservation')}
                      active={sortKey === 'reservation'}
                      dir={sortDir}
                      onClick={() => handlePaymentSort('reservation')}
                    />
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs uppercase tracking-wider align-bottom">
                    <TableSortHeaderButton
                      label={t('columns.customer')}
                      active={sortKey === 'customer'}
                      dir={sortDir}
                      onClick={() => handlePaymentSort('customer')}
                    />
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs uppercase tracking-wider align-bottom">
                    <TableSortHeaderButton
                      label={t('columns.product')}
                      active={sortKey === 'product'}
                      dir={sortDir}
                      onClick={() => handlePaymentSort('product')}
                    />
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs uppercase tracking-wider whitespace-nowrap align-bottom">
                    <TableSortHeaderButton
                      label={t('columns.tourDate')}
                      active={sortKey === 'tourDate'}
                      dir={sortDir}
                      onClick={() => handlePaymentSort('tourDate')}
                    />
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs uppercase tracking-wider align-bottom">
                    <TableSortHeaderButton
                      label={t('columns.channel')}
                      active={sortKey === 'channel'}
                      dir={sortDir}
                      onClick={() => handlePaymentSort('channel')}
                    />
                  </th>
                  <th className="px-3 py-2.5 text-right text-xs uppercase tracking-wider align-bottom">
                    <div className="flex justify-end">
                      <TableSortHeaderButton
                        label={t('columns.amount')}
                        active={sortKey === 'amount'}
                        dir={sortDir}
                        onClick={() => handlePaymentSort('amount')}
                        className="text-right"
                      />
                    </div>
                  </th>
                  <th className="px-3 py-2.5 text-right text-xs uppercase tracking-wider align-bottom">
                    <div className="flex justify-end">
                      <TableSortHeaderButton
                        label={t('columns.amountKrw')}
                        active={sortKey === 'amountKrw'}
                        dir={sortDir}
                        onClick={() => handlePaymentSort('amountKrw')}
                        className="text-right"
                      />
                    </div>
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs uppercase tracking-wider align-bottom">
                    <TableSortHeaderButton
                      label={t('columns.method')}
                      active={sortKey === 'method'}
                      dir={sortDir}
                      onClick={() => handlePaymentSort('method')}
                    />
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs uppercase tracking-wider align-bottom">
                    <TableSortHeaderButton
                      label={t('columns.submitBy')}
                      active={sortKey === 'submitBy'}
                      dir={sortDir}
                      onClick={() => handlePaymentSort('submitBy')}
                    />
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs uppercase tracking-wider align-bottom">
                    <TableSortHeaderButton
                      label={t('columns.note')}
                      active={sortKey === 'note'}
                      dir={sortDir}
                      onClick={() => handlePaymentSort('note')}
                    />
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {pageSlice.map((r, idx) => {
                  const res = resMap.get(r.reservation_id)
                  const gIdx = (safePage - 1) * UI_PAGE_SIZE + idx
                  return (
                    <tr key={rowListKey(r, gIdx)} className="hover:bg-gray-50/80">
                      <td className="px-3 py-2 align-middle text-center" onClick={(e) => e.stopPropagation()}>
                        <ExpenseStatementReconIcon
                          matched={Boolean(r.id) && reconciledPaymentIds.has(String(r.id))}
                          disabled={!String(r.id || '').trim()}
                          titleMatched={tStmt('matchedTitle')}
                          titleUnmatched={tStmt('unmatchedTitle')}
                          titleDisabled={tStmt('disabledTitle')}
                          onClick={() => openPaymentStmtRecon(r)}
                        />
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <StatusBadge status={r.payment_status} />
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-gray-900">
                        {formatDate(r.submit_on || r.created_at)}
                      </td>
                      <td className="px-3 py-2">
                        <Link
                          href={`/${locale}/admin/reservations/${r.reservation_id}`}
                          className="text-blue-600 hover:underline font-mono text-xs max-w-[min(220px,28vw)] truncate inline-block align-bottom"
                          title={r.reservation_id}
                        >
                          {r.reservation_id}
                        </Link>
                      </td>
                      <td
                        className="px-3 py-2 text-gray-800 max-w-[140px] truncate"
                        title={customerLabel(r.reservation_id)}
                      >
                        {customerLabel(r.reservation_id)}
                      </td>
                      <td className="px-3 py-2 text-gray-600 font-mono text-xs max-w-[120px] truncate">
                        {res?.product_id ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-gray-800 whitespace-nowrap text-xs">
                        {formatTourDateOnly(res?.tour_date)}
                      </td>
                      <td
                        className="px-3 py-2 text-gray-700 text-xs max-w-[min(160px,18vw)] truncate"
                        title={channelLabel(r.reservation_id)}
                      >
                        {channelLabel(r.reservation_id)}
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-medium whitespace-nowrap ${amountTextClass(
                          signedDisplayNumber(r.amount, r.payment_status)
                        )}`}
                      >
                        {formatSignedUsd(r.amount, r.payment_status)}
                      </td>
                      <td
                        className={`px-3 py-2 text-right whitespace-nowrap ${amountTextClass(
                          signedDisplayNumber(r.amount_krw, r.payment_status)
                        )}`}
                      >
                        {formatSignedKrw(r.amount_krw, r.payment_status)}
                      </td>
                      <td
                        className="px-3 py-2 text-gray-700 max-w-[160px] truncate"
                        title={methodLabel(r.payment_method)}
                      >
                        {methodLabel(r.payment_method)}
                      </td>
                      <td
                        className="px-3 py-2 text-gray-600 text-xs max-w-[140px] truncate"
                        title={r.submit_by || undefined}
                      >
                        {submitByDisplay(r.submit_by)}
                      </td>
                      <td className="px-3 py-2 text-gray-500 text-xs max-w-[200px] truncate" title={r.note || ''}>
                        {r.note || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-1 text-xs sm:text-sm text-gray-600 border-t border-gray-100">
            <span>{t('pageRange', { from: fromIdx, to: toIdx, total: sortedFilteredRows.length })}</span>
            <div className="flex items-center gap-1 flex-wrap justify-end">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setUiPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-0.5 px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:pointer-events-none"
              >
                <ChevronLeft className="w-4 h-4" />
                {t('prev')}
              </button>
              <span className="px-2 py-1 tabular-nums">
                {safePage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setUiPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex items-center gap-0.5 px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:pointer-events-none"
              >
                {t('next')}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}

      <ExpenseStatementSimilarLinesModal
        open={stmtReconOpen}
        onOpenChange={(o) => {
          setStmtReconOpen(o)
          if (!o) setStmtReconCtx(null)
        }}
        context={stmtReconCtx}
        onApplied={() => void loadAllBatches()}
      />
    </div>
  )
}
