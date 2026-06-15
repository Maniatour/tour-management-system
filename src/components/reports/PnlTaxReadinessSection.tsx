'use client'

import { useMemo, useState } from 'react'
import { ShieldCheck, AlertTriangle, Link2, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AccountingTerm } from '@/components/ui/AccountingTerm'
import type { PnlDetailLine, PnlDrillState } from '@/components/reports/PnlUnifiedExpenseDetailDialog'
import {
  duplicateExtraKeysToSelect,
  findPnlDetailDuplicateGroups,
  pnlDetailLineKey,
} from '@/lib/pnl-expense-detail-duplicates'
import {
  BULK_COMPANY_DUP_AMOUNT_EPS,
  BULK_COMPANY_DUP_DAY_WINDOW,
} from '@/lib/statement-bulk-company-duplicate-check'

interface PnlTaxReadinessSectionProps {
  /** 통합 PNL 합계에 포함되는 지출 라인 (exclude_from_pnl 제외분) */
  lines: PnlDetailLine[]
  /** "중복 아님" 처리된 지출 키(source:id) — 중복 의심 집계에서 제외 */
  dismissedDuplicateKeys?: Set<string>
  /** «중복 아님» 작업 배치 정보 — 마지막 작업 되돌리기용 */
  dismissedUndoInfo?: { batchCount: number; lastBatchSize: number }
  /** 가장 최근 «중복 아님» 클릭 한 번만 되돌리기 */
  onUndoLastDismissedDuplicates?: () => void | Promise<void>
  /** «중복 아님» 숨김 전체 되돌리기 */
  onClearAllDismissedDuplicates?: () => void | Promise<void>
  /** 드릴(상세 모달) 열기 — 통합 지출 표와 동일한 모달 */
  onOpenDrill: (drill: PnlDrillState) => void
}

