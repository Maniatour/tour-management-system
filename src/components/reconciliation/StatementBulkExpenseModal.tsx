'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocale } from 'next-intl'
import { ListPlus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatStatementLineDescription } from '@/lib/statement-display'
import {
  normalizeExpenseDescriptionForMatch,
  pickHistoryHintForLine,
  pickRuleForLine,
  statementLineMatchText,
  type CompanyExpenseHistoryHint,
  type StatementAutofillRuleRow
} from '@/lib/statement-bulk-expense-autofill'
import type { ExpenseStandardCategoryPickRow } from '@/lib/expenseStandardCategoryPaidFor'
import {
  applyStandardLeafToCompanyExpense,
  buildUnifiedStandardLeafGroups,
  flattenUnifiedLeaves,
  matchStandardLeafIdForPaidForAndCategory,
  unifiedStandardTriggerLabel
} from '@/lib/companyExpenseStandardUnified'
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

export type BulkExpenseKind =
  | 'company_expenses'
  | 'tour_expenses'
  | 'reservation_expenses'
  | 'ticket_bookings'

export type BulkExpenseCandidateLine = {
  id: string
  posted_date: string
  amount: number | string
  direction: string
  description: string | null
  merchant: string | null
  matched_status: string
  exclude_from_pnl: boolean
}

export type BulkCompanyExpenseProposalRow = {
  statement_line_id: string
  posted_date: string
  amount: number
  line_desc: string
  exclude_from_pnl: boolean
  suggestion_source: 'rule' | 'history' | 'none'
  rule_id?: string
  paid_to: string
  paid_for: string
  category: string
  description: string
}

export type BulkTourProposalRow = {
  statement_line_id: string
  posted_date: string
  amount: number
  line_desc: string
  exclude_from_pnl: boolean
  paid_to: string
  paid_for: string
}

export type BulkReservationProposalRow = BulkTourProposalRow & { note: string }

export type BulkTicketProposalRow = {
  statement_line_id: string
  posted_date: string
  amount: number
  line_desc: string
  exclude_from_pnl: boolean
  category: string
  company: string
  note: string
}

type TourPickRow = { id: string; tour_date: string; product_id: string | null }

const KIND_LABEL: Record<BulkExpenseKind, string> = {
  company_expenses: '회사 지출',
  tour_expenses: '투어 지출',
  reservation_expenses: '예약 지출',
  ticket_bookings: '입장권(티켓)'
}

function ruleResolvedStandardLeafId(
  r: StatementAutofillRuleRow,
  cats: ExpenseStandardCategoryPickRow[],
  locale: string
): string {
  const fromDb = (r.standard_leaf_id ?? '').trim()
  if (fromDb) return fromDb
  return matchStandardLeafIdForPaidForAndCategory(r.paid_for, r.category, cats, locale)
}

function effectiveAutofillExpenseFromRule(
  rule: StatementAutofillRuleRow,
  catsById: Map<string, ExpenseStandardCategoryPickRow>
): { paid_for: string; category: string } {
  const lid = (rule.standard_leaf_id ?? '').trim()
  if (lid) {
    const applied = applyStandardLeafToCompanyExpense(lid, catsById)
    if (applied) return { paid_for: applied.paid_for, category: applied.category }
  }
  return { paid_for: rule.paid_for, category: rule.category }
}

function autofillRuleSupabaseErrorText(e: unknown): string {
  if (e && typeof e === 'object') {
    const o = e as { message?: string; details?: string; hint?: string; code?: string }
    const parts = [o.message, o.details, o.hint, o.code].filter(
      (x): x is string => typeof x === 'string' && x.trim() !== ''
    )
    if (parts.length) return parts.join(' — ')
  }
  return e instanceof Error ? e.message : '요청 실패'
}

/** 원격 DB에 standard_leaf_id 컬럼·캐시가 아직 없을 때 PostgREST 400 대응 */
function isLikelyMissingStandardLeafIdColumn(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false
  const o = e as { message?: string; details?: string }
  const t = `${o.message ?? ''} ${o.details ?? ''}`.toLowerCase()
  if (!t.includes('standard_leaf_id')) return false
  return (
    t.includes('schema cache') ||
    t.includes('could not find') ||
    t.includes('does not exist') ||
    t.includes('pgrst204') ||
    (t.includes('column') && (t.includes('unknown') || t.includes('not find')))
  )
}

/** 컬럼 누락·스키마 캐시 또는 standard_leaf_id FK 불일치 시, leaf 없이 재시도 */
function shouldRetryAutofillRuleWithoutStandardLeafId(e: unknown): boolean {
  if (isLikelyMissingStandardLeafIdColumn(e)) return true
  if (!e || typeof e !== 'object') return false
  const o = e as { message?: string; details?: string; code?: string }
  const t = `${o.message ?? ''} ${o.details ?? ''}`.toLowerCase()
  const isFk =
    o.code === '23503' || t.includes('foreign key') || t.includes('violates foreign key constraint')
  if (!isFk) return false
  return t.includes('standard_leaf') || t.includes('expense_standard_categories')
}

type StatementRuleEditDraft = {
  id: string
  pattern: string
  match_mode: 'contains' | 'startswith'
  priority: string
  paid_for: string
  category: string
  paid_to: string
  /** 표준 리프 id — DB standard_leaf_id 와 동기 */
  standardLeafId: string
  scopeThisAccount: boolean
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  candidateLines: BulkExpenseCandidateLine[]
  financialAccountId: string
  defaultPaymentMethodId: string | null
  email: string
  onCompleted: () => void | Promise<void>
}

function filterExpenseCandidates(lines: BulkExpenseCandidateLine[]): BulkExpenseCandidateLine[] {
  return lines.filter(
    (l) =>
      l.direction === 'outflow' &&
      l.matched_status === 'unmatched' &&
      Number.isFinite(Number(l.amount)) &&
      Number(l.amount) > 0
  )
}

function buildProposalsCompany(
  lines: BulkExpenseCandidateLine[],
  rules: StatementAutofillRuleRow[],
  history: CompanyExpenseHistoryHint[],
  accountId: string,
  catsById: Map<string, ExpenseStandardCategoryPickRow>
): BulkCompanyExpenseProposalRow[] {
  const out: BulkCompanyExpenseProposalRow[] = []
  for (const line of filterExpenseCandidates(lines)) {
    const amt = Number(line.amount)
    const lineDesc = formatStatementLineDescription(line.description, line.merchant)
    const hay = statementLineMatchText(line.description, line.merchant)
    const merchantDefault = (line.merchant ?? '').trim() || (line.description ?? '').trim().slice(0, 80)

    const rule = pickRuleForLine(rules, accountId, hay)
    const hist = rule ? null : pickHistoryHintForLine(hay, history)

    let suggestion_source: BulkCompanyExpenseProposalRow['suggestion_source'] = 'none'
    let rule_id: string | undefined
    let paid_to = merchantDefault
    let paid_for = ''
    let category = ''
    let description = lineDesc || (line.description ?? '').trim() || ''

    if (rule) {
      suggestion_source = 'rule'
      rule_id = rule.id
      const eff = effectiveAutofillExpenseFromRule(rule, catsById)
      paid_for = eff.paid_for
      category = eff.category
      paid_to = rule.paid_to.trim() || paid_to
    } else if (hist) {
      suggestion_source = 'history'
      paid_for = hist.paid_for
      category = hist.category
      paid_to = hist.paid_to.trim() || paid_to
    }

    out.push({
      statement_line_id: line.id,
      posted_date: line.posted_date,
      amount: amt,
      line_desc: lineDesc,
      exclude_from_pnl: Boolean(line.exclude_from_pnl),
      suggestion_source,
      rule_id,
      paid_to,
      paid_for,
      category,
      description
    })
  }
  return out
}

