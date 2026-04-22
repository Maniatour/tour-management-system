'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
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
  flattenUnifiedLeaves,
  VEHICLE_REPAIR_STANDARD_LEAF_ID,
  type UnifiedStandardLeafItem,
} from '@/lib/companyExpenseStandardUnified'

type StatRow = { paid_for: string; count: number; paid_for_label_id: string | null }

type PaidForLabel = {
  id: string
  code: string
  label_ko: string
  label_en: string | null
  links_vehicle_maintenance: boolean
}

type RowDraft = { targetLeafId: string }

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
  const [onlyUnlabeled, setOnlyUnlabeled] = useState(true)
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({})

  const selectableLeaves = useMemo(() => {
    const groups = buildUnifiedStandardLeafGroups(standardCats, locale)
    return flattenUnifiedLeaves(groups)
  }, [standardCats, locale])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [sRes, lRes, cRes] = await Promise.all([
        fetch('/api/company-expenses/paid-for-normalization'),
        fetch('/api/company-expenses/paid-for-labels?includeInactive=1'),
        fetch('/api/company-expenses/expense-standard-categories'),
      ])
      const sJson = await sRes.json()
      const lJson = await lRes.json()
      const cJson = await cRes.json()
      if (!sRes.ok) {
        toast.error(sJson.error || t('loadStatsError'))
        setStats([])
      } else {
        setStats(Array.isArray(sJson.data) ? sJson.data : [])
      }
      if (!lRes.ok) {
        toast.error(lJson.error || t('loadLabelsError'))
        setLabels([])
      } else {
        setLabels(Array.isArray(lJson.data) ? lJson.data : [])
      }
      if (!cRes.ok) {
        toast.error(cJson.error || t('loadCategoriesError'))
        setStandardCats([])
      } else {
        setStandardCats(Array.isArray(cJson.data) ? cJson.data : [])
      }
      setDrafts({})
    } catch {
      toast.error(t('loadError'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  const rowKey = (r: StatRow) => `${r.paid_for}||${r.paid_for_label_id ?? 'null'}`

  const getDraft = (r: StatRow): RowDraft =>
    drafts[rowKey(r)] ?? { targetLeafId: selectableLeaves[0]?.id ?? '' }

  const setDraft = (r: StatRow, next: RowDraft) => {
    setDrafts((prev) => ({ ...prev, [rowKey(r)]: next }))
  }

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

  const filtered = onlyUnlabeled ? stats.filter((r) => r.paid_for_label_id == null) : stats

  const renderLeafOption = (it: UnifiedStandardLeafItem) => (
    <SelectItem key={it.id} value={it.id}>
      {it.displayLabel}
      {it.id === VEHICLE_REPAIR_STANDARD_LEAF_ID ? ` (${t('vehicleTag')})` : ''}
    </SelectItem>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[min(90vh,720px)] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription className="text-left">{t('description')}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 py-2 border-b">
          <Checkbox
            id="pfn-only-unlabeled"
            checked={onlyUnlabeled}
            onCheckedChange={(v) => setOnlyUnlabeled(v === true)}
          />
          <Label htmlFor="pfn-only-unlabeled" className="text-sm cursor-pointer">
            {t('onlyUnlabeled')}
          </Label>
          <Button type="button" variant="outline" size="sm" className="ml-auto" onClick={() => void load()} disabled={loading}>
            {t('refresh')}
          </Button>
        </div>

        <div className="overflow-auto flex-1 min-h-0 -mx-2 px-2">
          {loading ? (
            <p className="text-sm text-muted-foreground py-6 text-center">{t('loading')}</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">{t('empty')}</p>
          ) : selectableLeaves.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">{t('noStandardCategories')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('colPaidFor')}</TableHead>
                  <TableHead className="w-24 text-right">{t('colCount')}</TableHead>
                  <TableHead className="w-44">{t('colCurrentLabel')}</TableHead>
                  <TableHead className="min-w-[14rem]">{t('colTargetLabel')}</TableHead>
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
                  return (
                    <TableRow key={k}>
                      <TableCell className="max-w-[14rem]">
                        <span className="text-sm break-words" title={r.paid_for}>
                          {r.paid_for}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{r.count}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{current}</TableCell>
                      <TableCell>
                        <Select
                          value={d.targetLeafId}
                          onValueChange={(v) => setDraft(r, { targetLeafId: v })}
                        >
                          <SelectTrigger className="h-auto min-h-9 max-w-full whitespace-normal py-1.5 text-left text-xs sm:text-sm">
                            <SelectValue placeholder={t('pickLabel')} />
                          </SelectTrigger>
                          <SelectContent className="max-h-[min(24rem,70vh)]">
                            {selectableLeaves.map((it) => renderLeafOption(it))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
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
      </DialogContent>
    </Dialog>
  )
}
