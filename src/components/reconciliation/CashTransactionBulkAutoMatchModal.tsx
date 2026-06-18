'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { sourceTableLabelKey } from '@/lib/expense-ledger-match-display'
import {
  applyCashTransactionAutoMatchProposals,
  pickDefaultCashAutoMatchSelections,
  prepareCashTransactionAutoMatchProposals,
  type CashAutoMatchInputRow,
  type CashAutoMatchProposal,
} from '@/lib/cash-transaction-auto-match'
import {
  applyExpenseStatementAutoMatchProposals,
  pickDefaultExpenseAutoMatchSelections,
  prepareExpenseStatementAutoMatchProposals,
  type ExpenseAutoMatchInputRow,
  type ExpenseStatementAutoMatchProposal,
} from '@/lib/expense-statement-auto-match'
import type { ExpenseReconSourceTable } from '@/lib/expense-reconciliation-similar-lines'

const PREVIEW_PAGE_SIZE = 25
const AMOUNT_EQUAL_EPS = 0.02

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  cashTargets: CashAutoMatchInputRow[]
  ledgerTargets: ExpenseAutoMatchInputRow[]
  onApplied: () => void
}

export default function CashTransactionBulkAutoMatchModal({
  open,
  onOpenChange,
  cashTargets,
  ledgerTargets,
  onApplied,
}: Props) {
  const t = useTranslations('expenses.statementRecon.cashBulkAutoMatch')
  const tRecon = useTranslations('expenses.statementRecon')
  const { user } = useAuth()
  const [preparing, setPreparing] = useState(false)
  const [applying, setApplying] = useState(false)
  const [cashProposals, setCashProposals] = useState<CashAutoMatchProposal[]>([])
  const [ledgerProposals, setLedgerProposals] = useState<ExpenseStatementAutoMatchProposal[]>([])
  const [hint, setHint] = useState<string | null>(null)
  const [selectedCashIds, setSelectedCashIds] = useState<Set<string>>(() => new Set())
  const [cashCandidatePick, setCashCandidatePick] = useState<Record<string, string>>({})
  const [selectedLedgerIds, setSelectedLedgerIds] = useState<Set<string>>(() => new Set())
  const [ledgerCandidatePick, setLedgerCandidatePick] = useState<Record<string, string>>({})
  const [previewPage, setPreviewPage] = useState(1)
  const selectAllRef = useRef<HTMLInputElement>(null)

  const ledgerById = useMemo(() => new Map(ledgerTargets.map((e) => [e.id, e])), [ledgerTargets])

  const ledgerSourceLabel = useCallback(
    (expenseId: string) => {
      const table = ledgerById.get(expenseId)?.sourceTable ?? 'reservation_expenses'
      return tRecon(`sourceTypes.${sourceTableLabelKey(table)}`)
    },
    [ledgerById, tRecon]
  )

  const prepare = useCallback(async () => {
    const hasCash = cashTargets.length > 0
    const hasLedger = ledgerTargets.length > 0
    if (!hasCash && !hasLedger) {
      setHint(t('noTargets'))
      setCashProposals([])
      setLedgerProposals([])
      return
    }
    setPreparing(true)
    setHint(null)
    try {
      const [cashPack, ledgerPack] = await Promise.all([
        hasCash
          ? prepareCashTransactionAutoMatchProposals(supabase, cashTargets)
          : Promise.resolve({
              proposals: [] as CashAutoMatchProposal[],
              expensePoolSize: 0,
              paymentPoolSize: 0,
              skippedAlreadyMatched: 0,
            }),
        hasLedger
          ? prepareExpenseStatementAutoMatchProposals(supabase, ledgerTargets)
          : Promise.resolve({
              proposals: [] as ExpenseStatementAutoMatchProposal[],
              poolSize: 0,
              statementPoolSize: 0,
              cashPoolSize: 0,
              skippedNoDate: 0,
            }),
      ])

      if (cashPack.proposals.length === 0 && ledgerPack.proposals.length === 0) {
        setCashProposals([])
        setLedgerProposals([])
        setSelectedCashIds(new Set())
        setSelectedLedgerIds(new Set())
        setCashCandidatePick({})
        setLedgerCandidatePick({})
        setHint(
          t('noCandidates', {
            cashTargetCount: cashTargets.length,
            ledgerTargetCount: ledgerTargets.length,
            expensePoolSize: cashPack.expensePoolSize,
            paymentPoolSize: cashPack.paymentPoolSize,
            statementPoolSize: ledgerPack.statementPoolSize,
          })
        )
        return
      }

      const cashPick = pickDefaultCashAutoMatchSelections(cashPack.proposals)
      const ledgerPick = pickDefaultExpenseAutoMatchSelections(ledgerPack.proposals)

      setCashProposals(cashPack.proposals)
      setLedgerProposals(ledgerPack.proposals)
      setSelectedCashIds(cashPick.selectedCashIds)
      setCashCandidatePick(cashPick.candidateKeyByCashId)
      setSelectedLedgerIds(ledgerPick.selectedExpenseIds)
      setLedgerCandidatePick(ledgerPick.candidateKeyByExpenseId)
      setPreviewPage(1)
      setHint(
        t('readyHint', {
          cashProposalCount: cashPack.proposals.length,
          cashTargetCount: cashTargets.length,
          ledgerProposalCount: ledgerPack.proposals.length,
          ledgerTargetCount: ledgerTargets.length,
          expensePoolSize: cashPack.expensePoolSize,
          paymentPoolSize: cashPack.paymentPoolSize,
          statementPoolSize: ledgerPack.statementPoolSize,
          skippedCashMatched: cashPack.skippedAlreadyMatched,
        })
      )
    } catch (e) {
      setHint(e instanceof Error ? e.message : t('prepareError'))
      setCashProposals([])
      setLedgerProposals([])
    } finally {
      setPreparing(false)
    }
  }, [cashTargets, ledgerTargets, t])

  useEffect(() => {
    if (!open) return
    void prepare()
  }, [open, prepare])

  type PreviewRow =
    | { kind: 'cash'; proposal: CashAutoMatchProposal }
    | { kind: 'ledger'; proposal: ExpenseStatementAutoMatchProposal }

  const previewRows: PreviewRow[] = useMemo(() => {
    const rows: PreviewRow[] = [
      ...cashProposals.map((p) => ({ kind: 'cash' as const, proposal: p })),
      ...ledgerProposals.map((p) => ({ kind: 'ledger' as const, proposal: p })),
    ]
    return rows
  }, [cashProposals, ledgerProposals])

  const pageCount = useMemo(
    () => Math.max(1, Math.ceil(previewRows.length / PREVIEW_PAGE_SIZE)),
    [previewRows.length]
  )
  const safePage = Math.min(Math.max(1, previewPage), pageCount)
  const pagedRows = useMemo(() => {
    const start = (safePage - 1) * PREVIEW_PAGE_SIZE
    return previewRows.slice(start, start + PREVIEW_PAGE_SIZE)
  }, [previewRows, safePage])

  const rowKey = (row: PreviewRow) =>
    row.kind === 'cash' ? `cash:${row.proposal.cash_id}` : `ledger:${row.proposal.expense_id}`

  const isRowSelected = (row: PreviewRow) =>
    row.kind === 'cash'
      ? selectedCashIds.has(row.proposal.cash_id)
      : selectedLedgerIds.has(row.proposal.expense_id)

  const toggleRow = (row: PreviewRow, checked: boolean) => {
    if (row.kind === 'cash') {
      setSelectedCashIds((prev) => {
        const next = new Set(prev)
        if (checked) next.add(row.proposal.cash_id)
        else next.delete(row.proposal.cash_id)
        return next
      })
    } else {
      setSelectedLedgerIds((prev) => {
        const next = new Set(prev)
        if (checked) next.add(row.proposal.expense_id)
        else next.delete(row.proposal.expense_id)
        return next
      })
    }
  }

  const pagedSelectable = useMemo(
    () => pagedRows.filter((r) => r.proposal.candidates.length > 0),
    [pagedRows]
  )
  const pageAllSelected =
    pagedSelectable.length > 0 && pagedSelectable.every((r) => isRowSelected(r))

  useEffect(() => {
    const el = selectAllRef.current
    if (!el) return
    const total = pagedSelectable.length
    const n = pagedSelectable.filter((r) => isRowSelected(r)).length
    el.indeterminate = n > 0 && n < total
  }, [pagedSelectable, selectedCashIds, selectedLedgerIds])

  const selectedCount =
    cashProposals.filter((p) => selectedCashIds.has(p.cash_id)).length +
    ledgerProposals.filter((p) => selectedLedgerIds.has(p.expense_id)).length

  const apply = async () => {
    const email = user?.email?.trim()
    if (!email) {
      setHint(t('needLogin'))
      return
    }
    if (selectedCount === 0) {
      setHint(t('needSelection'))
      return
    }
    setApplying(true)
    setHint(null)
    try {
      const cashItems = cashProposals
        .filter((p) => selectedCashIds.has(p.cash_id))
        .map((p) => {
          const key = cashCandidatePick[p.cash_id] ?? p.candidates[0]?.key ?? ''
          const candidate = p.candidates.find((c) => c.key === key) ?? p.candidates[0]
          return { cash_id: p.cash_id, candidate: candidate!, cash_amount: p.amount }
        })
        .filter((x) => x.candidate)

      const ledgerItems = ledgerProposals
        .filter((p) => selectedLedgerIds.has(p.expense_id))
        .map((p) => {
          const key = ledgerCandidatePick[p.expense_id] ?? p.candidates[0]?.key ?? ''
          const candidate = p.candidates.find((c) => c.key === key) ?? p.candidates[0]
          const exp = ledgerById.get(p.expense_id)
          return {
            expense_id: p.expense_id,
            candidate: candidate!,
            ledger_amount: p.amount,
            sourceTable: (exp?.sourceTable ?? 'reservation_expenses') as ExpenseReconSourceTable,
          }
        })
        .filter((x) => x.candidate)

      const [cashResult, ledgerResult] = await Promise.all([
        cashItems.length > 0
          ? applyCashTransactionAutoMatchProposals(supabase, { actorEmail: email, items: cashItems })
          : Promise.resolve({ applied: 0, skippedConflict: 0, skippedInvalid: 0 }),
        ledgerItems.length > 0
          ? applyExpenseStatementAutoMatchProposals(supabase, {
              actorEmail: email,
              sourceTable: 'reservation_expenses',
              items: ledgerItems,
            })
          : Promise.resolve({ applied: 0, skippedConflict: 0, skippedInvalid: 0 }),
      ])

      const applied = cashResult.applied + ledgerResult.applied
      setHint(
        t('applyDone', {
          applied,
          skippedConflict: cashResult.skippedConflict + ledgerResult.skippedConflict,
          skippedInvalid: cashResult.skippedInvalid + ledgerResult.skippedInvalid,
        })
      )
      onApplied()
      if (applied > 0) onOpenChange(false)
    } catch (e) {
      setHint(e instanceof Error ? e.message : t('applyError'))
    } finally {
      setApplying(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && (applying || preparing)) return
        onOpenChange(o)
      }}
    >
      <DialogContent
        className="max-w-4xl max-h-[90vh] flex flex-col gap-0 p-0"
        onEscapeKeyDown={(e) => {
          if (applying || preparing) e.preventDefault()
        }}
        onPointerDownOutside={(e) => {
          if (applying || preparing) e.preventDefault()
        }}
      >
        <DialogHeader className="px-4 pt-4 pb-2 shrink-0">
          <DialogTitle>{t('title')}</DialogTitle>
          <p className="text-sm text-muted-foreground leading-snug">{t('description')}</p>
        </DialogHeader>

        <div className="px-4 pb-2 text-xs text-slate-700 leading-relaxed shrink-0">
          {preparing ? (
            <span>{t('preparing')}</span>
          ) : hint ? (
            <span>{hint}</span>
          ) : (
            <span>{t('ruleLine')}</span>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-auto border-y border-slate-200">
          {previewRows.length > 0 ? (
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
                        for (const row of pagedSelectable) toggleRow(row, checked)
                      }}
                      aria-label={t('selectPage')}
                    />
                  </th>
                  <th className="px-2 py-2">{t('colSource')}</th>
                  <th className="px-2 py-2">{t('colCandidate')}</th>
                  <th className="px-2 py-2 w-14">{t('colScore')}</th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((row) => {
                  if (row.kind === 'cash') {
                    const p = row.proposal
                    const pickKey = cashCandidatePick[p.cash_id] ?? p.candidates[0]?.key ?? ''
                    const picked = p.candidates.find((c) => c.key === pickKey) ?? p.candidates[0]
                    return (
                      <tr key={rowKey(row)} className="border-b border-slate-100 align-top hover:bg-slate-50/80">
                        <td className="px-2 py-2">
                          <input
                            type="checkbox"
                            className="rounded"
                            disabled={applying || preparing || p.candidates.length === 0}
                            checked={selectedCashIds.has(p.cash_id)}
                            onChange={(e) => toggleRow(row, e.target.checked)}
                          />
                        </td>
                        <td className="px-2 py-2 min-w-[10rem]">
                          <div className="text-[10px] font-medium text-sky-800 mb-0.5">
                            {tRecon('sourceTypes.cashTransactions')} ·{' '}
                            {p.direction === 'inflow' ? tRecon('dirIn') : tRecon('dirOut')}
                          </div>
                          <div className="font-medium text-slate-900 tabular-nums">
                            {p.transaction_date} · ${p.amount.toFixed(2)}
                          </div>
                          <div className="text-slate-600 truncate max-w-[14rem]" title={p.description}>
                            {p.description}
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
                                setCashCandidatePick((prev) => ({ ...prev, [p.cash_id]: e.target.value }))
                              }
                            >
                              {p.candidates.map((c) => (
                                <option key={c.key} value={c.key}>
                                  {c.target_kind === 'expense'
                                    ? `${tRecon(`sourceTypes.${sourceTableLabelKey(c.target_table)}`)} · ${c.submit_date} · $${c.amount.toFixed(2)} · ${c.paid_for || c.paid_to || c.label}`
                                    : `${tRecon('sourceTypes.paymentRecords')} · ${c.submit_date} · $${c.amount.toFixed(2)} · ${c.label}`}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td className="px-2 py-2 tabular-nums text-slate-700">{picked?.score?.toFixed(0) ?? '—'}</td>
                      </tr>
                    )
                  }

                  const p = row.proposal
                  const pickKey = ledgerCandidatePick[p.expense_id] ?? p.candidates[0]?.key ?? ''
                  const picked = p.candidates.find((c) => c.key === pickKey) ?? p.candidates[0]
                  return (
                    <tr key={rowKey(row)} className="border-b border-slate-100 align-top hover:bg-slate-50/80">
                      <td className="px-2 py-2">
                        <input
                          type="checkbox"
                          className="rounded"
                          disabled={applying || preparing || p.candidates.length === 0}
                          checked={selectedLedgerIds.has(p.expense_id)}
                          onChange={(e) => toggleRow(row, e.target.checked)}
                        />
                      </td>
                      <td className="px-2 py-2 min-w-[10rem]">
                        <div className="text-[10px] font-medium text-indigo-700 mb-0.5">
                          {ledgerSourceLabel(p.expense_id)}
                        </div>
                        <div className="font-medium text-slate-900 tabular-nums">
                          {p.submit_on} · ${p.amount.toFixed(2)}
                        </div>
                        <div className="text-slate-600 truncate max-w-[14rem]" title={p.paid_for}>
                          {p.paid_for || '—'}
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
                              setLedgerCandidatePick((prev) => ({
                                ...prev,
                                [p.expense_id]: e.target.value,
                              }))
                            }
                          >
                            {p.candidates.map((c) => (
                              <option key={c.key} value={c.key}>
                                {c.label}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="px-2 py-2 tabular-nums text-slate-700">{picked?.score?.toFixed(0) ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <p className="p-4 text-sm text-muted-foreground">{preparing ? t('preparing') : t('emptyPreview')}</p>
          )}
        </div>

        {previewRows.length > PREVIEW_PAGE_SIZE ? (
          <div className="px-4 py-2 flex items-center justify-between text-xs shrink-0">
            <span>{t('pageInfo', { page: safePage, pageCount, selected: selectedCount, total: previewRows.length })}</span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={safePage <= 1 || preparing || applying}
                onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
              >
                {t('prevPage')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={safePage >= pageCount || preparing || applying}
                onClick={() => setPreviewPage((p) => Math.min(pageCount, p + 1))}
              >
                {t('nextPage')}
              </Button>
            </div>
          </div>
        ) : null}

        <DialogFooter className="px-4 py-3 shrink-0 gap-2">
          <Button type="button" variant="outline" disabled={applying || preparing} onClick={() => onOpenChange(false)}>
            {t('close')}
          </Button>
          <Button type="button" variant="outline" disabled={applying || preparing} onClick={() => void prepare()}>
            {t('refresh')}
          </Button>
          <Button type="button" disabled={applying || preparing || selectedCount === 0} onClick={() => void apply()}>
            {applying ? t('applying') : t('apply', { count: selectedCount })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { AMOUNT_EQUAL_EPS }
