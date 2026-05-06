'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ExternalLink } from 'lucide-react'
import {
  BULK_COMPANY_DUP_AMOUNT_EPS,
  BULK_COMPANY_DUP_DAY_WINDOW,
  COMPANY_EXPENSE_LEDGER_DUP_MAX_SCAN,
  fetchCompanyExpenseDuplicatesForBulk,
  type BulkCompanyDuplicateCheckInput,
  type BulkCompanyDuplicateRow,
  type LedgerDuplicateExpenseRow
} from '@/lib/statement-bulk-company-duplicate-check'
import {
  canonGroupFingerprint,
  canonPairFingerprint,
  deleteExpenseBySourceKey,
  fetchUnifiedExpenseLedgerDuplicateGroups,
  insertExpenseDuplicateSuppression,
  UNIFIED_EXPENSE_SOURCE_LABEL,
  type UnifiedLedgerDuplicateExpenseRow
} from '@/lib/expense-unified-duplicate-scan'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { toast } from 'sonner'

export type CompanyExpenseDuplicateCheckMode = 'statement' | 'ledger'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: CompanyExpenseDuplicateCheckMode
  /** mode === 'statement' — 지출 일괄 입력 후보와 동일한 명세 줄 목록 */
  statementCandidates?: BulkCompanyDuplicateCheckInput[]
  /** mode === 'ledger' — YYYY-MM-DD */
  ledgerDateFrom?: string
  ledgerDateTo?: string
  /** 중복 점검에서 숨김·삭제 후 부모 목록 새로고침 등 */
  onAfterLedgerMutation?: () => void
  createdByEmail?: string | null
}

function linkCell(m: {
  reconciled_statement_line_id: string | null
  statement_line_id: string | null
}): string {
  if (m.reconciled_statement_line_id) return `대조:${m.reconciled_statement_line_id.slice(0, 8)}…`
  if (m.statement_line_id) return `행:${m.statement_line_id.slice(0, 8)}…`
  return '—'
}

function originCell(origin: string | null): string {
  return origin === 'statement_adjustment' ? '명세 보정·일괄' : '운영'
}

