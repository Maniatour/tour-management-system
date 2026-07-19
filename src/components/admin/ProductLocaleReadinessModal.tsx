'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Languages,
  Loader2,
  Search,
  X,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { buildAdminProductCustomerEditPath } from '@/lib/adminProductCustomerEdit'
import type { AdminEditLocale } from '@/lib/adminEditLocales'
import {
  computeProductsLocaleReadiness,
  LOCALE_READINESS_LOCALES,
  type ProductDetailsMultilingualRow,
  type ProductLocaleReadiness,
  type ProductLocaleReadinessSource,
  type LocaleReadinessFieldKey,
} from '@/lib/adminProductLocaleReadiness'

type ProductLocaleReadinessModalProps = {
  isOpen: boolean
  onClose: () => void
  products: ProductLocaleReadinessSource[]
  homepageChannelId?: string | null
  locale: string
}

type SortKey = 'overall' | 'ko' | 'en' | 'name'

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
    <div className="min-w-[7rem]" title={`${label} ${percent}%`}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
          {label}
        </span>
        <span className={`text-xs font-semibold tabular-nums ${percentTextTone(percent)}`}>
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
}: ProductLocaleReadinessModalProps) {
  const t = useTranslations('products.localeReadiness')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<ProductLocaleReadiness[]>([])
  const [search, setSearch] = useState('')
  const [incompleteOnly, setIncompleteOnly] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>('overall')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fieldLabel = (key: LocaleReadinessFieldKey): string => {
    try {
      return t(`fields.${key}`)
    } catch {
      return key
    }
  }

  const localeLabel = (code: AdminEditLocale): string =>
    code === 'en' ? t('localeEn') : t('localeKo')

  const productIdsKey = useMemo(
    () =>
      products
        .map((p) => p.id)
        .filter(Boolean)
        .sort()
        .join(','),
    [products]
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
          if (!cancelled) setRows([])
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
            detailRows.push(...((fallback || []) as ProductDetailsMultilingualRow[]))
          } else {
            detailRows.push(...((data || []) as ProductDetailsMultilingualRow[]))
          }
        }

        if (cancelled) return

        const computed = computeProductsLocaleReadiness(products, detailRows, {
          homepageChannelId,
          uiLocale: locale,
        })
        setRows(computed)
      } catch (e) {
        console.error('locale readiness load error', e)
        if (!cancelled) {
          setError(t('loadError'))
          setRows([])
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = rows

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
      if (sortKey === 'ko') return a.byLocale.ko.percent - b.byLocale.ko.percent
      if (sortKey === 'en') return a.byLocale.en.percent - b.byLocale.en.percent
      return a.overallPercent - b.overallPercent
    })
    return sorted
  }, [rows, search, incompleteOnly, sortKey, locale])

  const summary = useMemo(() => {
    if (rows.length === 0) {
      return { avgKo: 0, avgEn: 0, incomplete: 0 }
    }
    const avgKo = Math.round(
      rows.reduce((s, r) => s + r.byLocale.ko.percent, 0) / rows.length
    )
    const avgEn = Math.round(
      rows.reduce((s, r) => s + r.byLocale.en.percent, 0) / rows.length
    )
    const incomplete = rows.filter((r) =>
      LOCALE_READINESS_LOCALES.some((code) => r.byLocale[code].percent < 100)
    ).length
    return { avgKo, avgEn, incomplete }
  }, [rows])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[10050] flex items-center justify-center p-3 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label={t('close')}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="locale-readiness-title"
        className="relative z-10 flex flex-col w-full max-w-5xl max-h-[90vh] bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden"
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
                {t('summary', {
                  count: rows.length,
                  avgKo: summary.avgKo,
                  avgEn: summary.avgEn,
                  incomplete: summary.incomplete,
                })}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            aria-label={t('close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-4 sm:px-6 py-3 border-b border-gray-100 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between bg-gray-50/80">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
              <option value="ko">{t('sortKo')}</option>
              <option value="en">{t('sortEn')}</option>
              <option value="name">{t('sortName')}</option>
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 sm:px-4 py-2">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-600">
              <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
              {t('loading')}
            </div>
          ) : error ? (
            <div className="py-12 text-center text-sm text-rose-600">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-500">{t('empty')}</div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {filtered.map((row) => {
                const open = expandedId === row.productId
                return (
                  <li key={row.productId} className="py-3 px-2 sm:px-3">
                    <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedId(open ? null : row.productId)
                        }
                        className="flex items-start gap-2 text-left min-w-0 flex-1"
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
                                <span>{row.status}</span>
                              </>
                            ) : null}
                            <span aria-hidden>·</span>
                            <span className="tabular-nums">
                              {t('overall', { percent: row.overallPercent })}
                            </span>
                          </div>
                        </div>
                      </button>

                      <div className="flex flex-wrap items-center gap-4 lg:gap-6 pl-6 lg:pl-0">
                        {LOCALE_READINESS_LOCALES.map((code) => (
                          <ProgressCell
                            key={code}
                            percent={row.byLocale[code].percent}
                            label={localeLabel(code)}
                          />
                        ))}
                        <Link
                          href={buildAdminProductCustomerEditPath(locale, row.productId)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {t('editCustomerPage')}
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </div>

                    {open ? (
                      <div className="mt-3 ml-6 grid gap-3 sm:grid-cols-2">
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
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-4 sm:px-6 py-3 border-t border-gray-200 bg-white">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  )
}
