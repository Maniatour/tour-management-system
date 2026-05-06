'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { apiBearerAuthHeaders } from '@/lib/api-client-bearer'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import type { ExpenseStandardCategoryPickRow } from '@/lib/expenseStandardCategoryPaidFor'
import type { UnifiedStandardLeafGroup } from '@/lib/companyExpenseStandardUnified'
import { splitMappingIdsFromLeafId } from '@/lib/pnlStandardCategoryTable'
import { usePaymentMethodOptions } from '@/hooks/usePaymentMethodOptions'
import { StatementReconciledBadge } from '@/components/reconciliation/StatementReconciledBadge'

export type PnlExpenseSource = 'tour_expenses' | 'reservation_expenses' | 'company_expenses' | 'ticket_bookings'

export type PnlDetailLine = {
  id: string
  source: PnlExpenseSource
  /** 표 집계·드릴 키: 표준 리프 id 또는 미매칭 버킷 */
  bucketKey: string
  /** 매핑에서 해석된 리프(또는 상위만 지정 시 상위 id) */
  resolvedLeafId: string | null
  /** expense_category_mappings.original_value 와 동일 */
  mappingOriginalValue: string
  yearMonth: string
  amount: number
  submit_on: string | null
  paid_to: string | null
  paid_for: string | null
  /** payment_methods.id 등 — 표시는 paymentMethodMap으로 해석 */
  payment_method: string | null
  /** reconciliation_matches 에 명세 줄과 연결됨 */
  statementReconciled: boolean
  category: string | null
  company: string | null
  note: string | null
  exclude_from_pnl: boolean
}

export type PnlDrillMode = 'cell' | 'row' | 'col' | 'grand'

export type PnlDrillState =
  | { mode: 'cell'; rowId: string; month: string; rowTitle?: string }
  | { mode: 'row'; rowId: string; rowTitle?: string }
  | { mode: 'col'; month: string }
  | { mode: 'grand' }