function LedgerDetailLinksCell({
  row,
  locale
}: {
  row: UnifiedLedgerDuplicateExpenseRow
  locale: string
}) {
  const tourId = row.detail_tour_id?.trim()
  const resId = row.detail_reservation_id?.trim()
  if (!tourId && !resId) {
    return <span className="text-slate-400">—</span>
  }
  return (
    <div className="flex flex-col gap-1 items-start">
      {tourId ? (
        <Button asChild size="sm" variant="outline" className="h-7 text-[10px] px-2 py-0 gap-1">
          <Link
            href={`/${locale}/admin/tours/${encodeURIComponent(tourId)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            투어 상세
            <ExternalLink className="h-3 w-3 opacity-70 shrink-0" aria-hidden />
          </Link>
        </Button>
      ) : null}
      {resId ? (
        <Button asChild size="sm" variant="outline" className="h-7 text-[10px] px-2 py-0 gap-1">
          <Link
            href={`/${locale}/admin/reservations/${encodeURIComponent(resId)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            예약 상세
            <ExternalLink className="h-3 w-3 opacity-70 shrink-0" aria-hidden />
          </Link>
        </Button>
      ) : null}
    </div>
  )
}

function standardCategoryCell(row: LedgerDuplicateExpenseRow): string {
  const spf = (row.standard_paid_for ?? '').trim()
  if (spf) return spf
  const c = (row.category ?? '').trim()
  if (c) return `${c} (비표준)`
  return '—'
}

function ymdTodayLocal(): string {
  const t = new Date()
  const y = t.getFullYear()
  const m = String(t.getMonth() + 1).padStart(2, '0')
  const d = String(t.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function ymdAddDaysLocal(ymd: string, delta: number): string {
  const [y, mo, da] = ymd.split('-').map(Number)
  const u = new Date(y, mo - 1, da + delta)
  const yy = u.getFullYear()
  const mm = String(u.getMonth() + 1).padStart(2, '0')
  const dd = String(u.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

export default function CompanyExpenseDuplicateCheckModal({
  open,
  onOpenChange,
  mode,
  statementCandidates = [],
  ledgerDateFrom = '',
  ledgerDateTo = '',
  onAfterLedgerMutation,
  createdByEmail = null
}: Props) {
  const params = useParams()
  const locale = typeof params?.locale === 'string' ? params.locale : 'ko'

  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [statementRows, setStatementRows] = useState<BulkCompanyDuplicateRow[] | null>(null)
  const [ledgerGroups, setLedgerGroups] = useState<UnifiedLedgerDuplicateExpenseRow[][] | null>(null)
  const [ledgerTruncated, setLedgerTruncated] = useState(false)
  const [keepKeyByGroup, setKeepKeyByGroup] = useState<Record<number, string>>({})
  const [actionBusy, setActionBusy] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<{ keepKey: string; deleteKeys: string[] } | null>(null)

  const stmtKey = useMemo(
    () =>
      mode === 'statement'
        ? statementCandidates.map((c) => `${c.statement_line_id}|${c.posted_date}|${c.amount}`).join(';')
        : '',
    [mode, statementCandidates]
  )

  const ledgerRange = useMemo(() => {
    const to = ledgerDateTo.trim() || ymdTodayLocal()
    const from = ledgerDateFrom.trim() || ymdAddDaysLocal(to, -90)
    return { from, to }
  }, [ledgerDateFrom, ledgerDateTo])

  const reloadLedger = useCallback(async () => {
    const { from, to } = ledgerRange
    const { groups, truncated } = await fetchUnifiedExpenseLedgerDuplicateGroups(from, to)
    setLedgerGroups(groups)
    setLedgerTruncated(truncated)
    const init: Record<number, string> = {}
    for (let i = 0; i < groups.length; i++) {
      init[i] = groups[i][0]?.source_key ?? ''
    }
    setKeepKeyByGroup(init)
  }, [ledgerRange])

  useEffect(() => {
    if (!open) {
      setErr(null)
      setStatementRows(null)
      setLedgerGroups(null)
      setLedgerTruncated(false)
      setKeepKeyByGroup({})
      setDeleteConfirm(null)
      return
    }
    let cancelled = false
    void (async () => {
      setLoading(true)
      setErr(null)
      setStatementRows(null)
      setLedgerGroups(null)
      setLedgerTruncated(false)
      setKeepKeyByGroup({})
      try {
        if (mode === 'statement') {
          if (statementCandidates.length === 0) {
            if (!cancelled) setStatementRows([])
            return
          }
          const rows = await fetchCompanyExpenseDuplicatesForBulk(statementCandidates)
          if (!cancelled) setStatementRows(rows)
        } else {
          await reloadLedger()
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : '조회 실패')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, mode, stmtKey, reloadLedger])

  useEffect(() => {
    if (!ledgerGroups) return
    setKeepKeyByGroup((prev) => {
      const next: Record<number, string> = {}
      for (let gi = 0; gi < ledgerGroups.length; gi++) {
        const g = ledgerGroups[gi]
        const keys = g.map((r) => r.source_key)
        const cur = prev[gi]
        next[gi] = cur && keys.includes(cur) ? cur : keys[0] ?? ''
      }
      return next
    })
  }, [ledgerGroups])

  const title =
    mode === 'statement'
      ? '명세 줄 ↔ 기존 회사 지출 중복 점검'
      : '회사·투어·예약·입장권 교차 중복 의심 점검'

  async function onMarkGroupDifferent(group: UnifiedLedgerDuplicateExpenseRow[]) {
    const keys = group.map((r) => r.source_key)
    if (keys.length < 2) return
    const fp = keys.length === 2 ? canonPairFingerprint(keys[0]!, keys[1]!) : canonGroupFingerprint(keys)
    const kind = keys.length === 2 ? 'pair' : 'group'
    setActionBusy(true)
    setErr(null)
    try {
      await insertExpenseDuplicateSuppression({
        fingerprint: fp,
        kind,
        member_keys: [...keys].sort((a, b) => a.localeCompare(b)),
        created_by: createdByEmail ?? null
      })
      toast.success('다른 지출로 기록했습니다. 이 목록에서는 다시 표시되지 않습니다.')
      await reloadLedger()
      onAfterLedgerMutation?.()
    } catch (e) {
      setErr(e instanceof Error ? e.message : '저장 실패')
      toast.error(e instanceof Error ? e.message : '저장 실패')
    } finally {
      setActionBusy(false)
    }
  }

  async function runDeleteOthers(deleteKeys: string[]) {
    setDeleteConfirm(null)
    setActionBusy(true)
    setErr(null)
    try {
      for (const k of deleteKeys) {
        await deleteExpenseBySourceKey(k)
      }
      toast.success(`${deleteKeys.length}건을 삭제하고 한 건만 남겼습니다.`)
      await reloadLedger()
      onAfterLedgerMutation?.()
    } catch (e) {
      setErr(e instanceof Error ? e.message : '삭제 중 오류')
      toast.error(e instanceof Error ? e.message : '삭제 중 오류')
    } finally {
      setActionBusy(false)
    }
  }

  return (
    <>
      <AlertDialog open={deleteConfirm != null} onOpenChange={(v) => !v && setDeleteConfirm(null)}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-left text-base">선택한 한 건만 남기고 삭제</AlertDialogTitle>
            <AlertDialogDescription className="text-left text-sm space-y-2">
              <p>
                유지할 지출을 제외한 나머지는 <strong>영구 삭제</strong>됩니다. 명세 대조 연결이 있으면 함께 해제됩니다.
              </p>
              {deleteConfirm && deleteConfirm.deleteKeys.length > 0 ? (
                <ul className="list-disc pl-4 font-mono text-[11px] break-all text-slate-700">
                  {deleteConfirm.deleteKeys.map((k) => (
                    <li key={k}>{k}</li>
                  ))}
                </ul>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionBusy}>취소</AlertDialogCancel>
            <AlertDialogAction
              disabled={actionBusy}
              className="bg-red-600 hover:bg-red-700"
              onClick={(ev) => {
                ev.preventDefault()
                if (!deleteConfirm) return
                void runDeleteOthers(deleteConfirm.deleteKeys)
              }}
            >
              삭제 실행
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v && (loading || actionBusy)) return
          onOpenChange(v)
        }}
      >
        <DialogContent
          className="max-w-[min(96rem,calc(100vw-1.5rem))] w-[calc(100vw-1rem)] max-h-[min(88vh,820px)] flex flex-col gap-0 p-0"
          onPointerDownOutside={(e) => {
            if (loading || actionBusy) e.preventDefault()
          }}
          onEscapeKeyDown={(e) => {
            if (loading || actionBusy) e.preventDefault()
          }}
        >
          <DialogHeader className="px-4 pt-4 pb-2 pr-12 border-b border-slate-100 shrink-0 text-left space-y-1">
            <DialogTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" aria-hidden />
              {title}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-slate-600">
              {mode === 'statement' ? (
                <>
                  명세 <strong>출금·미대조</strong> 후보 줄마다, 금액(±{BULK_COMPANY_DUP_AMOUNT_EPS})·등록일(±
                  {BULK_COMPANY_DUP_DAY_WINDOW}일)이 맞는 <strong>기존 회사 지출</strong>을 찾습니다. 일괄 입력·자동 매칭 전에
                  같은 거래가 이미 있는지 확인할 때 사용하세요.
                </>
              ) : (
                <>
                  목록의 <strong>시작일·종료일</strong>이 있으면 그 범위로, 비어 있으면 <strong>종료일=오늘 · 시작일=90일
                  전</strong>으로 조회합니다. <strong>회사·투어·예약·입장권(확정)</strong> 네 종류 지출을 한 풀에 넣어 비교하며,{' '}
                  <strong>같은 테이블 안끼리만이 아니라</strong> 출처가 달라도(예: 회사 지출 ↔ 투어 지출) 금액(±
                  {BULK_COMPANY_DUP_AMOUNT_EPS})·등록일(±{BULK_COMPANY_DUP_DAY_WINDOW}일)이 비슷하면 한 그룹으로 묶습니다.
                  우연히 겹친 경우 <strong>다른 지출로 숨김</strong>을 남기거나, 동일 거래 중복이면{' '}
                  <strong>한 건만 남기고 삭제</strong>하세요.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="px-3 sm:px-4 py-3 overflow-y-auto flex-1 min-h-0 text-[11px] sm:text-xs space-y-2">
            {err ? <p className="text-red-700 text-sm">{err}</p> : null}
            {loading ? <p className="text-slate-600">불러오는 중…</p> : null}

            {!loading && !err && mode === 'statement' && statementCandidates.length === 0 ? (
              <p className="text-slate-600">점검할 명세 출금·미대조 줄이 없습니다. 계정·필터를 확인하세요.</p>
            ) : null}

            {!loading &&
            !err &&
            mode === 'statement' &&
            statementRows &&
            statementCandidates.length > 0 &&
            statementRows.length === 0 ? (
              <p className="text-emerald-800">
                표시 중인 명세 후보 줄과 겹치는 기존 회사 지출이 없습니다. (금액 ±{BULK_COMPANY_DUP_AMOUNT_EPS}, 등록일 ±
                {BULK_COMPANY_DUP_DAY_WINDOW}일, 승인·대기만)
              </p>
            ) : null}

            {!loading && !err && mode === 'ledger' && ledgerGroups && ledgerGroups.length === 0 ? (
              <p className="text-emerald-800">
                해당 기간·기준에서 중복 의심 그룹이 없습니다. (금액 ±{BULK_COMPANY_DUP_AMOUNT_EPS}, 등록일 ±
                {BULK_COMPANY_DUP_DAY_WINDOW}일, 승인·대기·입장권 확정)
              </p>
            ) : null}

            {ledgerTruncated ? (
              <p className="text-amber-900 font-medium">
                조회·비교 상한({COMPANY_EXPENSE_LEDGER_DUP_MAX_SCAN}건)에 걸렸습니다. 기간을 줄이거나 테이블당 일부만
                가져온 뒤 비교하므로, 누락될 수 있습니다.
              </p>
            ) : null}

            {!loading && !err && mode === 'statement' && statementRows && statementRows.length > 0 ? (
              <div className="rounded-md border border-amber-200/90 bg-amber-50/50 overflow-x-auto">
                <table className="w-full min-w-[72rem] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-amber-200/80 text-slate-600 bg-amber-100/40">
                      <th className="py-1.5 px-1.5 font-medium whitespace-nowrap">명세일</th>
                      <th className="py-1.5 px-1.5 font-medium text-right whitespace-nowrap">명세 금액</th>
                      <th className="py-1.5 px-1.5 font-medium min-w-[10rem]">명세 설명</th>
                      <th className="py-1.5 px-1.5 font-medium whitespace-nowrap">기존 지출 ID</th>
                      <th className="py-1.5 px-1.5 font-medium text-right whitespace-nowrap">기존 금액</th>
                      <th className="py-1.5 px-1.5 font-medium whitespace-nowrap">등록일</th>
                      <th className="py-1.5 px-1.5 font-medium min-w-[7rem]">Paid to</th>
                      <th className="py-1.5 px-1.5 font-medium min-w-[7rem]">Paid for</th>
                      <th className="py-1.5 px-1.5 font-medium whitespace-nowrap">상태</th>
                      <th className="py-1.5 px-1.5 font-medium whitespace-nowrap">지출↔명세</th>
                      <th className="py-1.5 px-1.5 font-medium min-w-[6rem]">비고</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statementRows.flatMap((block) =>
                      block.matches.map((m) => (
                        <tr key={`${block.proposal.statement_line_id}-${m.id}`} className="border-b border-amber-100/80 align-top">
                          <td className="py-1 px-1.5 whitespace-nowrap text-slate-800">{block.proposal.posted_date}</td>
                          <td className="py-1 px-1.5 text-right tabular-nums text-slate-800">
                            ${Number(block.proposal.amount).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-1 px-1.5 break-words text-slate-700">{block.proposal.line_desc || '—'}</td>
                          <td className="py-1 px-1.5 font-mono text-[10px] text-slate-800">{m.id.slice(0, 8)}…</td>
                          <td className="py-1 px-1.5 text-right tabular-nums text-slate-800">
                            {m.amount != null && Number.isFinite(m.amount)
                              ? `$${m.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                              : '—'}
                          </td>
                          <td className="py-1 px-1.5 whitespace-nowrap text-slate-700">
                            {m.submit_on ? String(m.submit_on).slice(0, 10) : '—'}
                          </td>
                          <td className="py-1 px-1.5 break-words text-slate-700">{m.paid_to?.trim() || '—'}</td>
                          <td className="py-1 px-1.5 break-words text-slate-700">{m.paid_for?.trim() || '—'}</td>
                          <td className="py-1 px-1.5 whitespace-nowrap text-slate-700">{m.status?.trim() || '—'}</td>
                          <td className="py-1 px-1.5 whitespace-nowrap text-slate-700">{linkCell(m)}</td>
                          <td className="py-1 px-1.5 text-slate-600">{originCell(m.ledger_expense_origin)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            ) : null}

            {!loading && !err && mode === 'ledger' && ledgerGroups && ledgerGroups.length > 0 ? (
              <div className="space-y-4">
                {ledgerGroups.map((group, gi) => {
                  const refAmt = group[0]?.amount
                  const amtLabel =
                    refAmt != null && Number.isFinite(refAmt)
                      ? `$${refAmt.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                      : '—'
                  const keepKey = keepKeyByGroup[gi] ?? group[0]?.source_key ?? ''
                  const deleteKeys = group.map((r) => r.source_key).filter((k) => k !== keepKey)
                  return (
                    <div
                      key={`ledger-group-${gi}-${group.map((r) => r.source_key).join('-')}`}
                      className="rounded-lg border-2 border-amber-400/90 bg-gradient-to-b from-amber-50/90 to-white overflow-hidden shadow-sm ring-1 ring-amber-200/60"
                    >
                      <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-amber-100/90 border-b border-amber-300/80 text-xs text-amber-950">
                        <span
                          className="inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-full bg-amber-600 px-2 text-[11px] font-bold text-white"
                          title={`중복 의심 그룹 ${gi + 1}`}
                        >
                          {gi + 1}
                        </span>
                        <span className="font-semibold">중복 의심 그룹</span>
                        <span className="text-slate-700">
                          · {group.length}건 · 금액 근접 {amtLabel}
                        </span>
                        <span className="grow" />
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="h-8 text-[11px]"
                          disabled={actionBusy}
                          onClick={() => void onMarkGroupDifferent(group)}
                        >
                          다른 지출(목록에서 숨김)
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          className="h-8 text-[11px]"
                          disabled={actionBusy || deleteKeys.length === 0}
                          onClick={() => setDeleteConfirm({ keepKey, deleteKeys })}
                        >
                          유지 한 건만 남기고 나머지 삭제
                        </Button>
                      </div>
                      <div className="overflow-x-auto px-1 pb-2 pt-1">
                        <table className="w-full min-w-[94rem] border-collapse text-left text-[11px]">
                          <thead>
                            <tr className="border-b border-amber-200/90 text-slate-600 bg-amber-50/80">
                              <th className="py-1.5 px-2 font-medium w-10 text-center">유지</th>
                              <th className="py-1.5 px-2 font-medium min-w-[7rem]">지출 구분</th>
                              <th className="py-1.5 px-2 font-medium min-w-[11rem]">지출 ID</th>
                              <th className="py-1.5 px-2 font-medium whitespace-nowrap">등록일</th>
                              <th className="py-1.5 px-2 font-medium min-w-[7rem]">Paid to</th>
                              <th className="py-1.5 px-2 font-medium min-w-[7rem]">paid for</th>
                              <th className="py-1.5 px-2 font-medium min-w-[8rem]">표준 카테고리</th>
                              <th className="py-1.5 px-2 font-medium text-right whitespace-nowrap">금액</th>
                              <th className="py-1.5 px-2 font-medium min-w-[8rem]">결제 방법</th>
                              <th className="py-1.5 px-2 font-medium min-w-[9rem]">명세 대조 현황</th>
                              <th className="py-1.5 px-2 font-medium min-w-[8rem]">대조 금융 계정</th>
                              <th className="py-1.5 px-2 font-medium min-w-[8rem] whitespace-nowrap">투어·예약 상세</th>
                              <th className="py-1.5 px-2 font-medium min-w-[8rem]">참고</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.map((row, ri) => (
                              <tr
                                key={row.source_key}
                                className={`border-b border-amber-100/90 align-top ${
                                  ri === 0 ? 'bg-amber-50/95' : 'bg-white'
                                }`}
                              >
                                <td className="py-2 px-2 text-center align-middle">
                                  <input
                                    type="radio"
                                    className="h-3.5 w-3.5 accent-amber-700"
                                    name={`dup-keep-${gi}`}
                                    checked={keepKey === row.source_key}
                                    onChange={() => setKeepKeyByGroup((p) => ({ ...p, [gi]: row.source_key }))}
                                    aria-label={`그룹 ${gi + 1}에서 유지할 지출`}
                                  />
                                </td>
                                <td className="py-2 px-2 whitespace-nowrap text-slate-800 font-medium">
                                  {UNIFIED_EXPENSE_SOURCE_LABEL[row.source_table]}
                                </td>
                                <td className="py-2 px-2 align-top">
                                  <div className="flex flex-col gap-1">
                                    <span
                                      className={`inline-flex w-fit rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                        ri === 0 ? 'bg-amber-600 text-white' : 'bg-slate-200 text-slate-800'
                                      }`}
                                    >
                                      {ri === 0 ? '기준' : '비슷'}
                                    </span>
                                    <span className="font-mono text-[10px] leading-snug break-all text-slate-900">
                                      {row.id}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-2 px-2 whitespace-nowrap text-slate-800">
                                  {row.submit_on ? String(row.submit_on).slice(0, 10) : '—'}
                                </td>
                                <td className="py-2 px-2 break-words text-slate-800">{row.paid_to?.trim() || '—'}</td>
                                <td className="py-2 px-2 break-words text-slate-800">{row.paid_for?.trim() || '—'}</td>
                                <td className="py-2 px-2 break-words text-slate-800">{standardCategoryCell(row)}</td>
                                <td className="py-2 px-2 text-right tabular-nums text-slate-900 font-medium">
                                  {row.amount != null && Number.isFinite(row.amount)
                                    ? `$${row.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                                    : '—'}
                                </td>
                                <td className="py-2 px-2 break-words text-slate-800">{row.display_payment_method}</td>
                                <td className="py-2 px-2 break-words text-slate-800">{row.display_statement_status}</td>
                                <td className="py-2 px-2 break-words text-slate-800">
                                  {row.display_financial_account ?? '—'}
                                </td>
                                <td className="py-2 px-2 align-top">
                                  <LedgerDetailLinksCell row={row} locale={locale} />
                                </td>
                                <td className="py-2 px-2 break-words text-slate-600 text-[10px]">
                                  {row.source_context?.trim() || '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : null}
          </div>

          <DialogFooter className="px-4 py-3 border-t border-slate-100 shrink-0">
            <Button type="button" variant="outline" disabled={loading || actionBusy} onClick={() => onOpenChange(false)}>
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
