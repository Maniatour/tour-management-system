'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { usePaymentMethodOptions } from '@/hooks/usePaymentMethodOptions'
import type { ExpenseStatementReconContext, SimilarStatementLineRow, SimilarStatementLinesMatchMode } from '@/lib/expense-reconciliation-similar-lines'
import {
  expenseReconciliationAmountTolerance,
  fetchSimilarStatementLinesForExpenseRow,
  replaceExpenseReconciliationMatch,
  searchStatementLinesAcrossImports,
  sumMatchedAmountAllocatedToSource
} from '@/lib/expense-reconciliation-similar-lines'

function dedupeStatementLineIdsPreserveOrder(ids: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of ids) {
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

function sourceTableLabelKey(
  table: string
): 'paymentRecords' | 'reservation' | 'company' | 'tour' | 'ticketBookings' | 'tourHotelBookings' | 'unknown' {
  switch (table) {
    case 'payment_records':
      return 'paymentRecords'
    case 'reservation_expenses':
      return 'reservation'
    case 'company_expenses':
      return 'company'
    case 'tour_expenses':
      return 'tour'
    case 'ticket_bookings':
      return 'ticketBookings'
    case 'tour_hotel_bookings':
      return 'tourHotelBookings'
    default:
      return 'unknown'
  }
}

type SourceSummaryInfo = {
  paymentMethod: string | null
  primaryDetail: string | null
  secondaryDetail: string | null
  /** 투어 호텔 부킹 등 — YYYY-MM-DD 표시용 */
  checkInDate?: string | null
  checkOutDate?: string | null
}

function formatYmdForDisplay(raw: string | null | undefined): string | null {
  const s = raw == null ? '' : String(raw).trim()
  if (!s) return null
  return s.length >= 10 ? s.slice(0, 10) : s
}

async function fetchSourceSummaryInfo(context: ExpenseStatementReconContext): Promise<SourceSummaryInfo | null> {
  const base = { paymentMethod: null, primaryDetail: null, secondaryDetail: null } as SourceSummaryInfo
  switch (context.sourceTable) {
    case 'company_expenses': {
      const { data } = await supabase
        .from('company_expenses')
        .select('payment_method, paid_for, paid_to, description')
        .eq('id', context.sourceId)
        .maybeSingle()
      if (!data) return null
      return {
        paymentMethod: data.payment_method ?? null,
        primaryDetail: data.paid_for ?? data.description ?? null,
        secondaryDetail: data.paid_to ?? null
      }
    }
    case 'reservation_expenses': {
      const { data } = await supabase
        .from('reservation_expenses')
        .select('payment_method, paid_for, paid_to, note')
        .eq('id', context.sourceId)
        .maybeSingle()
      if (!data) return null
      return {
        paymentMethod: data.payment_method ?? null,
        primaryDetail: data.paid_for ?? data.note ?? null,
        secondaryDetail: data.paid_to ?? null
      }
    }
    case 'tour_expenses': {
      const { data } = await supabase
        .from('tour_expenses')
        .select('payment_method, paid_for, paid_to, note')
        .eq('id', context.sourceId)
        .maybeSingle()
      if (!data) return null
      return {
        paymentMethod: data.payment_method ?? null,
        primaryDetail: data.paid_for ?? data.note ?? null,
        secondaryDetail: data.paid_to ?? null
      }
    }
    case 'ticket_bookings': {
      const { data } = await supabase
        .from('ticket_bookings')
        .select('payment_method, category, company, note')
        .eq('id', context.sourceId)
        .maybeSingle()
      if (!data) return null
      return {
        paymentMethod: data.payment_method ?? null,
        primaryDetail: data.category ?? data.note ?? null,
        secondaryDetail: data.company ?? null
      }
    }
    case 'tour_hotel_bookings': {
      const { data } = await supabase
        .from('tour_hotel_bookings')
        .select('payment_method, hotel, reservation_name, city, check_in_date, check_out_date')
        .eq('id', context.sourceId)
        .maybeSingle()
      if (!data) return null
      return {
        paymentMethod: data.payment_method ?? null,
        primaryDetail: data.hotel ?? data.reservation_name ?? null,
        secondaryDetail: data.city ?? null,
        checkInDate: formatYmdForDisplay(data.check_in_date),
        checkOutDate: formatYmdForDisplay(data.check_out_date)
      }
    }
    case 'payment_records': {
      const { data } = await supabase
        .from('payment_records')
        .select('payment_method, note')
        .eq('id', context.sourceId)
        .maybeSingle()
      if (!data) return null
      return {
        paymentMethod: data.payment_method ?? null,
        primaryDetail: data.note ?? null,
        secondaryDetail: null
      }
    }
    default:
      return base
  }
}

export default function ExpenseStatementSimilarLinesModal({
  open,
  onOpenChange,
  context,
  onApplied
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  context: ExpenseStatementReconContext | null
  onApplied?: () => void
}) {
  const t = useTranslations('expenses.statementRecon')
  const { user } = useAuth()
  const {
    paymentMethodMap,
    paymentMethodFinancialAccountNameByPmId,
    paymentMethodFinancialAccountNameByMethodKey
  } = usePaymentMethodOptions()
  const [rows, setRows] = useState<SimilarStatementLineRow[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  /** 선택 순서 유지(추가 연결 시 여러 줄을 순서대로 배정) */
  const [selectedIdsOrdered, setSelectedIdsOrdered] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [matchMode, setMatchMode] = useState<SimilarStatementLinesMatchMode>('dateProximity')
  const [rowSearch, setRowSearch] = useState('')
  const [searchResultRows, setSearchResultRows] = useState<SimilarStatementLineRow[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [sourceSummary, setSourceSummary] = useState<SourceSummaryInfo | null>(null)
  const [syncAmountToStatement, setSyncAmountToStatement] = useState(false)
  const [appendLink, setAppendLink] = useState(false)
  const [appendAmountStr, setAppendAmountStr] = useState('')
  const [sourceAllocatedSum, setSourceAllocatedSum] = useState<number | null>(null)
  const appendAmountUserEditedRef = useRef(false)
  const headerSelectAllRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    if (!context) return
    setLoading(true)
    setMessage(null)
    setSelectedIdsOrdered([])
    try {
      const list = await fetchSimilarStatementLinesForExpenseRow(supabase, {
        dateYmd: context.dateYmd,
        amount: context.amount,
        direction: context.direction,
        matchMode,
        limit: matchMode === 'amountOnly' ? 200 : 100
      })
      setRows(list)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t('loadError'))
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [context, t, matchMode])

  useEffect(() => {
    if (open && context) void load()
    if (!open) {
      setRows([])
      setSelectedIdsOrdered([])
      setMessage(null)
      setMatchMode('dateProximity')
      setRowSearch('')
      setSearchResultRows([])
      setSearchLoading(false)
      setSourceSummary(null)
      setSyncAmountToStatement(false)
      setAppendLink(false)
      setAppendAmountStr('')
      setSourceAllocatedSum(null)
      appendAmountUserEditedRef.current = false
    }
  }, [open, context, load])

  useEffect(() => {
    if (!open || !context) return
    let cancelled = false
    void fetchSourceSummaryInfo(context)
      .then((info) => {
        if (!cancelled) setSourceSummary(info)
      })
      .catch(() => {
        if (!cancelled) setSourceSummary(null)
      })
    return () => {
      cancelled = true
    }
  }, [open, context])

  useEffect(() => {
    if (!open || !context) {
      setSourceAllocatedSum(null)
      return
    }
    let cancelled = false
    void sumMatchedAmountAllocatedToSource(supabase, context.sourceTable, context.sourceId).then((n) => {
      if (!cancelled) setSourceAllocatedSum(n)
    })
    return () => {
      cancelled = true
    }
  }, [open, context])

  const searchQueryTrimmed = rowSearch.trim()
  const isSearchActive = searchQueryTrimmed.length > 0

  const displayRows = useMemo(() => {
    if (!isSearchActive) return rows
    return searchResultRows
  }, [rows, searchResultRows, isSearchActive])

  useEffect(() => {
    if (!open || !context) return
    if (!isSearchActive) {
      setSearchResultRows([])
      setSearchLoading(false)
      return
    }
    setSearchLoading(true)
    let cancelled = false
    const timer = setTimeout(() => {
      void searchStatementLinesAcrossImports(supabase, {
        query: searchQueryTrimmed,
        direction: context.direction,
        limit: 250
      })
        .then((list) => {
          if (!cancelled) {
            setSearchResultRows(list)
            setMessage(null)
          }
        })
        .catch((e) => {
          if (!cancelled) {
            setMessage(e instanceof Error ? e.message : t('loadError'))
            setSearchResultRows([])
          }
        })
        .finally(() => {
          if (!cancelled) setSearchLoading(false)
        })
    }, 320)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [rowSearch, open, context, t])

  useEffect(() => {
    setSelectedIdsOrdered((prev) => prev.filter((id) => displayRows.some((r) => r.id === id)))
  }, [displayRows])

  const toggleLineId = useCallback((id: string) => {
    setSelectedIdsOrdered((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }, [])

  const allVisibleSelected =
    displayRows.length > 0 && displayRows.every((r) => selectedIdsOrdered.includes(r.id))
  const someVisibleSelected = displayRows.some((r) => selectedIdsOrdered.includes(r.id))

  useEffect(() => {
    const el = headerSelectAllRef.current
    if (el) el.indeterminate = someVisibleSelected && !allVisibleSelected
  }, [someVisibleSelected, allVisibleSelected])

  const toggleAllVisible = useCallback(() => {
    if (allVisibleSelected) {
      setSelectedIdsOrdered((prev) => prev.filter((id) => !displayRows.some((r) => r.id === id)))
    } else {
      setSelectedIdsOrdered((prev) => {
        const next = [...prev]
        for (const r of displayRows) {
          if (!next.includes(r.id)) next.push(r.id)
        }
        return next
      })
    }
  }, [allVisibleSelected, displayRows])

  const primarySelectedId = selectedIdsOrdered[0] ?? null
  const selectedRow = useMemo(
    () => (primarySelectedId ? displayRows.find((r) => r.id === primarySelectedId) ?? null : null),
    [displayRows, primarySelectedId]
  )

  const ledgerTotalAbs = context ? Math.abs(context.amount) : 0
  const remainingOnLedger =
    sourceAllocatedSum == null ? null : Math.max(0, ledgerTotalAbs - sourceAllocatedSum)

  useEffect(() => {
    appendAmountUserEditedRef.current = false
  }, [context?.sourceId, appendLink, selectedIdsOrdered.join('|')])

  useEffect(() => {
    if (!open || !context || !appendLink || selectedIdsOrdered.length !== 1 || !selectedRow || appendAmountUserEditedRef.current)
      return
    if (remainingOnLedger == null) return
    const lineRoom = Math.max(0, Math.abs(selectedRow.amount) - selectedRow.allocated_sum)
    const sug = Math.min(remainingOnLedger, lineRoom)
    setAppendAmountStr(sug > 0 ? sug.toFixed(2) : '')
  }, [open, context, appendLink, selectedIdsOrdered.length, selectedRow, remainingOnLedger])

  const selectedAmountDiff = selectedRow ? Math.abs(Math.abs(selectedRow.amount) - Math.abs(context?.amount ?? 0)) : 0
  const syncTol = context ? expenseReconciliationAmountTolerance(Math.abs(context.amount)) : 0
  const canSyncAmount =
    !appendLink &&
    selectedIdsOrdered.length === 1 &&
    Boolean(context) &&
    context!.sourceTable !== 'payment_records' &&
    selectedRow != null &&
    selectedAmountDiff > 0.009 &&
    selectedAmountDiff <= syncTol

  const apply = async () => {
    if (!context || !user?.email) {
      setMessage(t('needLogin'))
      return
    }
    const ordered = dedupeStatementLineIdsPreserveOrder(selectedIdsOrdered)
    if (ordered.length === 0) {
      setMessage(t('needSelectLine'))
      return
    }
    if (!appendLink && ordered.length > 1) {
      setMessage(t('replaceSelectSingleOnly'))
      return
    }

    setSaving(true)
    setMessage(null)
    try {
      const ledgerCap = Math.abs(context.amount)
      const email = user.email

      if (!appendLink) {
        const row = displayRows.find((r) => r.id === ordered[0])
        if (!row) {
          setMessage(t('saveError'))
          return
        }
        const diff = Math.abs(Math.abs(row.amount) - ledgerCap)
        const stol = expenseReconciliationAmountTolerance(ledgerCap)
        const canSync =
          context.sourceTable !== 'payment_records' && diff > 0.009 && diff <= stol

        await replaceExpenseReconciliationMatch(supabase, {
          actorEmail: email,
          sourceTable: context.sourceTable,
          sourceId: context.sourceId,
          statementLineId: row.id,
          statementLineAmount: row.amount,
          matchedAmount: ledgerCap,
          linkMode: 'replace',
          ledgerCapAmount: ledgerCap,
          syncSourceAmountToStatement: canSync && syncAmountToStatement
        })
        onApplied?.()
        onOpenChange(false)
        return
      }

      if (ordered.length === 1) {
        const row = displayRows.find((r) => r.id === ordered[0])
        if (!row) {
          setMessage(t('saveError'))
          return
        }
        const parsed = Number(String(appendAmountStr).trim().replace(/,/g, ''))
        if (!Number.isFinite(parsed) || parsed <= 0) {
          setMessage(t('appendAmountInvalid'))
          return
        }
        const matchedAmount = Math.abs(parsed)
        await replaceExpenseReconciliationMatch(supabase, {
          actorEmail: email,
          sourceTable: context.sourceTable,
          sourceId: context.sourceId,
          statementLineId: row.id,
          statementLineAmount: row.amount,
          matchedAmount,
          linkMode: 'append',
          ledgerCapAmount: ledgerCap,
          syncSourceAmountToStatement: false
        })
        onApplied?.()
        onOpenChange(false)
        return
      }

      for (const lineId of ordered) {
        const row = displayRows.find((r) => r.id === lineId)
        if (!row) continue

        const allocated = await sumMatchedAmountAllocatedToSource(supabase, context.sourceTable, context.sourceId)
        const remaining = ledgerCap - allocated
        const capTol = Math.max(0.5, ledgerCap * 0.001)
        if (remaining <= capTol) break

        const lineAbs = Math.abs(row.amount)
        const lineRoom = Math.max(0, lineAbs - row.allocated_sum)
        const share = Math.min(remaining, lineRoom)
        if (share <= capTol) continue

        await replaceExpenseReconciliationMatch(supabase, {
          actorEmail: email,
          sourceTable: context.sourceTable,
          sourceId: context.sourceId,
          statementLineId: lineId,
          statementLineAmount: row.amount,
          matchedAmount: share,
          linkMode: 'append',
          ledgerCapAmount: ledgerCap,
          syncSourceAmountToStatement: false
        })
      }

      onApplied?.()
      onOpenChange(false)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t('saveError'))
    } finally {
      setSaving(false)
    }
  }

  const formatMatchLabel = (m: { source_table: string; source_id: string }) => {
    const k = sourceTableLabelKey(m.source_table)
    const typeName = t(`sourceTypes.${k}`)
    return `${typeName} · ${m.source_id.slice(0, 8)}…`
  }

  const tableName = context ? t(`sourceTypes.${sourceTableLabelKey(context.sourceTable)}`) : ''
  const dirLabel = context ? (context.direction === 'inflow' ? t('dirIn') : t('dirOut')) : ''

  const paymentMethodDisplay = useMemo(() => {
    const raw = sourceSummary?.paymentMethod
    if (raw == null || String(raw).trim() === '') return null
    const key = String(raw).trim()
    return paymentMethodMap[key] ?? key
  }, [sourceSummary?.paymentMethod, paymentMethodMap])

  const linkedFinancialAccountDisplay = useMemo(() => {
    const raw = sourceSummary?.paymentMethod
    if (raw == null || String(raw).trim() === '') return null
    const key = String(raw).trim()
    return (
      paymentMethodFinancialAccountNameByPmId[key] ?? paymentMethodFinancialAccountNameByMethodKey[key] ?? null
    )
  }, [
    sourceSummary?.paymentMethod,
    paymentMethodFinancialAccountNameByPmId,
    paymentMethodFinancialAccountNameByMethodKey
  ])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] w-full max-w-[min(96vw,72rem)] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('modalTitle')}</DialogTitle>
          <p className="text-sm text-muted-foreground pt-1">{t('modalHint')}</p>
          <p className="text-xs text-muted-foreground pt-0.5">{t('modalSplitHint')}</p>
          <p className="text-xs text-muted-foreground pt-0.5">{t('modalMultiLineHint')}</p>
        </DialogHeader>

        {context ? (
          <div className="space-y-1.5 border-b pb-2 mb-2">
            <p className="text-xs text-muted-foreground tabular-nums">
              {t('ledgerSummary', {
                table: tableName,
                date: context.dateYmd,
                amount: context.amount.toFixed(2),
                dir: dirLabel
              })}
            </p>
            {sourceSummary?.primaryDetail ? (
              <p className="text-[11px] text-muted-foreground leading-snug truncate" title={sourceSummary.primaryDetail}>
                {t('sourcePrimaryDetail')}: {sourceSummary.primaryDetail}
              </p>
            ) : null}
            {sourceSummary?.secondaryDetail ? (
              <p className="text-[11px] text-muted-foreground leading-snug truncate" title={sourceSummary.secondaryDetail}>
                {t('sourceSecondaryDetail')}: {sourceSummary.secondaryDetail}
              </p>
            ) : null}
            {sourceSummary?.checkInDate ? (
              <p className="text-[11px] text-muted-foreground leading-snug tabular-nums">
                {t('sourceHotelCheckIn')}: {sourceSummary.checkInDate}
              </p>
            ) : null}
            {sourceSummary?.checkOutDate ? (
              <p className="text-[11px] text-muted-foreground leading-snug tabular-nums">
                {t('sourceHotelCheckOut')}: {sourceSummary.checkOutDate}
              </p>
            ) : null}
            {paymentMethodDisplay ? (
              <p
                className="text-[11px] text-muted-foreground leading-snug truncate"
                title={
                  linkedFinancialAccountDisplay
                    ? `${paymentMethodDisplay} · ${linkedFinancialAccountDisplay}`
                    : paymentMethodDisplay
                }
              >
                {t('sourcePaymentMethod')}: {paymentMethodDisplay}
                <span className="text-muted-foreground/90">
                  {' '}
                  · {t('sourceLinkedFinancialAccount')}: {linkedFinancialAccountDisplay ?? t('noLinks')}
                </span>
              </p>
            ) : null}
            <p className="text-[11px] text-muted-foreground leading-snug">
              {matchMode === 'amountOnly' ? t('amountOnlyModeHint') : t('dateProximityModeHint')}
            </p>
            <p className="text-[11px] text-muted-foreground leading-snug">{t('searchGlobalHint')}</p>
            <label className="flex items-start gap-2 rounded-md border border-muted bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground leading-snug">
              <input
                type="checkbox"
                className="mt-0.5 accent-emerald-600"
                checked={appendLink}
                onChange={(e) => setAppendLink(e.target.checked)}
              />
              <span>{t('appendLinkCheckbox')}</span>
            </label>
            {appendLink ? (
              <div className="space-y-1.5 rounded-md border border-emerald-200/80 bg-emerald-50/50 px-3 py-2 text-[11px] text-muted-foreground">
                {remainingOnLedger != null && sourceAllocatedSum != null ? (
                  <p className="tabular-nums leading-snug">
                    {t('appendRemaining', {
                      allocated: sourceAllocatedSum.toFixed(2),
                      total: ledgerTotalAbs.toFixed(2),
                      remaining: remainingOnLedger.toFixed(2)
                    })}
                  </p>
                ) : (
                  <p>{t('loading')}</p>
                )}
                {selectedIdsOrdered.length > 1 ? (
                  <p className="text-emerald-950/90 leading-snug">{t('multiAppendHint')}</p>
                ) : (
                  <label className="flex flex-col gap-0.5 max-w-[14rem]">
                    <span className="text-foreground/90">{t('appendShareLabel')}</span>
                    <Input
                      type="text"
                      inputMode="decimal"
                      className="h-8 text-xs tabular-nums"
                      value={appendAmountStr}
                      onChange={(e) => {
                        appendAmountUserEditedRef.current = true
                        setAppendAmountStr(e.target.value)
                      }}
                    />
                  </label>
                )}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between mb-2">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={matchMode === 'dateProximity' ? 'default' : 'outline'}
              disabled={loading || !context}
              onClick={() => {
                setMatchMode('dateProximity')
              }}
            >
              {t('matchModeDateProximity')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={matchMode === 'amountOnly' ? 'default' : 'outline'}
              disabled={loading || !context}
              onClick={() => {
                setMatchMode('amountOnly')
              }}
            >
              {t('matchModeAmountOnly')}
            </Button>
          </div>
          <div className="flex-1 min-w-[10rem] max-w-md">
            <Input
              type="search"
              value={rowSearch}
              onChange={(e) => setRowSearch(e.target.value)}
              placeholder={t('searchRowsPlaceholder')}
              className="h-9 text-sm"
              disabled={!context}
            />
          </div>
        </div>
        {!loading && !isSearchActive && rows.length > 0 ? (
          <p className="text-[11px] text-muted-foreground mb-1.5 tabular-nums">
            {t('similarCandidatesCount', { count: rows.length })}
          </p>
        ) : null}
        {isSearchActive && !searchLoading ? (
          <p className="text-[11px] text-muted-foreground mb-1.5 tabular-nums">
            {t('searchResultsCount', { count: searchResultRows.length })}
          </p>
        ) : null}

        {message ? <div className="text-sm text-red-600 mb-2">{message}</div> : null}

        {selectedIdsOrdered.length > 0 ? (
          <p className="text-[11px] text-muted-foreground tabular-nums mb-1">
            {t('selectedLinesCount', { n: selectedIdsOrdered.length })}
          </p>
        ) : null}

        {canSyncAmount ? (
          <label className="mb-2 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={syncAmountToStatement}
              onChange={(e) => setSyncAmountToStatement(e.target.checked)}
            />
            <span>
              {t('syncAmountCheckbox', {
                ledger: (context?.amount ?? 0).toFixed(2),
                statement: Math.abs(selectedRow?.amount ?? 0).toFixed(2)
              })}
            </span>
          </label>
        ) : null}

        <div className="flex-1 min-h-0 overflow-auto rounded-md border">
          {loading || (isSearchActive && searchLoading) ? (
            <div className="p-6 text-center text-sm text-muted-foreground">{t('loading')}</div>
          ) : !isSearchActive && rows.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">{t('empty')}</div>
          ) : displayRows.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">{t('noSearchResults')}</div>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="bg-muted sticky top-0 z-[1]">
                <tr>
                  <th className="text-center p-2 font-medium w-11">
                    <input
                      ref={headerSelectAllRef}
                      type="checkbox"
                      className="accent-emerald-600"
                      checked={allVisibleSelected}
                      onChange={toggleAllVisible}
                      aria-label={t('selectAllVisible')}
                    />
                  </th>
                  <th className="text-left p-2 font-medium">{t('colAccount')}</th>
                  <th className="text-left p-2 font-medium">{t('colDate')}</th>
                  <th className="text-right p-2 font-medium">{t('colAmount')}</th>
                  <th className="text-right p-2 font-medium whitespace-nowrap">{t('colAllocatedSum')}</th>
                  <th className="text-left p-2 font-medium">{t('colDesc')}</th>
                  <th className="text-left p-2 font-medium">{t('colStatus')}</th>
                  <th className="text-left p-2 font-medium">{t('colLinked')}</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((r) => (
                  <tr
                    key={r.id}
                    className={`border-t cursor-pointer hover:bg-muted/50 ${
                      selectedIdsOrdered.includes(r.id) ? 'bg-emerald-50' : ''
                    }`}
                    onClick={() => toggleLineId(r.id)}
                  >
                    <td className="p-2 align-middle text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="accent-emerald-600"
                        checked={selectedIdsOrdered.includes(r.id)}
                        onChange={() => toggleLineId(r.id)}
                      />
                    </td>
                    <td className="p-2 max-w-[9rem] truncate align-middle" title={r.financial_account_name}>
                      {r.financial_account_name}
                    </td>
                    <td className="p-2 whitespace-nowrap align-middle">{r.posted_date}</td>
                    <td className="p-2 text-right tabular-nums align-middle">${r.amount.toFixed(2)}</td>
                    <td className="p-2 text-right tabular-nums text-xs text-muted-foreground align-middle whitespace-nowrap">
                      {r.existing_matches.length > 0 ? (
                        <>
                          ${r.allocated_sum.toFixed(2)} / ${Math.abs(r.amount).toFixed(2)}
                        </>
                      ) : (
                        t('noLinks')
                      )}
                    </td>
                    <td className="p-2 max-w-[14rem] truncate align-middle" title={r.description}>
                      {r.description}
                    </td>
                    <td className="p-2 whitespace-nowrap text-xs align-middle">
                      {r.matched_status === 'unmatched'
                        ? t('statusUnmatched')
                        : r.matched_status === 'partial'
                          ? t('statusPartial')
                          : t('statusMatched')}
                    </td>
                    <td className="p-2 text-xs text-muted-foreground max-w-[12rem] align-middle">
                      {r.existing_matches.length === 0
                        ? t('noLinks')
                        : r.existing_matches.map((m, i) => (
                            <div key={`${m.source_table}-${m.source_id}-${i}`} className="truncate">
                              {formatMatchLabel(m)}
                            </div>
                          ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('close')}
          </Button>
          <Button
            type="button"
            disabled={
              selectedIdsOrdered.length === 0 ||
              saving ||
              (appendLink && remainingOnLedger != null && remainingOnLedger < 0.01)
            }
            onClick={() => void apply()}
          >
            {saving
              ? t('saving')
              : appendLink && selectedIdsOrdered.length > 1
                ? t('connectAppendN', { n: dedupeStatementLineIdsPreserveOrder(selectedIdsOrdered).length })
                : appendLink
                  ? t('connectAppend')
                  : t('connect')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
