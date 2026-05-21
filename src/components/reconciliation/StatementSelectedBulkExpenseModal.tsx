'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocale } from 'next-intl'
import { AlertTriangle, ListChecks } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { apiBearerAuthHeaders } from '@/lib/api-client-bearer'
import { formatStatementLineDescription } from '@/lib/statement-display'
import type { ExpenseStandardCategoryPickRow } from '@/lib/expenseStandardCategoryPaidFor'
import {
  applyStandardLeafToCompanyExpense,
  buildUnifiedStandardLeafGroups,
  matchStandardLeafIdForPaidForAndCategory
} from '@/lib/companyExpenseStandardUnified'
import {
  BULK_COMPANY_DUP_AMOUNT_EPS,
  BULK_COMPANY_DUP_DAY_WINDOW,
  fetchCompanyExpenseDuplicatesForBulk,
  type BulkCompanyDuplicateRow
} from '@/lib/statement-bulk-company-duplicate-check'
import type { BulkExpenseCandidateLine } from '@/components/reconciliation/StatementBulkExpenseModal'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'

export type SelectedBulkExpenseKind = 'company_expenses' | 'tour_expenses'

const KIND_LABEL: Record<SelectedBulkExpenseKind, string> = {
  company_expenses: '회사 지출',
  tour_expenses: '투어 지출'
}

type TourPickRow = { id: string; tour_date: string; product_id: string | null }

type CompanyDupScreenState = {
  rows: BulkCompanyDuplicateRow[]
  valid: {
    statement_line_id: string
    posted_date: string
    amount: number
    line_desc: string
    exclude_from_pnl: boolean
    paid_to: string
    paid_for: string
    category: string
    description: string
  }[]
} | null

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedLines: BulkExpenseCandidateLine[]
  financialAccountId: string
  defaultPaymentMethodId: string | null
  email: string
  onCompleted: () => void | Promise<void>
}

