'use client'

import { useCallback, useEffect, useState } from 'react'
import { ExpenseStatementReconIcon } from '@/components/reconciliation/ExpenseStatementReconIcon'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import type { DateViewLedgerRow, TicketDateViewReconBundle } from '@/lib/ticketBookingDateViewRecon'
import {
  softDeleteDateViewLedgerRows,
  unlinkDateViewStatementLineSelections,
} from '@/lib/ticketBookingDateViewRecon'

function formatUsd(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '—'
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const SOURCE_LABEL_KO: Record<string, string> = {
  ticket_bookings: '티켓 부킹',
  company_expenses: '회사 지출',
  tour_expenses: '투어 지출',
}

const SOURCE_LABEL_EN: Record<string, string> = {
  ticket_bookings: 'Ticket booking',
  company_expenses: 'Company expense',
  tour_expenses: 'Tour expense',
}

function ledgerRowKey(row: DateViewLedgerRow): string {
  return `${row.sourceTable}:${row.sourceId}`
}

export function TicketBookingDateViewReconPanel({
  bundle,
  loading,
  locale,
  dayWindow,
  canDelete = false,
  onDataChanged,
  onOpenLedgerRow,
}: {
  bundle: TicketDateViewReconBundle | null | undefined
  loading?: boolean
  locale: string
  dayWindow: number
  /** 티켓 부킹 관리 soft-delete 권한 */
  canDelete?: boolean
  onDataChanged?: (dateYmd: string, opts?: { reloadBookings?: boolean }) => void | Promise<void>
  /** 행 클릭 — 티켓은 상세 모달, 회사·투어 지출은 명세 대조 모달 */
  onOpenLedgerRow?: (row: DateViewLedgerRow) => void
}) {
  const { user } = useAuth()
  const ko = locale.startsWith('ko')

  const [selectedLedgerKeys, setSelectedLedgerKeys] = useState<Set<string>>(new Set())
  const [selectedStmtLineIds, setSelectedStmtLineIds] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  useEffect(() => {
    setSelectedLedgerKeys(new Set())
    setSelectedStmtLineIds(new Set())
    setActionMessage(null)
  }, [bundle?.dateYmd])

  const sourceLabel = (t: string) => (ko ? SOURCE_LABEL_KO[t] : SOURCE_LABEL_EN[t]) ?? t

  const toggleLedger = useCallback((key: string, checked: boolean) => {
    setSelectedLedgerKeys((prev) => {
      const next = new Set(prev)
      if (checked) next.add(key)
      else next.delete(key)
      return next
    })
  }, [])

  const toggleStmt = useCallback((lineId: string, checked: boolean) => {
    setSelectedStmtLineIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(lineId)
      else next.delete(lineId)
      return next
    })
  }, [])

  const toggleAllLedger = useCallback(
    (checked: boolean) => {
      if (!bundle) return
      setSelectedLedgerKeys(
        checked ? new Set(bundle.ledgerRows.map((r) => ledgerRowKey(r))) : new Set()
      )
    },
    [bundle]
  )

  const toggleAllStmt = useCallback(
    (checked: boolean) => {
      if (!bundle) return
      setSelectedStmtLineIds(
        checked ? new Set(bundle.statementRows.map((r) => r.lineId)) : new Set()
      )
    },
    [bundle]
  )

  const runLedgerDelete = async () => {
    if (!bundle || !canDelete || selectedLedgerKeys.size === 0) return
    const rows = bundle.ledgerRows.filter((r) => selectedLedgerKeys.has(ledgerRowKey(r)))
    const msg = ko
      ? `선택한 지출 ${rows.length}건을 삭제(보관)합니다. 명세 연결도 해제됩니다.\n\n계속할까요?`
      : `Soft-delete ${rows.length} selected ledger row(s) and unlink statements.\n\nContinue?`
    if (!window.confirm(msg)) return

    setBusy(true)
    setActionMessage(null)
    try {
      const { deletedCount } = await softDeleteDateViewLedgerRows(
        supabase,
        rows.map((r) => ({ sourceTable: r.sourceTable, sourceId: r.sourceId })),
        user?.email ?? null
      )
      setSelectedLedgerKeys(new Set())
      setActionMessage(
        ko ? `${deletedCount}건 삭제했습니다.` : `Deleted ${deletedCount} row(s).`
      )
      await onDataChanged?.(bundle.dateYmd, { reloadBookings: true })
    } catch (e) {
      setActionMessage(e instanceof Error ? e.message : ko ? '삭제 실패' : 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  const runStmtUnlink = async () => {
    if (!bundle || !canDelete || selectedStmtLineIds.size === 0) return
    const n = selectedStmtLineIds.size
    const msg = ko
      ? `선택한 명세 ${n}건의 대조 연결만 해제합니다. (명세 CSV 줄은 유지)\n\n계속할까요?`
      : `Unlink reconciliation on ${n} selected statement line(s). (CSV lines kept)\n\nContinue?`
    if (!window.confirm(msg)) return

    setBusy(true)
    setActionMessage(null)
    try {
      const { unlinkedCount } = await unlinkDateViewStatementLineSelections(
        supabase,
        [...selectedStmtLineIds]
      )
      setSelectedStmtLineIds(new Set())
      setActionMessage(
        ko ? `연결 ${unlinkedCount}건 해제했습니다.` : `Unlinked ${unlinkedCount} match(es).`
      )
      await onDataChanged?.(bundle.dateYmd, { reloadBookings: false })
    } catch (e) {
      setActionMessage(e instanceof Error ? e.message : ko ? '해제 실패' : 'Unlink failed')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <p className="mt-2 text-[10px] text-slate-500 animate-pulse">
        {ko ? '앤텔롭 지출·명세 불러오는 중…' : 'Loading canyon expenses & statements…'}
      </p>
    )
  }

  if (!bundle) return null

  const hasLedger = bundle.ledgerRows.length > 0
  const hasStmt = bundle.statementRows.length > 0
  if (!hasLedger && !hasStmt) {
    return (
      <p className="mt-2 text-[10px] text-slate-500">
        {ko
          ? `체크인 ±${dayWindow}일 구간에 앤텔롭 관련 지출·은행 출금 명세가 없습니다. (명세 CSV 업로드·거래일 확인)`
          : `No canyon ledger or bank outflow lines within ±${dayWindow} days of check-in.`}
      </p>
    )
  }

  const tableCls = 'w-full text-[10px] border-collapse'
  const thCls = 'text-left font-semibold text-slate-600 px-1.5 py-0.5 border-b border-slate-200'
  const tdCls = 'px-1.5 py-0.5 align-top border-b border-slate-100 text-slate-800'

  const allLedgerSelected =
    hasLedger && bundle.ledgerRows.every((r) => selectedLedgerKeys.has(ledgerRowKey(r)))
  const allStmtSelected =
    hasStmt && bundle.statementRows.every((r) => selectedStmtLineIds.has(r.lineId))

  return (
    <div className="mt-2 space-y-2 rounded-md border border-violet-200/80 bg-violet-50/40 px-2 py-1.5">
      <div className="text-[10px] font-semibold text-violet-900">
        {ko ? '앤텔롭 지출 · 명세 대조' : 'Canyon expenses · statement check'}
        <span className="ml-1.5 font-normal text-violet-700">
          {ko ? `(명세 ±${dayWindow}일)` : `(statements ±${dayWindow}d)`}
        </span>
      </div>

      {actionMessage ? (
        <p className="text-[10px] text-violet-900 font-medium">{actionMessage}</p>
      ) : null}

      {hasLedger ? (
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            <div className="text-[10px] font-semibold text-slate-700">
              {ko ? '티켓 부킹 · 회사 지출 · 투어 지출' : 'Ticket · company · tour ledger'}
            </div>
            {canDelete ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="h-6 px-2 text-[10px]"
                disabled={busy || selectedLedgerKeys.size === 0}
                onClick={() => void runLedgerDelete()}
              >
                {ko
                  ? `선택 삭제 (${selectedLedgerKeys.size})`
                  : `Delete selected (${selectedLedgerKeys.size})`}
              </Button>
            ) : null}
          </div>
          <div className="overflow-x-auto">
            <table className={tableCls}>
              <thead>
                <tr>
                  {canDelete ? (
                    <th className={`${thCls} w-8 text-center`}>
                      <Checkbox
                        checked={allLedgerSelected}
                        onCheckedChange={(v) => toggleAllLedger(v === true)}
                        aria-label={ko ? '전체 선택' : 'Select all'}
                      />
                    </th>
                  ) : null}
                  <th className={thCls}>{ko ? '구분' : 'Type'}</th>
                  <th className={thCls}>{ko ? '벤더' : 'Vendor'}</th>
                  <th className={thCls}>{ko ? '날짜' : 'Date'}</th>
                  <th className={thCls}>{ko ? '내용' : 'Detail'}</th>
                  <th className={`${thCls} text-right`}>{ko ? '금액' : 'Amount'}</th>
                  <th className={`${thCls} text-center`}>{ko ? '명세' : 'Stmt'}</th>
                </tr>
              </thead>
              <tbody>
                {bundle.ledgerRows.map((row) => {
                  const key = ledgerRowKey(row)
                  const clickable = Boolean(onOpenLedgerRow)
                  return (
                    <tr
                      key={key}
                      className={`${selectedLedgerKeys.has(key) ? 'bg-violet-100/60' : ''} ${
                        clickable ? 'cursor-pointer hover:bg-violet-100/50' : ''
                      }`}
                      title={
                        clickable
                          ? ko
                            ? '클릭하여 상세 보기'
                            : 'Click to view details'
                          : undefined
                      }
                      onClick={() => {
                        if (clickable) onOpenLedgerRow?.(row)
                      }}
                    >
                      {canDelete ? (
                        <td className={`${tdCls} text-center`} onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedLedgerKeys.has(key)}
                            onCheckedChange={(v) => toggleLedger(key, v === true)}
                            aria-label={row.detail || key}
                          />
                        </td>
                      ) : null}
                      <td className={tdCls}>{sourceLabel(row.sourceTable)}</td>
                      <td className={`${tdCls} font-medium whitespace-nowrap`}>{row.vendorLabel}</td>
                      <td className={`${tdCls} tabular-nums whitespace-nowrap`}>
                        <div>{row.dateYmd || '—'}</div>
                        {row.secondaryDateYmd ? (
                          <div className="text-[9px] text-slate-500" title={ko ? '등록일' : 'Submit date'}>
                            {ko ? '등록' : 'Sub'} {row.secondaryDateYmd}
                          </div>
                        ) : null}
                      </td>
                      <td className={`${tdCls} max-w-[12rem] truncate`} title={row.detail}>
                        {row.detail || '—'}
                      </td>
                      <td className={`${tdCls} text-right tabular-nums whitespace-nowrap`}>
                        {formatUsd(row.amount)}
                      </td>
                      <td className={`${tdCls} text-center`}>
                        <ExpenseStatementReconIcon
                          matched={row.statementMatched}
                          titleMatched={ko ? '명세 연결됨' : 'Statement linked'}
                          titleUnmatched={ko ? '명세 미연결' : 'Not linked'}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {hasStmt ? (
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            <div className="text-[10px] font-semibold text-slate-700">
              {ko
                ? `은행 출금 명세 (${bundle.statementRows.length}건 · 업로드 statement_lines)`
                : `Bank outflow lines (${bundle.statementRows.length} · statement_lines)`}
            </div>
            {canDelete ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 px-2 text-[10px] border-amber-300 text-amber-950 hover:bg-amber-50"
                disabled={busy || selectedStmtLineIds.size === 0}
                onClick={() => void runStmtUnlink()}
              >
                {ko
                  ? `선택 연결 해제 (${selectedStmtLineIds.size})`
                  : `Unlink selected (${selectedStmtLineIds.size})`}
              </Button>
            ) : null}
          </div>
          <div className="overflow-x-auto">
            <table className={tableCls}>
              <thead>
                <tr>
                  {canDelete ? (
                    <th className={`${thCls} w-8 text-center`}>
                      <Checkbox
                        checked={allStmtSelected}
                        onCheckedChange={(v) => toggleAllStmt(v === true)}
                        aria-label={ko ? '전체 선택' : 'Select all'}
                      />
                    </th>
                  ) : null}
                  <th className={thCls}>{ko ? '거래일' : 'Posted'}</th>
                  <th className={thCls}>{ko ? '벤더' : 'Vendor'}</th>
                  <th className={thCls}>{ko ? '통장' : 'Account'}</th>
                  <th className={thCls}>{ko ? '적요' : 'Description'}</th>
                  <th className={`${thCls} text-right`}>{ko ? '금액' : 'Amount'}</th>
                  <th className={thCls}>{ko ? '연결' : 'Linked'}</th>
                </tr>
              </thead>
              <tbody>
                {bundle.statementRows.map((row) => {
                  const linked = row.linkedSources.length > 0
                  const linkText = linked
                    ? row.linkedSources
                        .map((l) => `${sourceLabel(l.source_table)}`)
                        .filter((v, i, a) => a.indexOf(v) === i)
                        .join(', ')
                    : ko
                      ? '미연결'
                      : 'Unlinked'
                  return (
                    <tr
                      key={row.lineId}
                      className={selectedStmtLineIds.has(row.lineId) ? 'bg-violet-100/60' : undefined}
                    >
                      {canDelete ? (
                        <td className={`${tdCls} text-center`}>
                          <Checkbox
                            checked={selectedStmtLineIds.has(row.lineId)}
                            onCheckedChange={(v) => toggleStmt(row.lineId, v === true)}
                            aria-label={row.description}
                          />
                        </td>
                      ) : null}
                      <td className={`${tdCls} tabular-nums whitespace-nowrap`}>{row.postedDate}</td>
                      <td className={`${tdCls} font-medium whitespace-nowrap`}>{row.vendorLabel}</td>
                      <td className={`${tdCls} max-w-[6rem] truncate`} title={row.financialAccountName}>
                        {row.financialAccountName}
                      </td>
                      <td className={`${tdCls} max-w-[16rem]`}>
                        <div className="truncate font-medium" title={row.description}>
                          {row.description}
                        </div>
                        {row.rawDescription && row.rawDescription !== row.description ? (
                          <div
                            className="truncate text-slate-500 text-[9px] mt-0.5"
                            title={row.rawDescription}
                          >
                            {row.rawDescription}
                          </div>
                        ) : null}
                      </td>
                      <td className={`${tdCls} text-right tabular-nums whitespace-nowrap`}>
                        {formatUsd(row.amount)}
                      </td>
                      <td className={tdCls}>
                        <span
                          className={
                            linked
                              ? 'text-emerald-800 font-medium'
                              : row.matchedStatus === 'unmatched'
                                ? 'text-amber-800'
                                : 'text-slate-600'
                          }
                        >
                          {linkText}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  )
}
