'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { PieChart, Save, BookOpen } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getDefaultLedgerBaseDate, getFiscalReportingSettings } from '@/lib/fiscal-settings'
import { Button } from '@/components/ui/button'
import { AccountingTerm } from '@/components/ui/AccountingTerm'

interface PnlUnifiedReportTabProps {
  dateRange: { start: string; end: string }
}

type CatRow = { categoryLabel: string; amount: number; source: string }

function mapKey(
  paidFor: string | null,
  sourceTable: string,
  mappings: Map<string, string>
): string {
  const raw = (paidFor || '').trim() || '기타'
  return mappings.get(`${raw}::${sourceTable}`) || raw
}

export default function PnlUnifiedReportTab({ dateRange }: PnlUnifiedReportTabProps) {
  const [ledgerBase, setLedgerBase] = useState(getDefaultLedgerBaseDate())
  const [editLedger, setEditLedger] = useState(getDefaultLedgerBaseDate())
  const [savingFiscal, setSavingFiscal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<CatRow[]>([])
  const [totalExcl, setTotalExcl] = useState(0)

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
      supabase.from('expense_category_mappings').select('original_value, source_table, standard_category_id'),
      supabase.from('expense_standard_categories').select('id, name, name_ko')
    ])

    const stdName = new Map<string, string>()
    for (const s of standards || []) {
      stdName.set(
        (s as { id: string }).id,
        (s as { name_ko: string | null; name: string }).name_ko ||
          (s as { name: string }).name
      )
    }

    const mapLookup = new Map<string, string>()
    for (const m of mappings || []) {
      const row = m as { original_value: string; source_table: string; standard_category_id: string | null }
      if (row.standard_category_id) {
        mapLookup.set(
          `${row.original_value}::${row.source_table}`,
          stdName.get(row.standard_category_id) || row.standard_category_id
        )
      }
    }

    const [{ data: te }, { data: re }, { data: ce }, { data: tb }] = await Promise.all([
      supabase
        .from('tour_expenses')
        .select('amount, paid_for, exclude_from_pnl')
        .gte('submit_on', startISO)
        .lte('submit_on', endISO),
      supabase
        .from('reservation_expenses')
        .select('amount, paid_for, exclude_from_pnl')
        .gte('submit_on', startISO)
        .lte('submit_on', endISO),
      supabase
        .from('company_expenses')
        .select('amount, paid_for, category, exclude_from_pnl')
        .gte('submit_on', startISO)
        .lte('submit_on', endISO),
      supabase
        .from('ticket_bookings')
        .select('expense, category')
        .gte('submit_on', startISO)
        .lte('submit_on', endISO)
        .in('status', ['confirmed', 'paid'])
    ])

    const agg = new Map<string, { amount: number; source: string }>()
    let excluded = 0

    const add = (label: string, amount: number, source: string) => {
      const prev = agg.get(label)
      if (prev) prev.amount += amount
      else agg.set(label, { amount, source })
    }

    for (const x of te || []) {
      const r = x as { amount: unknown; paid_for: string | null; exclude_from_pnl: boolean | null }
      const amt = Number(r.amount) || 0
      if (r.exclude_from_pnl) {
        excluded += amt
        continue
      }
      const label = mapKey(r.paid_for, 'tour_expenses', mapLookup)
      add(label, amt, 'tour_expenses')
    }
    for (const x of re || []) {
      const r = x as { amount: unknown; paid_for: string | null; exclude_from_pnl: boolean | null }
      const amt = Number(r.amount) || 0
      if (r.exclude_from_pnl) {
        excluded += amt
        continue
      }
      const label = mapKey(r.paid_for, 'reservation_expenses', mapLookup)
      add(label, amt, 'reservation_expenses')
    }
    for (const x of ce || []) {
      const r = x as {
        amount: unknown
        paid_for: string | null
        category: string | null
        exclude_from_pnl: boolean | null
      }
      const amt = Number(r.amount) || 0
      if (r.exclude_from_pnl) {
        excluded += amt
        continue
      }
      const label = mapKey(r.paid_for || r.category, 'company_expenses', mapLookup)
      add(label, amt, 'company_expenses')
    }
    for (const x of tb || []) {
      const r = x as { expense: unknown; category: string | null }
      const amt = Number(r.expense) || 0
      const label = r.category || '입장권'
      add(label, amt, 'ticket_bookings')
    }

    const list: CatRow[] = Array.from(agg.entries()).map(([categoryLabel, v]) => ({
      categoryLabel,
      amount: v.amount,
      source: v.source
    }))
    list.sort((a, b) => b.amount - a.amount)

    setRows(list)
    setTotalExcl(excluded)
    setLoading(false)
  }, [dateRange])

  useEffect(() => {
    loadPnl()
  }, [loadPnl])

  const grandTotal = useMemo(() => rows.reduce((s, r) => s + r.amount, 0), [rows])

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
              <code className="text-xs bg-white px-1 rounded border">expense_category_mappings</code>에 따라{' '}
              <strong>
                <AccountingTerm termKey="표준카테고리">표준 카테고리</AccountingTerm> 이름
              </strong>
              으로 묶어 보여 줍니다. 매핑이 없으면 <code className="text-xs">paid_for</code>·
              카테고리 문자열 그대로 나옵니다.
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
        <h3 className="font-semibold mb-2 flex flex-wrap items-center gap-x-1 gap-y-1">
          <AccountingTerm termKey="통합지출">통합 지출</AccountingTerm>
          <span className="font-normal text-gray-600">
            (<AccountingTerm termKey="표준카테고리">표준 카테고리</AccountingTerm> 매핑 반영)
          </span>
        </h3>
        <p className="text-xs sm:text-sm text-gray-600 mb-4 break-words">
          기간 {dateRange.start} ~ {dateRange.end} · exclude_from_pnl 인 건은 제외했습니다 (합계: $
          {totalExcl.toLocaleString(undefined, { maximumFractionDigits: 2 })})
        </p>
        <div className="overflow-x-auto -mx-1 px-1 sm:mx-0 touch-pan-x">
          <table className="w-full min-w-[300px] text-xs sm:text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="py-2">카테고리(매핑 후)</th>
                <th className="py-2">출처</th>
                <th className="py-2 text-right">금액</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.categoryLabel}-${i}`} className="border-b border-gray-100">
                  <td className="py-2">{r.categoryLabel}</td>
                  <td className="py-2 text-gray-500">{r.source}</td>
                  <td className="py-2 text-right">${r.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td className="py-2" colSpan={2}>
                  합계
                </td>
                <td className="py-2 text-right">
                  ${grandTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}