function buildProposalsTour(lines: BulkExpenseCandidateLine[]): BulkTourProposalRow[] {
  return filterExpenseCandidates(lines).map((line) => {
    const amt = Number(line.amount)
    const lineDesc = formatStatementLineDescription(line.description, line.merchant)
    const merchantDefault = (line.merchant ?? '').trim() || ''
    return {
      statement_line_id: line.id,
      posted_date: line.posted_date,
      amount: amt,
      line_desc: lineDesc,
      exclude_from_pnl: Boolean(line.exclude_from_pnl),
      paid_to: merchantDefault,
      paid_for: ''
    }
  })
}

function buildProposalsReservation(lines: BulkExpenseCandidateLine[]): BulkReservationProposalRow[] {
  return buildProposalsTour(lines).map((r) => ({ ...r, note: '' }))
}

function buildProposalsTicket(lines: BulkExpenseCandidateLine[]): BulkTicketProposalRow[] {
  return filterExpenseCandidates(lines).map((line) => {
    const amt = Number(line.amount)
    const lineDesc = formatStatementLineDescription(line.description, line.merchant)
    return {
      statement_line_id: line.id,
      posted_date: line.posted_date,
      amount: amt,
      line_desc: lineDesc,
      exclude_from_pnl: Boolean(line.exclude_from_pnl),
      category: '',
      company: '',
      note: ''
    }
  })
}