function formatMoney(n: number): string {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

function formatPct(n: number): string {
  return `${(n * 100).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`
}

/**
 * 세금 보고 준비도 — 통합 PNL 지출 합계가 (1) 은행·카드 명세와 얼마나 대조됐는지,
 * (2) 중복 의심으로 과대계상 위험이 있는지를 한눈에 보여 준다.
 * 금액 자체는 바꾸지 않으며, 검토·정리는 상세 지출 모달에서 한다.
 */
export default function PnlTaxReadinessSection({
  lines,
  dismissedDuplicateKeys,
  dismissedUndoInfo,
  onUndoLastDismissedDuplicates,
  onClearAllDismissedDuplicates,
  onOpenDrill,
}: PnlTaxReadinessSectionProps) {
  const [clearingDismissed, setClearingDismissed] = useState(false)
  const [undoingLastDismissed, setUndoingLastDismissed] = useState(false)
  const dismissedCount = dismissedDuplicateKeys?.size ?? 0
  const canUndoLast = (dismissedUndoInfo?.batchCount ?? 0) > 0
  const stats = useMemo(() => {
    let totalAmount = 0
    let reconciledAmount = 0
    let reconciledCount = 0
    for (const l of lines) {
      const amt = Number(l.amount) || 0
      totalAmount += amt
      if (l.statementReconciled) {
        reconciledAmount += amt
        reconciledCount += 1
      }
    }
    const totalCount = lines.length
    const unmatchedCount = totalCount - reconciledCount
    const unmatchedAmount = totalAmount - reconciledAmount
    const coverage = totalAmount > 0 ? reconciledAmount / totalAmount : 0

    const dupGroups = findPnlDetailDuplicateGroups(lines, dismissedDuplicateKeys)
    const dupExtraKeys = duplicateExtraKeysToSelect(lines, dupGroups)
    const dupExtraKeySet = new Set(dupExtraKeys)
    let dupExtraAmount = 0
    for (const l of lines) {
      if (dupExtraKeySet.has(pnlDetailLineKey(l))) dupExtraAmount += Number(l.amount) || 0
    }

    return {
      totalAmount,
      totalCount,
      reconciledAmount,
      reconciledCount,
      unmatchedAmount,
      unmatchedCount,
      coverage,
      dupGroupCount: dupGroups.length,
      dupExtraCount: dupExtraKeys.length,
      dupExtraAmount,
    }
  }, [lines, dismissedDuplicateKeys])

  const hasUnmatched = stats.unmatchedCount > 0 && stats.unmatchedAmount > 0.005
  const hasDuplicates = stats.dupExtraCount > 0
  const isClean = !hasUnmatched && !hasDuplicates && stats.totalCount > 0

  const coveragePct = stats.coverage
  const coverageTone =
    coveragePct >= 0.95
      ? 'text-emerald-700'
      : coveragePct >= 0.7
        ? 'text-amber-700'
        : 'text-rose-700'
  const coverageBarTone =
    coveragePct >= 0.95 ? 'bg-emerald-500' : coveragePct >= 0.7 ? 'bg-amber-500' : 'bg-rose-500'

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold flex flex-wrap items-center gap-x-2 gap-y-1 text-sm sm:text-base">
            <ShieldCheck className="h-5 w-5 shrink-0 text-slate-600" aria-hidden />
            <AccountingTerm termKey="세금보고">세금 보고</AccountingTerm> 준비도 ·{' '}
            <AccountingTerm termKey="명세대조">명세 대조</AccountingTerm> 커버리지
          </h3>
          <p className="text-xs text-gray-600 mt-1 leading-relaxed">
            통합 지출 표 <strong>합계({formatMoney(stats.totalAmount)})</strong> 중 은행·카드{' '}
            <AccountingTerm termKey="명세대조">명세</AccountingTerm>와 연결된 비율입니다. 금액은 바꾸지 않으며, 미대조·중복은
            아래 버튼으로 상세에서 검토·정리할 수 있습니다. (중복 기준: 금액 ±${BULK_COMPANY_DUP_AMOUNT_EPS}, 등록일 ±
            {BULK_COMPANY_DUP_DAY_WINDOW}일)
          </p>
        </div>
        {isClean ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-medium text-emerald-800 shrink-0">
            <ShieldCheck className="h-4 w-4" aria-hidden />
            정리 완료
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-medium text-amber-800 shrink-0">
            <AlertTriangle className="h-4 w-4" aria-hidden />
            검토 필요
          </span>
        )}
      </div>

      {/* 커버리지 바 */}
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
          <span className="text-slate-700">
            <AccountingTerm termKey="명세대조">명세 대조</AccountingTerm> 커버리지(금액 기준)
          </span>
          <span className={`tabular-nums font-semibold ${coverageTone}`}>
            {formatPct(coveragePct)}{' '}
            <span className="text-xs font-normal text-slate-500">
              ({formatMoney(stats.reconciledAmount)} / {formatMoney(stats.totalAmount)})
            </span>
          </span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all ${coverageBarTone}`}
            style={{ width: `${Math.min(100, Math.max(0, coveragePct * 100))}%` }}
          />
        </div>
        <p className="text-[11px] text-slate-500 tabular-nums">
          연결됨 {stats.reconciledCount}건 · 미대조 {stats.unmatchedCount}건 / 전체 {stats.totalCount}건
        </p>
      </div>

      {/* 요약 타일 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-md border border-emerald-100 bg-emerald-50/60 p-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-800">
            <Link2 className="h-3.5 w-3.5" aria-hidden />
            명세 연결됨
          </div>
          <div className="mt-1 text-lg font-semibold tabular-nums text-emerald-900">
            {formatMoney(stats.reconciledAmount)}
          </div>
          <div className="text-[11px] text-emerald-700/80 tabular-nums">{stats.reconciledCount}건</div>
        </div>

        <button
          type="button"
          disabled={!hasUnmatched}
          onClick={() => onOpenDrill({ mode: 'unmatched' })}
          className={`text-left rounded-md border p-3 transition-colors ${
            hasUnmatched
              ? 'border-rose-200 bg-rose-50/70 hover:bg-rose-50'
              : 'border-slate-200 bg-slate-50/60 cursor-default'
          }`}
        >
          <div
            className={`flex items-center gap-1.5 text-xs font-medium ${
              hasUnmatched ? 'text-rose-800' : 'text-slate-500'
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
            명세 미대조
          </div>
          <div
            className={`mt-1 text-lg font-semibold tabular-nums ${
              hasUnmatched ? 'text-rose-900' : 'text-slate-700'
            }`}
          >
            {formatMoney(stats.unmatchedAmount)}
          </div>
          <div className={`text-[11px] tabular-nums ${hasUnmatched ? 'text-rose-700/80' : 'text-slate-500'}`}>
            {stats.unmatchedCount}건{hasUnmatched ? ' · 눌러서 검토' : ''}
          </div>
        </button>

        <button
          type="button"
          disabled={!hasDuplicates}
          onClick={() => onOpenDrill({ mode: 'duplicates' })}
          className={`text-left rounded-md border p-3 transition-colors ${
            hasDuplicates
              ? 'border-amber-200 bg-amber-50/70 hover:bg-amber-50'
              : 'border-slate-200 bg-slate-50/60 cursor-default'
          }`}
        >
          <div
            className={`flex items-center gap-1.5 text-xs font-medium ${
              hasDuplicates ? 'text-amber-800' : 'text-slate-500'
            }`}
          >
            <Copy className="h-3.5 w-3.5" aria-hidden />
            중복 의심(삭제 후보)
          </div>
          <div
            className={`mt-1 text-lg font-semibold tabular-nums ${
              hasDuplicates ? 'text-amber-900' : 'text-slate-700'
            }`}
          >
            {formatMoney(stats.dupExtraAmount)}
          </div>
          <div className={`text-[11px] tabular-nums ${hasDuplicates ? 'text-amber-700/80' : 'text-slate-500'}`}>
            {stats.dupGroupCount}그룹 · 삭제 후보 {stats.dupExtraCount}건{hasDuplicates ? ' · 눌러서 정리' : ''}
          </div>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        <Button type="button" variant="outline" size="sm" onClick={() => onOpenDrill({ mode: 'grand' })}>
          전체 지출 상세 열기
        </Button>
        {hasUnmatched ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-rose-300 text-rose-800 hover:bg-rose-50"
            onClick={() => onOpenDrill({ mode: 'unmatched' })}
          >
            미대조 {stats.unmatchedCount}건 검토
          </Button>
        ) : null}
        {hasDuplicates ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-amber-300 text-amber-900 hover:bg-amber-50"
            onClick={() => onOpenDrill({ mode: 'duplicates' })}
          >
            중복 의심 {stats.dupExtraCount}건 정리
          </Button>
        ) : null}
        {canUndoLast && onUndoLastDismissedDuplicates ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-amber-400 text-amber-950 hover:bg-amber-50"
            disabled={undoingLastDismissed || clearingDismissed}
            onClick={() => {
              setUndoingLastDismissed(true)
              void Promise.resolve(onUndoLastDismissedDuplicates()).finally(() =>
                setUndoingLastDismissed(false)
              )
            }}
          >
            {undoingLastDismissed
              ? '되돌리는 중…'
              : `마지막 중복 아님 되돌리기 (${dismissedUndoInfo!.lastBatchSize}건)`}
          </Button>
        ) : null}
        {dismissedCount > 0 && onClearAllDismissedDuplicates && (dismissedUndoInfo?.batchCount ?? 0) > 1 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-slate-400 text-slate-800 hover:bg-slate-100"
            disabled={clearingDismissed || undoingLastDismissed}
            onClick={() => {
              setClearingDismissed(true)
              void Promise.resolve(onClearAllDismissedDuplicates()).finally(() => setClearingDismissed(false))
            }}
          >
            {clearingDismissed
              ? '되돌리는 중…'
              : `중복 아님 전체 되돌리기 (${dismissedCount}건)`}
          </Button>
        ) : null}
      </div>

      {dismissedCount > 0 ? (
        <p className="text-[11px] text-amber-900 leading-relaxed bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          <strong>중복 아님</strong>으로 숨긴 지출이 {dismissedCount}건 있습니다.
          {stats.dupExtraCount === 0
            ? ' «전체 선택» 후 «중복 아님 처리»를 누르셨다면 중복 의심 숫자가 0으로 보일 수 있습니다. 위 «마지막 중복 아님 되돌리기»로 방금 작업만 취소하거나, 여러 번 처리했다면 «전체 되돌리기»를 사용하세요.'
            : ' 일부만 숨긴 상태입니다. 실수로 처리했다면 «마지막 중복 아님 되돌리기»로 방금 작업만 되돌릴 수 있습니다.'}
        </p>
      ) : null}

      <p className="text-[11px] text-slate-500 leading-relaxed bg-slate-50 border border-slate-100 rounded-md px-3 py-2">
        <strong>세금 보고 권장 흐름</strong> — ① 미대조 금액을 <AccountingTerm termKey="명세대조">명세 대조</AccountingTerm>{' '}
        탭에서 연결해 실제 은행·카드 거래와 맞추고, ② 중복 의심 건은 정리(삭제 보관함)한 뒤, ③ 커버리지가 충분히 높아진 상태의
        합계로 보고하세요. 명세에 잡히지 않는 현금 지출은 모달 하단 «유사 현금 지출»에서 현금 관리 출금과 연결할 수 있습니다.
      </p>
    </div>
  )
}
