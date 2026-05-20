# -*- coding: utf-8 -*-
"""Restore Korean UI strings in CategoryMappingExpenseDetailDialog.tsx"""
from pathlib import Path

path = Path(__file__).resolve().parents[1] / "src/components/expenses/CategoryMappingExpenseDetailDialog.tsx"

# Full file content with correct UTF-8 Korean
content = r'''use client'

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

export type CategoryMappingSourceTable =
  | 'tour_expenses'
  | 'reservation_expenses'
  | 'company_expenses'

const EMPTY = '\u2014'

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
}

type RowDraft = {
  classification: string
  leafId: string
}

function sourceLabel(source: CategoryMappingSourceTable): string {
  switch (source) {
    case 'tour_expenses':
      return '\ud22c\uc5b4 \uc9c0\ucd9c'
    case 'reservation_expenses':
      return '\uc608\uc57d \uc9c0\ucd9c'
    case 'company_expenses':
      return '\ud68c\uc0ac \uc9c0\ucd9c'
    default:
      return source
  }
}

function classificationFieldLabel(source: CategoryMappingSourceTable): string {
  return source === 'company_expenses' ? '\uce74\ud14c\uace0\ub9ac (category)' : '\acb0\uc81c\ub0b4\uc6a9 (paid_for)'
}

function descriptionDisplay(
  line: ExpenseLine,
  sourceTable: CategoryMappingSourceTable
): string {
  if (sourceTable === 'company_expenses') {
    const desc = (line.description || '').trim()
    if (desc) return desc
    return (line.note || '').trim()
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
      ? 'id, category, paid_for, amount, submit_on, paid_to, description, notes'
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
    throw new Error(`${classificationFieldLabel(sourceTable)}\uc744 \uc785\ub825\ud558\uc138\uc694.`)
  }
  if (!draft.leafId) {
    throw new Error('\ud45c\uc900 \uce74\ud14c\uace0\ub9ac\ub97c \uc120\ud0dd\ud558\uc138\uc694.')
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
        throw new Error(json.message || json.error || '\uc608\uc57d \uc9c0\ucd9c \uc218\uc815 \uc2e4\ud328')
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
        throw new Error(json.error || '\ud68c\uc0ac \uc9c0\ucd9c \uc218\uc815 \uc2e4\ud328')
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

  const totalPages = useMemo(
    () => reservationExpenseTotalPages(lines.length, pageSize),
    [lines.length, pageSize]
  )
  const safePage = Math.min(Math.max(1, page), totalPages)

  useEffect(() => {
    if (page !== safePage) setPage(safePage)
  }, [page, safePage])

  const pageLines = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return lines.slice(start, start + pageSize)
  }, [lines, safePage, pageSize])

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
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : '\uc9c0\ucd9c \ubaa9\ub85d\uc744 \ubd88\ub7ec\uc624\uc9c0 \ubabb\ud588\uc2b5\ub2c8\ub2e4.')
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

  const applyBulkDrafts = () => {
    if (selectedIds.size === 0) {
      toast.error('\uc120\ud0dd\ub41c \ud56d\ubaa9\uc774 \uc5c6\uc2b5\ub2c8\ub2e4.')
      return
    }
    const classification = bulkClassification.trim()
    if (!classification && !bulkLeafId) {
      toast.error('\uc77c\uad04 \uc6d0\ubb38 \ub610\ub294 \ud45c\uc900 \uce74\ud14c\uace0\ub9ac\ub97c \uc785\ub825\ud558\uc138\uc694.')
      return
    }

    setDrafts((prev) => {
      const next = { ...prev }
      for (const id of selectedIds) {
        const cur = next[id] ?? { classification: lineById.get(id)?.classification ?? '', leafId: '' }
        let row = { ...cur }
        if (classification) row = { ...row, classification }
        if (bulkLeafId) row = draftWithLeaf(id, bulkLeafId, row)
        next[id] = row
      }
      return next
    })
    toast.success(
      `${selectedIds.size}\uac74\uc5d0 \uc77c\uad04 \uc801\uc6a9\ud588\uc2b5\ub2c8\ub2e4. \uc800\uc7a5 \ubc84\ud2bc\uc73c\ub85c \ubc18\uc601\ud558\uc138\uc694.`
    )
  }

  const busy = savingId !== null || bulkSaving

  const saveRow = async (line: ExpenseLine) => {
    const draft = drafts[line.id]
    if (!draft) return

    setSavingId(line.id)
    try {
      await persistExpenseRow(line, draft, sourceTable, byId)
      toast.success('\uc800\uc7a5\ud588\uc2b5\ub2c8\ub2e4.')
      await onSaved()
      await loadLines()
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : '\uc800\uc7a5\uc5d0 \uc2e4\ud328\ud588\uc2b5\ub2c8\ub2e4.')
    } finally {
      setSavingId(null)
    }
  }

  const saveSelected = async () => {
    if (selectedIds.size === 0) {
      toast.error('\uc120\ud0dd\ub41c \ud56d\ubaa9\uc774 \uc5c6\uc2b5\ub2c8\ub2e4.')
      return
    }

    const targets: { line: ExpenseLine; draft: RowDraft }[] = []
    for (const id of selectedIds) {
      const line = lineById.get(id)
      const draft = drafts[id]
      if (!line || !draft) continue
      targets.push({ line, draft })
    }

    if (targets.length === 0) return

    setBulkSaving(true)
    let ok = 0
    let fail = 0
    let lastError = ''

    for (const { line, draft } of targets) {
      try {
        await persistExpenseRow(line, draft, sourceTable, byId)
        ok++
      } catch (e) {
        fail++
        lastError = e instanceof Error ? e.message : '\uc800\uc7a5 \uc2e4\ud328'
        console.error(e)
      }
    }

    if (ok > 0) {
      toast.success(
        `${ok}\uac74 \uc800\uc7a5\ud588\uc2b5\ub2c8\ub2e4.${fail > 0 ? ` (${fail}\uac74 \uc2e4\ud328)` : ''}`
      )
      await onSaved()
      await loadLines()
    } else {
      toast.error(lastError || '\uc800\uc7a5\uc5d0 \uc2e4\ud328\ud588\uc2b5\ub2c8\ub2e4.')
    }

    setBulkSaving(false)
  }

  const totalAmount = lines.reduce((s, l) => s + l.amount, 0)
  const selectedCount = selectedIds.size

  const LEAF_PLACEHOLDER = '\ud45c\uc900 \ub9ac\ud504 \uc120\ud0dd\u2026'

  const leafSelect = (
    value: string,
    onChange: (leafId: string) => void,
    disabled: boolean,
    className?: string
  ) => (
    <select
      className={
        className ??
        'h-8 w-full min-w-[160px] max-w-[220px] rounded-md border bg-background px-2 text-xs'
      }
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    >
      <option value="">{LEAF_PLACEHOLDER}</option>
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
      <DialogContent className="max-w-[min(100vw-1.5rem,56rem)] max-h-[min(90vh,720px)] flex flex-col p-0 gap-0 z-[1200]">
        <DialogHeader className="px-4 pt-4 pb-2 pr-12 border-b shrink-0">
          <DialogTitle className="text-base leading-snug">
            {'\uc9c0\ucd9c \uc0c1\uc138 \u2014 '}
            {originalValue}
          </DialogTitle>
          <p className="text-xs text-muted-foreground font-normal pt-1 leading-relaxed">
            {sourceLabel(sourceTable)} {'\u00b7'} {lines.length}
            {'\uac74 \u00b7'} {formatMoney(totalAmount)}
          </p>
          <p className="text-xs text-muted-foreground font-normal pt-1 leading-relaxed">
            {
              '\uac19\uc740 \uc6d0\ubb38(\uc608: vehicle)\uc73c\ub85c \ubb36\uc778 \uc9c0\ucd9c\uc744 \ub098\ub204\ub824\uba74 \ud589\ub9c8\ub2e4 '
            }
            <strong>{classificationFieldLabel(sourceTable)}</strong>
            {
              '\uc744 \uad6c\ubd84\ud558\uace0 \ud45c\uc900 \uce74\ud14c\uace0\ub9ac\ub97c \uc9c0\uc815\ud55c \ub4a4 \uc800\uc7a5\ud558\uc138\uc694. (vehicle loan, vehicle insurance \ub4f1)'
            }
          </p>
        </DialogHeader>

        {!loading && lines.length > 0 && (
          <motion.div className="px-4 py-3 border-b bg-muted/30 shrink-0 space-y-3">
'''

# The script got truncated - I need a different approach. Write the python file that builds content programmatically
# Actually let me just run python to decode unicode escapes and write - split into part 2 in the same script

if __name__ == '__main__':
    # decode escapes in the template by using .encode().decode('unicode_escape') on string parts
    pass
