'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { apiBearerAuthHeaders } from '@/lib/api-client-bearer'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import ReservationExpenseTabPager, {
  reservationExpenseTotalPages,
} from '@/components/expenses/ReservationExpenseTabPager'
import { buildUnifiedStandardLeafGroups } from '@/lib/companyExpenseStandardUnified'
import {
  canonicalPaidForTextFromStandardCategory,
  type ExpenseStandardCategoryPickRow,
} from '@/lib/expenseStandardCategoryPaidFor'
import { splitMappingIdsFromLeafId } from '@/lib/pnlStandardCategoryTable'
import L from './category-mapping-detail.labels.json'

export type CategoryMappingSourceTable =
  | 'tour_expenses'
  | 'reservation_expenses'
  | 'company_expenses'

const EMPTY = L.empty

const SOURCE_LABELS: Record<CategoryMappingSourceTable, string> = {
  tour_expenses: L.tourSource,
  reservation_expenses: L.reservationSource,
  company_expenses: L.companySource,
}

function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ''))
}

function isDraftSavable(draft: RowDraft): boolean {
  return Boolean(draft.classification.trim() && draft.leafId)
}

type ExpenseLine = {
  id: string
  classification: string
  paid_for: string | null
  category: string | null
  amount: number
  submit_on: string | null
  paid_to: string | null
  description: string | null
  note: string | null
  standard_paid_for: string | null
}

type RowDraft = {
  classification: string
  leafId: string
}

function sourceLabel(source: CategoryMappingSourceTable): string {
  return SOURCE_LABELS[source] ?? source
}

function classificationFieldLabel(source: CategoryMappingSourceTable): string {
  return source === 'company_expenses' ? L.categoryField : L.paidForField
}

/** ?? ?? ??? ???(paid_to) ? ??? ????(paid_for) */
function payeeDisplay(
  line: ExpenseLine,
  sourceTable: CategoryMappingSourceTable
): string {
  const paidTo = (line.paid_to || '').trim()
  if (paidTo) return paidTo
  if (sourceTable === 'company_expenses') {
    return (line.paid_for || '').trim()
  }
  return ''
}

function lineMatchesBulkSearch(
  line: ExpenseLine,
  sourceTable: CategoryMappingSourceTable,
  term: string
): boolean {
  const q = term.trim().toLowerCase()
  if (!q) return true
  const payee = payeeDisplay(line, sourceTable).toLowerCase()
  const desc = descriptionDisplay(line, sourceTable).toLowerCase()
  return payee.includes(q) || desc.includes(q)
}

function descriptionDisplay(
  line: ExpenseLine,
  sourceTable: CategoryMappingSourceTable
): string {
  if (sourceTable === 'company_expenses') {
    const desc = (line.description || '').trim()
    if (desc) return desc
    const notes = (line.note || '').trim()
    if (notes) return notes
    const standard = (line.standard_paid_for || '').trim()
    if (standard) return standard
    const paidFor = (line.paid_for || '').trim()
    const paidTo = (line.paid_to || '').trim()
    if (paidFor && paidTo && paidFor !== paidTo) return paidFor
    return ''
  }
  return (line.note || '').trim()
}

