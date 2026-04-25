'use client'

import React, { useCallback, useEffect, useMemo, useState, type ComponentProps } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import type { ExpenseStandardCategoryPickRow } from '@/lib/expenseStandardCategoryPaidFor'
import {
  buildUnifiedStandardLeafGroups,
  matchUnifiedLeafIdFromForm,
  VEHICLE_REPAIR_STANDARD_LEAF_ID,
} from '@/lib/companyExpenseStandardUnified'
import { supabase } from '@/lib/supabase'
import { UnifiedStandardLeafPicker } from '@/components/company-expense/UnifiedStandardLeafPicker'
import { ChevronDown, ChevronUp } from 'lucide-react'

type StatRow = {
  paid_for: string
  count: number
  paid_for_label_id: string | null
  /** RPC가 내려주면 우선 사용(그룹 내 standard_paid_for 미입력 건수) */
  missing_standard_count?: number
  sample_standard_paid_for: string | null
  sample_category: string | null
  sample_expense_type: string | null
}

type NormalizationListFilter = 'all' | 'missingStandard' | 'unlabeled'

function statRowHasMissingStandard(r: StatRow): boolean {
  if (typeof r.missing_standard_count === 'number' && !Number.isNaN(r.missing_standard_count)) {
    return r.missing_standard_count > 0
  }
  return !(r.sample_standard_paid_for ?? '').trim()
}

type PaidForLabel = {
  id: string
  code: string
  label_ko: string
  label_en: string | null
  links_vehicle_maintenance: boolean
}

type RowDraft = { targetLeafId: string }

const DETAIL_PAGE_SIZE = 20

type DetailExpenseRow = {
  id: string
  submit_on: string | null
  amount: number | null
  paid_to: string | null
  paid_for: string | null
  category: string | null
  expense_type: string | null
  description: string | null
  status: string | null
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onApplied?: () => void
}

