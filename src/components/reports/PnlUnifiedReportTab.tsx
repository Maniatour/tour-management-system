'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocale } from 'next-intl'
import { PieChart, Save, BookOpen, Settings } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fetchReconciledSourceIdsBatched } from '@/lib/reconciliation-match-queries'
import { getDefaultLedgerBaseDate, getFiscalReportingSettings } from '@/lib/fiscal-settings'
import { Button } from '@/components/ui/button'
import { AccountingTerm } from '@/components/ui/AccountingTerm'
import type { ExpenseStandardCategoryPickRow } from '@/lib/expenseStandardCategoryPaidFor'
import { buildPnlStandardCategoryTableRows, PNL_UNMATCHED_BUCKET_KEY } from '@/lib/pnlStandardCategoryTable'
import PnlUnifiedExpenseDetailDialog, {
  type PnlDetailLine,
  type PnlDrillState,
  type PnlExpenseSource,
} from '@/components/reports/PnlUnifiedExpenseDetailDialog'
import CategoryManagerModal from '@/components/expenses/CategoryManagerModal'

interface PnlUnifiedReportTabProps {
  dateRange: { start: string; end: string }
}

function mappingOriginalForExpense(
  source: PnlExpenseSource,
  r: { paid_for?: string | null; category?: string | null }
): string {
  if (source === 'tour_expenses' || source === 'reservation_expenses') {
    return (r.paid_for || '').trim() || '기타'
  }
  if (source === 'company_expenses') {
    return (r.paid_for || r.category || '').trim() || '기타'
  }
  return (r.category || '').trim() || '입장권'
}

function bucketForResolvedLeaf(resolvedLeafId: string | null, leafIdSet: Set<string>): string {
  if (resolvedLeafId && leafIdSet.has(resolvedLeafId)) return resolvedLeafId
  return PNL_UNMATCHED_BUCKET_KEY
}

/** submit_on 기준 로컬 연-월 (YYYY-MM) */
function yearMonthFromSubmitOn(iso: string): string {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  return `${y}-${String(m).padStart(2, '0')}`
}