function isoToYmd(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const day = d.getDate()
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function ymdLocalStartToIso(ymd: string): string {
  return new Date(`${ymd}T00:00:00`).toISOString()
}

function sourceLabel(s: PnlExpenseSource): string {
  switch (s) {
    case 'tour_expenses':
      return '투어 지출'
    case 'reservation_expenses':
      return '예약 지출'
    case 'company_expenses':
      return '회사 지출'
    case 'ticket_bookings':
      return '입장권 부킹'
    default:
      return s
  }
}

function classificationText(line: PnlDetailLine): string {
  if (line.source === 'ticket_bookings') return (line.category || '').trim() || '—'
  if (line.source === 'company_expenses') {
    const pf = (line.paid_for || '').trim()
    const cat = (line.category || '').trim()
    if (pf && cat) return `${pf} · ${cat}`
    return pf || cat || '—'
  }
  return (line.paid_for || '').trim() || '—'
}

function formatMoney(n: number): string {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

function paymentMethodDisplay(line: PnlDetailLine, map: Record<string, string>): string {
  const raw = (line.payment_method || '').trim()
  if (!raw) return '—'
  return map[raw] || raw
}

function filterLines(lines: PnlDetailLine[], drill: PnlDrillState | null): PnlDetailLine[] {
  if (!drill) return []
  switch (drill.mode) {
    case 'cell':
      return lines.filter((l) => l.bucketKey === drill.rowId && l.yearMonth === drill.month)
    case 'row':
      return lines.filter((l) => l.bucketKey === drill.rowId)
    case 'col':
      return lines.filter((l) => l.yearMonth === drill.month)
    case 'grand':
      return [...lines]
    default:
      return []
  }
}

type Draft = {
  amount: string
  submitDate: string
  paid_to: string
  paid_for: string
  category: string
  company: string
  note: string
  exclude_from_pnl: boolean
}

function lineToDraft(line: PnlDetailLine): Draft {
  return {
    amount: String(line.amount ?? ''),
    submitDate: isoToYmd(line.submit_on),
    paid_to: line.paid_to ?? '',
    paid_for: line.paid_for ?? '',
    category: line.category ?? '',
    company: line.company ?? '',
    note: line.note ?? '',
    exclude_from_pnl: line.exclude_from_pnl,
  }
}

function drillDialogTitle(drill: PnlDrillState | null, formatMonthLabel: (ym: string) => string): string {
  if (!drill) return '지출 내역'
  switch (drill.mode) {
    case 'cell':
      return `${drill.rowTitle ?? drill.rowId} · ${formatMonthLabel(drill.month)}`
    case 'row':
      return drill.rowTitle ?? drill.rowId
    case 'col':
      return `${formatMonthLabel(drill.month)} · 전체 카테고리`
    case 'grand':
      return '전체 지출'
    default:
      return '지출 내역'
  }
}

function PnlMappingAssignBlock({
  visible,
  expenseStandardCategories,
  unifiedStandardGroups,
  onMapped,
}: {
  visible: PnlDetailLine[]
  expenseStandardCategories: ExpenseStandardCategoryPickRow[]
  unifiedStandardGroups: UnifiedStandardLeafGroup[]
  onMapped: () => void | Promise<void>
}) {
  const groups = useMemo(() => {
    const m = new Map<string, { original: string; source: PnlExpenseSource; lines: PnlDetailLine[] }>()
    for (const l of visible) {
      const k = `${l.mappingOriginalValue}::${l.source}`
      if (!m.has(k)) m.set(k, { original: l.mappingOriginalValue, source: l.source, lines: [] })
      m.get(k)!.lines.push(l)
    }
    return Array.from(m.values())
  }, [visible])

  const byId = useMemo(
    () => new Map(expenseStandardCategories.map((c) => [c.id, c])),
    [expenseStandardCategories]
  )

  const [picked, setPicked] = useState<Record<string, string>>({})
  const [savingKey, setSavingKey] = useState<string | null>(null)

  useEffect(() => {
    setPicked({})
  }, [visible])

  const save = async (original: string, source: PnlExpenseSource) => {
    const k = `${original}::${source}`
    const leafId = picked[k] || ''
    if (!leafId) {
      toast.error('표준 카테고리를 선택하세요.')
      return
    }
    const { standard_category_id, sub_category_id } = splitMappingIdsFromLeafId(leafId, byId)
    setSavingKey(k)
    try {
      const { error } = await supabase.from('expense_category_mappings').upsert(
        {
          original_value: original,
          source_table: source,
          standard_category_id,
          sub_category_id,
          match_count: 1,
          last_matched_at: new Date().toISOString(),
        },
        { onConflict: 'original_value,source_table' }
      )
      if (error) throw error
      toast.success('표준 카테고리 매핑을 저장했습니다.')
      await onMapped()
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : '매핑 저장 실패')
    } finally {
      setSavingKey(null)
    }
  }

  if (groups.length === 0) return null

  return (
    <div className="mb-4 rounded-md border bg-muted/30 px-3 py-3 space-y-3 shrink-0">
      <p className="text-xs font-medium text-foreground">표준 카테고리 매핑 (원문·출처별)</p>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        리프를 선택한 뒤 저장하면 <code className="text-[10px] bg-muted px-1 rounded">expense_category_mappings</code>에
        반영됩니다. (카테고리 매니저와 동일)
      </p>
      <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
        {groups.map((g) => {
          const k = `${g.original}::${g.source}`
          const sum = g.lines.reduce((s, x) => s + x.amount, 0)
          return (
            <div
              key={k}
              className="flex flex-col sm:flex-row sm:items-end gap-2 text-xs border-b border-border/40 pb-2 last:border-0"
            >
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="text-muted-foreground">{sourceLabel(g.source)}</div>
                <div className="font-medium break-words" title={g.original}>
                  {g.original}
                </div>
                <div className="tabular-nums text-muted-foreground">
                  {g.lines.length}건 · {formatMoney(sum)}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <select
                  className="h-9 min-w-[200px] max-w-full rounded-md border bg-background px-2 text-xs"
                  value={picked[k] ?? ''}
                  onChange={(e) => setPicked((p) => ({ ...p, [k]: e.target.value }))}
                >
                  <option value="">표준 리프 선택…</option>
                  {unifiedStandardGroups.map((gr) => (
                    <optgroup key={gr.rootId} label={gr.groupLabel}>
                      {gr.items.map((it) => (
                        <option key={it.id} value={it.id}>
                          {it.displayLabel}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <Button type="button" size="sm" className="h-9" disabled={savingKey === k} onClick={() => save(g.original, g.source)}>
                  매핑 저장
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

type PnlUnifiedExpenseDetailDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  drill: PnlDrillState | null
  lines: PnlDetailLine[]
  formatMonthLabel: (ym: string) => string
  onSaved: () => void | Promise<void>
  expenseStandardCategories: ExpenseStandardCategoryPickRow[]
  unifiedStandardGroups: UnifiedStandardLeafGroup[]
}

export default function PnlUnifiedExpenseDetailDialog({
  open,
  onOpenChange,
  drill,
  lines,
  formatMonthLabel,
  onSaved,
  expenseStandardCategories,
  unifiedStandardGroups,
}: PnlUnifiedExpenseDetailDialogProps) {
  const { paymentMethodMap } = usePaymentMethodOptions()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)

  const visible = useMemo(() => filterLines(lines, drill), [lines, drill])

  useEffect(() => {
    if (!open) {
      setEditingId(null)
      setDraft(null)
    }
  }, [open])

  const startEdit = useCallback((line: PnlDetailLine) => {
    setEditingId(`${line.source}:${line.id}`)
    setDraft(lineToDraft(line))
  }, [])

  const cancelEdit = useCallback(() => {
    setEditingId(null)
    setDraft(null)
  }, [])

  const saveEdit = useCallback(
    async (line: PnlDetailLine) => {
      if (!draft) return
      const amt = parseFloat(String(draft.amount).replace(/,/g, ''))
      if (!Number.isFinite(amt) || amt === 0) {
        toast.error('금액을 확인하세요.')
        return
      }
      if (!draft.submitDate || !/^\d{4}-\d{2}-\d{2}$/.test(draft.submitDate)) {
        toast.error('지출일(날짜)을 선택하세요.')
        return
      }
      const submitIso = ymdLocalStartToIso(draft.submitDate)

      setSaving(true)
      try {
        if (line.source === 'tour_expenses') {
          const { error } = await supabase
            .from('tour_expenses')
            .update({
              paid_for: draft.paid_for.trim(),
              paid_to: draft.paid_to.trim() || null,
              amount: amt,
              submit_on: submitIso,
              note: draft.note.trim() || null,
              exclude_from_pnl: draft.exclude_from_pnl,
              updated_at: new Date().toISOString(),
            })
            .eq('id', line.id)
          if (error) throw error
        } else if (line.source === 'reservation_expenses') {
          const res = await fetch(`/api/reservation-expenses/${line.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              paid_for: draft.paid_for.trim(),
              paid_to: draft.paid_to.trim() || null,
              amount: amt,
              submit_on: submitIso,
              note: draft.note.trim() || null,
              exclude_from_pnl: draft.exclude_from_pnl,
            }),
          })
          const json = await res.json()
          if (!res.ok || !json.success) {
            throw new Error(json.message || json.error || '예약 지출 수정 실패')
          }
        } else if (line.source === 'company_expenses') {
          const res = await fetch('/api/company-expenses', {
            method: 'PUT',
            headers: { ...apiBearerAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: line.id,
              paid_for: draft.paid_for.trim(),
              category: draft.category.trim(),
              paid_to: draft.paid_to.trim() || null,
              amount: amt,
              submit_on: submitIso,
              exclude_from_pnl: draft.exclude_from_pnl,
              notes: draft.note.trim() || null,
            }),
          })
          const json = await res.json()
          if (!res.ok) {
            throw new Error(json.error || '회사 지출 수정 실패')
          }
        } else if (line.source === 'ticket_bookings') {
          const cat = draft.category.trim()
          if (!cat) {
            toast.error('입장권 카테고리를 입력하세요.')
            setSaving(false)
            return
          }
          const { error } = await supabase
            .from('ticket_bookings')
            .update({
              category: cat,
              company: draft.company.trim() || null,
              expense: amt,
              submit_on: submitIso,
              note: draft.note.trim() || null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', line.id)
          if (error) throw error
        }

        toast.success('저장했습니다.')
        cancelEdit()
        await onSaved()
      } catch (e) {
        console.error(e)
        toast.error(e instanceof Error ? e.message : '저장에 실패했습니다.')
      } finally {
        setSaving(false)
      }
    },
    [draft, cancelEdit, onSaved]
  )

  const title = drillDialogTitle(drill, formatMonthLabel)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(100vw-1.5rem,56rem)] max-h-[min(90vh,720px)] flex flex-col p-0 gap-0 z-[1200]">
        <DialogHeader className="px-4 pt-4 pb-2 pr-12 border-b shrink-0">
          <DialogTitle className="text-base leading-snug">지출 상세 — {title}</DialogTitle>
          <p className="text-xs text-muted-foreground font-normal pt-1">
            상단에서 원문·출처별 <strong>표준 리프</strong>를 지정·저장하면 카테고리 매니저와 동일하게{' '}
            <code className="text-[10px] bg-muted px-1 rounded">expense_category_mappings</code>가 갱신됩니다. 개별
            지출은 아래에서 금액·결제내용 등을 수정할 수 있습니다.
          </p>
        </DialogHeader>

        <div className="overflow-auto flex-1 min-h-0 px-2 sm:px-4 py-3 flex flex-col">
          {visible.length > 0 && (
            <PnlMappingAssignBlock
              visible={visible}
              expenseStandardCategories={expenseStandardCategories}
              unifiedStandardGroups={unifiedStandardGroups}
              onMapped={onSaved}
            />
          )}
          {visible.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">이 구간에 해당하는 지출이 없습니다.</p>
          ) : (
            <table className="w-full text-xs sm:text-sm border-collapse">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-2 font-medium whitespace-nowrap">출처</th>
                  <th className="py-2 pr-2 font-medium whitespace-nowrap">지출일</th>
                  <th className="py-2 pr-2 font-medium">결제처</th>
                  <th className="py-2 pr-2 font-medium min-w-[100px] max-w-[160px]">결제 방법</th>
                  <th className="py-2 pr-2 font-medium whitespace-nowrap">명세 대조</th>
                  <th className="py-2 pr-2 font-medium min-w-[120px]">분류(원문)</th>
                  <th className="py-2 pr-2 font-medium text-right whitespace-nowrap">금액</th>
                  <th className="py-2 pl-1 font-medium whitespace-nowrap w-[72px]"> </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((line) => {
                  const key = `${line.source}:${line.id}`
                  const isEditing = editingId === key
                  return (
                    <React.Fragment key={key}>
                      <tr className="border-b border-border/60 align-top">
                        <td className="py-2 pr-2 whitespace-nowrap">{sourceLabel(line.source)}</td>
                        <td className="py-2 pr-2 whitespace-nowrap tabular-nums">
                          {isoToYmd(line.submit_on) || '—'}
                        </td>
                        <td className="py-2 pr-2 break-all max-w-[140px]">
                          {(line.paid_to || '').trim() || (line.company || '').trim() || '—'}
                        </td>
                        <td className="py-2 pr-2 break-words text-muted-foreground max-w-[160px]" title={line.payment_method || undefined}>
                          {paymentMethodDisplay(line, paymentMethodMap)}
                        </td>
                        <td className="py-2 pr-2 whitespace-nowrap align-middle">
                          {line.statementReconciled ? (
                            <span className="inline-flex items-center gap-1 text-emerald-800 text-[11px] sm:text-xs" title="명세 대조에 연결됨">
                              <StatementReconciledBadge matched className="shrink-0" />
                              <span>연결됨</span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-[11px] sm:text-xs" title="명세 줄과 아직 매칭되지 않음">
                              미연결
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-2 break-words">{classificationText(line)}</td>
                        <td className="py-2 pr-2 text-right tabular-nums font-medium">{formatMoney(line.amount)}</td>
                        <td className="py-2 pl-1">
                          {!isEditing && (
                            <Button type="button" variant="outline" size="sm" className="h-8 px-2" onClick={() => startEdit(line)}>
                              수정
                            </Button>
                          )}
                        </td>
                      </tr>
                      {isEditing && draft && (
                        <tr className="bg-muted/40 border-b">
                          <td colSpan={8} className="p-3 sm:p-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-3xl">
                              <div className="space-y-1">
                                <Label className="text-xs">금액</Label>
                                <Input
                                  className="h-9"
                                  value={draft.amount}
                                  onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
                                  inputMode="decimal"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">지출일</Label>
                                <Input
                                  type="date"
                                  className="h-9"
                                  value={draft.submitDate}
                                  onChange={(e) => setDraft({ ...draft, submitDate: e.target.value })}
                                />
                              </div>

                              {line.source === 'ticket_bookings' ? (
                                <>
                                  <div className="space-y-1 sm:col-span-2">
                                    <Label className="text-xs">카테고리 (입장권 분류 · 매핑 전)</Label>
                                    <Input
                                      className="h-9"
                                      value={draft.category}
                                      onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                                    />
                                  </div>
                                  <div className="space-y-1 sm:col-span-2">
                                    <Label className="text-xs">공급업체(회사)</Label>
                                    <Input
                                      className="h-9"
                                      value={draft.company}
                                      onChange={(e) => setDraft({ ...draft, company: e.target.value })}
                                    />
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="space-y-1">
                                    <Label className="text-xs">결제처</Label>
                                    <Input
                                      className="h-9"
                                      value={draft.paid_to}
                                      onChange={(e) => setDraft({ ...draft, paid_to: e.target.value })}
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">결제내용 (paid_for)</Label>
                                    <Input
                                      className="h-9"
                                      value={draft.paid_for}
                                      onChange={(e) => setDraft({ ...draft, paid_for: e.target.value })}
                                    />
                                  </div>
                                  {line.source === 'company_expenses' && (
                                    <div className="space-y-1 sm:col-span-2">
                                      <Label className="text-xs">회사 지출 카테고리</Label>
                                      <Input
                                        className="h-9"
                                        value={draft.category}
                                        onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                                      />
                                    </div>
                                  )}
                                </>
                              )}

                              <div className="space-y-1 sm:col-span-2">
                                <Label className="text-xs">메모</Label>
                                <Input
                                  className="h-9"
                                  value={draft.note}
                                  onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                                />
                              </div>

                              {line.source !== 'ticket_bookings' && (
                                <div className="flex items-center gap-2 sm:col-span-2">
                                  <Checkbox
                                    id={`pnl-excl-${key}`}
                                    checked={draft.exclude_from_pnl}
                                    onCheckedChange={(c) =>
                                      setDraft({ ...draft, exclude_from_pnl: c === true })
                                    }
                                  />
                                  <Label htmlFor={`pnl-excl-${key}`} className="text-xs font-normal cursor-pointer">
                                    통합 PNL·이 표에서 제외 (exclude_from_pnl)
                                  </Label>
                                </div>
                              )}

                              <div className="flex flex-wrap gap-2 sm:col-span-2 pt-1">
                                <Button type="button" size="sm" disabled={saving} onClick={() => saveEdit(line)}>
                                  저장
                                </Button>
                                <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={cancelEdit}>
                                  취소
                                </Button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