export function PaidForNormalizationModal({ open, onOpenChange, onApplied }: Props) {
  const t = useTranslations('companyExpense.paidForNormalization')
  const locale = useLocale()
  const [loading, setLoading] = useState(false)
  const [applyingKey, setApplyingKey] = useState<string | null>(null)
  const [stats, setStats] = useState<StatRow[]>([])
  /** 구 라벨(paid_for_label_id) 표시용 — 선택지는 표준 카테고리만 사용 */
  const [labels, setLabels] = useState<PaidForLabel[]>([])
  const [standardCats, setStandardCats] = useState<ExpenseStandardCategoryPickRow[]>([])
  const [listFilter, setListFilter] = useState<NormalizationListFilter>('missingStandard')
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({})
  const [selectedStat, setSelectedStat] = useState<StatRow | null>(null)
  const [detailPage, setDetailPage] = useState(1)
  const [detailRows, setDetailRows] = useState<DetailExpenseRow[]>([])
  const [detailTotal, setDetailTotal] = useState<number | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailSelectedIds, setDetailSelectedIds] = useState<Set<string>>(() => new Set())
  const [applyingDetailSelected, setApplyingDetailSelected] = useState(false)
  /** 포함된 지출 패널 펼침(통계 행은 유지) */
  const [detailPanelExpanded, setDetailPanelExpanded] = useState(true)

  const unifiedStandardGroups = useMemo(
    () => buildUnifiedStandardLeafGroups(standardCats, locale, { includeInactive: true }),
    [standardCats, locale]
  )

  const hasAnyStandardLeaf = useMemo(
    () => unifiedStandardGroups.some((g) => g.items.length > 0),
    [unifiedStandardGroups]
  )

  const standardCatById = useMemo(
    () => new Map(standardCats.map((c) => [c.id, c])),
    [standardCats]
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [sRes, lRes, catResult] = await Promise.all([
        fetch('/api/company-expenses/paid-for-normalization'),
        fetch('/api/company-expenses/paid-for-labels?includeInactive=1'),
        supabase
          .from('expense_standard_categories')
          .select('id, name, name_ko, parent_id, tax_deductible, display_order, is_active')
          .order('display_order', { ascending: true }),
      ])
      const sJson = await sRes.json()
      const lJson = await lRes.json()
      if (!sRes.ok) {
        toast.error(sJson.error || t('loadStatsError'))
        setStats([])
      } else {
        const raw = Array.isArray(sJson.data) ? sJson.data : []
        setStats(
          raw.map((row: unknown) => {
            const o = row && typeof row === 'object' ? (row as Record<string, unknown>) : {}
            let missing_standard_count: number | undefined
            if ('missing_standard_count' in o) {
              const n = Number(o.missing_standard_count)
              if (Number.isFinite(n)) missing_standard_count = n
            }
            return {
              paid_for: String(o.paid_for ?? ''),
              count: Number(o.count ?? 0),
              paid_for_label_id: (o.paid_for_label_id as string | null) ?? null,
              ...(missing_standard_count !== undefined ? { missing_standard_count } : {}),
              sample_standard_paid_for:
                o.sample_standard_paid_for == null ? null : String(o.sample_standard_paid_for),
              sample_category: o.sample_category == null ? null : String(o.sample_category),
              sample_expense_type: o.sample_expense_type == null ? null : String(o.sample_expense_type),
            } as StatRow
          })
        )
      }
      if (!lRes.ok) {
        toast.error(lJson.error || t('loadLabelsError'))
        setLabels([])
      } else {
        setLabels(Array.isArray(lJson.data) ? lJson.data : [])
      }
      if (catResult.error) {
        toast.error(catResult.error.message || t('loadCategoriesError'))
        setStandardCats([])
      } else {
        setStandardCats(
          Array.isArray(catResult.data) ? (catResult.data as ExpenseStandardCategoryPickRow[]) : []
        )
      }
      setDrafts({})
      setSelectedStat(null)
      setDetailPage(1)
      setDetailRows([])
      setDetailTotal(null)
      setDetailSelectedIds(new Set())
    } catch {
      toast.error(t('loadError'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  useEffect(() => {
    if (!open) {
      setSelectedStat(null)
      setDetailPage(1)
      setDetailRows([])
      setDetailTotal(null)
      setDetailSelectedIds(new Set())
      setApplyingDetailSelected(false)
    }
  }, [open])

  useEffect(() => {
    setDrafts({})
    setSelectedStat(null)
    setDetailPage(1)
    setDetailSelectedIds(new Set())
  }, [listFilter])

  useEffect(() => {
    setDetailSelectedIds(new Set())
  }, [detailPage, selectedStat])

  useEffect(() => {
    if (!open || !selectedStat) return
    let cancelled = false
    const run = async () => {
      setDetailLoading(true)
      try {
        const from = (detailPage - 1) * DETAIL_PAGE_SIZE
        const to = from + DETAIL_PAGE_SIZE - 1
        let query = supabase
          .from('company_expenses')
          .select(
            'id, submit_on, amount, paid_to, paid_for, category, expense_type, description, status',
            { count: 'exact' }
          )
          .eq('paid_for', selectedStat.paid_for)
        if (selectedStat.paid_for_label_id == null) {
          query = query.is('paid_for_label_id', null)
        } else {
          query = query.eq('paid_for_label_id', selectedStat.paid_for_label_id)
        }
        const { data, error, count } = await query
          .order('submit_on', { ascending: false, nullsFirst: false })
          .range(from, to)
        if (cancelled) return
        if (error) {
          toast.error(t('detailLoadError'))
          setDetailRows([])
          setDetailTotal(0)
        } else {
          setDetailRows((data ?? []) as DetailExpenseRow[])
          setDetailTotal(typeof count === 'number' ? count : 0)
        }
      } finally {
        if (!cancelled) setDetailLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [open, selectedStat, detailPage, t])

  useEffect(() => {
    if (!selectedStat) {
      setDetailRows([])
      setDetailTotal(null)
      setDetailLoading(false)
      setDetailSelectedIds(new Set())
    }
  }, [selectedStat])

  const rowKey = (r: StatRow) => `${r.paid_for}||${r.paid_for_label_id ?? 'null'}`

  const totalDetailPages =
    detailTotal != null && detailTotal > 0 ? Math.max(1, Math.ceil(detailTotal / DETAIL_PAGE_SIZE)) : 1

  useEffect(() => {
    if (detailTotal == null || detailTotal <= 0) return
    const tp = Math.max(1, Math.ceil(detailTotal / DETAIL_PAGE_SIZE))
    if (detailPage > tp) setDetailPage(tp)
  }, [detailTotal, detailPage])

  const toggleRowSelected = (r: StatRow) => {
    setSelectedStat((cur) => {
      if (cur && rowKey(cur) === rowKey(r)) return null
      return r
    })
    setDetailPage(1)
    setDetailPanelExpanded(true)
  }

  useEffect(() => {
    if (selectedStat) setDetailPanelExpanded(true)
  }, [selectedStat])

  const formatSubmitOn = (iso: string | null) => {
    if (!iso) return '—'
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso.slice(0, 10)
    return d.toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  /** 회사 지출 목록과 동일: USD 통화 표기 */
  const formatCurrency = (n: number | null) => {
    if (n == null || Number.isNaN(n)) return '—'
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
  }

  const detailPageIds = useMemo(() => detailRows.map((r) => r.id), [detailRows])
  const allDetailPageSelected =
    detailPageIds.length > 0 && detailPageIds.every((id) => detailSelectedIds.has(id))
  const someDetailPageSelected = detailPageIds.some((id) => detailSelectedIds.has(id))
  const headerPageCheckboxState: ComponentProps<typeof Checkbox>['checked'] = allDetailPageSelected
    ? true
    : someDetailPageSelected
      ? 'indeterminate'
      : false

  const detailFrom =
    detailTotal != null && detailTotal > 0 ? (detailPage - 1) * DETAIL_PAGE_SIZE + 1 : 0
  const detailTo =
    detailTotal != null && detailTotal > 0
      ? Math.min(detailPage * DETAIL_PAGE_SIZE, detailTotal)
      : 0

  const inferredLeafForStat = useCallback(
    (r: StatRow): string => {
      if (standardCats.length === 0) return ''
      const sp = (r.sample_standard_paid_for ?? '').trim()
      const cat = (r.sample_category ?? '').trim()
      const et = (r.sample_expense_type ?? '').trim()
      const paidForForMatch = sp || (r.paid_for ?? '').trim()
      if (!paidForForMatch && !cat && !et) return ''
      const m = matchUnifiedLeafIdFromForm(paidForForMatch, cat, et, standardCats, locale)
      if (m !== '__custom__' && m) return m
      return ''
    },
    [standardCats, locale]
  )

  const getDraft = useCallback(
    (r: StatRow): RowDraft => {
      const key = rowKey(r)
      if (Object.prototype.hasOwnProperty.call(drafts, key)) {
        return drafts[key]!
      }
      return { targetLeafId: inferredLeafForStat(r) }
    },
    [drafts, inferredLeafForStat]
  )

  const setDraft = useCallback((r: StatRow, next: RowDraft) => {
    setDrafts((prev) => ({ ...prev, [rowKey(r)]: next }))
  }, [])

  const applyRow = async (r: StatRow) => {
    const d = getDraft(r)
    if (!d.targetLeafId) {
      toast.error(t('pickLabel'))
      return
    }
    const key = rowKey(r)
    setApplyingKey(key)
    try {
      const res = await fetch('/api/company-expenses/paid-for-normalization/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paidFor: r.paid_for,
          previousLabelId: r.paid_for_label_id,
          standardLeafId: d.targetLeafId,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || t('applyError'))
        return
      }
      toast.success(t('applySuccess', { count: json.updatedCount ?? 0 }))
      await load()
      onApplied?.()
    } catch {
      toast.error(t('applyError'))
    } finally {
      setApplyingKey(null)
    }
  }

  const applySelectedDetailExpenses = async () => {
    if (!selectedStat) return
    const d = getDraft(selectedStat)
    if (!d.targetLeafId) {
      toast.error(t('pickLabel'))
      return
    }
    const ids = [...detailSelectedIds]
    if (ids.length === 0) {
      toast.error(t('detailNoneSelected'))
      return
    }
    setApplyingDetailSelected(true)
    try {
      const res = await fetch('/api/company-expenses/paid-for-normalization/apply-by-ids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expenseIds: ids,
          standardLeafId: d.targetLeafId,
          paidFor: selectedStat.paid_for,
          previousLabelId: selectedStat.paid_for_label_id,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || t('applyError'))
        return
      }
      toast.success(t('detailApplySelectedSuccess', { count: json.updatedCount ?? 0 }))
      await load()
      onApplied?.()
    } catch {
      toast.error(t('applyError'))
    } finally {
      setApplyingDetailSelected(false)
    }
  }

  const filtered = useMemo(() => {
    if (listFilter === 'all') return stats
    if (listFilter === 'missingStandard') return stats.filter(statRowHasMissingStandard)
    return stats.filter((r) => r.paid_for_label_id == null)
  }, [stats, listFilter])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex w-[min(96vw,88rem)] max-w-[min(96vw,88rem)] flex-col max-h-[min(90vh,720px)]">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription className="text-left">{t('description')}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-3 py-2 border-b">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-initial">
            <Label htmlFor="pfn-list-filter" className="text-sm shrink-0 text-muted-foreground">
              {t('listFilterLabel')}
            </Label>
            <Select
              value={listFilter}
              onValueChange={(v) => setListFilter(v as NormalizationListFilter)}
              disabled={loading}
            >
              <SelectTrigger id="pfn-list-filter" className="h-9 w-[min(100%,16rem)] sm:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('listFilterAll')}</SelectItem>
                <SelectItem value="missingStandard">{t('listFilterMissingStandard')}</SelectItem>
                <SelectItem value="unlabeled">{t('listFilterUnlabeled')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-auto sm:ml-0"
            onClick={() => void load()}
            disabled={loading}
          >
            {t('refresh')}
          </Button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-2 px-2 -mx-2">
          <p className="shrink-0 text-xs text-muted-foreground">{t('rowSelectHint')}</p>
          <div className="min-h-0 flex-1 overflow-auto">
            {loading ? (
              <p className="text-sm text-muted-foreground py-6 text-center">{t('loading')}</p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">{t('empty')}</p>
            ) : !hasAnyStandardLeaf ? (
              <p className="text-sm text-muted-foreground py-6 text-center">{t('noStandardCategories')}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('colPaidFor')}</TableHead>
                    <TableHead className="w-24 text-right">{t('colCount')}</TableHead>
                    <TableHead className="w-44">{t('colCurrentLabel')}</TableHead>
                    <TableHead className="min-w-[42rem] w-[42rem]">{t('colTargetLabel')}</TableHead>
                    <TableHead className="w-28 text-right">{t('colAction')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => {
                    const k = rowKey(r)
                    const current = r.paid_for_label_id
                      ? labels.find((l) => l.id === r.paid_for_label_id)?.label_ko ?? r.paid_for_label_id
                      : '—'
                    const d = getDraft(r)
                    const selected = selectedStat != null && rowKey(selectedStat) === k
                    return (
                      <TableRow
                        key={k}
                        className={cn(selected && 'bg-muted/50', 'cursor-pointer')}
                        onClick={() => toggleRowSelected(r)}
                      >
                        <TableCell className="max-w-[14rem]">
                          <span className="text-sm break-words" title={r.paid_for}>
                            {r.paid_for}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{r.count}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{current}</TableCell>
                        <TableCell
                          className="relative min-w-[42rem] w-[42rem] align-top overflow-visible"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <UnifiedStandardLeafPicker
                            compact
                            allowClear
                            placeholderWhenEmpty={t('pickerNoSelection')}
                            clearOptionLabel={t('pickerNoSelection')}
                            groups={unifiedStandardGroups}
                            value={d.targetLeafId}
                            onPick={(id) => setDraft(r, { targetLeafId: id ?? '' })}
                            parentOpen={open}
                            listZClass="z-[2000]"
                            className="min-w-0"
                            renderOptionSuffix={(it) => (
                              <>
                                {standardCatById.get(it.id)?.is_active === false
                                  ? ` (${t('inactiveCategory')})`
                                  : ''}
                                {it.id === VEHICLE_REPAIR_STANDARD_LEAF_ID ? ` (${t('vehicleTag')})` : ''}
                              </>
                            )}
                          />
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => void applyRow(r)}
                            disabled={applyingKey === k || !d.targetLeafId}
                          >
                            {applyingKey === k ? t('applying') : t('apply')}
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </div>

          {selectedStat ? (
            <div className="flex shrink-0 flex-col gap-0 border-t pt-2">
              <div className="flex min-h-0 items-stretch gap-1 overflow-hidden rounded-md border bg-muted/30">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold text-foreground hover:bg-muted/60"
                  onClick={() => setDetailPanelExpanded((v) => !v)}
                  aria-expanded={detailPanelExpanded}
                  aria-controls="pfn-detail-accordion-panel"
                  id="pfn-detail-accordion-trigger"
                >
                  {detailPanelExpanded ? (
                    <ChevronUp className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                  ) : (
                    <ChevronDown className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                  )}
                  <span className="truncate">
                    {t('detailTitle', { total: detailTotal ?? selectedStat.count })}
                  </span>
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0 rounded-none px-3 text-muted-foreground hover:text-foreground"
                  onClick={() => setSelectedStat(null)}
                >
                  {t('detailClose')}
                </Button>
              </div>
              {detailPanelExpanded ? (
                <div
                  id="pfn-detail-accordion-panel"
                  role="region"
                  aria-labelledby="pfn-detail-accordion-trigger"
                  className="mt-2 flex max-h-[40vh] min-h-[8rem] flex-col gap-2"
                >
              {detailLoading ? (
                <p className="text-sm text-muted-foreground py-4 text-center">{t('detailLoading')}</p>
              ) : detailRows.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">{t('detailEmpty')}</p>
              ) : (
                <>
                  <div className="flex shrink-0 flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="pfn-detail-select-page"
                        checked={headerPageCheckboxState}
                        onCheckedChange={(v) => {
                          if (v === true) {
                            setDetailSelectedIds((prev) => new Set([...prev, ...detailPageIds]))
                          } else {
                            setDetailSelectedIds((prev) => {
                              const n = new Set(prev)
                              detailPageIds.forEach((id) => n.delete(id))
                              return n
                            })
                          }
                        }}
                      />
                      <Label htmlFor="pfn-detail-select-page" className="cursor-pointer text-sm">
                        {t('detailSelectAllPage')}
                      </Label>
                    </div>
                    {detailSelectedIds.size > 0 ? (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {t('detailSelectedCount', { count: detailSelectedIds.size })}
                      </span>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={
                        applyingDetailSelected ||
                        detailSelectedIds.size === 0 ||
                        !getDraft(selectedStat).targetLeafId
                      }
                      onClick={() => void applySelectedDetailExpenses()}
                    >
                      {applyingDetailSelected ? t('detailApplyingSelected') : t('detailApplySelected')}
                    </Button>
                  </div>
                  <div className="min-h-0 flex-1 overflow-auto rounded-md border bg-background">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10 pr-0" />
                          <TableHead className="w-[10rem]">{t('detailColDate')}</TableHead>
                          <TableHead className="w-32 text-right">{t('detailColAmount')}</TableHead>
                          <TableHead className="min-w-[8rem]">{t('detailColPaidTo')}</TableHead>
                          <TableHead className="w-32">{t('detailColCategory')}</TableHead>
                          <TableHead className="w-32">{t('detailColExpenseType')}</TableHead>
                          <TableHead>{t('detailColDescription')}</TableHead>
                          <TableHead className="w-24">{t('detailColStatus')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detailRows.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="w-10 pr-0 align-middle">
                              <Checkbox
                                checked={detailSelectedIds.has(row.id)}
                                onCheckedChange={(v) => {
                                  setDetailSelectedIds((prev) => {
                                    const n = new Set(prev)
                                    if (v === true) n.add(row.id)
                                    else n.delete(row.id)
                                    return n
                                  })
                                }}
                                aria-label={row.id}
                              />
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-sm">
                              {formatSubmitOn(row.submit_on)}
                            </TableCell>
                            <TableCell className="text-right text-sm tabular-nums">
                              {formatCurrency(row.amount)}
                            </TableCell>
                            <TableCell className="max-w-[12rem] truncate text-sm" title={row.paid_to ?? ''}>
                              {row.paid_to ?? '—'}
                            </TableCell>
                            <TableCell className="text-sm">{row.category ?? '—'}</TableCell>
                            <TableCell className="text-sm">{row.expense_type ?? '—'}</TableCell>
                            <TableCell className="max-w-[20rem] truncate text-xs text-muted-foreground" title={row.description ?? ''}>
                              {row.description ?? '—'}
                            </TableCell>
                            <TableCell className="text-xs">{row.status ?? '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="flex shrink-0 items-center justify-between gap-2 text-sm">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={detailLoading || detailPage <= 1}
                      onClick={() => setDetailPage((p) => Math.max(1, p - 1))}
                    >
                      {t('detailPrev')}
                    </Button>
                    <span className="flex-1 text-center text-muted-foreground tabular-nums">
                      {t('detailPageStatus', {
                        from: detailFrom,
                        to: detailTo,
                        total: detailTotal ?? 0,
                        page: detailPage,
                        totalPages: totalDetailPages,
                      })}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={
                        detailLoading ||
                        detailTotal == null ||
                        detailPage >= totalDetailPages
                      }
                      onClick={() => setDetailPage((p) => p + 1)}
                    >
                      {t('detailNext')}
                    </Button>
                  </div>
                </>
              )}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