function enumerateMonthsInclusive(startYmd: string, endYmd: string): string[] {
  const s = new Date(startYmd + 'T00:00:00')
  const e = new Date(endYmd + 'T23:59:59')
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return []
  const out: string[] = []
  const cur = new Date(s.getFullYear(), s.getMonth(), 1)
  const endM = new Date(e.getFullYear(), e.getMonth(), 1)
  while (cur <= endM) {
    out.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`)
    cur.setMonth(cur.getMonth() + 1)
  }
  return out
}

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split('-').map((x) => parseInt(x, 10))
  if (!y || !m) return ym
  return `${y}년 ${m}월`
}

function formatMoney(n: number): string {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

export default function PnlUnifiedReportTab({ dateRange }: PnlUnifiedReportTabProps) {
  const locale = useLocale()
  const [ledgerBase, setLedgerBase] = useState(getDefaultLedgerBaseDate())
  const [editLedger, setEditLedger] = useState(getDefaultLedgerBaseDate())
  const [savingFiscal, setSavingFiscal] = useState(false)
  const [loading, setLoading] = useState(true)
  /** 표준 리프 id 또는 미매칭 버킷 → 월(YYYY-MM) → 금액 */
  const [monthlyCells, setMonthlyCells] = useState<Record<string, Record<string, number>>>({})
  const [standardCategoryRows, setStandardCategoryRows] = useState<ExpenseStandardCategoryPickRow[]>([])
  const [pnlDetailLines, setPnlDetailLines] = useState<PnlDetailLine[]>([])
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailDrill, setDetailDrill] = useState<PnlDrillState | null>(null)
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false)
  const [totalExcl, setTotalExcl] = useState(0)

  const { rows: pnlTableRows, groups: unifiedStandardGroups } = useMemo(
    () => buildPnlStandardCategoryTableRows(standardCategoryRows, locale),
    [standardCategoryRows, locale]
  )

  useEffect(() => {
    getFiscalReportingSettings().then((s) => {
      setLedgerBase(s.ledgerBaseDate)
      setEditLedger(s.ledgerBaseDate)
    })
  }, [])

  const saveFiscal = async () => {
    setSavingFiscal(true)
    const { error } = await supabase.from('shared_settings').upsert(
      {
        setting_key: 'fiscal_reporting',
        setting_value: { ledgerBaseDate: editLedger }
      },
      { onConflict: 'setting_key' }
    )
    setSavingFiscal(false)
    if (error) {
      alert(error.message)
      return
    }
    setLedgerBase(editLedger)
  }

  const loadPnl = useCallback(async () => {
    setLoading(true)
    const startISO = new Date(dateRange.start + 'T00:00:00').toISOString()
    const endISO = new Date(dateRange.end + 'T23:59:59.999').toISOString()

    const [{ data: mappings }, { data: standards }] = await Promise.all([
      supabase
        .from('expense_category_mappings')
        .select('original_value, source_table, standard_category_id, sub_category_id'),
      supabase
        .from('expense_standard_categories')
        .select('id, name, name_ko, parent_id, display_order, is_active, tax_deductible'),
    ])

    const cats: ExpenseStandardCategoryPickRow[] = (standards || []) as ExpenseStandardCategoryPickRow[]
    setStandardCategoryRows(cats)
    const { leafIdSet } = buildPnlStandardCategoryTableRows(cats, locale)

    const mapToLeaf = new Map<string, string>()
    for (const m of mappings || []) {
      const row = m as {
        original_value: string
        source_table: string
        standard_category_id: string | null
        sub_category_id: string | null
      }
      const eff = row.sub_category_id || row.standard_category_id
      if (eff) {
        mapToLeaf.set(`${row.original_value}::${row.source_table}`, eff)
      }
    }

    const [{ data: te }, { data: re }, { data: ce }, { data: tb }] = await Promise.all([
      supabase
        .from('tour_expenses')
        .select('id, amount, paid_for, paid_to, note, payment_method, exclude_from_pnl, submit_on')
        .gte('submit_on', startISO)
        .lte('submit_on', endISO),
      supabase
        .from('reservation_expenses')
        .select('id, amount, paid_for, paid_to, note, payment_method, exclude_from_pnl, submit_on')
        .gte('submit_on', startISO)
        .lte('submit_on', endISO),
      supabase
        .from('company_expenses')
        .select('id, amount, paid_for, category, paid_to, notes, description, payment_method, exclude_from_pnl, submit_on')
        .gte('submit_on', startISO)
        .lte('submit_on', endISO),
      supabase
        .from('ticket_bookings')
        .select('id, expense, category, company, note, payment_method, submit_on')
        .gte('submit_on', startISO)
        .lte('submit_on', endISO)
        .in('status', ['confirmed', 'paid'])
    ])

    const monthly = new Map<string, Map<string, number>>()
    const detailLines: PnlDetailLine[] = []
    let excluded = 0

    const addMonthly = (bucketKey: string, submitOn: string | null, amount: number) => {
      if (!submitOn) return
      const ym = yearMonthFromSubmitOn(submitOn)
      if (!monthly.has(bucketKey)) monthly.set(bucketKey, new Map())
      const row = monthly.get(bucketKey)!
      row.set(ym, (row.get(ym) || 0) + amount)
    }

    for (const x of te || []) {
      const r = x as {
        id: string
        amount: unknown
        paid_for: string | null
        paid_to: string | null
        note: string | null
        payment_method: string | null
        exclude_from_pnl: boolean | null
        submit_on: string | null
      }
      const amt = Number(r.amount) || 0
      if (r.exclude_from_pnl) {
        excluded += amt
        continue
      }
      if (!r.submit_on) continue
      const orig = mappingOriginalForExpense('tour_expenses', r)
      const resolvedLeafId = mapToLeaf.get(`${orig}::tour_expenses`) ?? null
      const bucketKey = bucketForResolvedLeaf(resolvedLeafId, leafIdSet)
      addMonthly(bucketKey, r.submit_on, amt)
      detailLines.push({
        id: r.id,
        source: 'tour_expenses',
        bucketKey,
        resolvedLeafId,
        mappingOriginalValue: orig,
        yearMonth: yearMonthFromSubmitOn(r.submit_on),
        amount: amt,
        submit_on: r.submit_on,
        paid_to: r.paid_to,
        paid_for: r.paid_for,
        payment_method: r.payment_method,
        statementReconciled: false,
        category: null,
        company: null,
        note: r.note,
        exclude_from_pnl: r.exclude_from_pnl ?? false,
      })
    }
    for (const x of re || []) {
      const r = x as {
        id: string
        amount: unknown
        paid_for: string | null
        paid_to: string | null
        note: string | null
        payment_method: string | null
        exclude_from_pnl: boolean | null
        submit_on: string | null
      }
      const amt = Number(r.amount) || 0
      if (r.exclude_from_pnl) {
        excluded += amt
        continue
      }
      if (!r.submit_on) continue
      const orig = mappingOriginalForExpense('reservation_expenses', r)
      const resolvedLeafId = mapToLeaf.get(`${orig}::reservation_expenses`) ?? null
      const bucketKey = bucketForResolvedLeaf(resolvedLeafId, leafIdSet)
      addMonthly(bucketKey, r.submit_on, amt)
      detailLines.push({
        id: r.id,
        source: 'reservation_expenses',
        bucketKey,
        resolvedLeafId,
        mappingOriginalValue: orig,
        yearMonth: yearMonthFromSubmitOn(r.submit_on),
        amount: amt,
        submit_on: r.submit_on,
        paid_to: r.paid_to,
        paid_for: r.paid_for,
        payment_method: r.payment_method,
        statementReconciled: false,
        category: null,
        company: null,
        note: r.note,
        exclude_from_pnl: r.exclude_from_pnl ?? false,
      })
    }
    for (const x of ce || []) {
      const r = x as {
        id: string
        amount: unknown
        paid_for: string | null
        category: string | null
        paid_to: string | null
        notes: string | null
        description: string | null
        payment_method: string | null
        exclude_from_pnl: boolean | null
        submit_on: string | null
      }
      const amt = Number(r.amount) || 0
      if (r.exclude_from_pnl) {
        excluded += amt
        continue
      }
      if (!r.submit_on) continue
      const orig = mappingOriginalForExpense('company_expenses', r)
      const resolvedLeafId = mapToLeaf.get(`${orig}::company_expenses`) ?? null
      const bucketKey = bucketForResolvedLeaf(resolvedLeafId, leafIdSet)
      addMonthly(bucketKey, r.submit_on, amt)
      const memo = [r.notes, r.description].filter(Boolean).join(' · ') || null
      detailLines.push({
        id: r.id,
        source: 'company_expenses',
        bucketKey,
        resolvedLeafId,
        mappingOriginalValue: orig,
        yearMonth: yearMonthFromSubmitOn(r.submit_on),
        amount: amt,
        submit_on: r.submit_on,
        paid_to: r.paid_to,
        paid_for: r.paid_for,
        payment_method: r.payment_method,
        statementReconciled: false,
        category: r.category,
        company: null,
        note: memo,
        exclude_from_pnl: r.exclude_from_pnl ?? false,
      })
    }
    for (const x of tb || []) {
      const r = x as {
        id: string
        expense: unknown
        category: string | null
        company: string | null
        note: string | null
        payment_method: string | null
        submit_on: string | null
      }
      const amt = Number(r.expense) || 0
      if (!r.submit_on) continue
      const orig = mappingOriginalForExpense('ticket_bookings', r)
      const resolvedLeafId = mapToLeaf.get(`${orig}::ticket_bookings`) ?? null
      const bucketKey = bucketForResolvedLeaf(resolvedLeafId, leafIdSet)
      addMonthly(bucketKey, r.submit_on, amt)
      detailLines.push({
        id: r.id,
        source: 'ticket_bookings',
        bucketKey,
        resolvedLeafId,
        mappingOriginalValue: orig,
        yearMonth: yearMonthFromSubmitOn(r.submit_on),
        amount: amt,
        submit_on: r.submit_on,
        paid_to: null,
        paid_for: null,
        payment_method: r.payment_method,
        statementReconciled: false,
        category: r.category,
        company: r.company,
        note: r.note,
        exclude_from_pnl: false,
      })
    }

    const teIds = detailLines.filter((l) => l.source === 'tour_expenses').map((l) => l.id)
    const reIds = detailLines.filter((l) => l.source === 'reservation_expenses').map((l) => l.id)
    const ceIds = detailLines.filter((l) => l.source === 'company_expenses').map((l) => l.id)
    const tbIds = detailLines.filter((l) => l.source === 'ticket_bookings').map((l) => l.id)

    const [teRe, reRe, ceRe, tbRe] = await Promise.all([
      fetchReconciledSourceIdsBatched(supabase, 'tour_expenses', teIds),
      fetchReconciledSourceIdsBatched(supabase, 'reservation_expenses', reIds),
      fetchReconciledSourceIdsBatched(supabase, 'company_expenses', ceIds),
      fetchReconciledSourceIdsBatched(supabase, 'ticket_bookings', tbIds),
    ])

    const detailLinesWithRecon: PnlDetailLine[] = detailLines.map((l) => ({
      ...l,
      statementReconciled:
        (l.source === 'tour_expenses' && teRe.has(l.id)) ||
        (l.source === 'reservation_expenses' && reRe.has(l.id)) ||
        (l.source === 'company_expenses' && ceRe.has(l.id)) ||
        (l.source === 'ticket_bookings' && tbRe.has(l.id)),
    }))

    const cells: Record<string, Record<string, number>> = {}
    for (const [cat, mmap] of monthly) {
      cells[cat] = Object.fromEntries(mmap)
    }

    setMonthlyCells(cells)
    setPnlDetailLines(detailLinesWithRecon)
    setTotalExcl(excluded)
    setLoading(false)
  }, [dateRange, locale])

  useEffect(() => {
    loadPnl()
  }, [loadPnl])

  const months = useMemo(
    () => enumerateMonthsInclusive(dateRange.start, dateRange.end),
    [dateRange.start, dateRange.end]
  )

  const { rowTotals, colTotals, grandTotal } = useMemo(() => {
    const bucketKeys = Object.keys(monthlyCells)
    const rowTotals: Record<string, number> = {}
    for (const k of bucketKeys) {
      rowTotals[k] = Object.values(monthlyCells[k] || {}).reduce((s, v) => s + v, 0)
    }
    const colTotals: Record<string, number> = {}
    for (const ym of months) {
      let s = 0
      for (const k of bucketKeys) {
        s += monthlyCells[k]?.[ym] ?? 0
      }
      colTotals[ym] = s
    }
    const grandTotal = bucketKeys.reduce((sum, k) => sum + (rowTotals[k] ?? 0), 0)
    return { rowTotals, colTotals, grandTotal }
  }, [monthlyCells, months])

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6 min-w-0">
      <section className="rounded-lg border border-slate-200 bg-slate-50 p-4 sm:p-5 text-xs sm:text-sm text-slate-800 space-y-4">
        <div className="flex items-start gap-2">
          <BookOpen className="h-5 w-5 shrink-0 text-slate-600 mt-0.5" />
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-slate-900">이 화면의 위치</h2>
            <p>
              <strong>관리자 › 종합 통계 리포트</strong> 상단 탭 중{' '}
              <strong>
                「통합 <AccountingTerm termKey="PNL">PNL</AccountingTerm>」
              </strong>
              입니다. (URL 예:{' '}
              <code className="rounded bg-white px-1.5 py-0.5 text-xs border">/ko/admin/reports</code>)
            </p>
          </div>
        </div>
        <div className="border-t border-slate-200 pt-4 space-y-2">
          <h3 className="font-semibold text-slate-900">무엇을 보여 주나</h3>
          <ul className="list-disc list-inside space-y-1.5 leading-relaxed pl-1">
            <li>
              선택한{' '}
              <strong>
                <AccountingTerm termKey="리포트기간">리포트 기간</AccountingTerm>
              </strong>
              (위쪽에서 일/월/기간 선택한 것과 동일) 안의 지출을 모읍니다.
            </li>
            <li>
              출처: <code className="text-xs bg-white px-1 rounded border">tour_expenses</code>,{' '}
              <code className="text-xs bg-white px-1 rounded border">reservation_expenses</code>,{' '}
              <code className="text-xs bg-white px-1 rounded border">company_expenses</code>,{' '}
              <code className="text-xs bg-white px-1 rounded border">ticket_bookings</code>.
            </li>
            <li>
              행 구조·순서는 <strong>카테고리 매니저 › 표준 카테고리 관리</strong>에 등록된{' '}
              <code className="text-xs bg-white px-1 rounded border">expense_standard_categories</code> 트리와 같습니다(
              상위 그룹 헤더 + 들여쓰기된 하위 리프). 집계는{' '}
              <code className="text-xs bg-white px-1 rounded border">expense_category_mappings</code>의 리프(또는 상위만
              있을 때) 기준이며, 트리에 없는 매핑·미매칭은 맨 아래 <strong>매칭되지 않은 지출</strong> 행에 모읍니다.
            </li>
            <li>
              <strong>exclude_from_pnl</strong>이 켜진 행(
              <AccountingTerm termKey="명세대조">명세 대조</AccountingTerm> 탭에서 개인·
              <AccountingTerm termKey="PNL제외">PNL 제외</AccountingTerm> 처리한 회사 지출/투어/예약 지출 등)은 합계에서 빼고, 하단에 “제외된 금액 합계”로만 보여 줍니다.
            </li>
          </ul>
        </div>
        <div className="border-t border-slate-200 pt-4 space-y-2">
          <h3 className="font-semibold text-slate-900">
            <AccountingTerm termKey="원장기준일">원장 기준일</AccountingTerm>
          </h3>
          <p className="leading-relaxed">
            아래{' '}
            <strong>
              <AccountingTerm termKey="원장기준일">원장 기준일</AccountingTerm>
            </strong>
            은 <strong>
              <AccountingTerm termKey="현금관리">현금 관리</AccountingTerm>
            </strong>{' '}
            탭의 누적 <AccountingTerm termKey="잔액">잔액</AccountingTerm> 계산 시작일과 같습니다.
            DB의 <code className="text-xs bg-white px-1 rounded border">shared_settings</code> 키{' '}
            <code className="text-xs">fiscal_reporting.ledgerBaseDate</code>에 저장되며, 기본은 <strong>2025-01-01</strong>
            입니다. 2025년부터 장부를 맞추려면 이 날짜를 그대로 두거나, 실제로 잔액을 맞추기 시작한 날로 조정한 뒤{' '}
            <strong>저장</strong>하세요.
          </p>
        </div>
        <div className="border-t border-slate-200 pt-4 space-y-2">
          <h3 className="font-semibold text-slate-900">
            <AccountingTerm termKey="명세대조">명세 대조</AccountingTerm> 탭과의 관계
          </h3>
          <p className="leading-relaxed">
            <strong>
              <AccountingTerm termKey="명세대조">명세 대조</AccountingTerm>
            </strong>
            에서 <AccountingTerm termKey="미매칭">미매칭</AccountingTerm> 줄을{' '}
            <strong>
              <AccountingTerm termKey="보정지출">보정 지출</AccountingTerm>
            </strong>
            로 넣으면 <code className="text-xs">company_expenses</code>에 잡히므로, 같은 기간을 선택하면 이 통합{' '}
            <AccountingTerm termKey="PNL">PNL</AccountingTerm> 표에도 반영됩니다.{' '}
            <AccountingTerm termKey="세금보고">세금 보고용</AccountingTerm> 분류를 맞추려면 보정 시
            카테고리와 <code className="text-xs">expense_category_mappings</code>를 함께 정리하는 것이 좋습니다.
          </p>
        </div>
      </section>

      <div className="rounded-lg border border-gray-200 bg-white p-3 sm:p-4 space-y-3">
        <h3 className="font-semibold flex flex-wrap items-center gap-x-2 gap-y-1 text-sm sm:text-base">
          <PieChart className="h-5 w-5 shrink-0" />
          <AccountingTerm termKey="손익">손익</AccountingTerm>·<AccountingTerm termKey="원장">원장</AccountingTerm> 설정
        </h3>
        <p className="text-sm text-gray-600">
          현금 리포트 <AccountingTerm termKey="잔액">잔액</AccountingTerm> 등에 쓰이는{' '}
          <AccountingTerm termKey="원장기준일">원장 기준일</AccountingTerm>입니다. 기본값은 2025-01-01 입니다. (shared_settings ·
          fiscal_reporting)
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <label className="text-sm flex flex-col gap-1 sm:block min-w-0">
            <AccountingTerm termKey="원장기준일">원장 기준일</AccountingTerm>
            <input
              type="date"
              className="sm:ml-2 border rounded px-2 py-2 text-sm w-full sm:w-auto min-h-[44px]"
              value={editLedger}
              onChange={(e) => setEditLedger(e.target.value)}
            />
          </label>
          <Button type="button" size="sm" onClick={saveFiscal} disabled={savingFiscal}>
            <Save className="h-4 w-4 mr-1" />
            저장
          </Button>
          <span className="text-xs text-gray-500">적용값: {ledgerBase}</span>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
          <h3 className="font-semibold flex flex-wrap items-center gap-x-1 gap-y-1">
            <AccountingTerm termKey="통합지출">통합 지출</AccountingTerm>
            <span className="font-normal text-gray-600">
              (<AccountingTerm termKey="표준카테고리">표준 카테고리</AccountingTerm> 매핑 반영)
            </span>
          </h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => setCategoryManagerOpen(true)}
          >
            <Settings className="h-4 w-4 mr-1.5" aria-hidden />
            표준 카테고리·매핑 관리
          </Button>
        </div>
        <p className="text-xs sm:text-sm text-gray-600 mb-4 break-words">
          기간 {dateRange.start} ~ {dateRange.end} · exclude_from_pnl 인 건은 제외했습니다 (합계: $
          {totalExcl.toLocaleString(undefined, { maximumFractionDigits: 2 })})
        </p>
        <p className="text-xs text-blue-900/90 bg-blue-50 border border-blue-100 rounded-md px-3 py-2 mb-3">
          금액·합계 셀을 누르면 <strong>상세 지출</strong> 모달이 열립니다. 모달 상단에서 원문·출처별로{' '}
          <strong>표준 카테고리(리프) 매핑</strong>을 저장할 수 있고, 하단에서 지출 금액·분류·PNL 제외 등을 수정할 수
          있습니다(입장권 부킹은 PNL 제외 옵션 없음).
        </p>
        <div className="overflow-x-auto -mx-1 px-1 sm:mx-0 touch-pan-x">
          <table className="w-full min-w-[480px] text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="border-b text-left text-gray-500 bg-slate-50">
                <th className="py-2 pl-2 pr-3 font-medium sticky left-0 z-20 bg-slate-50 min-w-[220px] max-w-[min(42vw,22rem)]">
                  <AccountingTerm termKey="표준카테고리">표준 카테고리</AccountingTerm>
                </th>
                {months.map((ym) => (
                  <th key={ym} className="py-2 px-2 text-right font-medium whitespace-nowrap min-w-[88px]">
                    {formatMonthLabel(ym)}
                  </th>
                ))}
                <th className="py-2 pl-2 pr-2 text-right font-semibold text-gray-700 whitespace-nowrap min-w-[100px] bg-slate-100">
                  합계
                </th>
              </tr>
            </thead>
            <tbody>
              {standardCategoryRows.length === 0 && !loading ? (
                <tr>
                  <td className="py-6 text-center text-gray-500" colSpan={Math.max(2, months.length + 2)}>
                    표준 카테고리를 불러오지 못했습니다. DB 마이그레이션과 권한을 확인하세요.
                  </td>
                </tr>
              ) : (
                pnlTableRows.map((row) => {
                  if (row.kind === 'group-header') {
                    const groupMonthSum = (ym: string) =>
                      row.leafIds.reduce((s, id) => s + (monthlyCells[id]?.[ym] ?? 0), 0)
                    const groupPeriodSum = row.leafIds.reduce((s, id) => s + (rowTotals[id] ?? 0), 0)
                    return (
                      <tr key={row.rowKey} className="bg-slate-100/95 border-b border-slate-200">
                        <td className="py-1.5 pl-3 pr-2 text-[11px] sm:text-xs font-semibold text-slate-800 leading-snug sticky left-0 z-10 bg-slate-100/95 shadow-[2px_0_4px_rgba(15,23,42,0.06)]">
                          {row.label}
                        </td>
                        {months.map((ym) => {
                          const v = groupMonthSum(ym)
                          return (
                            <td
                              key={ym}
                              className="py-1.5 px-2 text-right tabular-nums text-slate-700 font-semibold text-[11px] sm:text-xs"
                              title="이 그룹 하위 표준 리프 합계"
                            >
                              {v !== 0 ? formatMoney(v) : '—'}
                            </td>
                          )
                        })}
                        <td
                          className="py-1.5 pl-2 pr-2 text-right tabular-nums font-semibold text-slate-900 text-[11px] sm:text-xs bg-slate-200/80"
                          title="이 그룹 하위 표준 리프 기간 합계"
                        >
                          {groupPeriodSum !== 0 ? formatMoney(groupPeriodSum) : '—'}
                        </td>
                      </tr>
                    )
                  }
                  const dataKey = row.rowKey
                  const rowTitle = row.label
                  const isUnmatched = row.kind === 'unmatched'
                  return (
                    <tr
                      key={row.rowKey}
                      className={`border-b border-gray-100 hover:bg-gray-50/80 ${isUnmatched ? 'bg-amber-50/35' : ''}`}
                    >
                      <td
                        className={`py-2 pr-3 align-top sticky left-0 z-10 text-[11px] sm:text-xs leading-snug shadow-[2px_0_4px_rgba(15,23,42,0.06)] ${
                          row.kind === 'leaf' && row.indentSubcategory ? 'pl-5 sm:pl-7' : 'pl-2'
                        } ${isUnmatched ? 'bg-amber-50/95 font-medium' : 'bg-white'}`}
                      >
                        {row.label}
                      </td>
                      {months.map((ym) => {
                        const v = monthlyCells[dataKey]?.[ym] ?? 0
                        return (
                          <td key={ym} className="py-1 px-2 text-right tabular-nums">
                            <button
                              type="button"
                              title="이 달·이 표준 분류 상세"
                              className={`w-full min-h-[36px] rounded px-1 py-1 -mx-1 transition-colors ${
                                v !== 0
                                  ? 'text-blue-800 hover:bg-blue-50 hover:underline underline-offset-2'
                                  : 'text-gray-400 hover:bg-slate-100'
                              }`}
                              onClick={() => {
                                setDetailDrill({
                                  mode: 'cell',
                                  rowId: dataKey,
                                  month: ym,
                                  rowTitle: rowTitle,
                                })
                                setDetailOpen(true)
                              }}
                            >
                              {v !== 0 ? formatMoney(v) : '—'}
                            </button>
                          </td>
                        )
                      })}
                      <td
                        className={`py-1 pl-2 pr-2 text-right tabular-nums font-medium ${
                          isUnmatched ? 'bg-amber-100/70' : 'bg-slate-50/90'
                        }`}
                      >
                        <button
                          type="button"
                          title="이 행·기간 전체 상세"
                          className="w-full min-h-[36px] rounded px-1 py-1 -mx-1 text-blue-900 hover:bg-blue-50 hover:underline underline-offset-2"
                          onClick={() => {
                            setDetailDrill({
                              mode: 'row',
                              rowId: dataKey,
                              rowTitle: `${rowTitle} · 기간 합계`,
                            })
                            setDetailOpen(true)
                          }}
                        >
                          {formatMoney(rowTotals[dataKey] ?? 0)}
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
            {standardCategoryRows.length > 0 && months.length > 0 && (
              <tfoot>
                <tr className="font-semibold border-t-2 border-slate-200 bg-slate-50">
                  <td className="py-2 pl-2 pr-3 sticky left-0 z-10 bg-slate-50">월 합계</td>
                  {months.map((ym) => (
                    <td key={ym} className="py-1 px-2 text-right tabular-nums">
                      <button
                        type="button"
                        title="이 달·전체 카테고리 상세"
                        className="w-full min-h-[36px] rounded px-1 py-1 -mx-1 text-blue-900 hover:bg-blue-50 hover:underline underline-offset-2"
                        onClick={() => {
                          setDetailDrill({ mode: 'col', month: ym })
                          setDetailOpen(true)
                        }}
                      >
                        {formatMoney(colTotals[ym] ?? 0)}
                      </button>
                    </td>
                  ))}
                  <td className="py-1 pl-2 pr-2 text-right tabular-nums bg-slate-100">
                    <button
                      type="button"
                      title="기간 전체 상세"
                      className="w-full min-h-[36px] rounded px-1 py-1 -mx-1 text-blue-950 hover:bg-blue-100/80 hover:underline underline-offset-2 font-semibold"
                      onClick={() => {
                        setDetailDrill({ mode: 'grand' })
                        setDetailOpen(true)
                      }}
                    >
                      {formatMoney(grandTotal)}
                    </button>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <CategoryManagerModal
        isOpen={categoryManagerOpen}
        onClose={() => {
          setCategoryManagerOpen(false)
          void loadPnl()
        }}
        onSave={() => {
          void loadPnl()
        }}
      />

      <PnlUnifiedExpenseDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        drill={detailDrill}
        lines={pnlDetailLines}
        formatMonthLabel={formatMonthLabel}
        onSaved={loadPnl}
        expenseStandardCategories={standardCategoryRows}
        unifiedStandardGroups={unifiedStandardGroups}
      />
    </div>
  )
}
