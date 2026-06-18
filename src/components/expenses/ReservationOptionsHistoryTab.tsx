'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { RefreshCw, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { supabase, isAbortLikeError } from '@/lib/supabase'
import { compareSortValues, type SortDir } from '@/lib/clientTableSort'
import TableSortHeaderButton from '@/components/expenses/TableSortHeaderButton'
import StringMultiSelectFilter from '@/components/filters/StringMultiSelectFilter'
import { reservationOptionCountsTowardPricingTotal, isOptionIdUuidLike } from '@/utils/reservationOptionsShared'

type ReservationOptionRow = {
  id: string
  reservation_id: string
  option_id: string
  ea: number | null
  price: number | null
  total_price: number | null
  status: string | null
  note: string | null
  created_at: string | null
  updated_at: string | null
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
type OptionLite = { id: string; name: string | null; name_ko: string | null; name_en: string | null; category: string | null }

function optionLiteFromRawOptionId(id: string): OptionLite {
  const label = String(id).trim()
  return { id: label, name: label, name_ko: label, name_en: label, category: null }
}

const FETCH_BATCH = 400
const UI_PAGE_SIZE = 50

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function rowYmd(r: ReservationOptionRow): string {
  const iso = r.created_at
  if (!iso) return ''
  return iso.slice(0, 10)
}

function tourDateYmd(tourDate: string | null | undefined): string {
  if (!tourDate || !String(tourDate).trim()) return ''
  return String(tourDate).trim().slice(0, 10)
}

function rowListKey(r: ReservationOptionRow, globalIndex: number): string {
  return `ro-${globalIndex}-${r.id || 'noid'}--${r.reservation_id}--${r.created_at ?? ''}`
}

function lineTotal(r: ReservationOptionRow): number {
  const tp = r.total_price
  if (tp != null && Number.isFinite(Number(tp))) return Number(tp)
  const ea = Number(r.ea) || 0
  const price = Number(r.price) || 0
  return Math.round(ea * price * 100) / 100
}

const STATUS_BADGE_CLASSES: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-900 border-emerald-200',
  cancelled: 'bg-red-50 text-red-900 border-red-300',
  refunded: 'bg-orange-50 text-orange-950 border-orange-300',
  canceled: 'bg-red-50 text-red-900 border-red-300',
}

const BADGE_BASE = 'border '

function statusBadgeClass(status: string | null | undefined): string {
  if (!status || !String(status).trim()) return `${BADGE_BASE}bg-neutral-100 text-neutral-600 border-neutral-200`
  const k = String(status).trim().toLowerCase()
  if (STATUS_BADGE_CLASSES[k]) return BADGE_BASE + STATUS_BADGE_CLASSES[k]
  return `${BADGE_BASE}bg-stone-100 text-stone-800 border-stone-300`
}