export default function StatementBulkExpenseModal({
  open,
  onOpenChange,
  candidateLines,
  financialAccountId,
  defaultPaymentMethodId,
  email,
  onCompleted
}: Props) {
  const locale = useLocale()
  const [expenseKind, setExpenseKind] = useState<BulkExpenseKind>('company_expenses')
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const [rules, setRules] = useState<StatementAutofillRuleRow[]>([])
  const [companyProposals, setCompanyProposals] = useState<BulkCompanyExpenseProposalRow[]>([])
  const [tourProposals, setTourProposals] = useState<BulkTourProposalRow[]>([])
  const [resProposals, setResProposals] = useState<BulkReservationProposalRow[]>([])
  const [ticketProposals, setTicketProposals] = useState<BulkTicketProposalRow[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())

  const [tourRows, setTourRows] = useState<TourPickRow[]>([])
  const [tourPickId, setTourPickId] = useState('')
  const [defaultReservationId, setDefaultReservationId] = useState('')

  const [newPattern, setNewPattern] = useState('')
  const [newMatchMode, setNewMatchMode] = useState<'contains' | 'startswith'>('contains')
  const [newPaidTo, setNewPaidTo] = useState('')
  const [newPaidFor, setNewPaidFor] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [newPriority, setNewPriority] = useState('10')
  const [newScopeThisAccount, setNewScopeThisAccount] = useState(true)
  const [newStandardLeafId, setNewStandardLeafId] = useState('')
  const [addingRule, setAddingRule] = useState(false)
  const [editRuleDraft, setEditRuleDraft] = useState<StatementRuleEditDraft | null>(null)
  const [savingRuleEdit, setSavingRuleEdit] = useState(false)

  const [expenseStandardCategories, setExpenseStandardCategories] = useState<ExpenseStandardCategoryPickRow[]>([])
  const [paidForFromDb, setPaidForFromDb] = useState<string[]>([])

  const selectAllRef = useRef<HTMLInputElement>(null)

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
    for (const r of rules) {
      const t = (r.paid_for ?? '').trim()
      if (t) s.add(t)
    }
    for (const p of companyProposals) {
      const t = p.paid_for.trim()
      if (t) s.add(t)
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'ko'))
  }, [paidForFromDb, rules, companyProposals])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void (async () => {
      try {
        const [sJson, catRes] = await Promise.all([
          fetch('/api/company-expenses/suggestions').then((r) => r.json()),
          supabase
            .from('expense_standard_categories')
            .select('id, name, name_ko, parent_id, tax_deductible, display_order, is_active')
            .or('is_active.is.null,is_active.eq.true')
            .order('display_order', { ascending: true })
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
      } catch {
        if (!cancelled) {
          setPaidForFromDb([])
          setExpenseStandardCategories([])
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open])

  const activeProposalsLength = useMemo(() => {
    if (expenseKind === 'company_expenses') return companyProposals.length
    if (expenseKind === 'tour_expenses') return tourProposals.length
    if (expenseKind === 'reservation_expenses') return resProposals.length
    return ticketProposals.length
  }, [expenseKind, companyProposals.length, tourProposals.length, resProposals.length, ticketProposals.length])

  const resetNewRuleForm = useCallback(() => {
    setNewPattern('')
    setNewMatchMode('contains')
    setNewPaidTo('')
    setNewPaidFor('')
    setNewCategory('')
    setNewStandardLeafId('')
    setNewPriority('10')
    setNewScopeThisAccount(true)
  }, [])

  const loadAll = useCallback(async () => {
    if (!open) return
    const base = filterExpenseCandidates(candidateLines)
    if (base.length === 0) {
      setCompanyProposals([])
      setTourProposals([])
      setResProposals([])
      setTicketProposals([])
      setSelectedIds(new Set())
      setRules([])
      setLoadError(null)
      return
    }
    setLoading(true)
    setLoadError(null)
    try {
      if (expenseKind === 'company_expenses') {
        const [{ data: rulesData, error: rulesErr }, { data: histData, error: histErr }] = await Promise.all([
          supabase
            .from('statement_expense_autofill_rules')
            .select('*')
            .order('priority', { ascending: false }),
          supabase
            .from('company_expenses')
            .select('description, paid_for, paid_to, category')
            .eq('status', 'approved')
            .not('description', 'is', null)
            .order('submit_on', { ascending: false })
            .limit(2000)
        ])
        if (rulesErr) throw rulesErr
        if (histErr) throw histErr

        const rulesRows = (rulesData || []) as StatementAutofillRuleRow[]
        setRules(rulesRows)

        const history: CompanyExpenseHistoryHint[] = []
        for (const r of histData || []) {
          const norm = normalizeExpenseDescriptionForMatch(
            typeof r.description === 'string' ? r.description : null
          )
          if (!norm) continue
          history.push({
            norm,
            paid_to: String(r.paid_to ?? '').trim(),
            paid_for: String(r.paid_for ?? '').trim(),
            category: String(r.category ?? '').trim()
          })
        }

        const built = buildProposalsCompany(
          candidateLines,
          rulesRows,
          history,
          financialAccountId,
          standardCatsById
        )
        setCompanyProposals(built)
        setSelectedIds(
          new Set(built.filter((p) => p.paid_for.trim() && p.category.trim() && p.paid_to.trim()).map((p) => p.statement_line_id))
        )
      } else if (expenseKind === 'tour_expenses') {
        const { data: tours, error: tourErr } = await supabase
          .from('tours')
          .select('id, tour_date, product_id')
          .order('tour_date', { ascending: false })
          .limit(500)
        if (tourErr) throw tourErr
        setTourRows((tours || []) as TourPickRow[])
        const built = buildProposalsTour(candidateLines)
        setTourProposals(built)
        setSelectedIds(
          new Set(built.filter((p) => p.paid_for.trim() && p.paid_to.trim()).map((p) => p.statement_line_id))
        )
      } else if (expenseKind === 'reservation_expenses') {
        const built = buildProposalsReservation(candidateLines)
        setResProposals(built)
        setSelectedIds(new Set(built.filter((p) => p.paid_for.trim() && p.paid_to.trim()).map((p) => p.statement_line_id)))
      } else {
        const built = buildProposalsTicket(candidateLines)
        setTicketProposals(built)
        setSelectedIds(new Set(built.filter((p) => p.category.trim() && p.company.trim()).map((p) => p.statement_line_id)))
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : '불러오기 실패')
      setCompanyProposals([])
      setTourProposals([])
      setResProposals([])
      setTicketProposals([])
      setSelectedIds(new Set())
    } finally {
      setLoading(false)
    }
  }, [open, candidateLines, financialAccountId, expenseKind, standardCatsById])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  useEffect(() => {
    if (open) {
      setTourPickId('')
      setDefaultReservationId('')
    }
  }, [open])

  useEffect(() => {
    const el = selectAllRef.current
    if (!el) return
    const n = activeProposalsLength
    const sel = selectedIds.size
    el.indeterminate = n > 0 && sel > 0 && sel < n
  }, [activeProposalsLength, selectedIds])

  const updateCompanyProposal = useCallback(
    (id: string, patch: Partial<Pick<BulkCompanyExpenseProposalRow, 'paid_to' | 'paid_for' | 'category' | 'description'>>) => {
      setCompanyProposals((prev) =>
        prev.map((p) => (p.statement_line_id === id ? { ...p, ...patch, suggestion_source: 'none' as const } : p))
      )
    },
    []
  )

  const updateTourProposal = useCallback((id: string, patch: Partial<Pick<BulkTourProposalRow, 'paid_to' | 'paid_for'>>) => {
    setTourProposals((prev) => prev.map((p) => (p.statement_line_id === id ? { ...p, ...patch } : p)))
  }, [])

  const updateResProposal = useCallback(
    (id: string, patch: Partial<Pick<BulkReservationProposalRow, 'paid_to' | 'paid_for' | 'note'>>) => {
      setResProposals((prev) => prev.map((p) => (p.statement_line_id === id ? { ...p, ...patch } : p)))
    },
    []
  )

  const updateTicketProposal = useCallback(
    (id: string, patch: Partial<Pick<BulkTicketProposalRow, 'category' | 'company' | 'note'>>) => {
      setTicketProposals((prev) => prev.map((p) => (p.statement_line_id === id ? { ...p, ...patch } : p)))
    },
    []
  )

  const addRule = async () => {
    setFormError(null)
    const pattern = newPattern.trim()
    if (pattern.length < 2) {
      setFormError('패턴은 2글자 이상 입력하세요.')
      return
    }
    if (!newPaidFor.trim() || !newCategory.trim()) {
      setFormError('결제내용(paid for)·카테고리는 필수입니다.')
      return
    }
    setAddingRule(true)
    try {
      const leafId = newStandardLeafId.trim()
      let paidForSave = newPaidFor.trim()
      let categorySave = newCategory.trim()
      if (leafId) {
        const applied = applyStandardLeafToCompanyExpense(leafId, standardCatsById)
        if (applied) {
          paidForSave = applied.paid_for
          categorySave = applied.category
        }
      }
      const insertPayload = {
        financial_account_id: newScopeThisAccount ? financialAccountId : null,
        pattern,
        match_mode: newMatchMode,
        paid_to: newPaidTo.trim(),
        paid_for: paidForSave,
        category: categorySave,
        standard_leaf_id: leafId || null,
        priority: Math.min(9999, Math.max(0, Math.floor(Number(newPriority) || 0))),
        source: 'template' as const,
        created_by: email || null
      }
      let { error } = await supabase.from('statement_expense_autofill_rules').insert(insertPayload)
      if (error && shouldRetryAutofillRuleWithoutStandardLeafId(error)) {
        const { standard_leaf_id: _omitLeaf, ...rest } = insertPayload
        const second = await supabase.from('statement_expense_autofill_rules').insert(rest)
        error = second.error
      }
      if (error) throw new Error(autofillRuleSupabaseErrorText(error))
      resetNewRuleForm()
      if (expenseKind === 'company_expenses') await loadAll()
    } catch (e) {
      setFormError(autofillRuleSupabaseErrorText(e))
    } finally {
      setAddingRule(false)
    }
  }

  const deleteRule = async (id: string) => {
    setFormError(null)
    setEditRuleDraft((draft) => (draft?.id === id ? null : draft))
    try {
      const { error } = await supabase.from('statement_expense_autofill_rules').delete().eq('id', id)
      if (error) throw error
      if (expenseKind === 'company_expenses') await loadAll()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : '삭제 실패')
    }
  }

  const cancelRuleEdit = useCallback(() => {
    setEditRuleDraft(null)
    setFormError(null)
  }, [])

  const saveRuleEdit = async () => {
    const d = editRuleDraft
    if (!d) return
    setFormError(null)
    const pattern = d.pattern.trim()
    if (pattern.length < 2) {
      setFormError('패턴은 2글자 이상 입력하세요.')
      return
    }
    if (!d.paid_for.trim() || !d.category.trim()) {
      setFormError('결제내용(paid for)·카테고리는 필수입니다.')
      return
    }
    setSavingRuleEdit(true)
    try {
      const leafId = d.standardLeafId.trim()
      let paidForSave = d.paid_for.trim()
      let categorySave = d.category.trim()
      if (leafId) {
        const applied = applyStandardLeafToCompanyExpense(leafId, standardCatsById)
        if (applied) {
          paidForSave = applied.paid_for
          categorySave = applied.category
        }
      }
      const updatePayload = {
        pattern,
        match_mode: d.match_mode,
        paid_to: d.paid_to.trim(),
        paid_for: paidForSave,
        category: categorySave,
        standard_leaf_id: leafId || null,
        priority: Math.min(9999, Math.max(0, Math.floor(Number(d.priority) || 0))),
        financial_account_id: d.scopeThisAccount ? financialAccountId : null
      }
      let { error } = await supabase
        .from('statement_expense_autofill_rules')
        .update(updatePayload)
        .eq('id', d.id)
      if (error && shouldRetryAutofillRuleWithoutStandardLeafId(error)) {
        const { standard_leaf_id: _omitLeaf, ...rest } = updatePayload
        const second = await supabase.from('statement_expense_autofill_rules').update(rest).eq('id', d.id)
        error = second.error
      }
      if (error) throw new Error(autofillRuleSupabaseErrorText(error))
      setEditRuleDraft(null)
      if (expenseKind === 'company_expenses') await loadAll()
    } catch (e) {
      setFormError(autofillRuleSupabaseErrorText(e))
    } finally {
      setSavingRuleEdit(false)
    }
  }

  const paymentMethodValue = defaultPaymentMethodId?.trim() || 'Card'

  const linkStatement = async (
    lineId: string,
    sourceTable: 'company_expenses' | 'tour_expenses' | 'reservation_expenses' | 'ticket_bookings',
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

  const applySelected = async () => {
    setFormError(null)
    if (expenseKind === 'tour_expenses' && !tourPickId) {
      setFormError('투어 지출은 상단에서 투어를 먼저 선택하세요.')
      return
    }
    const pickedTour = tourRows.find((t) => t.id === tourPickId)

    if (expenseKind === 'tour_expenses' && !pickedTour) {
      setFormError('선택한 투어를 찾을 수 없습니다.')
      return
    }

    setApplying(true)
    const ruleUsage = new Map<string, number>()
    try {
      if (expenseKind === 'company_expenses') {
        const rows = companyProposals.filter((p) => selectedIds.has(p.statement_line_id))
        const valid = rows.filter((p) => p.paid_for.trim() && p.category.trim() && p.paid_to.trim())
        if (valid.length === 0) {
          setFormError('저장할 행을 선택하고, 결제처·결제내용·카테고리를 모두 채우세요.')
          setApplying(false)
          return
        }
        for (const p of valid) {
          const leafId = matchStandardLeafIdForPaidForAndCategory(
            p.paid_for.trim(),
            p.category.trim(),
            expenseStandardCategories,
            locale
          )
          const applied = leafId ? applyStandardLeafToCompanyExpense(leafId, standardCatsById) : null
          const { data: ins, error: insErr } = await supabase
            .from('company_expenses')
            .insert({
              paid_to: p.paid_to.trim(),
              paid_for: p.paid_for.trim(),
              description: p.description.trim() || null,
              amount: p.amount,
              payment_method: paymentMethodValue,
              submit_by: email,
              category: applied ? applied.category : p.category.trim(),
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
          if (p.rule_id && p.suggestion_source === 'rule') {
            ruleUsage.set(p.rule_id, (ruleUsage.get(p.rule_id) ?? 0) + 1)
          }
        }
        for (const [rid, n] of ruleUsage) {
          const { data: cur } = await supabase
            .from('statement_expense_autofill_rules')
            .select('usage_count')
            .eq('id', rid)
            .maybeSingle()
          const base = Number(cur?.usage_count ?? 0)
          await supabase.from('statement_expense_autofill_rules').update({ usage_count: base + n }).eq('id', rid)
        }
      } else if (expenseKind === 'tour_expenses' && pickedTour) {
        const rows = tourProposals.filter((p) => selectedIds.has(p.statement_line_id))
        const valid = rows.filter((p) => p.paid_for.trim() && p.paid_to.trim())
        if (valid.length === 0) {
          setFormError('저장할 행을 선택하고, 지급 대상·항목을 채우세요.')
          setApplying(false)
          return
        }
        for (const p of valid) {
          const { data: ins, error: insErr } = await supabase
            .from('tour_expenses')
            .insert({
              tour_id: pickedTour.id,
              tour_date: pickedTour.tour_date,
              product_id: pickedTour.product_id,
              paid_to: p.paid_to.trim() || null,
              paid_for: p.paid_for.trim(),
              amount: p.amount,
              payment_method: paymentMethodValue,
              submitted_by: email,
              submit_on: `${p.posted_date}T12:00:00.000Z`,
              status: 'pending',
              statement_line_id: p.statement_line_id,
              exclude_from_pnl: p.exclude_from_pnl,
              is_personal: false
            })
            .select('id')
            .single()
          if (insErr || !ins?.id) throw insErr || new Error('투어 지출 저장 실패')
          await linkStatement(p.statement_line_id, 'tour_expenses', String(ins.id), p.amount)
        }
      } else if (expenseKind === 'reservation_expenses') {
        const rows = resProposals.filter((p) => selectedIds.has(p.statement_line_id))
        const valid = rows.filter((p) => p.paid_for.trim() && p.paid_to.trim())
        if (valid.length === 0) {
          setFormError('저장할 행을 선택하고, 결제처·결제내용을 채우세요.')
          setApplying(false)
          return
        }
        for (const p of valid) {
          const newId = crypto.randomUUID()
          const { error: insErr } = await supabase.from('reservation_expenses').insert({
            id: newId,
            submitted_by: email,
            paid_to: p.paid_to.trim(),
            paid_for: p.paid_for.trim(),
            amount: p.amount,
            payment_method: paymentMethodValue,
            submit_on: `${p.posted_date}T12:00:00.000Z`,
            reservation_id: defaultReservationId.trim() || null,
            note: p.note.trim() || null,
            status: 'approved',
            statement_line_id: p.statement_line_id,
            exclude_from_pnl: p.exclude_from_pnl,
            is_personal: false
          })
          if (insErr) throw insErr
          await linkStatement(p.statement_line_id, 'reservation_expenses', newId, p.amount)
        }
      } else {
        const rows = ticketProposals.filter((p) => selectedIds.has(p.statement_line_id))
        const valid = rows.filter((p) => p.category.trim() && p.company.trim())
        if (valid.length === 0) {
          setFormError('저장할 행을 선택하고, 카테고리·공급업체를 채우세요.')
          setApplying(false)
          return
        }
        for (const p of valid) {
          const { data: ins, error: insErr } = await supabase
            .from('ticket_bookings')
            .insert({
              category: p.category.trim(),
              company: p.company.trim(),
              expense: p.amount,
              income: 0,
              submit_on: `${p.posted_date}T12:00:00.000Z`,
              submitted_by: email,
              check_in_date: p.posted_date,
              time: '12:00:00',
              ea: 1,
              payment_method: paymentMethodValue,
              status: 'confirmed',
              note: p.note.trim() || null,
              statement_line_id: p.statement_line_id
            })
            .select('id')
            .single()
          if (insErr || !ins?.id) throw insErr || new Error('티켓 부킹 저장 실패')
          await linkStatement(p.statement_line_id, 'ticket_bookings', String(ins.id), p.amount)
        }
      }

      await onCompleted()
      onOpenChange(false)
    } catch (e) {
      setFormError(e instanceof Error ? e.message : '저장 중 오류')
    } finally {
      setApplying(false)
    }
  }

  const sourceLabel = (s: BulkCompanyExpenseProposalRow['suggestion_source']) => {
    if (s === 'rule') return '규칙'
    if (s === 'history') return '과거 설명'
    return '—'
  }

  const hintLine = useMemo(() => {
    if (candidateLines.length > 200) {
      return `명세 출금·미대조 줄 중 앞에서 ${200}건만 포함했습니다. 나머지는 필터·검색으로 좁힌 뒤 다시 열어 주세요.`
    }
    return null
  }, [candidateLines.length])

  const toggleSelectAll = (checked: boolean) => {
    let ids: string[] = []
    if (expenseKind === 'company_expenses') ids = companyProposals.map((p) => p.statement_line_id)
    else if (expenseKind === 'tour_expenses') ids = tourProposals.map((p) => p.statement_line_id)
    else if (expenseKind === 'reservation_expenses') ids = resProposals.map((p) => p.statement_line_id)
    else ids = ticketProposals.map((p) => p.statement_line_id)
    setSelectedIds(checked ? new Set(ids) : new Set())
  }

  const onKindChange = (k: BulkExpenseKind) => {
    setExpenseKind(k)
    setSelectedIds(new Set())
    setFormError(null)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && applying) return
        onOpenChange(v)
        if (!v) {
          setExpenseKind('company_expenses')
          setCompanyProposals([])
          setTourProposals([])
          setResProposals([])
          setTicketProposals([])
          setSelectedIds(new Set())
          setLoadError(null)
          setFormError(null)
          resetNewRuleForm()
          setEditRuleDraft(null)
          setTourPickId('')
          setDefaultReservationId('')
        }
      }}
    >
      <DialogContent
        className="max-w-[min(96rem,calc(100vw-1.5rem))] w-[calc(100vw-1rem)] max-h-[min(92vh,900px)] flex flex-col gap-0 p-0"
        onPointerDownOutside={(e) => {
          if (applying) e.preventDefault()
        }}
        onEscapeKeyDown={(e) => {
          if (applying) e.preventDefault()
        }}
      >
        <DialogHeader className="px-4 pt-4 pb-2 pr-12 border-b border-slate-100 shrink-0 text-left space-y-1">
          <DialogTitle className="text-base flex items-center gap-2">
            <ListPlus className="h-5 w-5 shrink-0 text-slate-600" aria-hidden />
            명세에서 지출 일괄 입력
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-slate-600">
            <strong>지출 유형</strong>을 고른 뒤 미리보기에서 값을 확인·수정하고, 체크한 행만 저장합니다.{' '}
            <strong>회사 지출</strong>만 규칙·과거 설명으로 paid for·카테고리를 자동 제안합니다. 투어·예약·입장권은
            행마다 입력하거나 가맹점명을 결제처로 두고 수정하세요.
          </DialogDescription>
        </DialogHeader>

        <div className="px-3 sm:px-4 py-2 overflow-y-auto flex-1 min-h-0 space-y-3 text-xs sm:text-sm">
          {hintLine ? <p className="text-amber-800 text-[11px] sm:text-xs">{hintLine}</p> : null}
          {loadError ? <p className="text-red-700 text-sm">{loadError}</p> : null}
          {formError ? <p className="text-red-700 text-sm">{formError}</p> : null}

          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1 min-w-[12rem]">
              <Label className="text-[10px] text-slate-600">지출 유형</Label>
              <Select value={expenseKind} onValueChange={(v) => onKindChange(v as BulkExpenseKind)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(KIND_LABEL) as BulkExpenseKind[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {KIND_LABEL[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {expenseKind === 'tour_expenses' ? (
              <div className="space-y-1 flex-1 min-w-[14rem] max-w-md">
                <Label className="text-[10px] text-slate-600">공통 투어 (모든 행에 동일 적용)</Label>
                <Select value={tourPickId} onValueChange={setTourPickId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="투어 선택" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {tourRows.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.tour_date} · {t.product_id ?? '—'} · {t.id.slice(0, 8)}…
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            {expenseKind === 'reservation_expenses' ? (
              <div className="space-y-1 flex-1 min-w-[12rem] max-w-xs">
                <Label className="text-[10px] text-slate-600">공통 예약 ID (선택, 모든 행에 동일)</Label>
                <Input
                  className="h-8 text-xs"
                  value={defaultReservationId}
                  onChange={(e) => setDefaultReservationId(e.target.value)}
                  placeholder="예약 UUID"
                />
              </div>
            ) : null}
          </div>

          {expenseKind === 'company_expenses' ? (
            <section className="rounded-md border border-slate-200 bg-slate-50/80 p-2 space-y-2">
              <h3 className="text-xs font-semibold text-slate-800">규칙(템플릿) — 회사 지출만</h3>
              <p className="text-[10px] text-slate-600 leading-snug space-y-1">
                <span className="block">
                  <strong>패턴이란?</strong> 카드 명세에 나온 글자 중, <strong>다음에도 그대로 나올 법한 짧은 부분</strong>만
                  적습니다. 와일드카드·별표(<code className="text-[9px] bg-slate-100 px-0.5 rounded">*</code>) 같은 특수
                  문법은 없습니다(프로그래밍용 정규식이 아님). 띄어쓰기만 정리한 뒤 <strong>대소문자 구분 없이</strong>{' '}
                  비교합니다.
                </span>
                <span className="block">
                  <strong>포함:</strong> 명세 한 줄(가맹점+적요) 안에 패턴 글자가 <strong>어디에든 들어가면</strong> 이
                  규칙이 적용됩니다. <strong>접두:</strong> 줄 <strong>맨 앞</strong>부터 패턴과 같을 때만 적용됩니다. 보통은{' '}
                  <strong>포함</strong>만 쓰면 됩니다.
                </span>
                <span className="block">
                  <strong>예:</strong> 적요가{' '}
                  <code className="text-[9px] bg-slate-100 px-0.5 rounded break-all">
                    _WIX.COM, INC.*11544NEW YORK NY
                  </code>{' '}
                  이면 패턴에 <code className="text-[9px] bg-slate-100 px-0.5 rounded">wix.com</code> 또는{' '}
                  <code className="text-[9px] bg-slate-100 px-0.5 rounded">wix</code>처럼 <strong>바뀌지 않는 상호
                  일부</strong>만 넣으세요. 뒤의 지역·숫자까지 통째로 넣으면, 다른 건의 명세는 조금만 달라도 안 맞을 수
                  있습니다.
                </span>
                <span className="block">
                  <strong>비슷한 명세를 자동으로 같은 카테고리로:</strong> 위처럼 <strong>규칙 저장</strong>을 한 번 해두면,
                  그 글자가 들어가는 출금 줄마다 결제내용·카테고리가 자동으로 채워집니다. 또는 규칙 없이{' '}
                  <strong>과거에 저장한 승인 지출의 설명</strong>이 새 명세 줄 안에 그대로(긴 글자 일부 포함) 들어 있으면
                  &quot;과거 설명&quot;으로 제안되지만, 카드사마다 뒤쪽 글자가 조금씩 다르면 안 맞을 수 있어{' '}
                  <strong>짧은 패턴 규칙이 더 안정적</strong>입니다.
                </span>
                <span className="block">
                  여러 규칙이 한 줄에 모두 맞으면 <strong>우선순위</strong> 큰 것이 먼저 적용되고, &quot;이 금융 계정에만
                  적용&quot;이 전체 규칙보다 먼저입니다. 자동 채우기 순서는 <strong>규칙 → 과거 승인 지출 설명</strong>입니다.
                </span>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 items-end">
                <div className="space-y-1">
                  <Label className="text-[10px] text-slate-600">패턴</Label>
                  <Input
                    className="h-8 text-xs"
                    value={newPattern}
                    onChange={(e) => setNewPattern(e.target.value)}
                    placeholder="명세 문자열에 포함·접두"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-slate-600">매칭</Label>
                  <Select value={newMatchMode} onValueChange={(v) => setNewMatchMode(v as 'contains' | 'startswith')}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contains">포함</SelectItem>
                      <SelectItem value="startswith">접두</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-slate-600">우선순위</Label>
                  <Input
                    className="h-8 text-xs"
                    type="number"
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value)}
                  />
                </div>
                <div className="space-y-1 sm:col-span-1 min-w-0">
                  <Label className="text-[10px] text-slate-600">paid for (기존 지출에서 선택)</Label>
                  <select
                    className="h-8 text-xs w-full rounded-md border border-slate-200 bg-white px-2"
                    value={newPaidFor}
                    onChange={(e) => {
                      setNewPaidFor(e.target.value)
                      setNewStandardLeafId('')
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
                <div className="space-y-1 sm:col-span-1 min-w-0">
                  <Label className="text-[10px] text-slate-600">카테고리 (표준 카테고리)</Label>
                  <select
                    className="h-8 text-xs w-full rounded-md border border-slate-200 bg-white px-2"
                    value={newStandardLeafId || matchStandardLeafIdForPaidForAndCategory(newPaidFor, newCategory, expenseStandardCategories, locale)}
                    onChange={(e) => {
                      const id = e.target.value
                      if (!id) {
                        setNewCategory('')
                        setNewStandardLeafId('')
                        return
                      }
                      const applied = applyStandardLeafToCompanyExpense(id, standardCatsById)
                      if (applied) {
                        setNewCategory(applied.category)
                        setNewPaidFor(applied.paid_for)
                        setNewStandardLeafId(id)
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
                <div className="space-y-1">
                  <Label className="text-[10px] text-slate-600">paid to (선택)</Label>
                  <Input className="h-8 text-xs" value={newPaidTo} onChange={(e) => setNewPaidTo(e.target.value)} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-[11px] text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-slate-300"
                  checked={newScopeThisAccount}
                  onChange={(e) => setNewScopeThisAccount(e.target.checked)}
                />
                이 금융 계정에만 적용
              </label>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="secondary" disabled={addingRule} onClick={() => void addRule()}>
                  {addingRule ? '추가 중…' : '규칙 저장'}
                </Button>
                <Button type="button" size="sm" variant="outline" disabled={loading} onClick={() => void loadAll()}>
                  새로고침
                </Button>
              </div>
              {rules.length > 0 ? (
                <div className="max-h-72 overflow-y-auto overflow-x-auto border border-slate-200 rounded bg-white">
                  <table className="w-full text-[10px] border-collapse min-w-[48rem]">
                    <thead>
                      <tr className="text-slate-500 border-b bg-slate-50 text-left">
                        <th className="py-1 px-1.5 font-medium min-w-[7rem]">패턴</th>
                        <th className="py-1 px-1.5 font-medium w-12 whitespace-nowrap">매칭</th>
                        <th className="py-1 px-1.5 font-medium min-w-[6rem]">paid for</th>
                        <th className="py-1 px-1.5 font-medium min-w-[8rem]">표준 카테고리</th>
                        <th className="py-1 px-1.5 font-medium min-w-[5rem]">결제처</th>
                        <th className="py-1 px-1.5 font-medium w-16 whitespace-nowrap">적용</th>
                        <th className="py-1 px-1.5 w-12">우선</th>
                        <th className="py-1 px-1 font-medium w-24 whitespace-nowrap">작업</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rules.map((r) => {
                        if (editRuleDraft?.id === r.id) {
                          const d = editRuleDraft
                          const sourceRule = rules.find((x) => x.id === r.id)
                          const otherAccountRule =
                            sourceRule?.financial_account_id != null &&
                            sourceRule.financial_account_id !== financialAccountId
                          return (
                            <tr key={r.id} className="border-b border-amber-200 bg-amber-50/60 align-top">
                              <td colSpan={8} className="p-2">
                                <p className="text-[10px] font-semibold text-slate-800 mb-2">규칙 수정</p>
                                {otherAccountRule ? (
                                  <p className="text-[10px] text-amber-900 bg-amber-100/80 border border-amber-200 rounded px-2 py-1 mb-2">
                                    이 규칙은 다른 금융 계정에만 적용되던 항목입니다. 아래에서 &quot;이 금융 계정에만
                                    적용&quot;을 켜고 저장하면 <strong>현재 명세의 금융 계정</strong>으로 옮겨집니다. 끄고
                                    저장하면 <strong>전체 계정</strong> 규칙이 됩니다.
                                  </p>
                                ) : null}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 items-end">
                                  <div className="space-y-1">
                                    <Label className="text-[10px] text-slate-600">패턴</Label>
                                    <Input
                                      className="h-8 text-xs"
                                      value={d.pattern}
                                      onChange={(e) =>
                                        setEditRuleDraft((prev) => (prev ? { ...prev, pattern: e.target.value } : prev))
                                      }
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-[10px] text-slate-600">매칭</Label>
                                    <Select
                                      value={d.match_mode}
                                      onValueChange={(v) =>
                                        setEditRuleDraft((prev) =>
                                          prev ? { ...prev, match_mode: v as 'contains' | 'startswith' } : prev
                                        )
                                      }
                                    >
                                      <SelectTrigger className="h-8 text-xs">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="contains">포함</SelectItem>
                                        <SelectItem value="startswith">접두</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-[10px] text-slate-600">우선순위</Label>
                                    <Input
                                      className="h-8 text-xs"
                                      type="number"
                                      value={d.priority}
                                      onChange={(e) =>
                                        setEditRuleDraft((prev) => (prev ? { ...prev, priority: e.target.value } : prev))
                                      }
                                    />
                                  </div>
                                  <div className="space-y-1 min-w-0">
                                    <Label className="text-[10px] text-slate-600">paid for</Label>
                                    <select
                                      className="h-8 text-xs w-full rounded-md border border-slate-200 bg-white px-2"
                                      value={d.paid_for}
                                      onChange={(e) =>
                                        setEditRuleDraft((prev) =>
                                          prev
                                            ? { ...prev, paid_for: e.target.value, standardLeafId: '' }
                                            : prev
                                        )
                                      }
                                    >
                                      <option value="">선택…</option>
                                      {paidForSelectOptions.map((opt) => (
                                        <option key={opt} value={opt}>
                                          {opt.length > 48 ? `${opt.slice(0, 48)}…` : opt}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="space-y-1 min-w-0 sm:col-span-1">
                                    <Label className="text-[10px] text-slate-600">표준 카테고리</Label>
                                    <select
                                      className="h-8 text-xs w-full rounded-md border border-slate-200 bg-white px-2"
                                      value={
                                        d.standardLeafId ||
                                        matchStandardLeafIdForPaidForAndCategory(d.paid_for, d.category, expenseStandardCategories, locale)
                                      }
                                      onChange={(e) => {
                                        const id = e.target.value
                                        setEditRuleDraft((prev) => {
                                          if (!prev) return prev
                                          if (!id) return { ...prev, category: '', standardLeafId: '' }
                                          const applied = applyStandardLeafToCompanyExpense(id, standardCatsById)
                                          return applied
                                            ? {
                                                ...prev,
                                                category: applied.category,
                                                paid_for: applied.paid_for,
                                                standardLeafId: id
                                              }
                                            : prev
                                        })
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
                                  <div className="space-y-1">
                                    <Label className="text-[10px] text-slate-600">결제처 (paid to)</Label>
                                    <Input
                                      className="h-8 text-xs"
                                      value={d.paid_to}
                                      onChange={(e) =>
                                        setEditRuleDraft((prev) => (prev ? { ...prev, paid_to: e.target.value } : prev))
                                      }
                                    />
                                  </div>
                                </div>
                                <label className="flex items-center gap-2 text-[11px] text-slate-700 cursor-pointer mt-2">
                                  <input
                                    type="checkbox"
                                    className="rounded border-slate-300"
                                    checked={d.scopeThisAccount}
                                    onChange={(e) =>
                                      setEditRuleDraft((prev) =>
                                        prev ? { ...prev, scopeThisAccount: e.target.checked } : prev
                                      )
                                    }
                                  />
                                  이 금융 계정에만 적용
                                </label>
                                <div className="flex flex-wrap gap-2 mt-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="secondary"
                                    disabled={savingRuleEdit || loading}
                                    onClick={() => void saveRuleEdit()}
                                  >
                                    {savingRuleEdit ? '저장 중…' : '수정 저장'}
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={savingRuleEdit}
                                    onClick={cancelRuleEdit}
                                  >
                                    취소
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          )
                        }

                        const leafId = ruleResolvedStandardLeafId(r, expenseStandardCategories, locale)
                        const stdLabel = leafId ? unifiedStandardTriggerLabel(unifiedStandardGroups, leafId) : ''
                        const scopeLabel =
                          r.financial_account_id == null
                            ? '전체'
                            : r.financial_account_id === financialAccountId
                              ? '이 계정'
                              : '다른 계정'

                        return (
                          <tr key={r.id} className="border-b border-slate-100 align-top">
                            <td className="py-0.5 px-1.5 break-all max-w-[14rem]">{r.pattern}</td>
                            <td className="py-0.5 px-1.5 whitespace-nowrap text-slate-600">
                              {r.match_mode === 'startswith' ? '접두' : '포함'}
                            </td>
                            <td className="py-0.5 px-1.5 break-words">{r.paid_for}</td>
                            <td className="py-0.5 px-1.5 break-words">
                              {stdLabel ? (
                                <span className="text-slate-800">{stdLabel}</span>
                              ) : (
                                <span className="text-slate-500">
                                  <span className="italic text-slate-400">표준 없음</span>
                                  {r.category ? (
                                    <span className="not-italic text-slate-500"> · {r.category}</span>
                                  ) : null}
                                </span>
                              )}
                            </td>
                            <td className="py-0.5 px-1.5 break-all text-slate-600 max-w-[10rem]">
                              {(r.paid_to ?? '').trim() || '—'}
                            </td>
                            <td className="py-0.5 px-1.5 text-slate-600 whitespace-nowrap">{scopeLabel}</td>
                            <td className="py-0.5 px-1.5">{r.priority}</td>
                            <td className="py-0.5 px-1.5 whitespace-nowrap">
                              <button
                                type="button"
                                className="text-blue-700 hover:underline mr-2"
                                disabled={savingRuleEdit || addingRule}
                                onClick={() => {
                                  setFormError(null)
                                  const eff = effectiveAutofillExpenseFromRule(r, standardCatsById)
                                  setEditRuleDraft({
                                    id: r.id,
                                    pattern: r.pattern,
                                    match_mode: r.match_mode,
                                    priority: String(typeof r.priority === 'number' ? r.priority : 0),
                                    paid_for: eff.paid_for,
                                    category: eff.category,
                                    paid_to: (r.paid_to ?? '').trim(),
                                    standardLeafId:
                                      (r.standard_leaf_id ?? '').trim() ||
                                      matchStandardLeafIdForPaidForAndCategory(
                                        eff.paid_for,
                                        eff.category,
                                        expenseStandardCategories,
                                        locale
                                      ),
                                    scopeThisAccount:
                                      r.financial_account_id != null && r.financial_account_id === financialAccountId
                                  })
                                }}
                              >
                                수정
                              </button>
                              <button
                                type="button"
                                className="text-red-600 hover:underline"
                                disabled={savingRuleEdit}
                                onClick={() => void deleteRule(r.id)}
                              >
                                삭제
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-[10px] text-slate-500">등록된 규칙이 없습니다.</p>
              )}
            </section>
          ) : null}

          {loading ? (
            <p className="text-slate-600 py-6 text-center">불러오는 중…</p>
          ) : filterExpenseCandidates(candidateLines).length === 0 ? (
            <p className="text-slate-600 py-4">대상 명세 줄이 없습니다.</p>
          ) : expenseKind === 'company_expenses' && companyProposals.length === 0 ? (
            <p className="text-slate-600 py-4">표시할 출금 미대조 줄이 없습니다.</p>
          ) : expenseKind === 'tour_expenses' && tourProposals.length === 0 ? (
            <p className="text-slate-600 py-4">표시할 출금 미대조 줄이 없습니다.</p>
          ) : expenseKind === 'reservation_expenses' && resProposals.length === 0 ? (
            <p className="text-slate-600 py-4">표시할 출금 미대조 줄이 없습니다.</p>
          ) : expenseKind === 'ticket_bookings' && ticketProposals.length === 0 ? (
            <p className="text-slate-600 py-4">표시할 출금 미대조 줄이 없습니다.</p>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-md">
              {expenseKind === 'company_expenses' ? (
                <table className="w-full text-[10px] sm:text-[11px] border-collapse min-w-[72rem]">
                  <thead>
                    <tr className="border-b text-left text-slate-500 bg-slate-50">
                      <th className="py-1.5 px-1 w-8 text-center">
                        <input
                          ref={selectAllRef}
                          type="checkbox"
                          className="rounded border-slate-300"
                          checked={companyProposals.length > 0 && selectedIds.size === companyProposals.length}
                          onChange={(e) => toggleSelectAll(e.target.checked)}
                          aria-label="전체 선택"
                        />
                      </th>
                      <th className="py-1.5 px-1 font-medium whitespace-nowrap">일자</th>
                      <th className="py-1.5 px-1 font-medium text-right">금액</th>
                      <th className="py-1.5 px-1 font-medium min-w-[9rem]">명세 설명</th>
                      <th className="py-1.5 px-1 font-medium w-16">제안</th>
                      <th className="py-1.5 px-1 font-medium min-w-[6rem]">결제처</th>
                      <th className="py-1.5 px-1 font-medium min-w-[6rem]">paid for</th>
                      <th className="py-1.5 px-1 font-medium min-w-[5rem]">카테고리</th>
                      <th className="py-1.5 px-1 font-medium min-w-[7rem]">지출 비고</th>
                    </tr>
                  </thead>
                  <tbody>
                    {companyProposals.map((p) => (
                      <tr key={p.statement_line_id} className="border-b border-slate-100 align-top">
                        <td className="py-1 px-1 text-center">
                          <input
                            type="checkbox"
                            className="rounded border-slate-300"
                            checked={selectedIds.has(p.statement_line_id)}
                            onChange={() => {
                              setSelectedIds((prev) => {
                                const n = new Set(prev)
                                if (n.has(p.statement_line_id)) n.delete(p.statement_line_id)
                                else n.add(p.statement_line_id)
                                return n
                              })
                            }}
                          />
                        </td>
                        <td className="py-1 px-1 whitespace-nowrap">{p.posted_date}</td>
                        <td className="py-1 px-1 text-right tabular-nums">
                          ${p.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-1 px-1 break-words text-slate-800">{p.line_desc || '—'}</td>
                        <td className="py-1 px-1 text-slate-600 whitespace-nowrap">{sourceLabel(p.suggestion_source)}</td>
                        <td className="py-1 px-1">
                          <Input
                            className="h-7 text-[10px] px-1"
                            value={p.paid_to}
                            onChange={(e) => updateCompanyProposal(p.statement_line_id, { paid_to: e.target.value })}
                          />
                        </td>
                        <td className="py-1 px-1 min-w-[9rem] max-w-[14rem]">
                          <select
                            className="h-7 text-[10px] px-1 w-full rounded border border-slate-200 bg-white"
                            value={p.paid_for}
                            onChange={(e) => updateCompanyProposal(p.statement_line_id, { paid_for: e.target.value })}
                          >
                            <option value="">선택…</option>
                            {paidForSelectOptions.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt.length > 40 ? `${opt.slice(0, 40)}…` : opt}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-1 px-1 min-w-[10rem] max-w-[18rem]">
                          <select
                            className="h-7 text-[10px] px-1 w-full rounded border border-slate-200 bg-white"
                            value={matchStandardLeafIdForPaidForAndCategory(p.paid_for, p.category, expenseStandardCategories, locale)}
                            onChange={(e) => {
                              const id = e.target.value
                              if (!id) {
                                updateCompanyProposal(p.statement_line_id, { category: '' })
                                return
                              }
                              const applied = applyStandardLeafToCompanyExpense(id, standardCatsById)
                              if (applied) {
                                updateCompanyProposal(p.statement_line_id, { category: applied.category })
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
                        </td>
                        <td className="py-1 px-1">
                          <Input
                            className="h-7 text-[10px] px-1"
                            value={p.description}
                            onChange={(e) => updateCompanyProposal(p.statement_line_id, { description: e.target.value })}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : expenseKind === 'tour_expenses' ? (
                <table className="w-full text-[10px] sm:text-[11px] border-collapse min-w-[42rem]">
                  <thead>
                    <tr className="border-b text-left text-slate-500 bg-slate-50">
                      <th className="py-1.5 px-1 w-8 text-center">
                        <input
                          ref={selectAllRef}
                          type="checkbox"
                          className="rounded border-slate-300"
                          checked={tourProposals.length > 0 && selectedIds.size === tourProposals.length}
                          onChange={(e) => toggleSelectAll(e.target.checked)}
                          aria-label="전체 선택"
                        />
                      </th>
                      <th className="py-1.5 px-1 font-medium whitespace-nowrap">일자</th>
                      <th className="py-1.5 px-1 font-medium text-right">금액</th>
                      <th className="py-1.5 px-1 font-medium min-w-[10rem]">명세 설명</th>
                      <th className="py-1.5 px-1 font-medium min-w-[6rem]">지급 대상 (paid_to)</th>
                      <th className="py-1.5 px-1 font-medium min-w-[6rem]">항목 (paid_for)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tourProposals.map((p) => (
                      <tr key={p.statement_line_id} className="border-b border-slate-100 align-top">
                        <td className="py-1 px-1 text-center">
                          <input
                            type="checkbox"
                            className="rounded border-slate-300"
                            checked={selectedIds.has(p.statement_line_id)}
                            onChange={() => {
                              setSelectedIds((prev) => {
                                const n = new Set(prev)
                                if (n.has(p.statement_line_id)) n.delete(p.statement_line_id)
                                else n.add(p.statement_line_id)
                                return n
                              })
                            }}
                          />
                        </td>
                        <td className="py-1 px-1 whitespace-nowrap">{p.posted_date}</td>
                        <td className="py-1 px-1 text-right tabular-nums">
                          ${p.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-1 px-1 break-words">{p.line_desc || '—'}</td>
                        <td className="py-1 px-1">
                          <Input
                            className="h-7 text-[10px] px-1"
                            value={p.paid_to}
                            onChange={(e) => updateTourProposal(p.statement_line_id, { paid_to: e.target.value })}
                          />
                        </td>
                        <td className="py-1 px-1">
                          <Input
                            className="h-7 text-[10px] px-1"
                            value={p.paid_for}
                            onChange={(e) => updateTourProposal(p.statement_line_id, { paid_for: e.target.value })}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : expenseKind === 'reservation_expenses' ? (
                <table className="w-full text-[10px] sm:text-[11px] border-collapse min-w-[48rem]">
                  <thead>
                    <tr className="border-b text-left text-slate-500 bg-slate-50">
                      <th className="py-1.5 px-1 w-8 text-center">
                        <input
                          ref={selectAllRef}
                          type="checkbox"
                          className="rounded border-slate-300"
                          checked={resProposals.length > 0 && selectedIds.size === resProposals.length}
                          onChange={(e) => toggleSelectAll(e.target.checked)}
                          aria-label="전체 선택"
                        />
                      </th>
                      <th className="py-1.5 px-1 font-medium whitespace-nowrap">일자</th>
                      <th className="py-1.5 px-1 font-medium text-right">금액</th>
                      <th className="py-1.5 px-1 font-medium min-w-[10rem]">명세 설명</th>
                      <th className="py-1.5 px-1 font-medium min-w-[6rem]">결제처</th>
                      <th className="py-1.5 px-1 font-medium min-w-[6rem]">결제내용</th>
                      <th className="py-1.5 px-1 font-medium min-w-[6rem]">메모</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resProposals.map((p) => (
                      <tr key={p.statement_line_id} className="border-b border-slate-100 align-top">
                        <td className="py-1 px-1 text-center">
                          <input
                            type="checkbox"
                            className="rounded border-slate-300"
                            checked={selectedIds.has(p.statement_line_id)}
                            onChange={() => {
                              setSelectedIds((prev) => {
                                const n = new Set(prev)
                                if (n.has(p.statement_line_id)) n.delete(p.statement_line_id)
                                else n.add(p.statement_line_id)
                                return n
                              })
                            }}
                          />
                        </td>
                        <td className="py-1 px-1 whitespace-nowrap">{p.posted_date}</td>
                        <td className="py-1 px-1 text-right tabular-nums">
                          ${p.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-1 px-1 break-words">{p.line_desc || '—'}</td>
                        <td className="py-1 px-1">
                          <Input
                            className="h-7 text-[10px] px-1"
                            value={p.paid_to}
                            onChange={(e) => updateResProposal(p.statement_line_id, { paid_to: e.target.value })}
                          />
                        </td>
                        <td className="py-1 px-1">
                          <Input
                            className="h-7 text-[10px] px-1"
                            value={p.paid_for}
                            onChange={(e) => updateResProposal(p.statement_line_id, { paid_for: e.target.value })}
                          />
                        </td>
                        <td className="py-1 px-1">
                          <Input
                            className="h-7 text-[10px] px-1"
                            value={p.note}
                            onChange={(e) => updateResProposal(p.statement_line_id, { note: e.target.value })}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-[10px] sm:text-[11px] border-collapse min-w-[48rem]">
                  <thead>
                    <tr className="border-b text-left text-slate-500 bg-slate-50">
                      <th className="py-1.5 px-1 w-8 text-center">
                        <input
                          ref={selectAllRef}
                          type="checkbox"
                          className="rounded border-slate-300"
                          checked={ticketProposals.length > 0 && selectedIds.size === ticketProposals.length}
                          onChange={(e) => toggleSelectAll(e.target.checked)}
                          aria-label="전체 선택"
                        />
                      </th>
                      <th className="py-1.5 px-1 font-medium whitespace-nowrap">일자</th>
                      <th className="py-1.5 px-1 font-medium text-right">금액</th>
                      <th className="py-1.5 px-1 font-medium min-w-[10rem]">명세 설명</th>
                      <th className="py-1.5 px-1 font-medium min-w-[6rem]">카테고리</th>
                      <th className="py-1.5 px-1 font-medium min-w-[6rem]">공급업체</th>
                      <th className="py-1.5 px-1 font-medium min-w-[6rem]">메모</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ticketProposals.map((p) => (
                      <tr key={p.statement_line_id} className="border-b border-slate-100 align-top">
                        <td className="py-1 px-1 text-center">
                          <input
                            type="checkbox"
                            className="rounded border-slate-300"
                            checked={selectedIds.has(p.statement_line_id)}
                            onChange={() => {
                              setSelectedIds((prev) => {
                                const n = new Set(prev)
                                if (n.has(p.statement_line_id)) n.delete(p.statement_line_id)
                                else n.add(p.statement_line_id)
                                return n
                              })
                            }}
                          />
                        </td>
                        <td className="py-1 px-1 whitespace-nowrap">{p.posted_date}</td>
                        <td className="py-1 px-1 text-right tabular-nums">
                          ${p.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-1 px-1 break-words">{p.line_desc || '—'}</td>
                        <td className="py-1 px-1">
                          <Input
                            className="h-7 text-[10px] px-1"
                            value={p.category}
                            onChange={(e) => updateTicketProposal(p.statement_line_id, { category: e.target.value })}
                          />
                        </td>
                        <td className="py-1 px-1">
                          <Input
                            className="h-7 text-[10px] px-1"
                            value={p.company}
                            onChange={(e) => updateTicketProposal(p.statement_line_id, { company: e.target.value })}
                          />
                        </td>
                        <td className="py-1 px-1">
                          <Input
                            className="h-7 text-[10px] px-1"
                            value={p.note}
                            onChange={(e) => updateTicketProposal(p.statement_line_id, { note: e.target.value })}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="px-4 py-3 border-t border-slate-100 shrink-0 gap-2 flex-col sm:flex-row sm:justify-end">
          <p className="text-[10px] text-slate-500 mr-auto w-full sm:w-auto">
            결제수단: {defaultPaymentMethodId ? `ID ${defaultPaymentMethodId.slice(0, 8)}…` : '기본 Card'}
          </p>
          <Button type="button" variant="outline" disabled={applying} onClick={() => onOpenChange(false)}>
            닫기
          </Button>
          <Button
            type="button"
            disabled={applying || loading || selectedIds.size === 0}
            onClick={() => void applySelected()}
          >
            {applying ? '저장 중…' : `선택 저장 (${selectedIds.size}건)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