export default function StatementSelectedBulkExpenseModal({
  open,
  onOpenChange,
  selectedLines,
  financialAccountId,
  defaultPaymentMethodId,
  email,
  onCompleted
}: Props) {
  const locale = useLocale()
  const [expenseKind, setExpenseKind] = useState<SelectedBulkExpenseKind>('company_expenses')
  const [paidFor, setPaidFor] = useState('')
  const [paidTo, setPaidTo] = useState('')
  const [standardLeafId, setStandardLeafId] = useState('')
  const [category, setCategory] = useState('')
  const [tourPickId, setTourPickId] = useState('')
  const [tourRows, setTourRows] = useState<TourPickRow[]>([])
  const [paidForFromDb, setPaidForFromDb] = useState<string[]>([])
  const [expenseStandardCategories, setExpenseStandardCategories] = useState<ExpenseStandardCategoryPickRow[]>([])
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [dupCheckLoading, setDupCheckLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [companyDupScreen, setCompanyDupScreen] = useState<CompanyDupScreenState>(null)

  const unifiedStandardGroups = useMemo(
    () => buildUnifiedStandardLeafGroups(expenseStandardCategories, locale, { includeInactive: true }),
    [expenseStandardCategories, locale]
  )

  const standardCatsById = useMemo(
    () => new Map(expenseStandardCategories.map((c) => [c.id, c])),
    [expenseStandardCategories]
  )

  const paidForSelectOptions = useMemo(() => {
    const s = new Set<string>()
    for (const x of paidForFromDb) {
      const t = x.trim()
      if (t) s.add(t)
    }
    if (paidFor.trim()) s.add(paidFor.trim())
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'ko'))
  }, [paidForFromDb, paidFor])

  const linePreviews = useMemo(() => {
    return selectedLines.map((line) => {
      const amt = Number(line.amount)
      const lineDesc = formatStatementLineDescription(line.description, line.merchant)
      const merchantDefault = (line.merchant ?? '').trim() || (line.description ?? '').trim().slice(0, 80)
      return {
        line,
        amount: amt,
        lineDesc,
        paidToResolved: paidTo.trim() || merchantDefault
      }
    })
  }, [selectedLines, paidTo])

  const paymentMethodValue = defaultPaymentMethodId?.trim() || 'Card'

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void (async () => {
      setLoading(true)
      setFormError(null)
      setCompanyDupScreen(null)
      try {
        const [sJson, catRes, tourRes] = await Promise.all([
          fetch('/api/company-expenses/suggestions', { headers: apiBearerAuthHeaders() }).then((r) => r.json()),
          supabase
            .from('expense_standard_categories')
            .select('id, name, name_ko, parent_id, tax_deductible, display_order, is_active')
            .or('is_active.is.null,is_active.eq.true')
            .order('display_order', { ascending: true }),
          supabase
            .from('tours')
            .select('id, tour_date, product_id')
            .order('tour_date', { ascending: false })
            .limit(500)
        ])
        if (cancelled) return
        const raw = sJson as { paid_for?: unknown }
        const pf = Array.isArray(raw?.paid_for)
          ? raw.paid_for.filter((x): x is string => typeof x === 'string' && x.trim() !== '')
          : []
        setPaidForFromDb(pf)
        if (!catRes.error && Array.isArray(catRes.data)) {
          setExpenseStandardCategories(catRes.data as ExpenseStandardCategoryPickRow[])
        } else {
          setExpenseStandardCategories([])
        }
        if (!tourRes.error && Array.isArray(tourRes.data)) {
          setTourRows(tourRes.data as TourPickRow[])
        } else {
          setTourRows([])
        }
      } catch {
        if (!cancelled) {
          setPaidForFromDb([])
          setExpenseStandardCategories([])
          setTourRows([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open])

  const resetForm = useCallback(() => {
    setExpenseKind('company_expenses')
    setPaidFor('')
    setPaidTo('')
    setStandardLeafId('')
    setCategory('')
    setTourPickId('')
    setFormError(null)
    setCompanyDupScreen(null)
  }, [])

  const linkStatement = async (
    lineId: string,
    sourceTable: 'company_expenses' | 'tour_expenses',
    sourceId: string,
    amount: number
  ) => {
    const { error: mErr } = await supabase.from('reconciliation_matches').insert({
      statement_line_id: lineId,
      source_table: sourceTable,
      source_id: sourceId,
      matched_amount: amount,
      matched_by: email || null
    })
    if (mErr) throw mErr
    const { error: uErr } = await supabase
      .from('statement_lines')
      .update({ matched_status: 'matched' })
      .eq('id', lineId)
    if (uErr) throw uErr
  }

  const buildCompanyValid = () => {
    const pf = paidFor.trim()
    const cat = category.trim()
    if (!pf || !cat) return []
    return linePreviews.map(({ line, amount, lineDesc, paidToResolved }) => ({
      statement_line_id: line.id,
      posted_date: line.posted_date,
      amount,
      line_desc: lineDesc,
      exclude_from_pnl: Boolean(line.exclude_from_pnl),
      paid_to: paidToResolved,
      paid_for: pf,
      category: cat,
      description: lineDesc || (line.description ?? '').trim() || ''
    }))
  }

  const applyCompanyBulkInner = async (
    valid: NonNullable<CompanyDupScreenState>['valid']
  ) => {
    for (const p of valid) {
      const leafId = matchStandardLeafIdForPaidForAndCategory(
        p.paid_for,
        p.category,
        expenseStandardCategories,
        locale
      )
      const applied = leafId ? applyStandardLeafToCompanyExpense(leafId, standardCatsById) : null
      const { data: ins, error: insErr } = await supabase
        .from('company_expenses')
        .insert({
          paid_to: p.paid_to,
          paid_for: p.paid_for,
          description: p.description.trim() || null,
          amount: p.amount,
          payment_method: paymentMethodValue,
          submit_by: email,
          category: applied ? applied.category : p.category,
          ...(applied
            ? {
                standard_paid_for: applied.paid_for,
                expense_type: applied.expense_type,
                tax_deductible: applied.tax_deductible
              }
            : {}),
          status: 'approved',
          ledger_expense_origin: 'statement_adjustment',
          statement_line_id: p.statement_line_id,
          reconciliation_status: 'reconciled',
          exclude_from_pnl: p.exclude_from_pnl,
          is_personal: false,
          personal_partner: null,
          submit_on: `${p.posted_date}T12:00:00.000Z`
        })
        .select('id')
        .single()
      if (insErr || !ins?.id) throw insErr || new Error('회사 지출 저장 실패')
      await linkStatement(p.statement_line_id, 'company_expenses', String(ins.id), p.amount)
    }
  }

  const finalizeAfterBulkSuccess = async () => {
    await onCompleted()
    onOpenChange(false)
    resetForm()
  }

  const beginCompanySaveWithDupCheck = async () => {
    const valid = buildCompanyValid()
    if (valid.length === 0) {
      setFormError('paid for·표준 카테고리를 선택하세요.')
      return
    }
    setDupCheckLoading(true)
    try {
      const dups = await fetchCompanyExpenseDuplicatesForBulk(
        valid.map((p) => ({
          statement_line_id: p.statement_line_id,
          posted_date: p.posted_date,
          amount: p.amount,
          line_desc: p.line_desc
        }))
      )
      if (dups.length > 0) {
        setCompanyDupScreen({ rows: dups, valid })
        return
      }
      setApplying(true)
      try {
        await applyCompanyBulkInner(valid)
        await finalizeAfterBulkSuccess()
      } finally {
        setApplying(false)
      }
    } catch (e) {
      setFormError(e instanceof Error ? e.message : '중복 점검 중 오류')
    } finally {
      setDupCheckLoading(false)
    }
  }

  const confirmDespiteDuplicates = async () => {
    if (!companyDupScreen) return
    const { valid } = companyDupScreen
    setCompanyDupScreen(null)
    setApplying(true)
    try {
      await applyCompanyBulkInner(valid)
      await finalizeAfterBulkSuccess()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : '저장 중 오류')
    } finally {
      setApplying(false)
    }
  }

  const applyTourBulk = async () => {
    const pf = paidFor.trim()
    if (!pf) {
      setFormError('paid for를 입력하세요.')
      return
    }
    if (!tourPickId) {
      setFormError('투어를 선택하세요.')
      return
    }
    const pickedTour = tourRows.find((t) => t.id === tourPickId)
    if (!pickedTour) {
      setFormError('선택한 투어를 찾을 수 없습니다.')
      return
    }
    setApplying(true)
    try {
      for (const { line, amount, paidToResolved } of linePreviews) {
        const { data: ins, error: insErr } = await supabase
          .from('tour_expenses')
          .insert({
            tour_id: pickedTour.id,
            tour_date: pickedTour.tour_date,
            product_id: pickedTour.product_id,
            paid_to: paidToResolved || null,
            paid_for: pf,
            amount,
            payment_method: paymentMethodValue,
            submitted_by: email,
            submit_on: `${line.posted_date}T12:00:00.000Z`,
            status: 'pending',
            statement_line_id: line.id,
            exclude_from_pnl: Boolean(line.exclude_from_pnl),
            is_personal: false
          })
          .select('id')
          .single()
        if (insErr || !ins?.id) throw insErr || new Error('투어 지출 저장 실패')
        await linkStatement(line.id, 'tour_expenses', String(ins.id), amount)
      }
      await finalizeAfterBulkSuccess()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : '저장 중 오류')
    } finally {
      setApplying(false)
    }
  }

  const handleSave = () => {
    setFormError(null)
    if (selectedLines.length === 0) {
      setFormError('선택된 명세 줄이 없습니다.')
      return
    }
    if (expenseKind === 'company_expenses') {
      void beginCompanySaveWithDupCheck()
      return
    }
    void applyTourBulk()
  }

  const companyReady = paidFor.trim() !== '' && category.trim() !== ''
  const tourReady = paidFor.trim() !== '' && tourPickId !== ''
  const canSave = expenseKind === 'company_expenses' ? companyReady : tourReady

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && (applying || dupCheckLoading)) return
        onOpenChange(v)
        if (!v) resetForm()
      }}
    >
      <DialogContent
        className="max-w-[min(56rem,calc(100vw-1.5rem))] w-[calc(100vw-1rem)] max-h-[min(88vh,820px)] flex flex-col gap-0 p-0"
        onPointerDownOutside={(e) => {
          if (applying || dupCheckLoading) e.preventDefault()
        }}
        onEscapeKeyDown={(e) => {
          if (applying || dupCheckLoading) e.preventDefault()
        }}
      >
        <DialogHeader className="px-4 pt-4 pb-2 pr-12 border-b border-slate-100 shrink-0 text-left space-y-1">
          <DialogTitle className="text-base flex items-center gap-2">
            {companyDupScreen ? (
              <>
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" aria-hidden />
                회사 지출 중복 점검
              </>
            ) : (
              <>
                <ListChecks className="h-5 w-5 shrink-0 text-slate-600" aria-hidden />
                선택 일괄 입력
              </>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-slate-600">
            {companyDupScreen ? (
              <>
                저장하려는 명세 줄과 <strong>같은 금액(±{BULK_COMPANY_DUP_AMOUNT_EPS})</strong>·
                <strong>근접 등록일(±{BULK_COMPANY_DUP_DAY_WINDOW}일)</strong>인 기존 회사 지출이 있습니다. 확인 후
                저장하세요.
              </>
            ) : (
              <>
                표에서 선택한 <strong>{selectedLines.length}건</strong>에 동일한 paid for·paid to·지출 유형을
                적용합니다. paid to를 비우면 각 줄의 가맹점·적요를 결제처로 씁니다.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {companyDupScreen ? (
          <div className="px-4 py-3 overflow-y-auto flex-1 min-h-0 text-[11px] sm:text-xs space-y-2">
            <div className="rounded-md border border-amber-200/90 bg-amber-50/50 overflow-x-auto max-h-[50vh]">
              <table className="w-full min-w-[48rem] border-collapse text-left">
                <thead>
                  <tr className="border-b border-amber-200/80 text-slate-600 bg-amber-100/40">
                    <th className="py-1.5 px-1.5 font-medium">명세일</th>
                    <th className="py-1.5 px-1.5 font-medium text-right">금액</th>
                    <th className="py-1.5 px-1.5 font-medium">설명</th>
                    <th className="py-1.5 px-1.5 font-medium">기존 지출</th>
                  </tr>
                </thead>
                <tbody>
                  {companyDupScreen.rows.flatMap((block) =>
                    block.matches.map((m) => (
                      <tr
                        key={`${block.proposal.statement_line_id}-${m.id}`}
                        className="border-b border-amber-100/80"
                      >
                        <td className="py-1 px-1.5">{block.proposal.posted_date}</td>
                        <td className="py-1 px-1.5 text-right tabular-nums">
                          ${Number(block.proposal.amount).toFixed(2)}
                        </td>
                        <td className="py-1 px-1.5">{block.proposal.line_desc || '—'}</td>
                        <td className="py-1 px-1.5 font-mono text-[10px]">{m.id.slice(0, 8)}…</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <DialogFooter className="px-0 pt-2 sm:justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={applying}
                onClick={() => setCompanyDupScreen(null)}
              >
                돌아가기
              </Button>
              <Button type="button" variant="destructive" disabled={applying} onClick={() => void confirmDespiteDuplicates()}>
                {applying ? '저장 중…' : '중복 있어도 저장'}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="px-4 py-3 overflow-y-auto flex-1 min-h-0 space-y-4 text-xs sm:text-sm">
              {formError ? <p className="text-red-700 text-sm">{formError}</p> : null}
              {loading ? <p className="text-slate-600">불러오는 중…</p> : null}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px] text-slate-600">지출 유형</Label>
                  <Select
                    value={expenseKind}
                    onValueChange={(v) => {
                      setExpenseKind(v as SelectedBulkExpenseKind)
                      setFormError(null)
                      setCompanyDupScreen(null)
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(KIND_LABEL) as SelectedBulkExpenseKind[]).map((k) => (
                        <SelectItem key={k} value={k}>
                          {KIND_LABEL[k]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {expenseKind === 'tour_expenses' ? (
                  <div className="space-y-1">
                    <Label className="text-[10px] text-slate-600">투어 (모든 행에 동일)</Label>
                    <Select value={tourPickId} onValueChange={setTourPickId}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="투어 선택" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {tourRows.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.tour_date} · {t.product_id ?? '—'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 rounded-md border border-slate-200 bg-slate-50/80 p-3">
                <div className="space-y-1 min-w-0">
                  <Label className="text-[10px] text-slate-600">paid for</Label>
                  <select
                    className="h-8 text-xs w-full rounded-md border border-slate-200 bg-white px-2"
                    value={paidFor}
                    onChange={(e) => {
                      setPaidFor(e.target.value)
                      setStandardLeafId('')
                    }}
                  >
                    <option value="">선택…</option>
                    {paidForSelectOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt.length > 48 ? `${opt.slice(0, 48)}…` : opt}
                      </option>
                    ))}
                  </select>
                </div>
                {expenseKind === 'company_expenses' ? (
                  <div className="space-y-1 min-w-0">
                    <Label className="text-[10px] text-slate-600">표준 카테고리</Label>
                    <select
                      className="h-8 text-xs w-full rounded-md border border-slate-200 bg-white px-2"
                      value={
                        standardLeafId ||
                        matchStandardLeafIdForPaidForAndCategory(
                          paidFor,
                          category,
                          expenseStandardCategories,
                          locale
                        )
                      }
                      onChange={(e) => {
                        const id = e.target.value
                        if (!id) {
                          setCategory('')
                          setStandardLeafId('')
                          return
                        }
                        const applied = applyStandardLeafToCompanyExpense(id, standardCatsById)
                        if (applied) {
                          setCategory(applied.category)
                          setPaidFor(applied.paid_for)
                          setStandardLeafId(id)
                        }
                      }}
                    >
                      <option value="">표준 선택…</option>
                      {unifiedStandardGroups.map((g) => (
                        <optgroup key={g.rootId} label={g.groupLabel}>
                          {g.items.map((it) => (
                            <option key={it.id} value={it.id}>
                              {it.displayLabel}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                ) : null}
                <div className="space-y-1">
                  <Label className="text-[10px] text-slate-600">paid to (공통, 비우면 줄별 가맹점)</Label>
                  <Input
                    className="h-8 text-xs"
                    value={paidTo}
                    onChange={(e) => setPaidTo(e.target.value)}
                    placeholder="모든 선택 행에 동일 적용"
                  />
                </div>
              </div>

              <div className="rounded-md border border-slate-200 overflow-x-auto max-h-[40vh]">
                <table className="w-full min-w-[32rem] text-[11px] border-collapse">
                  <thead>
                    <tr className="border-b bg-slate-50 text-slate-600 text-left">
                      <th className="py-1.5 px-2 font-medium">일자</th>
                      <th className="py-1.5 px-2 font-medium text-right">금액</th>
                      <th className="py-1.5 px-2 font-medium">설명</th>
                      <th className="py-1.5 px-2 font-medium">적용 paid to</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linePreviews.map(({ line, amount, lineDesc, paidToResolved }) => (
                      <tr key={line.id} className="border-b border-slate-100">
                        <td className="py-1 px-2 whitespace-nowrap tabular-nums">{line.posted_date}</td>
                        <td className="py-1 px-2 text-right tabular-nums text-rose-800">
                          ${amount.toFixed(2)}
                        </td>
                        <td className="py-1 px-2 break-words max-w-[14rem]">{lineDesc}</td>
                        <td className="py-1 px-2 break-words text-slate-700">{paidToResolved || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <DialogFooter className="px-4 py-3 border-t border-slate-100 shrink-0 gap-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={applying || dupCheckLoading}
                onClick={() => onOpenChange(false)}
              >
                취소
              </Button>
              <Button
                type="button"
                disabled={applying || dupCheckLoading || loading || !canSave || selectedLines.length === 0}
                onClick={() => void handleSave()}
              >
                {applying || dupCheckLoading
                  ? '처리 중…'
                  : `${selectedLines.length}건 저장`}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