export default function ReservationOptionsHistoryTab() {
  const t = useTranslations('expenses.reservationOptionsHistory')
  const tOpt = useTranslations('reservations.reservationOptions')
  const params = useParams()
  const locale = typeof params?.locale === 'string' ? params.locale : 'ko'
  const uiLocale = useLocale()

  const [allRows, setAllRows] = useState<ReservationOptionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fetchedCount, setFetchedCount] = useState(0)
  const [resMap, setResMap] = useState<Map<string, ReservationLite>>(() => new Map())
  const [custMap, setCustMap] = useState<Map<string, CustomerLite>>(() => new Map())
  const [channelMap, setChannelMap] = useState<Map<string, ChannelLite>>(() => new Map())
  const [optionMap, setOptionMap] = useState<Map<string, OptionLite>>(() => new Map())

  const [searchTerm, setSearchTerm] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [tourDateFrom, setTourDateFrom] = useState('')
  const [tourDateTo, setTourDateTo] = useState('')
  const [filterChannel, setFilterChannel] = useState<string>('all')
  const [filterOptions, setFilterOptions] = useState<Set<string>>(() => new Set())
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [uiPage, setUiPage] = useState(1)
  const [sortKey, setSortKey] = useState<string>('createdAt')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const statusLabel = useCallback(
    (raw: string | null | undefined) => {
      if (!raw || !String(raw).trim()) return '—'
      const k = String(raw).trim().toLowerCase()
      if (k === 'active') return tOpt('statusActive')
      if (k === 'cancelled' || k === 'canceled') return tOpt('statusCancelled')
      if (k === 'refunded') return tOpt('statusRefunded')
      return String(raw).trim()
    },
    [tOpt]
  )

  const optionLabel = useCallback(
    (optionId: string | null | undefined) => {
      const oid = String(optionId || '').trim()
      if (!oid) return '—'
      const opt = optionMap.get(oid)
      if (!opt) return oid
      if (uiLocale === 'en') {
        return opt.name_en || opt.name || opt.name_ko || oid
      }
      return opt.name_ko || opt.name || opt.name_en || oid
    },
    [optionMap, uiLocale]
  )

  const enrichMaps = useCallback(async (list: ReservationOptionRow[]) => {
    const resIds = [...new Set(list.map((r) => r.reservation_id).filter(Boolean))]
    const nextRes = new Map<string, ReservationLite>()
    const nextCust = new Map<string, CustomerLite>()
    const nextCh = new Map<string, ChannelLite>()
    const nextOpt = new Map<string, OptionLite>()

    for (const part of chunk(resIds, 100)) {
      if (part.length === 0) continue
      const { data: resvs, error: rErr } = await supabase
        .from('reservations')
        .select('id, product_id, tour_date, customer_id, channel_id')
        .in('id', part)
      if (rErr) {
        console.warn('[ReservationOptionsHistoryTab] reservations:', rErr)
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
        console.warn('[ReservationOptionsHistoryTab] channels:', chErr)
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
        console.warn('[ReservationOptionsHistoryTab] customers:', cErr)
        continue
      }
      ;(custs || []).forEach((c: CustomerLite) => nextCust.set(c.id, c))
    }

    const optionIds = [...new Set(list.map((r) => r.option_id).filter(Boolean))]
    for (const part of chunk(optionIds, 100)) {
      if (part.length === 0) continue
      const { data: opts, error: oErr } = await supabase
        .from('options')
        .select('id, name, name_ko, name_en, category')
        .in('id', part)
      if (oErr) {
        console.warn('[ReservationOptionsHistoryTab] options:', oErr)
      } else {
        ;(opts || []).forEach((o: OptionLite) => nextOpt.set(o.id, o))
      }
      const missing = part.filter((id) => !nextOpt.has(id))
      for (const id of missing) {
        if (!isOptionIdUuidLike(id)) {
          nextOpt.set(id, optionLiteFromRawOptionId(id))
        }
      }
      const missingUuids = missing.filter((id) => isOptionIdUuidLike(id) && !nextOpt.has(id))
      if (missingUuids.length > 0) {
        const { data: po, error: poErr } = await supabase
          .from('product_options')
          .select('id, name')
          .in('id', missingUuids)
        if (poErr) {
          console.warn('[ReservationOptionsHistoryTab] product_options:', poErr)
        } else {
          for (const o of po || []) {
            if (o?.id != null) {
              nextOpt.set(String(o.id), {
                id: String(o.id),
                name: (o as { name?: string }).name ?? null,
                name_ko: null,
                name_en: null,
                category: null,
              })
            }
          }
        }
        for (const id of missingUuids) {
          if (!nextOpt.has(id)) {
            nextOpt.set(id, optionLiteFromRawOptionId(id))
          }
        }
      }
    }

    setResMap(nextRes)
    setCustMap(nextCust)
    setChannelMap(nextCh)
    setOptionMap(nextOpt)
  }, [])

  const loadAllBatches = useCallback(async () => {
    setLoading(true)
    setError(null)
    setFetchedCount(0)
    setUiPage(1)
    try {
      const acc: ReservationOptionRow[] = []
      let offset = 0
      for (;;) {
        const { data: batch, error: roErr } = await supabase
          .from('reservation_options')
          .select(
            'id, reservation_id, option_id, ea, price, total_price, status, note, created_at, updated_at'
          )
          .order('created_at', { ascending: false })
          .range(offset, offset + FETCH_BATCH - 1)

        if (roErr) throw roErr
        const rows = (batch || []) as ReservationOptionRow[]
        acc.push(...rows)
        setFetchedCount(acc.length)
        if (rows.length < FETCH_BATCH) break
        offset += FETCH_BATCH
      }

      await enrichMaps(acc)
      setAllRows(acc)
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
  }, [searchTerm, filterStatus, dateFrom, dateTo, tourDateFrom, tourDateTo, filterChannel, filterOptions, filterCategory])

  const applySearch = useCallback(() => {
    setSearchTerm(searchInput.trim())
  }, [searchInput])

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

  const distinctStatuses = useMemo(() => {
    const s = new Set<string>()
    allRows.forEach((r) => {
      if (r.status && String(r.status).trim()) s.add(String(r.status).trim().toLowerCase())
    })
    return [...s].sort((a, b) => a.localeCompare(b))
  }, [allRows])

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

  const distinctOptions = useMemo(() => {
    const ids = new Set<string>()
    allRows.forEach((r) => {
      const oid = String(r.option_id || '').trim()
      if (oid) ids.add(oid)
    })
    return [...ids]
      .map((id) => ({ id, name: optionLabel(id) }))
      .sort((a, b) => a.name.localeCompare(b.name, uiLocale === 'en' ? 'en' : 'ko'))
  }, [allRows, optionLabel, uiLocale])

  const optionFilterOptions = useMemo(
    () => distinctOptions.map((opt) => ({ value: opt.id, label: opt.name })),
    [distinctOptions]
  )

  const optionSelectedCountLabel = useCallback(
    (count: number) => t('filterOptionsSelectedCount', { count }),
    [t]
  )

  const distinctCategories = useMemo(() => {
    const cats = new Set<string>()
    allRows.forEach((r) => {
      const cat = String(optionMap.get(r.option_id)?.category || '').trim()
      if (cat) cats.add(cat)
    })
    return [...cats].sort((a, b) => a.localeCompare(b, uiLocale === 'en' ? 'en' : 'ko'))
  }, [allRows, optionMap, uiLocale])

  const handleSort = useCallback(
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
        const st = String(r.status || '').trim().toLowerCase()
        if (st !== filterStatus.toLowerCase()) return false
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
      if (filterOptions.size > 0) {
        const oid = String(r.option_id || '').trim()
        if (!filterOptions.has(oid)) return false
      }
      if (filterCategory !== 'all') {
        const cat = String(optionMap.get(r.option_id)?.category || '').trim()
        if (cat !== filterCategory) return false
      }

      if (!q) return true
      const optName = optionLabel(r.option_id)
      const optCat = optionMap.get(r.option_id)?.category || ''
      const cust = customerLabel(r.reservation_id)
      const ch = channelLabel(r.reservation_id)
      const blob = [
        r.id,
        r.reservation_id,
        r.option_id,
        optName,
        optCat,
        r.note,
        r.status,
        cust,
        res?.product_id,
        tourY,
        ch,
        String(r.ea ?? ''),
        String(r.price ?? ''),
        String(lineTotal(r)),
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
    dateFrom,
    dateTo,
    tourDateFrom,
    tourDateTo,
    filterChannel,
    filterOptions,
    filterCategory,
    resMap,
    optionMap,
    customerLabel,
    channelLabel,
    optionLabel,
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
          va = ra.status
          vb = rb.status
          break
        case 'createdAt':
          va = ra.created_at || ''
          vb = rb.created_at || ''
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
        case 'option':
          va = optionLabel(ra.option_id)
          vb = optionLabel(rb.option_id)
          break
        case 'category':
          va = optionMap.get(ra.option_id)?.category ?? ''
          vb = optionMap.get(rb.option_id)?.category ?? ''
          break
        case 'ea':
          va = ra.ea
          vb = rb.ea
          break
        case 'price':
          va = ra.price
          vb = rb.price
          break
        case 'total':
          va = lineTotal(ra)
          vb = lineTotal(rb)
          break
        case 'note':
          va = ra.note
          vb = rb.note
          break
        default:
          va = ra.created_at || ''
          vb = rb.created_at || ''
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
    optionMap,
    customerLabel,
    channelLabel,
    optionLabel,
  ])

  const amountStats = useMemo(() => {
    let sumAll = 0
    let sumActive = 0
    let qtyAll = 0
    let qtyActive = 0
    for (const r of filteredRows) {
      const total = lineTotal(r)
      const qty = Math.max(0, Math.floor(Number(r.ea) || 0))
      sumAll += total
      qtyAll += qty
      if (reservationOptionCountsTowardPricingTotal(r.status as 'active' | 'cancelled' | 'refunded' | null)) {
        sumActive += total
        qtyActive += qty
      }
    }
    return { sumAll, sumActive, qtyAll, qtyActive, rowCount: filteredRows.length }
  }, [filteredRows])

  const totalPages = Math.max(1, Math.ceil(sortedFilteredRows.length / UI_PAGE_SIZE))
  const safePage = Math.min(Math.max(1, uiPage), totalPages)
  const pageSlice = useMemo(() => {
    const start = (safePage - 1) * UI_PAGE_SIZE
    return sortedFilteredRows.slice(start, start + UI_PAGE_SIZE)
  }, [sortedFilteredRows, safePage])

  useEffect(() => {
    if (uiPage > totalPages) setUiPage(totalPages)
  }, [uiPage, totalPages])

  const fmtQty = useMemo(
    () => new Intl.NumberFormat(uiLocale === 'en' ? 'en-US' : 'ko-KR', { maximumFractionDigits: 0 }),
    [uiLocale]
  )

  const fmtUsd = useMemo(
    () =>
      new Intl.NumberFormat(uiLocale === 'en' ? 'en-US' : 'ko-KR', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 2,
      }),
    [uiLocale]
  )

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
    setSearchInput('')
    setSearchTerm('')
    setFilterStatus('all')
    setDateFrom('')
    setDateTo('')
    setTourDateFrom('')
    setTourDateTo('')
    setFilterChannel('all')
    setFilterOptions(new Set())
    setFilterCategory('all')
    setUiPage(1)
  }

  const fromIdx = sortedFilteredRows.length === 0 ? 0 : (safePage - 1) * UI_PAGE_SIZE + 1
  const toIdx = sortedFilteredRows.length === 0 ? 0 : Math.min(sortedFilteredRows.length, safePage * UI_PAGE_SIZE)

  const StatusBadge = ({ status }: { status: string | null | undefined }) => (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap max-w-[120px] truncate ${statusBadgeClass(status)}`}
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
          <div className="flex flex-col gap-2 lg:gap-3">
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:items-end">
              <div className="flex flex-1 min-w-0 gap-2">
                <div className="flex-1 min-w-0 relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        applySearch()
                      }
                    }}
                    placeholder={t('searchPlaceholder')}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={applySearch}
                  className="shrink-0 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Search className="w-4 h-4" />
                  {t('search')}
                </button>
              </div>
              <div className="w-full sm:w-auto sm:min-w-[16rem] md:min-w-[20rem] lg:min-w-[24rem] shrink-0">
                <StringMultiSelectFilter
                  id="ro-filter-option"
                  groupLabel={t('filterOption')}
                  options={optionFilterOptions}
                  selected={filterOptions}
                  onChange={setFilterOptions}
                  searchable
                  searchPlaceholder={t('filterOptionsSearch')}
                  allLabel={t('filterAll')}
                  clearLabel={t('filterOptionsClear')}
                  selectedCountLabel={optionSelectedCountLabel}
                  emptySearchLabel={t('filterOptionsSearchEmpty')}
                  panelClassName="min-w-[min(calc(100vw-2rem),28rem)] sm:min-w-[22rem]"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-0.5">{t('filterCategory')}</label>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg bg-white"
                >
                  <option value="all">{t('filterAll')}</option>
                  {distinctCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
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
              <div>
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
          <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-sm">
            <div>
              <div className="text-xs font-medium text-gray-500">{t('statsRowCount')}</div>
              <div className="tabular-nums font-semibold text-gray-900">{amountStats.rowCount}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-gray-500">{t('statsQtyActive')}</div>
              <div className="tabular-nums font-semibold text-blue-700">{fmtQty.format(amountStats.qtyActive)}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-gray-500">{t('statsQtyAll')}</div>
              <div className="tabular-nums font-semibold text-gray-900">{fmtQty.format(amountStats.qtyAll)}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-gray-500">{t('statsSumActive')}</div>
              <div className="tabular-nums font-semibold text-green-700">{fmtUsd.format(amountStats.sumActive)}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-gray-500">{t('statsSumAll')}</div>
              <div className="tabular-nums font-semibold text-gray-900">{fmtUsd.format(amountStats.sumAll)}</div>
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
                    <StatusBadge status={r.status} />
                    <span className="font-medium">{optionLabel(r.option_id)}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-500 text-xs">{t('columns.createdAt')}</span>
                    <span className="font-medium text-right">{formatDate(r.created_at)}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-500 text-xs">{t('columns.total')}</span>
                    <span className="font-semibold text-green-700">{fmtUsd.format(lineTotal(r))}</span>
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
                  <div className="flex justify-between gap-2 text-xs">
                    <span className="text-gray-500">{t('columns.ea')}</span>
                    <span>{r.ea ?? '—'}</span>
                  </div>
                  <div className="flex justify-between gap-2 text-xs">
                    <span className="text-gray-500">{t('columns.price')}</span>
                    <span>{r.price != null ? fmtUsd.format(Number(r.price)) : '—'}</span>
                  </div>
                  {r.note ? <p className="text-xs text-gray-500 line-clamp-2">{r.note}</p> : null}
                </div>
              )
            })}
          </div>

          <div className="hidden md:block overflow-x-auto border border-gray-200 rounded-lg">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2.5 text-left text-xs uppercase tracking-wider align-bottom">
                    <TableSortHeaderButton
                      label={t('columns.status')}
                      active={sortKey === 'status'}
                      dir={sortDir}
                      onClick={() => handleSort('status')}
                    />
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs uppercase tracking-wider align-bottom">
                    <TableSortHeaderButton
                      label={t('columns.createdAt')}
                      active={sortKey === 'createdAt'}
                      dir={sortDir}
                      onClick={() => handleSort('createdAt')}
                    />
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs uppercase tracking-wider align-bottom">
                    <TableSortHeaderButton
                      label={t('columns.reservation')}
                      active={sortKey === 'reservation'}
                      dir={sortDir}
                      onClick={() => handleSort('reservation')}
                    />
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs uppercase tracking-wider align-bottom">
                    <TableSortHeaderButton
                      label={t('columns.customer')}
                      active={sortKey === 'customer'}
                      dir={sortDir}
                      onClick={() => handleSort('customer')}
                    />
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs uppercase tracking-wider align-bottom">
                    <TableSortHeaderButton
                      label={t('columns.product')}
                      active={sortKey === 'product'}
                      dir={sortDir}
                      onClick={() => handleSort('product')}
                    />
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs uppercase tracking-wider whitespace-nowrap align-bottom">
                    <TableSortHeaderButton
                      label={t('columns.tourDate')}
                      active={sortKey === 'tourDate'}
                      dir={sortDir}
                      onClick={() => handleSort('tourDate')}
                    />
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs uppercase tracking-wider align-bottom">
                    <TableSortHeaderButton
                      label={t('columns.channel')}
                      active={sortKey === 'channel'}
                      dir={sortDir}
                      onClick={() => handleSort('channel')}
                    />
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs uppercase tracking-wider align-bottom">
                    <TableSortHeaderButton
                      label={t('columns.option')}
                      active={sortKey === 'option'}
                      dir={sortDir}
                      onClick={() => handleSort('option')}
                    />
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs uppercase tracking-wider align-bottom">
                    <TableSortHeaderButton
                      label={t('columns.category')}
                      active={sortKey === 'category'}
                      dir={sortDir}
                      onClick={() => handleSort('category')}
                    />
                  </th>
                  <th className="px-3 py-2.5 text-right text-xs uppercase tracking-wider align-bottom">
                    <div className="flex justify-end">
                      <TableSortHeaderButton
                        label={t('columns.ea')}
                        active={sortKey === 'ea'}
                        dir={sortDir}
                        onClick={() => handleSort('ea')}
                        className="text-right"
                      />
                    </div>
                  </th>
                  <th className="px-3 py-2.5 text-right text-xs uppercase tracking-wider align-bottom">
                    <div className="flex justify-end">
                      <TableSortHeaderButton
                        label={t('columns.price')}
                        active={sortKey === 'price'}
                        dir={sortDir}
                        onClick={() => handleSort('price')}
                        className="text-right"
                      />
                    </div>
                  </th>
                  <th className="px-3 py-2.5 text-right text-xs uppercase tracking-wider align-bottom">
                    <div className="flex justify-end">
                      <TableSortHeaderButton
                        label={t('columns.total')}
                        active={sortKey === 'total'}
                        dir={sortDir}
                        onClick={() => handleSort('total')}
                        className="text-right"
                      />
                    </div>
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs uppercase tracking-wider align-bottom">
                    <TableSortHeaderButton
                      label={t('columns.note')}
                      active={sortKey === 'note'}
                      dir={sortDir}
                      onClick={() => handleSort('note')}
                    />
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {pageSlice.map((r, idx) => {
                  const res = resMap.get(r.reservation_id)
                  const opt = optionMap.get(r.option_id)
                  const gIdx = (safePage - 1) * UI_PAGE_SIZE + idx
                  return (
                    <tr key={rowListKey(r, gIdx)} className="hover:bg-gray-50/80">
                      <td className="px-3 py-2 align-middle">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="px-3 py-2 align-middle whitespace-nowrap text-gray-700">
                        {formatDate(r.created_at)}
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <Link
                          href={`/${locale}/admin/reservations/${r.reservation_id}`}
                          className="text-blue-600 hover:underline font-mono text-xs"
                        >
                          {r.reservation_id}
                        </Link>
                      </td>
                      <td className="px-3 py-2 align-middle text-gray-700 max-w-[140px] truncate" title={customerLabel(r.reservation_id)}>
                        {customerLabel(r.reservation_id)}
                      </td>
                      <td className="px-3 py-2 align-middle text-gray-600 font-mono text-xs">{res?.product_id || '—'}</td>
                      <td className="px-3 py-2 align-middle whitespace-nowrap text-gray-700">
                        {formatTourDateOnly(res?.tour_date)}
                      </td>
                      <td className="px-3 py-2 align-middle text-gray-700 max-w-[120px] truncate" title={channelLabel(r.reservation_id)}>
                        {channelLabel(r.reservation_id)}
                      </td>
                      <td className="px-3 py-2 align-middle text-gray-900 max-w-[180px] truncate" title={optionLabel(r.option_id)}>
                        {optionLabel(r.option_id)}
                      </td>
                      <td className="px-3 py-2 align-middle text-gray-600 text-xs max-w-[100px] truncate" title={opt?.category || ''}>
                        {opt?.category || '—'}
                      </td>
                      <td className="px-3 py-2 align-middle text-right tabular-nums text-gray-700">{r.ea ?? '—'}</td>
                      <td className="px-3 py-2 align-middle text-right tabular-nums text-gray-700">
                        {r.price != null ? fmtUsd.format(Number(r.price)) : '—'}
                      </td>
                      <td className="px-3 py-2 align-middle text-right tabular-nums font-medium text-green-700">
                        {fmtUsd.format(lineTotal(r))}
                      </td>
                      <td className="px-3 py-2 align-middle text-gray-500 text-xs max-w-[160px] truncate" title={r.note || ''}>
                        {r.note || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
