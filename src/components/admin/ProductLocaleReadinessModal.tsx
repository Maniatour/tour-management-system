'use client'
import { BROWSER_AUTOFILL_OFF_PROPS } from '@/lib/browserAutofill'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import {
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Languages,
  Loader2,
  RefreshCw,
  Search,
  X,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { buildAdminProductCustomerEditPath } from '@/lib/adminProductCustomerEdit'
import type { AdminEditLocale } from '@/lib/adminEditLocales'
import {
  averageLocalePercent,
  buildRelatedBundlesByProduct,
  computeProductsLocaleReadiness,
  localeReadinessLabel,
  LOCALE_READINESS_LOCALES,
  type LocaleReadinessChoiceRow,
  type LocaleReadinessFaqRow,
  type LocaleReadinessScheduleRow,
  type LocaleReadinessTourCourseRow,
  type ProductDetailsMultilingualRow,
  type ProductLocaleReadiness,
  type ProductLocaleReadinessSource,
  type LocaleReadinessFieldKey,
} from '@/lib/adminProductLocaleReadiness'
import { fetchProductFieldTranslations } from '@/lib/productFieldTranslations'
import { isAdminProductSoftDeleted } from '@/lib/adminProductDelete'
import {
  clearLocaleFromSyncTask,
  fetchOpenLocaleSyncTasks,
  resolveLocaleSyncTask,
  type ProductLocaleSyncTask,
} from '@/lib/productLocaleSyncTasks'
import type { SiteLocale } from '@/lib/siteLocales'

type ProductLocaleReadinessModalProps = {
  isOpen: boolean
  onClose: () => void
  products: ProductLocaleReadinessSource[]
  homepageChannelId?: string | null
  locale: string
  /** Render as in-page panel (no overlay). */
  embedded?: boolean
}

type SortKey = 'overall' | 'name' | AdminEditLocale

function percentTone(percent: number): string {
  if (percent >= 80) return 'bg-emerald-500'
  if (percent >= 50) return 'bg-amber-500'
  return 'bg-rose-500'
}

function percentTextTone(percent: number): string {
  if (percent >= 80) return 'text-emerald-700'
  if (percent >= 50) return 'text-amber-700'
  return 'text-rose-700'
}

function ProgressCell({ percent, label }: { percent: number; label: string }) {
  return (
    <div className="min-w-[5.5rem] w-[5.5rem] xl:min-w-[6.5rem] xl:w-[6.5rem]" title={`${label} ${percent}%`}>
      <div className="flex items-center justify-between gap-1 mb-1">
        <span className="text-[10px] xl:text-[11px] font-medium text-gray-500 uppercase tracking-wide truncate">
          {label}
        </span>
        <span className={`text-[11px] xl:text-xs font-semibold tabular-nums shrink-0 ${percentTextTone(percent)}`}>
          {percent}%
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${percentTone(percent)}`}
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </div>
    </div>
  )
}

export default function ProductLocaleReadinessModal({
  isOpen,
  onClose,
  products,
  homepageChannelId,
  locale,
  embedded = false,
}: ProductLocaleReadinessModalProps) {
  const t = useTranslations('products.localeReadiness')
  const tProducts = useTranslations('products')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<ProductLocaleReadiness[]>([])
  const [syncTasks, setSyncTasks] = useState<ProductLocaleSyncTask[]>([])
  const [viewMode, setViewMode] = useState<'readiness' | 'syncNeeds'>('readiness')
  const [resolvingTaskId, setResolvingTaskId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [incompleteOnly, setIncompleteOnly] = useState(true)
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [selectedPublish, setSelectedPublish] = useState<'all' | 'published' | 'unpublished'>('all')
  const [sortKey, setSortKey] = useState<SortKey>('overall')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fieldLabel = (key: LocaleReadinessFieldKey): string => {
    const messageKey = `fields.${key}` as const
    return t.has(messageKey) ? t(messageKey) : key
  }

  const statusLabel = (status: string | null | undefined): string => {
    const value = String(status ?? '').trim()
    if (!value) return ''
    const messageKey = `status.${value}` as const
    return tProducts.has(messageKey) ? tProducts(messageKey) : value
  }

  const localeLabel = (code: AdminEditLocale): string => localeReadinessLabel(code)

  const activeProducts = useMemo(
    () =>
      products.filter(
        (p) => !isAdminProductSoftDeleted((p as { status?: string | null }).status)
      ),
    [products]
  )

  const productIdsKey = useMemo(
    () =>
      activeProducts
        .map((p) => p.id)
        .filter(Boolean)
        .sort()
        .join(','),
    [activeProducts]
  )

  useEffect(() => {
    if (!isOpen) return

    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const ids = productIdsKey ? productIdsKey.split(',') : []
        if (ids.length === 0) {
          if (!cancelled) {
            setRows([])
            setSyncTasks([])
          }
          return
        }

        const detailRows: ProductDetailsMultilingualRow[] = []
        const chunkSize = 80
        for (let i = 0; i < ids.length; i += chunkSize) {
          const chunk = ids.slice(i, i + chunkSize)
          const selectCols = [
            'product_id',
            'language_code',
            'channel_id',
            'slogan1',
            'slogan2',
            'slogan3',
            'slogan4',
            'slogan5',
            'description',
            'included',
            'not_included',
            'pickup_drop_info',
            'luggage_info',
            'tour_operation_info',
            'preparation_info',
            'small_group_info',
            'notice_info',
            'cancellation_policy',
            'customer_page_visibility',
          ].join(', ')

          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- customer_page_visibility may be missing from generated types
          const query = (supabase.from('product_details_multilingual') as any)
            .select(selectCols)
            .in('product_id', chunk)

          const { data, error: qErr } = await query

          if (qErr) {
            const { data: fallback, error: fallbackErr } = await supabase
              .from('product_details_multilingual')
              .select(
                [
                  'product_id',
                  'language_code',
                  'channel_id',
                  'slogan1',
                  'slogan2',
                  'slogan3',
                  'slogan4',
                  'slogan5',
                  'description',
                  'included',
                  'not_included',
                  'pickup_drop_info',
                  'luggage_info',
                  'tour_operation_info',
                  'preparation_info',
                  'small_group_info',
                  'notice_info',
                  'cancellation_policy',
                ].join(', ')
              )
              .in('product_id', chunk)

            if (fallbackErr) throw fallbackErr
            detailRows.push(...((fallback || []) as unknown as ProductDetailsMultilingualRow[]))
          } else {
            detailRows.push(...((data || []) as unknown as ProductDetailsMultilingualRow[]))
          }
        }

        if (cancelled) return

        const translationRows = await fetchProductFieldTranslations(ids)
        if (cancelled) return

        const faqs: LocaleReadinessFaqRow[] = []
        const choices: LocaleReadinessChoiceRow[] = []
        const schedules: LocaleReadinessScheduleRow[] = []
        const tourCourses: LocaleReadinessTourCourseRow[] = []

        for (let i = 0; i < ids.length; i += chunkSize) {
          const chunk = ids.slice(i, i + chunkSize)
          const [faqRes, choiceRes, scheduleRes, courseRes] = await Promise.all([
            supabase
              .from('product_faq_links')
              .select(
                `
                product_id,
                is_active,
                faq_library (
                  is_active,
                  question,
                  answer,
                  question_en,
                  answer_en,
                  content_i18n
                )
              `
              )
              .in('product_id', chunk),
            (supabase.from('product_choices') as any)
              .select(
                `
                product_id,
                choice_group_ko,
                choice_group_en,
                content_i18n,
                options:choice_options (
                  option_name,
                  option_name_ko,
                  content_i18n,
                  is_active
                )
              `
              )
              .in('product_id', chunk),
            (supabase.from('product_schedules') as any)
              .select(
                'product_id, show_to_customers, title_ko, title_en, content_i18n'
              )
              .in('product_id', chunk),
            supabase
              .from('product_tour_courses')
              .select(
                `
                product_id,
                tour_courses (
                  customer_name_ko,
                  customer_name_en,
                  customer_description_ko,
                  customer_description_en,
                  content_i18n
                )
              `
              )
              .in('product_id', chunk),
          ])

          if (!faqRes.error && faqRes.data) {
            for (const row of faqRes.data as unknown as Array<{
              product_id: string
              is_active?: boolean | null
              faq_library?:
                | {
                    is_active?: boolean | null
                    question?: string | null
                    answer?: string | null
                    question_en?: string | null
                    answer_en?: string | null
                    content_i18n?: unknown
                  }
                | Array<{
                    is_active?: boolean | null
                    question?: string | null
                    answer?: string | null
                    question_en?: string | null
                    answer_en?: string | null
                    content_i18n?: unknown
                  }>
                | null
            }>) {
              const joined = row.faq_library
              const faq = Array.isArray(joined) ? joined[0] : joined
              if (!faq) continue
              faqs.push({
                product_id: row.product_id,
                is_active: row.is_active !== false && faq.is_active !== false,
                question: faq.question ?? '',
                answer: faq.answer ?? '',
                question_en: faq.question_en ?? null,
                answer_en: faq.answer_en ?? null,
                content_i18n: (faq.content_i18n as LocaleReadinessFaqRow['content_i18n']) ?? null,
              })
            }
          }
          if (!choiceRes.error && choiceRes.data) {
            choices.push(...(choiceRes.data as unknown as LocaleReadinessChoiceRow[]))
          }
          if (!scheduleRes.error && scheduleRes.data) {
            schedules.push(
              ...(scheduleRes.data as unknown as LocaleReadinessScheduleRow[])
            )
          }
          if (!courseRes.error && courseRes.data) {
            for (const row of courseRes.data as unknown as Array<{
              product_id: string
              tour_courses:
                | LocaleReadinessTourCourseRow
                | LocaleReadinessTourCourseRow[]
                | null
            }>) {
              const joined = row.tour_courses
              const course = Array.isArray(joined) ? joined[0] : joined
              if (!course) continue
              tourCourses.push({
                product_id: row.product_id,
                customer_name_ko: course.customer_name_ko,
                customer_name_en: course.customer_name_en,
                customer_description_ko: course.customer_description_ko,
                customer_description_en: course.customer_description_en,
                content_i18n: course.content_i18n,
              })
            }
          }
        }

        if (cancelled) return

        const relatedByProduct = buildRelatedBundlesByProduct({
          faqs,
          choices,
          schedules,
          tourCourses,
        })

        const computed = computeProductsLocaleReadiness(activeProducts, detailRows, {
          homepageChannelId: homepageChannelId ?? null,
          uiLocale: locale,
          translationRows,
          relatedByProduct,
        })
        const openSyncTasks = await fetchOpenLocaleSyncTasks({ productIds: ids })
        if (cancelled) return
        setRows(computed)
        setSyncTasks(openSyncTasks)
      } catch (e) {
        console.error('locale readiness load error', e)
        if (!cancelled) {
          setError(t('loadError'))
          setRows([])
          setSyncTasks([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
    // products identity may change; productIdsKey + isOpen gate reloads
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: reload when id set / channel / open
  }, [isOpen, productIdsKey, homepageChannelId, locale, t])

  const productNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const row of rows) map.set(row.productId, row.productName)
    for (const product of activeProducts) {
      if (!map.has(product.id)) {
        map.set(product.id, product.name?.trim() || product.id)
      }
    }
    return map
  }, [rows, activeProducts])

  const syncTaskCountByProduct = useMemo(() => {
    const map = new Map<string, number>()
    for (const task of syncTasks) {
      map.set(task.product_id, (map.get(task.product_id) || 0) + 1)
    }
    return map
  }, [syncTasks])

  const formatSyncDate = (iso: string): string => {
    if (!iso) return '—'
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return '—'
    return date.toLocaleString(locale === 'en' ? 'en-US' : 'ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const reloadSyncTasks = async () => {
    const ids = productIdsKey ? productIdsKey.split(',') : []
    if (ids.length === 0) {
      setSyncTasks([])
      return
    }
    const openSyncTasks = await fetchOpenLocaleSyncTasks({ productIds: ids })
    setSyncTasks(openSyncTasks)
  }

  const handleResolveTask = async (taskId: string) => {
    setResolvingTaskId(taskId)
    try {
      const ok = await resolveLocaleSyncTask({ taskId })
      if (ok) {
        setSyncTasks((prev) => prev.filter((task) => task.id !== taskId))
      }
    } finally {
      setResolvingTaskId(null)
    }
  }

  const handleClearPendingLocale = async (taskId: string, code: SiteLocale) => {
    setResolvingTaskId(`${taskId}:${code}`)
    try {
      const ok = await clearLocaleFromSyncTask({ taskId, locale: code })
      if (ok) await reloadSyncTasks()
    } finally {
      setResolvingTaskId(null)
    }
  }

  const statusCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const row of rows) {
      const key = String(row.status ?? '').trim() || 'unknown'
      map.set(key, (map.get(key) || 0) + 1)
    }
    const items = [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([value, count]) => ({ value, count }))
    return [{ value: 'all', count: rows.length }, ...items]
  }, [rows])

  const publishCounts = useMemo(() => {
    const published = rows.filter((r) => r.isPublished).length
    const unpublished = rows.length - published
    return [
      { value: 'all' as const, count: rows.length },
      { value: 'published' as const, count: published },
      { value: 'unpublished' as const, count: unpublished },
    ]
  }, [rows])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = rows

    if (selectedStatus !== 'all') {
      list = list.filter(
        (r) => String(r.status ?? '').trim() === selectedStatus
      )
    }

    if (selectedPublish === 'published') {
      list = list.filter((r) => r.isPublished)
    } else if (selectedPublish === 'unpublished') {
      list = list.filter((r) => !r.isPublished)
    }

    if (q) {
      list = list.filter(
        (r) =>
          r.productName.toLowerCase().includes(q) ||
          r.productId.toLowerCase().includes(q)
      )
    }

    if (incompleteOnly) {
      list = list.filter((r) =>
        LOCALE_READINESS_LOCALES.some((code) => r.byLocale[code].percent < 100)
      )
    }

    const sorted = [...list]
    sorted.sort((a, b) => {
      if (sortKey === 'name') {
        return a.productName.localeCompare(b.productName, locale === 'en' ? 'en' : 'ko')
      }
      if (sortKey === 'overall') return a.overallPercent - b.overallPercent
      return (a.byLocale[sortKey]?.percent ?? 0) - (b.byLocale[sortKey]?.percent ?? 0)
    })
    return sorted
  }, [rows, search, incompleteOnly, sortKey, locale, selectedStatus, selectedPublish])

  const filteredSyncTasks = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = syncTasks

    if (selectedStatus !== 'all' || selectedPublish !== 'all') {
      const allowedIds = new Set(
        rows
          .filter((row) => {
            if (
              selectedStatus !== 'all' &&
              String(row.status ?? '').trim() !== selectedStatus
            ) {
              return false
            }
            if (selectedPublish === 'published' && !row.isPublished) return false
            if (selectedPublish === 'unpublished' && row.isPublished) return false
            return true
          })
          .map((row) => row.productId)
      )
      list = list.filter((task) => allowedIds.has(task.product_id))
    }

    if (q) {
      list = list.filter((task) => {
        const name = productNameById.get(task.product_id) || ''
        return (
          name.toLowerCase().includes(q) ||
          task.product_id.toLowerCase().includes(q) ||
          fieldLabel(task.field_key).toLowerCase().includes(q)
        )
      })
    }

    return list
    // fieldLabel depends on t; include t for locale message updates
  }, [syncTasks, search, selectedStatus, selectedPublish, rows, productNameById, t])

  const summary = useMemo(() => {
    const incomplete = filtered.filter((r) =>
      LOCALE_READINESS_LOCALES.some((code) => r.byLocale[code].percent < 100)
    ).length
    const avgByLocale = Object.fromEntries(
      LOCALE_READINESS_LOCALES.map((code) => [code, averageLocalePercent(filtered, code)])
    ) as Record<AdminEditLocale, number>
    const overallAvg =
      filtered.length === 0
        ? 0
        : Math.round(filtered.reduce((s, r) => s + r.overallPercent, 0) / filtered.length)
    const sourceInputAvg =
      filtered.length === 0
        ? 0
        : Math.round(
            filtered.reduce((s, r) => s + r.sourceInputPercent, 0) / filtered.length
          )
    return {
      incomplete,
      avgByLocale,
      overallAvg,
      sourceInputAvg,
      syncNeeds: syncTasks.length,
    }
  }, [filtered, syncTasks.length])

  if (!isOpen) return null

  const panel = (
      <div
        role={embedded ? 'region' : 'dialog'}
        aria-modal={embedded ? undefined : true}
        aria-labelledby="locale-readiness-title"
        className={
          embedded
            ? 'relative z-10 flex flex-col w-full min-h-[70vh] bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden'
            : 'relative z-10 flex flex-col w-full max-w-[min(98vw,1920px)] max-h-[90vh] bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden'
        }
      >
        <div className="flex items-start justify-between gap-3 px-4 sm:px-6 py-4 border-b border-gray-200">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Languages className="h-5 w-5 text-indigo-600 shrink-0" />
              <h2
                id="locale-readiness-title"
                className="text-lg sm:text-xl font-semibold text-gray-900"
              >
                {t('title')}
              </h2>
            </div>
            <p className="mt-1 text-sm text-gray-600">{t('subtitle')}</p>
            {!loading && !error ? (
              <p className="mt-2 text-xs text-gray-500">
                {viewMode === 'syncNeeds'
                  ? t('syncNeedsSummary', { count: filteredSyncTasks.length })
                  : t('summaryMulti', {
                      count: filtered.length,
                      avgOverall: summary.overallAvg,
                      incomplete: summary.incomplete,
                      avgSourceInput: summary.sourceInputAvg,
                    })}
                {summary.syncNeeds > 0 ? (
                  <span className="ml-2 text-amber-700">
                    · {t('syncNeedsBadge', { count: summary.syncNeeds })}
                  </span>
                ) : null}
              </p>
            ) : null}
          </div>
          {!embedded ? (
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800"
              aria-label={t('close')}
            >
              <X className="h-5 w-5" />
            </button>
          ) : null}
        </div>

        <div className="px-4 sm:px-6 py-3 border-b border-gray-100 bg-gray-50/80 space-y-3">
          <div
            className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-gray-200 bg-white p-1"
            role="tablist"
            aria-label={t('viewMode')}
          >
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'readiness'}
              onClick={() => setViewMode('readiness')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'readiness'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Languages className="h-3.5 w-3.5" />
              {t('viewReadiness')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'syncNeeds'}
              onClick={() => setViewMode('syncNeeds')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'syncNeeds'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {t('viewSyncNeeds')}
              {summary.syncNeeds > 0 ? (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
                    viewMode === 'syncNeeds' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {summary.syncNeeds}
                </span>
              ) : null}
            </button>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input {...BROWSER_AUTOFILL_OFF_PROPS} type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('searchPlaceholder')}
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(selectedStatus !== 'all' || selectedPublish !== 'all' || search) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStatus('all')
                    setSelectedPublish('all')
                    setSearch('')
                  }}
                  className="text-xs text-indigo-600 hover:text-indigo-800 underline"
                >
                  {tProducts('clearFilters')}
                </button>
              )}
              {viewMode === 'readiness' ? (
                <>
                  <label className="inline-flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={incompleteOnly}
                      onChange={(e) => setIncompleteOnly(e.target.checked)}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    {t('incompleteOnly')}
                  </label>
                  <select
                    value={sortKey}
                    onChange={(e) => setSortKey(e.target.value as SortKey)}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700"
                    aria-label={t('sortLabel')}
                  >
                    <option value="overall">{t('sortOverall')}</option>
                    {LOCALE_READINESS_LOCALES.map((code) => (
                      <option key={code} value={code}>
                        {localeLabel(code)}
                      </option>
                    ))}
                    <option value="name">{t('sortName')}</option>
                  </select>
                </>
              ) : (
                <p className="text-xs text-amber-800 max-w-xl">{t('syncNeedsHint')}</p>
              )}
            </div>
          </div>

          {rows.length > 0 ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <div
                className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-gray-200 bg-white p-1"
                role="group"
                aria-label={t('filterStatus')}
              >
                {statusCounts.map((status) => {
                  const active = selectedStatus === status.value
                  return (
                    <button
                      key={status.value}
                      type="button"
                      onClick={() => setSelectedStatus(status.value)}
                      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                        active
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <span>
                        {status.value === 'all'
                          ? tProducts('all')
                          : statusLabel(status.value)}
                      </span>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
                          active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {status.count}
                      </span>
                    </button>
                  )
                })}
              </div>

              <div
                className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-gray-200 bg-white p-1"
                role="group"
                aria-label={t('filterPublish')}
              >
                {publishCounts.map((publish) => {
                  const active = selectedPublish === publish.value
                  return (
                    <button
                      key={publish.value}
                      type="button"
                      onClick={() => setSelectedPublish(publish.value)}
                      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                        active
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <span>
                        {publish.value === 'all'
                          ? tProducts('all')
                          : publish.value === 'published'
                            ? t('published')
                            : t('unpublished')}
                      </span>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
                          active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {publish.count}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto px-2 sm:px-4 py-2">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-600">
              <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
              {t('loading')}
            </div>
          ) : error ? (
            <div className="py-12 text-center text-sm text-rose-600">{error}</div>
          ) : viewMode === 'syncNeeds' ? (
            filteredSyncTasks.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-500">{t('syncNeedsEmpty')}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                      <th className="px-3 py-2 font-medium">{t('syncColProduct')}</th>
                      <th className="px-3 py-2 font-medium">{t('syncColField')}</th>
                      <th className="px-3 py-2 font-medium">{t('syncColSource')}</th>
                      <th className="px-3 py-2 font-medium">{t('syncColUpdated')}</th>
                      <th className="px-3 py-2 font-medium">{t('syncColPending')}</th>
                      <th className="px-3 py-2 font-medium text-right">{t('syncColActions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredSyncTasks.map((task) => {
                      const productName =
                        productNameById.get(task.product_id) || task.product_id
                      const busy = resolvingTaskId === task.id
                      return (
                        <tr key={task.id} className="align-top hover:bg-amber-50/40">
                          <td className="px-3 py-3">
                            <div className="font-medium text-gray-900">{productName}</div>
                            <div className="mt-0.5 text-[11px] text-gray-400 font-mono truncate max-w-[14rem]">
                              {task.product_id}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-gray-800">{fieldLabel(task.field_key)}</td>
                          <td className="px-3 py-3">
                            <span className="inline-flex rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                              {localeLabel(task.source_locale)}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-xs text-gray-600 whitespace-nowrap">
                            <div>{formatSyncDate(task.source_updated_at)}</div>
                            {task.source_updated_by ? (
                              <div className="mt-0.5 text-[11px] text-gray-400 truncate max-w-[10rem]">
                                {task.source_updated_by}
                              </div>
                            ) : null}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex flex-wrap gap-1.5">
                              {task.pending_locales.map((code) => {
                                const clearing = resolvingTaskId === `${task.id}:${code}`
                                return (
                                  <button
                                    key={code}
                                    type="button"
                                    disabled={clearing || busy}
                                    onClick={() => void handleClearPendingLocale(task.id, code)}
                                    className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-60"
                                    title={t('markLocaleDone')}
                                  >
                                    {clearing ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : null}
                                    {localeLabel(code)}
                                    <X className="h-3 w-3 opacity-60" />
                                  </button>
                                )
                              })}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-2">
                              <Link
                                href={buildAdminProductCustomerEditPath(locale, task.product_id)}
                                className="inline-flex items-center justify-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
                              >
                                {t('editCustomerPage')}
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Link>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void handleResolveTask(task.id)}
                                className="inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                              >
                                {busy ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Check className="h-3.5 w-3.5" />
                                )}
                                {t('markAllDone')}
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-500">{t('empty')}</div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {filtered.map((row) => {
                const open = expandedId === row.productId
                const syncCount = syncTaskCountByProduct.get(row.productId) || 0
                return (
                  <li key={row.productId} className="py-3 px-2 sm:px-3">
                    <div className="flex flex-col xl:flex-row xl:items-center gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedId(open ? null : row.productId)
                        }
                        className="flex items-start gap-2 text-left w-full min-w-0 xl:w-[24rem] xl:min-w-[24rem] xl:max-w-[24rem] xl:shrink-0 xl:grow-0"
                      >
                        {open ? (
                          <ChevronDown className="h-4 w-4 mt-1 text-gray-400 shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 mt-1 text-gray-400 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className="font-medium text-sm text-gray-900 truncate">
                            {row.productName}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-gray-500">
                            <span
                              className={
                                row.isPublished
                                  ? 'text-emerald-700'
                                  : 'text-amber-700'
                              }
                            >
                              {row.isPublished ? t('published') : t('unpublished')}
                            </span>
                            {row.status ? (
                              <>
                                <span aria-hidden>·</span>
                                <span>{statusLabel(row.status)}</span>
                              </>
                            ) : null}
                            <span aria-hidden>·</span>
                            <span className="tabular-nums">
                              {t('sourceInput', {
                                percent: row.sourceInputPercent,
                                count: row.sourceInputFieldCount,
                              })}
                            </span>
                            <span aria-hidden>·</span>
                            <span className="tabular-nums">
                              {t('overall', { percent: row.overallPercent })}
                            </span>
                            {syncCount > 0 ? (
                              <>
                                <span aria-hidden>·</span>
                                <span
                                  role="link"
                                  tabIndex={0}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setViewMode('syncNeeds')
                                    setSearch(row.productName)
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key !== 'Enter' && e.key !== ' ') return
                                    e.preventDefault()
                                    e.stopPropagation()
                                    setViewMode('syncNeeds')
                                    setSearch(row.productName)
                                  }}
                                  className="text-amber-700 hover:text-amber-900 underline-offset-2 hover:underline cursor-pointer"
                                >
                                  {t('syncNeedsBadge', { count: syncCount })}
                                </span>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </button>

                      <div className="flex flex-nowrap items-center gap-2.5 xl:gap-3 pl-6 xl:pl-0 flex-1 min-w-0 overflow-x-auto">
                        {LOCALE_READINESS_LOCALES.map((code) => (
                          <ProgressCell
                            key={code}
                            percent={row.byLocale[code].percent}
                            label={localeLabel(code)}
                          />
                        ))}
                        <Link
                          href={buildAdminProductCustomerEditPath(locale, row.productId)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 shrink-0 ml-auto"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {t('editCustomerPage')}
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </div>

                    {open ? (
                      <div className="mt-3 ml-6 space-y-3">
                        <p className="text-xs text-gray-500">
                          {t('sourceBaselineHint', {
                            count: row.sourceInputFieldCount,
                            percent: row.sourceInputPercent,
                          })}
                        </p>
                        {syncCount > 0 ? (
                          <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3">
                            <div className="text-xs font-semibold text-amber-900 mb-2">
                              {t('syncNeedsForProduct')}
                            </div>
                            <ul className="space-y-1.5">
                              {syncTasks
                                .filter((task) => task.product_id === row.productId)
                                .map((task) => (
                                  <li
                                    key={task.id}
                                    className="text-xs text-amber-900 flex flex-wrap items-center gap-x-2 gap-y-1"
                                  >
                                    <span className="font-medium">{fieldLabel(task.field_key)}</span>
                                    <span className="text-amber-700/80">
                                      ({localeLabel(task.source_locale)} · {formatSyncDate(task.source_updated_at)})
                                    </span>
                                    <span className="text-amber-800">
                                      → {task.pending_locales.map((code) => localeLabel(code)).join(', ')}
                                    </span>
                                  </li>
                                ))}
                            </ul>
                          </div>
                        ) : null}
                        <div className="grid gap-3 sm:grid-cols-2">
                          {LOCALE_READINESS_LOCALES.map((code) => {
                            const score = row.byLocale[code]
                            return (
                              <div
                                key={code}
                                className="rounded-lg border border-gray-200 bg-gray-50/80 p-3"
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-semibold text-gray-800">
                                    {localeLabel(code)}
                                  </span>
                                  <span
                                    className={`text-xs font-semibold tabular-nums ${percentTextTone(score.percent)}`}
                                  >
                                    {score.filled}/{score.total} ({score.percent}%)
                                  </span>
                                </div>
                                {score.missingKeys.length === 0 ? (
                                  <p className="text-xs text-emerald-700">{t('allReady')}</p>
                                ) : (
                                  <ul className="space-y-1">
                                    {score.missingKeys.map((key) => (
                                      <li
                                        key={key}
                                        className="text-xs text-gray-700 flex items-center gap-1.5"
                                      >
                                        <span className="h-1.5 w-1.5 rounded-full bg-rose-400 shrink-0" />
                                        {fieldLabel(key)}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {!embedded ? (
          <div className="flex items-center justify-end gap-2 px-4 sm:px-6 py-3 border-t border-gray-200 bg-white">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              {t('close')}
            </button>
          </div>
        ) : null}
      </div>
  )

  if (embedded) return panel

  return (
    <div className="fixed inset-0 z-[10050] flex items-center justify-center p-3 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label={t('close')}
        onClick={onClose}
      />
      {panel}
    </div>
  )
}