function isoToYmd(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const day = d.getDate()
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function formatMoney(n: number): string {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

async function fetchExpenseLines(
  sourceTable: CategoryMappingSourceTable,
  originalValue: string
): Promise<ExpenseLine[]> {
  const matchField = sourceTable === 'company_expenses' ? 'category' : 'paid_for'
  const select =
    sourceTable === 'company_expenses'
      ? 'id, category, paid_for, amount, submit_on, paid_to, description, notes, standard_paid_for'
      : 'id, paid_for, amount, submit_on, paid_to, note'

  const all: ExpenseLine[] = []
  const batchSize = 500
  let from = 0
  let hasMore = true

  while (hasMore) {
    const { data, error } = await supabase
      .from(sourceTable)
      .select(select)
      .eq(matchField, originalValue)
      .is('deleted_at', null)
      .range(from, from + batchSize - 1)

    if (error) throw error

    const batch = data ?? []
    for (const row of batch as Record<string, unknown>[]) {
      const classification =
        sourceTable === 'company_expenses'
          ? String(row.category ?? '').trim()
          : String(row.paid_for ?? '').trim()
      all.push({
        id: String(row.id),
        classification,
        paid_for: row.paid_for != null ? String(row.paid_for) : null,
        category: row.category != null ? String(row.category) : null,
        amount: Number(row.amount) || 0,
        submit_on: row.submit_on != null ? String(row.submit_on) : null,
        paid_to: row.paid_to != null ? String(row.paid_to) : null,
        description: row.description != null ? String(row.description) : null,
        note:
          row.note != null
            ? String(row.note)
            : row.notes != null
              ? String(row.notes)
              : null,
        standard_paid_for:
          row.standard_paid_for != null ? String(row.standard_paid_for) : null,
      })
    }

    hasMore = batch.length === batchSize
    from += batchSize
  }

  return all.sort((a, b) => {
    const ta = a.submit_on ? new Date(a.submit_on).getTime() : 0
    const tb = b.submit_on ? new Date(b.submit_on).getTime() : 0
    return tb - ta
  })
}

async function persistExpenseRow(
  line: ExpenseLine,
  draft: RowDraft,
  sourceTable: CategoryMappingSourceTable,
  byId: Map<string, ExpenseStandardCategoryPickRow>
): Promise<void> {
  const classification = draft.classification.trim()
  if (!classification) {
    throw new Error(
      fmt(L.errClassificationRequired, {
        field: classificationFieldLabel(sourceTable),
      })
    )
  }
  if (!draft.leafId) {
    throw new Error(L.errLeafRequired)
  }

  const { standard_category_id, sub_category_id } = splitMappingIdsFromLeafId(draft.leafId, byId)

  if (classification !== line.classification) {
    if (sourceTable === 'tour_expenses') {
      const { error } = await supabase
        .from('tour_expenses')
        .update({
          paid_for: classification,
          updated_at: new Date().toISOString(),
        })
        .eq('id', line.id)
      if (error) throw error
    } else if (sourceTable === 'reservation_expenses') {
      const res = await fetch(`/api/reservation-expenses/${line.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paid_for: classification }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.message || json.error || L.errReservationUpdate)
      }
    } else {
      const res = await fetch('/api/company-expenses', {
        method: 'PUT',
        headers: { ...apiBearerAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: line.id,
          category: classification,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || L.errCompanyUpdate)
      }
    }
  }

  const { error: mapErr } = await supabase.from('expense_category_mappings').upsert(
    {
      original_value: classification,
      source_table: sourceTable,
      standard_category_id,
      sub_category_id,
      match_count: 1,
      last_matched_at: new Date().toISOString(),
    },
    { onConflict: 'original_value,source_table' }
  )
  if (mapErr) throw mapErr
}

export type CategoryMappingExpenseDetailDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  originalValue: string
  sourceTable: CategoryMappingSourceTable
  standardCategories: ExpenseStandardCategoryPickRow[]
  onSaved: () => void | Promise<void>
}

export default function CategoryMappingExpenseDetailDialog({
  open,
  onOpenChange,
  originalValue,
  sourceTable,
  standardCategories,
  onSaved,
}: CategoryMappingExpenseDetailDialogProps) {
  const [lines, setLines] = useState<ExpenseLine[]>([])
  const [loading, setLoading] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [bulkSaving, setBulkSaving] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [bulkClassification, setBulkClassification] = useState('')
  const [bulkLeafId, setBulkLeafId] = useState('')
  const [bulkLineSearch, setBulkLineSearch] = useState('')

  const pickRows = useMemo(
    () =>
      standardCategories.map((c) => ({
        id: c.id,
        name: c.name,
        name_ko: c.name_ko,
        parent_id: c.parent_id ?? null,
        tax_deductible: c.tax_deductible ?? null,
        display_order: c.display_order ?? null,
        is_active: c.is_active ?? true,
      })),
    [standardCategories]
  )

  const byId = useMemo(() => new Map(pickRows.map((c) => [c.id, c])), [pickRows])

  const unifiedGroups = useMemo(
    () => buildUnifiedStandardLeafGroups(pickRows, 'ko', { includeInactive: true }),
    [pickRows]
  )

  const displayLines = useMemo(() => {
    const q = bulkLineSearch.trim()
    if (!q) return lines
    return lines.filter((l) => lineMatchesBulkSearch(l, sourceTable, q))
  }, [lines, bulkLineSearch, sourceTable])

  const totalPages = useMemo(
    () => reservationExpenseTotalPages(displayLines.length, pageSize),
    [displayLines.length, pageSize]
  )
  const safePage = Math.min(Math.max(1, page), totalPages)

  useEffect(() => {
    if (page !== safePage) setPage(safePage)
  }, [page, safePage])

  useEffect(() => {
    setPage(1)
  }, [bulkLineSearch])

  const pageLines = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return displayLines.slice(start, start + pageSize)
  }, [displayLines, safePage, pageSize])

  const lineById = useMemo(() => new Map(lines.map((l) => [l.id, l])), [lines])

  const allPageSelected =
    pageLines.length > 0 && pageLines.every((l) => selectedIds.has(l.id))
  const somePageSelected = pageLines.some((l) => selectedIds.has(l.id)) && !allPageSelected

  const loadLines = useCallback(async () => {
    if (!originalValue.trim()) return
    setLoading(true)
    try {
      const data = await fetchExpenseLines(sourceTable, originalValue)
      setLines(data)
      const initial: Record<string, RowDraft> = {}
      for (const line of data) {
        initial[line.id] = { classification: line.classification, leafId: '' }
      }
      setDrafts(initial)
      setSelectedIds(new Set())
      setPage(1)
      setBulkClassification('')
      setBulkLeafId('')
      setBulkLineSearch('')
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : L.errLoadList)
      setLines([])
      setDrafts({})
      setSelectedIds(new Set())
    } finally {
      setLoading(false)
    }
  }, [originalValue, sourceTable])

  useEffect(() => {
    if (open) void loadLines()
    else {
      setLines([])
      setDrafts({})
      setSavingId(null)
      setBulkSaving(false)
      setSelectedIds(new Set())
      setPage(1)
    }
  }, [open, loadLines])

  useEffect(() => {
    setPage(1)
  }, [pageSize])

  const updateDraft = (id: string, patch: Partial<RowDraft>) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...patch },
    }))
  }

  const draftWithLeaf = (lineId: string, leafId: string, cur: RowDraft): RowDraft => {
    const leaf = byId.get(leafId)
    const suggested =
      leaf && leafId
        ? canonicalPaidForTextFromStandardCategory(leaf, { language: 'ko' })
        : undefined
    return {
      ...cur,
      leafId,
      ...(suggested ? { classification: suggested } : {}),
    }
  }

  const onLeafChange = (lineId: string, leafId: string) => {
    setDrafts((prev) => {
      const cur = prev[lineId] ?? { classification: '', leafId: '' }
      return { ...prev, [lineId]: draftWithLeaf(lineId, leafId, cur) }
    })
  }

  const toggleRow = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const togglePageSelection = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const line of pageLines) {
        if (checked) next.add(line.id)
        else next.delete(line.id)
      }
      return next
    })
  }

  const selectAllLines = () => {
    setSelectedIds(new Set(lines.map((l) => l.id)))
  }

  const clearSelection = () => setSelectedIds(new Set())

  const selectSearchMatches = () => {
    const q = bulkLineSearch.trim()
    if (!q) return
    const ids = lines
      .filter((l) => lineMatchesBulkSearch(l, sourceTable, q))
      .map((l) => l.id)
    if (ids.length === 0) {
      toast.error(L.errNoSearchMatches)
      return
    }
    setSelectedIds(new Set(ids))
    toast.success(fmt(L.msgSearchSelected, { count: ids.length }))
  }

  const resolveDraftForSave = (lineId: string, draft: RowDraft): RowDraft => {
    let row = { ...draft }
    const classification = bulkClassification.trim()
    if (classification) row = { ...row, classification }
    if (bulkLeafId) row = draftWithLeaf(lineId, bulkLeafId, row)
    return row
  }

  const applyBulkDrafts = () => {
    if (selectedIds.size === 0) {
      toast.error(L.errNoSelection)
      return
    }
    const classification = bulkClassification.trim()
    if (!classification && !bulkLeafId) {
      toast.error(L.errBulkInput)
      return
    }

    setDrafts((prev) => {
      const next = { ...prev }
      for (const id of selectedIds) {
        const cur = next[id] ?? {
          classification: lineById.get(id)?.classification ?? '',
          leafId: '',
        }
        let row = { ...cur }
        if (classification) row = { ...row, classification }
        if (bulkLeafId) row = draftWithLeaf(id, bulkLeafId, row)
        next[id] = row
      }
      return next
    })
    toast.success(fmt(L.msgBulkApplied, { count: selectedIds.size }))
  }

  const busy = savingId !== null || bulkSaving

  const saveRow = async (line: ExpenseLine) => {
    const base =
      drafts[line.id] ?? { classification: line.classification, leafId: '' }
    const draft = resolveDraftForSave(line.id, base)
    if (!isDraftSavable(draft)) {
      toast.error(draft.leafId ? fmt(L.errClassificationRequired, {
        field: classificationFieldLabel(sourceTable),
      }) : L.errLeafRequired)
      return
    }

    setSavingId(line.id)
    try {
      await persistExpenseRow(line, draft, sourceTable, byId)
      toast.success(L.msgSaved)
      await onSaved()
      await loadLines()
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : L.errSave)
    } finally {
      setSavingId(null)
    }
  }

  const saveSelected = async () => {
    if (selectedIds.size === 0) {
      toast.error(L.errNoSelection)
      return
    }

    const ready: { line: ExpenseLine; draft: RowDraft }[] = []
    let skipped = 0
    for (const id of selectedIds) {
      const line = lineById.get(id)
      if (!line) continue
      const base =
        drafts[id] ?? { classification: line.classification, leafId: '' }
      const draft = resolveDraftForSave(id, base)
      if (isDraftSavable(draft)) ready.push({ line, draft })
      else skipped++
    }

    if (ready.length === 0) {
      toast.error(L.errBulkSaveNoneReady)
      return
    }

    if (skipped > 0) {
      toast.warning(fmt(L.warnBulkSaveSkipped, { skipped }))
    }

    setBulkSaving(true)
    let ok = 0
    let fail = 0
    let lastError = ''

    for (const { line, draft } of ready) {
      try {
        await persistExpenseRow(line, draft, sourceTable, byId)
        ok++
      } catch (e) {
        fail++
        lastError = e instanceof Error ? e.message : L.errSaveFail
        console.error(e)
      }
    }

    if (ok > 0) {
      toast.success(
        fmt(L.msgSavedBulk, {
          ok,
          fail: fail > 0 ? fmt(L.failSuffix, { fail }) : '',
        })
      )
      await onSaved()
      await loadLines()
    } else {
      toast.error(lastError || L.errSave)
    }

    setBulkSaving(false)
  }

  const totalAmount = lines.reduce((s, l) => s + l.amount, 0)
  const selectedCount = selectedIds.size

  const leafSelect = (
    value: string,
    onChange: (leafId: string) => void,
    disabled: boolean,
    className?: string
  ) => (
    <select
      className={
        className ??
        'h-8 w-full min-w-0 max-w-full rounded-md border bg-background px-2 text-xs'
      }
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    >
      <option value="">{L.leafPlaceholder}</option>
      {unifiedGroups.map((gr) => (
        <optgroup key={gr.rootId} label={gr.groupLabel}>
          {gr.items.map((it) => (
            <option key={it.id} value={it.id}>
              {it.displayLabel}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(100vw-1.5rem,80rem)] w-[min(100vw-1.5rem,80rem)] max-h-[min(92vh,860px)] flex flex-col p-0 gap-0 z-[1200] sm:max-w-[80rem]">
        <DialogHeader className="px-4 pt-4 pb-2 pr-12 border-b shrink-0">
          <DialogTitle className="text-base leading-snug">
            {L.titlePrefix}
            {originalValue}
          </DialogTitle>
          <p className="text-xs text-muted-foreground font-normal pt-1 leading-relaxed">
            {sourceLabel(sourceTable)} ? {lines.length}
            {L.countSuffix} ? {formatMoney(totalAmount)}
          </p>
          <p className="text-xs text-muted-foreground font-normal pt-1 leading-relaxed">
            {L.intro}
            <strong>{classificationFieldLabel(sourceTable)}</strong>
            {L.introSuffix}
          </p>
        </DialogHeader>

        {!loading && lines.length > 0 && (
          <div className="px-4 py-3 border-b bg-muted/30 shrink-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-medium text-foreground">{L.bulkTitle}</span>
              <span className="text-muted-foreground tabular-nums">
                {L.selectedOf} {selectedCount}
                {L.countSuffix} / {L.totalOf} {lines.length}
                {L.countSuffix}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={busy || lines.length === 0}
                onClick={selectAllLines}
              >
                {L.selectAll}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={busy || selectedCount === 0}
                onClick={clearSelection}
              >
                {L.clearSelection}
              </Button>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{L.bulkLineSearch}</Label>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  className="h-8 text-xs flex-1"
                  value={bulkLineSearch}
                  onChange={(e) => setBulkLineSearch(e.target.value)}
                  placeholder={L.bulkLineSearchPlaceholder}
                  disabled={busy}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs shrink-0"
                  disabled={busy || !bulkLineSearch.trim()}
                  onClick={selectSearchMatches}
                >
                  {L.selectSearchMatches}
                </Button>
              </div>
              {bulkLineSearch.trim() ? (
                <p className="text-xs text-muted-foreground tabular-nums">
                  {fmt(L.searchFilterHint, {
                    shown: displayLines.length,
                    total: lines.length,
                  })}
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  {L.bulkPrefix}
                  {classificationFieldLabel(sourceTable)}
                </Label>
                <Input
                  className="h-8 text-xs"
                  value={bulkClassification}
                  onChange={(e) => setBulkClassification(e.target.value)}
                  placeholder={L.placeholderExample}
                  disabled={busy}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">{L.bulkStandardCategory}</Label>
                {leafSelect(bulkLeafId, setBulkLeafId, busy, 'h-8 w-full rounded-md border bg-background px-2 text-xs')}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8 text-xs"
                disabled={busy || selectedCount === 0}
                onClick={applyBulkDrafts}
              >
                {L.applyToSelected}
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-8 text-xs"
                disabled={busy || selectedCount === 0}
                onClick={() => void saveSelected()}
              >
                {bulkSaving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                    {L.saving}
                  </>
                ) : (
                  fmt(L.saveSelected, { count: selectedCount })
                )}
              </Button>
            </div>
          </div>
        )}

        <div className="overflow-auto flex-1 min-h-0 px-2 sm:px-4 py-3 flex flex-col gap-3">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              {L.loading}
            </div>
          ) : lines.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">{L.noExpenses}</p>
          ) : displayLines.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">{L.noSearchResults}</p>
          ) : (
            <>
              <ReservationExpenseTabPager
                page={safePage}
                totalPages={totalPages}
                pageSize={pageSize}
                totalFiltered={displayLines.length}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
              <table className="w-full text-xs sm:text-sm border-collapse">
                <colgroup>
                  <col className="w-8" />
                  <col className="w-[5.5rem]" />
                  <col className="min-w-[10rem]" />
                  <col className="min-w-[12rem]" />
                  <col className="w-[8.5rem]" />
                  <col className="w-[12.5rem]" />
                  <col className="w-[5.25rem]" />
                  <col className="w-[4.5rem]" />
                </colgroup>
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-1 w-8">
                      <Checkbox
                        checked={allPageSelected ? true : somePageSelected ? 'indeterminate' : false}
                        onCheckedChange={(c) => togglePageSelection(c === true)}
                        disabled={busy || pageLines.length === 0}
                        aria-label={L.selectPageAria}
                      />
                    </th>
                    <th className="py-2 pr-2 font-medium whitespace-nowrap">{L.colDate}</th>
                    <th className="py-2 pr-2 font-medium">{L.colPayee}</th>
                    <th className="py-2 pr-2 font-medium">{L.colDescription}</th>
                    <th className="py-2 pr-2 font-medium">
                      {classificationFieldLabel(sourceTable)}
                    </th>
                    <th className="py-2 pr-2 font-medium">{L.colStandard}</th>
                    <th className="py-2 pr-2 font-medium text-right whitespace-nowrap">{L.colAmount}</th>
                    <th className="py-2 pl-1 font-medium w-[72px]"> </th>
                  </tr>
                </thead>
                <tbody>
                  {pageLines.map((line) => {
                    const draft = drafts[line.id] ?? {
                      classification: line.classification,
                      leafId: '',
                    }
                    const saving = savingId === line.id
                    const checked = selectedIds.has(line.id)
                    return (
                      <tr
                        key={line.id}
                        className={`border-b border-border/60 align-top ${checked ? 'bg-blue-50/50' : ''}`}
                      >
                        <td className="py-2 pr-1">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(c) => toggleRow(line.id, c === true)}
                            disabled={busy}
                            aria-label={L.selectRowAria}
                          />
                        </td>
                        <td className="py-2 pr-2 whitespace-nowrap tabular-nums">
                          {isoToYmd(line.submit_on) || EMPTY}
                        </td>
                        <td className="py-2 pr-2 break-words align-top">
                          {payeeDisplay(line, sourceTable) || EMPTY}
                        </td>
                        <td className="py-2 pr-2 break-words text-muted-foreground align-top">
                          {(() => {
                            const text = descriptionDisplay(line, sourceTable)
                            return text ? (
                              <span className="line-clamp-3" title={text}>
                                {text}
                              </span>
                            ) : (
                              EMPTY
                            )
                          })()}
                        </td>
                        <td className="py-2 pr-2">
                          <Input
                            className="h-8 text-xs"
                            value={draft.classification}
                            onChange={(e) => updateDraft(line.id, { classification: e.target.value })}
                            disabled={busy}
                          />
                        </td>
                        <td className="py-2 pr-2 min-w-0 max-w-[12.5rem] align-top">
                          {leafSelect(draft.leafId, (leafId) => onLeafChange(line.id, leafId), busy)}
                        </td>
                        <td className="py-2 pr-2 w-[5.25rem] shrink-0 text-right tabular-nums font-medium whitespace-nowrap align-top">
                          {formatMoney(line.amount)}
                        </td>
                        <td className="py-2 pl-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 px-2 text-xs"
                            disabled={busy}
                            onClick={() => void saveRow(line)}
                          >
                            {saving ? L.savingShort : L.save}
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <ReservationExpenseTabPager
                page={safePage}
                totalPages={totalPages}
                pageSize={pageSize}
                totalFiltered={displayLines.length}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
