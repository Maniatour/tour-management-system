'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import {
  applyExpenseStatementAutoMatchProposals,
  EXPENSE_STATEMENT_AUTO_MATCH_DAY_WINDOW,
  EXPENSE_STATEMENT_AGGREGATE_MAX_DAY_SPAN,
  pickDefaultExpenseAutoMatchSelections,
  prepareExpenseStatementAutoMatchProposals,
  type ExpenseAutoMatchInputRow,
  type ExpenseStatementAutoMatchProposal,
} from '@/lib/expense-statement-auto-match'
import type { ExpenseReconSourceTable } from '@/lib/expense-reconciliation-similar-lines'

const PREVIEW_PAGE_SIZE = 25

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  expenses: ExpenseAutoMatchInputRow[]
  reconciledExpenseIds: Set<string>
  sourceTable?: ExpenseReconSourceTable
  /** 기본 번역 대신 표시할 제목·설명(통합 PNL 등) */
  title?: string
  description?: string
  /** 다른 Dialog(z≥1200) 위에 열 때 — 오버레이·본문 z-[1300] */
  nestedElevated?: boolean
  onApplied: () => void
}

export default function ExpenseStatementBulkAutoMatchModal({
  open,
  onOpenChange,
  expenses,
  reconciledExpenseIds,
  sourceTable = 'reservation_expenses',
  title: titleProp,
  description: descriptionProp,
  nestedElevated = false,
  onApplied,
}: Props) {
  const t = useTranslations('expenses.statementRecon.bulkAutoMatch')
  const { user } = useAuth()
  const [preparing, setPreparing] = useState(false)
  const [applying, setApplying] = useState(false)
  const [proposals, setProposals] = useState<ExpenseStatementAutoMatchProposal[]>([])
  const [hint, setHint] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [candidatePick, setCandidatePick] = useState<Record<string, string>>({})
  const [previewPage, setPreviewPage] = useState(1)
  const selectAllRef = useRef<HTMLInputElement>(null)
  const expenseById = useMemo(() => new Map(expenses.map((e) => [e.id, e])), [expenses])

  const unmatchedTargets = useMemo(
    () =>
      expenses.filter(
        (e) =>
          e.id &&
          !reconciledExpenseIds.has(e.id) &&
          e.submit_on &&
          e.submit_on.length >= 10 &&
          Math.abs(Number(e.amount ?? 0)) > AMOUNT_EQUAL_EPS
      ),
    [expenses, reconciledExpenseIds]
  )

  const prepare = useCallback(async () => {
    if (unmatchedTargets.length === 0) {
      setHint(t('noTargets'))
      setProposals([])
      return
    }
    setPreparing(true)
    setHint(null)
    try {
      const { proposals: next, poolSize, skippedNoDate } = await prepareExpenseStatementAutoMatchProposals(
        supabase,
        unmatchedTargets
      )
      if (next.length === 0) {
        setProposals([])
        setSelectedIds(new Set())
        setCandidatePick({})
        setHint(
          t('noCandidates', {
            expenseCount: unmatchedTargets.length,
            poolSize,
            dayWindow: EXPENSE_STATEMENT_AUTO_MATCH_DAY_WINDOW,
          })
        )
        return
      }
      const { selectedExpenseIds, candidateKeyByExpenseId } = pickDefaultExpenseAutoMatchSelections(next)
      setProposals(next)
      setSelectedIds(selectedExpenseIds)
      setCandidatePick(candidateKeyByExpenseId)
      setPreviewPage(1)
      const skipped = unmatchedTargets.length - next.length - skippedNoDate
      setHint(
        t('readyHint', {
          proposalCount: next.length,
          targetCount: unmatchedTargets.length,
          poolSize,
          dayWindow: EXPENSE_STATEMENT_AUTO_MATCH_DAY_WINDOW,
          aggregateSpan: EXPENSE_STATEMENT_AGGREGATE_MAX_DAY_SPAN,
          skipped: Math.max(0, skipped),
        })
      )
    } catch (e) {
      setHint(e instanceof Error ? e.message : t('prepareError'))
      setProposals([])
    } finally {
      setPreparing(false)
    }
  }, [unmatchedTargets, t])

  useEffect(() => {
    if (!open) return
    void prepare()
  }, [open, prepare])

  const pageCount = useMemo(
    () => Math.max(1, Math.ceil(proposals.length / PREVIEW_PAGE_SIZE)),
    [proposals.length]
  )
  const safePage = Math.min(Math.max(1, previewPage), pageCount)
  const pagedProposals = useMemo(() => {
    const start = (safePage - 1) * PREVIEW_PAGE_SIZE
    return proposals.slice(start, start + PREVIEW_PAGE_SIZE)
  }, [proposals, safePage])

  const pagedSelectable = useMemo(
    () => pagedProposals.filter((p) => p.candidates.length > 0),
    [pagedProposals]
  )
  const pageAllSelected =
    pagedSelectable.length > 0 && pagedSelectable.every((p) => selectedIds.has(p.expense_id))

  useEffect(() => {
    const el = selectAllRef.current
    if (!el) return
    const total = pagedSelectable.length
    const n = pagedSelectable.filter((p) => selectedIds.has(p.expense_id)).length
    el.indeterminate = n > 0 && n < total
  }, [pagedSelectable, selectedIds])

  const apply = async () => {
    const email = user?.email?.trim()
    if (!email) {
      setHint(t('needLogin'))
      return
    }
    const toApply = proposals.filter((p) => selectedIds.has(p.expense_id))
    if (toApply.length === 0) {
      setHint(t('needSelection'))
      return
    }
    setApplying(true)
    setHint(null)
    try {
      const items = toApply.map((p) => {
        const key = candidatePick[p.expense_id] ?? p.candidates[0]?.key ?? ''
        const candidate = p.candidates.find((c) => c.key === key) ?? p.candidates[0]
        const exp = expenseById.get(p.expense_id)
        return {
          expense_id: p.expense_id,
          candidate: candidate!,
          ledger_amount: p.amount,
          sourceTable: exp?.sourceTable ?? sourceTable,
        }
      })
      const result = await applyExpenseStatementAutoMatchProposals(supabase, {
        actorEmail: email,
        sourceTable,
        items: items.filter((x) => x.candidate),
      })
      setHint(
        t('applyDone', {
          applied: result.applied,
          skippedConflict: result.skippedConflict,
          skippedInvalid: result.skippedInvalid,
        })
      )
      onApplied()
      if (result.applied > 0) {
        onOpenChange(false)
      }
    } catch (e) {
      setHint(e instanceof Error ? e.message : t('applyError'))
    } finally {
      setApplying(false)
    }
  }

  const selectedCount = proposals.filter((p) => selectedIds.has(p.expense_id)).length

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && (applying || preparing)) return
        onOpenChange(o)
      }}
    >
      <DialogContent
        {...(nestedElevated ? { overlayClassName: 'z-[1300]' } : {})}
        className={`max-w-4xl max-h-[90vh] flex flex-col gap-0 p-0${nestedElevated ? ' z-[1300]' : ''}`}
        onEscapeKeyDown={(e) => {
          if (applying || preparing) e.preventDefault()
        }}
        onPointerDownOutside={(e) => {
          if (applying || preparing) e.preventDefault()
        }}
      >
        <DialogHeader className="px-4 pt-4 pb-2 shrink-0">
          <DialogTitle>{titleProp ?? t('title')}</DialogTitle>
          <p className="text-sm text-muted-foreground leading-snug">{descriptionProp ?? t('description')}</p>
        </DialogHeader>

        <div className="px-4 pb-2 text-xs text-slate-700 leading-relaxed shrink-0">
          {preparing ? (
            <span>{t('preparing')}</span>
          ) : hint ? (
            <span>{hint}</span>
          ) : (
            <span>
              {t('ruleLine', {
                dayWindow: EXPENSE_STATEMENT_AUTO_MATCH_DAY_WINDOW,
                aggregateSpan: EXPENSE_STATEMENT_AGGREGATE_MAX_DAY_SPAN,
              })}
            </span>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-auto border-y border-slate-200">
          {proposals.length > 0 ? (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-50 z-10">
                <tr className="text-left text-slate-600 border-b">
                  <th className="px-2 py-2 w-8">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      className="rounded"
                      disabled={applying || preparing || pagedSelectable.length === 0}
                      checked={pageAllSelected}
                      onChange={(e) => {
                        const checked = e.target.checked
                        setSelectedIds((prev) => {
                          const next = new Set(prev)
                          for (const p of pagedSelectable) {
                            if (checked) next.add(p.expense_id)
                            else next.delete(p.expense_id)
                          }
                          return next
                        })
                      }}
                      aria-label={t('selectPage')}
                    />
                  </th>
                  <th className="px-2 py-2">{t('colExpense')}</th>
                  <th className="px-2 py-2">{t('colCandidate')}</th>
                  <th className="px-2 py-2 w-14">{t('colScore')}</th>
                </tr>
              </thead>
              <tbody>
                {pagedProposals.map((p) => {
                  const pickKey = candidatePick[p.expense_id] ?? p.candidates[0]?.key ?? ''
                  const picked = p.candidates.find((c) => c.key === pickKey) ?? p.candidates[0]
                  return (
                    <tr key={p.expense_id} className="border-b border-slate-100 align-top hover:bg-slate-50/80">
                      <td className="px-2 py-2">
                        <input
                          type="checkbox"
                          className="rounded"
                          disabled={applying || preparing || p.candidates.length === 0}
                          checked={selectedIds.has(p.expense_id)}
                          onChange={(e) => {
                            setSelectedIds((prev) => {
                              const next = new Set(prev)
                              if (e.target.checked) next.add(p.expense_id)
                              else next.delete(p.expense_id)
                              return next
                            })
                          }}
                        />
                      </td>
                      <td className="px-2 py-2 min-w-[10rem]">
                        <div className="font-medium text-slate-900 tabular-nums">
                          {p.submit_on} · ${p.amount.toFixed(2)}
                        </div>
                        <div className="text-slate-600 truncate max-w-[14rem]" title={p.paid_for}>
                          {p.paid_for || '—'}
                        </div>
                        <div className="text-slate-500 truncate max-w-[14rem]" title={p.paid_to}>
                          {p.paid_to || '—'}
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        {p.candidates.length === 0 ? (
                          <span className="text-muted-foreground">{t('noCandidateRow')}</span>
                        ) : (
                          <select
                            className="w-full max-w-md text-xs border border-slate-200 rounded px-1.5 py-1 bg-white"
                            disabled={applying || preparing}
                            value={pickKey}
                            onChange={(e) =>
                              setCandidatePick((prev) => ({ ...prev, [p.expense_id]: e.target.value }))
                            }
                          >
                            {p.candidates.map((c) => (
                              <option key={c.key} value={c.key}>
                                {c.kind === 'aggregate' ? `〔합산〕 ` : ''}
                                {c.label}
                              </option>
                            ))}
                          </select>
                        )}
                        {picked && picked.kind === 'aggregate' ? (
                          <ul className="mt-1 text-[10px] text-slate-500 list-disc pl-4 space-y-0.5">
                            {picked.lines.map((l) => (
                              <li key={l.id}>
                                {l.posted_date} ${Math.abs(l.matchable_amount).toFixed(2)} — {l.description}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </td>
                      <td className="px-2 py-2 tabular-nums text-slate-700">{picked?.score ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            !preparing && (
              <p className="p-4 text-sm text-muted-foreground text-center">{t('emptyPreview')}</p>
            )
          )}
        </div>

        {proposals.length > PREVIEW_PAGE_SIZE ? (
          <div className="px-4 py-2 flex items-center justify-between text-xs text-slate-600 shrink-0">
            <span>
              {t('pageInfo', { page: safePage, pageCount, selected: selectedCount, total: proposals.length })}
            </span>
            <div className="flex gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={safePage <= 1 || applying || preparing}
                onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
              >
                {t('prevPage')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={safePage >= pageCount || applying || preparing}
                onClick={() => setPreviewPage((p) => Math.min(pageCount, p + 1))}
              >
                {t('nextPage')}
              </Button>
            </div>
          </div>
        ) : null}

        <DialogFooter className="px-4 py-3 shrink-0 gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={applying || preparing}
            onClick={() => onOpenChange(false)}
          >
            {t('close')}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={applying || preparing}
            onClick={() => void prepare()}
          >
            {t('refresh')}
          </Button>
          <Button
            type="button"
            disabled={applying || preparing || selectedCount === 0}
            onClick={() => void apply()}
          >
            {applying ? t('applying') : t('apply', { count: selectedCount })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const AMOUNT_EQUAL_EPS = 0.02
