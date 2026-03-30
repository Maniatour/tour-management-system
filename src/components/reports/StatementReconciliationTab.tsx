'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Building2,
  CreditCard,
  Link2,
  Lock,
  RefreshCw,
  Upload,
  Wand2,
  Plus,
  AlertCircle,
  BookOpen
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { AccountingTerm } from '@/components/ui/AccountingTerm'
import { getAccountingHint } from '@/lib/accounting-term-hints'
import { makeDedupeKey, parseStatementCsvText } from '@/lib/statement-csv'
import {
  findBestExpenseForLine,
  type ExpenseCandidate
} from '@/lib/reconciliation-engine'

type FinancialAccount = {
  id: string
  name: string
  account_type: string
  currency: string
  is_active: boolean
}

type StatementImport = {
  id: string
  financial_account_id: string
  period_label: string | null
  period_start: string
  period_end: string
  status: string
  original_filename: string | null
  created_at: string
}

type StatementLine = {
  id: string
  statement_import_id: string
  posted_date: string
  amount: number | string
  direction: string
  description: string | null
  merchant: string | null
  matched_status: string
  exclude_from_pnl: boolean
  is_personal: boolean
  personal_partner: string | null
}

const PERSONAL_PARTNER_OPTIONS: { value: string; label: string }[] = [
  { value: 'partner1', label: 'Joey' },
  { value: 'partner2', label: 'Chad' },
  { value: 'erica', label: 'Erica' }
]

type PaymentMethodRow = {
  id: string
  method: string
  card_number_last4: string | null
  financial_account_id: string | null
}

export default function StatementReconciliationTab() {
  const { authUser } = useAuth()
  const email = authUser?.email ?? ''

  const [accounts, setAccounts] = useState<FinancialAccount[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodRow[]>([])
  const [imports, setImports] = useState<StatementImport[]>([])
  const [selectedImportId, setSelectedImportId] = useState<string | null>(null)
  const [lines, setLines] = useState<StatementLine[]>([])
  const [matches, setMatches] = useState<
    { statement_line_id: string; source_table: string; source_id: string }[]
  >([])

  const [newAccountName, setNewAccountName] = useState('')
  const [newAccountType, setNewAccountType] = useState<'bank' | 'credit_card'>('credit_card')
  const [csvText, setCsvText] = useState('')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [importAccountId, setImportAccountId] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const [adjustCategory, setAdjustCategory] = useState('Miscellaneous')
  const [adjustPaidFor, setAdjustPaidFor] = useState('명세 보정')

  const loadAccounts = useCallback(async () => {
    const { data, error } = await supabase
      .from('financial_accounts')
      .select('id, name, account_type, currency, is_active')
      .eq('is_active', true)
      .order('name')
    if (error) console.error(error)
    else setAccounts((data as FinancialAccount[]) || [])
  }, [])

  const loadPaymentMethods = useCallback(async () => {
    const { data, error } = await supabase
      .from('payment_methods')
      .select('id, method, card_number_last4, financial_account_id')
      .order('method')
    if (error) console.error(error)
    else setPaymentMethods((data as PaymentMethodRow[]) || [])
  }, [])

  const loadImports = useCallback(async () => {
    const { data, error } = await supabase
      .from('statement_imports')
      .select('*')
      .order('period_start', { ascending: false })
      .limit(80)
    if (error) console.error(error)
    else setImports((data as StatementImport[]) || [])
  }, [])

  const loadLinesAndMatches = useCallback(async (importId: string) => {
    const { data: lineData, error: e1 } = await supabase
      .from('statement_lines')
      .select('*')
      .eq('statement_import_id', importId)
      .order('posted_date')
    if (e1) console.error(e1)
    const linesArr = (lineData as StatementLine[]) || []
    setLines(linesArr)
    const ids = linesArr.map((l) => l.id)
    let matchRows: { statement_line_id: string; source_table: string; source_id: string }[] = []
    if (ids.length > 0) {
      const { data: matchData, error: e2 } = await supabase
        .from('reconciliation_matches')
        .select('statement_line_id, source_table, source_id')
        .in('statement_line_id', ids)
      if (e2) console.error(e2)
      matchRows = (matchData as typeof matchRows) || []
    }
    setMatches(matchRows)
  }, [])

  useEffect(() => {
    loadAccounts()
    loadPaymentMethods()
    loadImports()
  }, [loadAccounts, loadPaymentMethods, loadImports])

  useEffect(() => {
    if (selectedImportId) loadLinesAndMatches(selectedImportId)
  }, [selectedImportId, loadLinesAndMatches])

  const selectedImport = useMemo(
    () => imports.find((i) => i.id === selectedImportId) || null,
    [imports, selectedImportId]
  )

  const matchByLine = useMemo(() => {
    const m = new Map<string, { source_table: string; source_id: string }>()
    for (const x of matches) {
      m.set(x.statement_line_id, { source_table: x.source_table, source_id: x.source_id })
    }
    return m
  }, [matches])

  const createAccount = async () => {
    if (!newAccountName.trim()) return
    setLoading(true)
    setMessage(null)
    const { error } = await supabase.from('financial_accounts').insert({
      name: newAccountName.trim(),
      account_type: newAccountType,
      currency: 'USD',
      is_active: true
    })
    setLoading(false)
    if (error) {
      setMessage(error.message)
      return
    }
    setNewAccountName('')
    await loadAccounts()
    setMessage('금융 계정이 추가되었습니다.')
  }

  const savePaymentMethodAccount = async (pmId: string, faId: string | null) => {
    const { error } = await supabase
      .from('payment_methods')
      .update({ financial_account_id: faId })
      .eq('id', pmId)
    if (error) {
      setMessage(error.message)
      return
    }
    await loadPaymentMethods()
  }

  const importCsv = async () => {
    if (!importAccountId || !periodStart || !periodEnd || !csvText.trim()) {
      setMessage('계정·기간·CSV 내용을 입력하세요.')
      return
    }
    if (!email) {
      setMessage('로그인이 필요합니다.')
      return
    }
    setLoading(true)
    setMessage(null)
    const parsed = parseStatementCsvText(csvText)
    if (parsed.length === 0) {
      setLoading(false)
      setMessage('파싱된 행이 없습니다. 헤더(날짜·금액 등)를 확인하세요.')
      return
    }

    const periodLabel = `${periodStart.slice(0, 7)}`

    const { data: imp, error: eImp } = await supabase
      .from('statement_imports')
      .insert({
        financial_account_id: importAccountId,
        period_label: periodLabel,
        period_start: periodStart,
        period_end: periodEnd,
        status: 'imported',
        imported_by: email,
        original_filename: 'paste.csv'
      })
      .select('id')
      .single()

    if (eImp || !imp?.id) {
      setLoading(false)
      setMessage(eImp?.message || '명세 헤더 저장 실패')
      return
    }

    const importId = imp.id as string
    const rows = parsed.map((r, i) => ({
      statement_import_id: importId,
      posted_date: r.postedDate,
      amount: r.amount,
      direction: r.direction,
      description: r.description,
      merchant: r.merchant,
      external_reference: r.externalReference,
      dedupe_key: makeDedupeKey(importId, r, i),
      raw: r.raw as Record<string, unknown>,
      matched_status: 'unmatched' as const
    }))

    const chunk = 150
    for (let i = 0; i < rows.length; i += chunk) {
      const { error: e2 } = await supabase.from('statement_lines').insert(rows.slice(i, i + chunk))
      if (e2) {
        setLoading(false)
        setMessage(e2.message)
        return
      }
    }

    setLoading(false)
    setCsvText('')
    await loadImports()
    setSelectedImportId(importId)
    setMessage(`가져옴: ${parsed.length}행`)
  }

  const runAutoMatch = async () => {
    if (!selectedImport || !selectedImportId) return
    setLoading(true)
    setMessage(null)

    const start = new Date(selectedImport.period_start)
    const end = new Date(selectedImport.period_end)
    start.setDate(start.getDate() - 5)
    end.setDate(end.getDate() + 5)
    const startIso = start.toISOString()
    const endIso = end.toISOString()

    const [{ data: ce }, { data: te }, { data: re }, { data: existingMatches }] = await Promise.all([
      supabase
        .from('company_expenses')
        .select('id, amount, submit_on, paid_for, paid_to')
        .gte('submit_on', startIso)
        .lte('submit_on', endIso),
      supabase
        .from('tour_expenses')
        .select('id, amount, submit_on, paid_for, paid_to')
        .gte('submit_on', startIso)
        .lte('submit_on', endIso),
      supabase
        .from('reservation_expenses')
        .select('id, amount, submit_on, paid_for, paid_to')
        .gte('submit_on', startIso)
        .lte('submit_on', endIso),
      supabase.from('reconciliation_matches').select('source_table, source_id')
    ])

    const used = new Set<string>()
    for (const m of existingMatches || []) {
      used.add(`${m.source_table}:${m.source_id}`)
    }

    const candidates: ExpenseCandidate[] = [
      ...(ce || []).map((r: Record<string, unknown>) => ({
        source_table: 'company_expenses' as const,
        source_id: String(r.id),
        amount: Number(r.amount),
        occurred_at: String(r.submit_on),
        label: `${r.paid_for} / ${r.paid_to}`
      })),
      ...(te || []).map((r: Record<string, unknown>) => ({
        source_table: 'tour_expenses' as const,
        source_id: String(r.id),
        amount: Number(r.amount),
        occurred_at: String(r.submit_on),
        label: `${r.paid_for} / ${r.paid_to}`
      })),
      ...(re || []).map((r: Record<string, unknown>) => ({
        source_table: 'reservation_expenses' as const,
        source_id: String(r.id),
        amount: Number(r.amount),
        occurred_at: String(r.submit_on),
        label: `${r.paid_for} / ${r.paid_to}`
      }))
    ]

    let n = 0
    for (const line of lines) {
      if (line.direction !== 'outflow') continue
      if (matchByLine.has(line.id)) continue
      const amt = Number(line.amount)
      const best = findBestExpenseForLine(amt, line.posted_date, candidates, used)
      if (!best) continue
      const k = `${best.expense.source_table}:${best.expense.source_id}`
      used.add(k)
      const { error } = await supabase.from('reconciliation_matches').insert({
        statement_line_id: line.id,
        source_table: best.expense.source_table,
        source_id: best.expense.source_id,
        matched_amount: amt
      })
      if (error) {
        console.error(error)
        continue
      }
      await supabase
        .from('statement_lines')
        .update({ matched_status: 'matched' })
        .eq('id', line.id)
      n += 1
    }

    setLoading(false)
    setMessage(`자동 매칭 ${n}건`)
    await loadLinesAndMatches(selectedImportId)
  }

  const createAdjustment = async (line: StatementLine) => {
    if (!email) {
      setMessage('로그인 필요')
      return
    }
    setLoading(true)
    const submitOn = `${line.posted_date}T12:00:00.000Z`
    const { data: ins, error } = await supabase
      .from('company_expenses')
      .insert({
        paid_to: 'Statement',
        paid_for: adjustPaidFor || '명세 보정',
        description: line.description || line.merchant || '',
        amount: Number(line.amount),
        payment_method: 'Card',
        submit_by: email,
        category: adjustCategory,
        status: 'approved',
        ledger_expense_origin: 'statement_adjustment',
        statement_line_id: line.id,
        reconciliation_status: 'reconciled',
        exclude_from_pnl: line.exclude_from_pnl,
        is_personal: false,
        personal_partner: null,
        submit_on: submitOn
      })
      .select('id')
      .single()

    if (error || !ins?.id) {
      setLoading(false)
      setMessage(error?.message || '보정 지출 실패')
      return
    }

    await supabase.from('reconciliation_matches').insert({
      statement_line_id: line.id,
      source_table: 'company_expenses',
      source_id: String(ins.id),
      matched_amount: Number(line.amount)
    })
    await supabase.from('statement_lines').update({ matched_status: 'matched' }).eq('id', line.id)

    setLoading(false)
    setMessage('보정 지출이 생성·연결되었습니다.')
    await loadLinesAndMatches(selectedImportId!)
  }

  const lockImport = async () => {
    if (!selectedImportId) return
    setLoading(true)
    await supabase
      .from('statement_imports')
      .update({ status: 'locked' })
      .eq('id', selectedImportId)
    setLoading(false)
    await loadImports()
    setMessage('명세가 잠겼습니다.')
  }

  const toggleLineFlags = async (line: StatementLine, field: 'exclude_from_pnl' | 'is_personal') => {
    if (field === 'is_personal') {
      const next = !line.is_personal
      await supabase
        .from('statement_lines')
        .update({
          is_personal: next,
          personal_partner: next ? line.personal_partner : null
        })
        .eq('id', line.id)
    } else {
      const next = !line.exclude_from_pnl
      await supabase.from('statement_lines').update({ exclude_from_pnl: next }).eq('id', line.id)
    }
    await loadLinesAndMatches(selectedImportId!)
  }

  const setStatementPersonalPartner = async (
    line: StatementLine,
    partner: 'partner1' | 'partner2' | 'erica' | ''
  ) => {
    await supabase
      .from('statement_lines')
      .update({ personal_partner: partner || null })
      .eq('id', line.id)
    await loadLinesAndMatches(selectedImportId!)
  }

  const statementOutflowSum = useMemo(
    () =>
      lines
        .filter((l) => l.direction === 'outflow' && !l.exclude_from_pnl)
        .reduce((s, l) => s + Number(l.amount), 0),
    [lines]
  )

  return (
    <div className="space-y-6 sm:space-y-8 min-w-0">
      <section className="rounded-lg border border-slate-200 bg-slate-50 p-4 sm:p-5 text-xs sm:text-sm text-slate-800 space-y-4">
        <div className="flex items-start gap-2">
          <BookOpen className="h-5 w-5 shrink-0 text-slate-600 mt-0.5" />
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-slate-900">이 화면의 위치</h2>
            <p>
              별도 주소의 새 페이지가 아니라, <strong>관리자 › 종합 통계 리포트</strong> 화면 상단 탭 중{' '}
              <strong>「<AccountingTerm termKey="명세대조">명세 대조</AccountingTerm>」</strong>입니다. (URL 예:{' '}
              <code className="rounded bg-white px-1.5 py-0.5 text-xs border">/ko/admin/reports</code> 등 로케일에 따라 앞 경로만 달라집니다.)
            </p>
          </div>
        </div>

        <div className="border-t border-slate-200 pt-4 space-y-3">
          <h3 className="font-semibold text-slate-900">왜 필요한가</h3>
          <p className="leading-relaxed">
            영수증을 붙여 둔 지출은 <code className="text-xs bg-white px-1 rounded border">company_expenses</code>·
            <code className="text-xs bg-white px-1 rounded border">tour_expenses</code>·
            <code className="text-xs bg-white px-1 rounded border">reservation_expenses</code> 등에 들어가지만, 카드
            실제 <AccountingTerm termKey="청구서">청구</AccountingTerm>는 <strong>월별 <AccountingTerm termKey="명세">명세</AccountingTerm>(statement)</strong>가 기준이 됩니다. 여기서 명세와 시스템 지출을 맞추면{' '}
            <AccountingTerm termKey="PNL">PNL</AccountingTerm>·정산이 명세와 일치합니다.
          </p>
        </div>

        <div className="border-t border-slate-200 pt-4 space-y-2">
          <h3 className="font-semibold text-slate-900">권장 월별 순서</h3>
          <ol className="list-decimal list-inside space-y-2 leading-relaxed pl-1">
            <li>
              <strong>
                <AccountingTerm termKey="금융계정">금융 계정</AccountingTerm>
              </strong>
              을 만듭니다(카드·은행 각각). 한 장의 카드/한 계좌당 하나씩 두면 <AccountingTerm termKey="대조">대조</AccountingTerm>가 쉽습니다.
            </li>
            <li>
              <strong>
                <AccountingTerm termKey="결제수단">결제수단</AccountingTerm>(payment_methods)
              </strong>{' '}
              목록에서 직원 카드 등을 해당{' '}
              <strong>
                <AccountingTerm termKey="금융계정">금융 계정</AccountingTerm>
              </strong>
              에 연결합니다. (누가 어떤 회사 카드로 썼는지와 명세 단위를 맞출 때 참고용입니다.)
            </li>
            <li>
              카드사·은행에서 <strong>CSV</strong>를 내려받아 아래 입력란에 붙여 넣고, <strong>이번 명세의 기간</strong>과{' '}
              <strong>
                해당 <AccountingTerm termKey="금융계정">금융 계정</AccountingTerm>
              </strong>
              을 선택한 뒤 <strong>가져오기</strong>를 누릅니다.
            </li>
            <li>
              <strong>명세 선택</strong>으로 방금 넣은 걸 고른 다음{' '}
              <strong>
                <AccountingTerm termKey="자동매칭">자동 매칭</AccountingTerm>
              </strong>
              을 실행합니다. 금액이 같고 날짜가 가까운 기존 지출(회사/투어/예약)과 연결됩니다.
            </li>
            <li>
              여전히{' '}
              <strong>
                <AccountingTerm termKey="미매칭">미매칭</AccountingTerm>
              </strong>
              인 줄은 명세에만 있는 지출입니다.{' '}
              <strong>
                <AccountingTerm termKey="보정지출">보정 지출</AccountingTerm>
              </strong>
              로 <code className="text-xs bg-white px-1 rounded border">company_expenses</code>에 한 줄 추가되며, 위에서
              정한 <strong>카테고리·<AccountingTerm termKey="paid_for">paid_for</AccountingTerm></strong>가 들어갑니다. (세금·관리용으로 카테고리를 맞추세요.)
            </li>
            <li>
              <strong>개인 사용</strong>이면 <strong>개인</strong>을 켠 뒤{' '}
              <strong>
                <AccountingTerm termKey="파트너">파트너</AccountingTerm>(Joey / Chad / Erica)
              </strong>
              를 선택합니다. 같은 금액이{' '}
              <strong>
                <AccountingTerm termKey="파트너자금">파트너 자금</AccountingTerm> 관리
              </strong>
              에 <AccountingTerm termKey="출금">출금</AccountingTerm>으로 자동 반영됩니다(개인 카드 사용 = 해당 파트너의 순자산에서 차감되는 흐름으로 잡습니다).
            </li>
            <li>
              <strong>
                <AccountingTerm termKey="PNL제외">PNL 제외</AccountingTerm>
              </strong>
              는 <AccountingTerm termKey="손익">손익</AccountingTerm> 집계에서 빼고 싶을 때 켭니다. 개인과 별개로 설정할 수 있습니다.
            </li>
            <li>
              월 작업이 끝나면{' '}
              <strong>
                <AccountingTerm termKey="명세잠금">명세 잠금</AccountingTerm>
              </strong>
              으로 해당 명세를 고정합니다.
            </li>
          </ol>
        </div>

        <div className="border-t border-slate-200 pt-4 space-y-2">
          <h3 className="font-semibold text-slate-900">CSV 형식 안내</h3>
          <p className="leading-relaxed">
            첫 줄에 <strong>헤더</strong>가 있어야 합니다. 날짜 컬럼은 <code className="text-xs">Date</code>,{' '}
            <code className="text-xs">Transaction Date</code>, <code className="text-xs">Posted Date</code> 등으로
            인식하고, 금액은 <code className="text-xs">Amount</code> 또는 <code className="text-xs">Debit</code>/
            <code className="text-xs">Credit</code> 쌍으로 읽습니다. 은행마다 열 이름이 다르면, 내보내기 옵션에서
            “CSV” 또는 호환 형식을 선택하세요. 같은 명세를 두 번 넣으면 <strong>중복 키</strong>로 걸릴 수 있으니,
            기간·계정별로 한 번만 가져오는 것이 좋습니다.
          </p>
        </div>

        <div className="border-t border-slate-200 pt-4 space-y-2">
          <h3 className="font-semibold text-slate-900">
            <AccountingTerm termKey="임시와확정">Temp / Posted</AccountingTerm>에 대해
          </h3>
          <p className="leading-relaxed">
            영수증만 올라간 지출은 아직 명세와 연결되지 않았을 수 있습니다. 이 탭에서는{' '}
            <strong>명세 라인 ↔ 기존 지출</strong>이 연결되면 그 줄은 사실상 “대조됨(Posted에 가까움)”으로 보시면
            됩니다. 명세에 없는 지출은 다음 달 청구에 나오거나 누락 여부를 따로 확인해야 합니다.
          </p>
        </div>

        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 flex gap-2 text-amber-950">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <div className="space-y-2">
            <p className="font-medium">
              <AccountingTerm termKey="이중계상">이중 계상</AccountingTerm> 주의
            </p>
            <p className="leading-relaxed">
              카드 승인 건은 이미 지출 테이블에 비용으로 잡혔을 수 있습니다. <strong>은행에서 카드 대금만 이체한
              줄</strong>은 비용이 아니라 <strong>현금 ↔ 카드 <AccountingTerm termKey="미지급">미지급</AccountingTerm></strong>{' '}
              이동입니다. 그 <AccountingTerm termKey="출금">출금</AccountingTerm>을 다시 비용으로 넣지 마세요. 필요하면 화면 맨 아래{' '}
              <strong>
                <AccountingTerm termKey="카드대금이체">카드 대금 이체</AccountingTerm>{' '}
                <AccountingTerm termKey="분개">분개</AccountingTerm>
              </strong>
              로 장부만 맞출 수 있습니다.
            </p>
          </div>
        </div>
      </section>

      {message && (
        <div className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-800">{message}</div>
      )}

      <section className="rounded-lg border border-gray-200 bg-white p-3 sm:p-4 space-y-3">
        <h3 className="font-semibold flex flex-wrap items-center gap-x-2 gap-y-1 text-sm sm:text-base">
          <Building2 className="h-5 w-5 shrink-0" />
          <AccountingTerm termKey="금융계정">금융 계정</AccountingTerm>
          <span className="font-normal text-gray-600">(은행·카드 레지스터)</span>
        </h3>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
          <input
            className="border rounded px-3 py-2 text-sm w-full sm:min-w-[200px] sm:max-w-md"
            placeholder="이름 (예: Chase 회사 체크)"
            value={newAccountName}
            onChange={(e) => setNewAccountName(e.target.value)}
          />
          <select
            className="border rounded px-3 py-2 text-sm"
            value={newAccountType}
            onChange={(e) => setNewAccountType(e.target.value as 'bank' | 'credit_card')}
          >
            <option value="credit_card">신용카드</option>
            <option value="bank">은행</option>
          </select>
          <Button type="button" size="sm" onClick={createAccount} disabled={loading}>
            <Plus className="h-4 w-4 mr-1" />
            추가
          </Button>
        </div>
        <ul className="text-sm text-gray-600 divide-y">
          {accounts.map((a) => (
            <li key={a.id} className="py-1 flex justify-between">
              <span>{a.name}</span>
              <span className="text-gray-400">{a.account_type}</span>
            </li>
          ))}
          {accounts.length === 0 && <li className="text-gray-400">등록된 계정 없음</li>}
        </ul>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-3 sm:p-4 space-y-3">
        <h3 className="font-semibold flex flex-wrap items-center gap-x-2 gap-y-1 text-sm sm:text-base">
          <CreditCard className="h-5 w-5 shrink-0" />
          <AccountingTerm termKey="결제수단">결제수단</AccountingTerm>
          <span className="font-normal">(payment_methods) ↔ </span>
          <AccountingTerm termKey="금융계정">금융 계정</AccountingTerm>
          <span className="font-normal">연결</span>
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="py-2 pr-2">카드/방법</th>
                <th className="py-2 pr-2">끝 4자리</th>
                <th className="py-2">
                  <AccountingTerm termKey="금융계정">금융 계정</AccountingTerm>
                </th>
              </tr>
            </thead>
            <tbody>
              {paymentMethods.map((pm) => (
                <tr key={pm.id} className="border-b border-gray-100">
                  <td className="py-2">{pm.method}</td>
                  <td className="py-2">{pm.card_number_last4 || '—'}</td>
                  <td className="py-2">
                    <select
                      className="border rounded px-2 py-1 w-full max-w-xs"
                      value={pm.financial_account_id || ''}
                      onChange={(e) =>
                        savePaymentMethodAccount(pm.id, e.target.value || null)
                      }
                    >
                      <option value="">— 선택 —</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-3 sm:p-4 space-y-3">
        <h3 className="font-semibold flex flex-wrap items-center gap-x-2 gap-y-1 text-sm sm:text-base">
          <Upload className="h-5 w-5 shrink-0" />
          <AccountingTerm termKey="명세">명세</AccountingTerm> CSV 가져오기
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="text-sm">
            <AccountingTerm termKey="금융계정">금융 계정</AccountingTerm>
            <select
              className="mt-1 border rounded px-3 py-2 w-full"
              value={importAccountId}
              onChange={(e) => setImportAccountId(e.target.value)}
            >
              <option value="">선택</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            기간 시작
            <input
              type="date"
              className="mt-1 border rounded px-3 py-2 w-full"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
            />
          </label>
          <label className="text-sm">
            기간 종료
            <input
              type="date"
              className="mt-1 border rounded px-3 py-2 w-full"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
            />
          </label>
        </div>
        <textarea
          className="w-full border rounded p-3 font-mono text-xs min-h-[160px]"
          placeholder="CSV 내용 붙여넣기..."
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
        />
        <Button type="button" onClick={importCsv} disabled={loading}>
          가져오기
        </Button>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-3 sm:p-4 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <h3 className="font-semibold flex flex-wrap items-center gap-x-2 gap-y-1 text-sm sm:text-base">
            <Link2 className="h-5 w-5 shrink-0" />
            <AccountingTerm termKey="명세대조">명세 대조</AccountingTerm>
          </h3>
          <div className="flex items-center gap-2 min-w-0 w-full sm:w-auto">
            <select
              className="border rounded px-3 py-2 text-sm min-w-0 flex-1 sm:flex-initial sm:min-w-[12rem]"
              title={`${getAccountingHint('명세')} — 가져온 명세 중 하나를 고릅니다.`}
              value={selectedImportId || ''}
              onChange={(e) => setSelectedImportId(e.target.value || null)}
            >
              <option value="">명세 선택</option>
              {imports.map((im) => (
                <option key={im.id} value={im.id}>
                  {im.period_label || im.period_start} · {im.status} · {im.id.slice(0, 8)}…
                </option>
              ))}
            </select>
            <Button type="button" variant="outline" size="sm" onClick={() => loadImports()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {selectedImport && (
          <p className="text-sm text-gray-600">
            상태: <strong>{selectedImport.status}</strong> · 기간 {selectedImport.period_start} ~{' '}
            {selectedImport.period_end} · 명세 <AccountingTerm termKey="출금">출금</AccountingTerm>(
            <AccountingTerm termKey="손익">손익</AccountingTerm> 포함) 합계:{' '}
            <strong>${statementOutflowSum.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
          </p>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <label className="text-sm flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 min-w-0">
            보정 시 <AccountingTerm termKey="표준카테고리">카테고리</AccountingTerm>
            <input
              className="border rounded px-2 py-2 text-sm w-full sm:w-auto min-w-0"
              value={adjustCategory}
              onChange={(e) => setAdjustCategory(e.target.value)}
            />
          </label>
          <label className="text-sm flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 min-w-0">
            <AccountingTerm termKey="paid_for">paid_for</AccountingTerm>
            <input
              className="border rounded px-2 py-2 text-sm w-full sm:min-w-[200px]"
              value={adjustPaidFor}
              onChange={(e) => setAdjustPaidFor(e.target.value)}
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={runAutoMatch} disabled={loading || !selectedImportId}>
            <Wand2 className="h-4 w-4 mr-1" />
            <AccountingTerm termKey="자동매칭">자동 매칭</AccountingTerm>
          </Button>
          <Button type="button" variant="outline" onClick={lockImport} disabled={loading || !selectedImportId}>
            <Lock className="h-4 w-4 mr-1" />
            <AccountingTerm termKey="명세잠금">명세 잠금</AccountingTerm>
          </Button>
        </div>

        <div className="overflow-x-auto -mx-1 px-1 sm:mx-0 sm:px-0 touch-pan-x">
          <table className="w-full min-w-[720px] text-xs sm:text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="py-2 pr-2">일자</th>
                <th className="py-2 pr-2">구분</th>
                <th className="py-2 pr-2">금액</th>
                <th className="py-2 pr-2">설명</th>
                <th className="py-2 pr-2">
                  <AccountingTerm termKey="매칭">매칭</AccountingTerm>
                </th>
                <th className="py-2 pr-2 min-w-[9rem]">개인·파트너 / 제외</th>
                <th className="py-2">동작</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => {
                const m = matchByLine.get(line.id)
                return (
                  <tr key={line.id} className="border-b border-gray-100 align-top">
                    <td className="py-2 whitespace-nowrap">{line.posted_date}</td>
                    <td className="py-2">{line.direction}</td>
                    <td className="py-2">${Number(line.amount).toFixed(2)}</td>
                    <td className="py-2 max-w-md">
                      <div className="truncate" title={line.description || ''}>
                        {line.description}
                      </div>
                      {line.merchant && (
                        <div className="text-xs text-gray-400">{line.merchant}</div>
                      )}
                    </td>
                    <td className="py-2 text-xs">
                      {m ? (
                        <span className="text-green-700">
                          {m.source_table}:{m.source_id.slice(0, 8)}…
                        </span>
                      ) : (
                        <span className="text-orange-600">
                          <AccountingTerm termKey="미매칭">미매칭</AccountingTerm>
                        </span>
                      )}
                    </td>
                    <td className="py-2">
                      <label className="flex items-center gap-1 text-xs mb-1">
                        <input
                          type="checkbox"
                          checked={line.is_personal}
                          onChange={() => toggleLineFlags(line, 'is_personal')}
                        />
                        개인
                      </label>
                      {line.is_personal && line.direction === 'outflow' && (
                        <select
                          className="border rounded px-1 py-0.5 text-xs w-full max-w-[9rem] mb-1"
                          value={line.personal_partner || ''}
                          onChange={(e) =>
                            setStatementPersonalPartner(
                              line,
                              e.target.value as 'partner1' | 'partner2' | 'erica' | ''
                            )
                          }
                          title="파트너 자금 관리에 반영할 당사자"
                        >
                          <option value="">파트너 선택</option>
                          {PERSONAL_PARTNER_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      )}
                      <label className="flex items-center gap-1 text-xs">
                        <input
                          type="checkbox"
                          checked={line.exclude_from_pnl}
                          onChange={() => toggleLineFlags(line, 'exclude_from_pnl')}
                        />
                        <AccountingTerm termKey="PNL제외">PNL 제외</AccountingTerm>
                      </label>
                    </td>
                    <td className="py-2">
                      {!m && line.direction === 'outflow' && (
                        <Button type="button" size="sm" variant="outline" onClick={() => createAdjustment(line)}>
                          <AccountingTerm termKey="보정지출">보정 지출</AccountingTerm>
                        </Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {selectedImportId && lines.length === 0 && (
            <p className="text-sm text-gray-500 py-4">라인 없음</p>
          )}
        </div>
      </section>

      <CardPaymentJournalSection accounts={accounts} email={email} />
    </div>
  )
}

function CardPaymentJournalSection({
  accounts,
  email
}: {
  accounts: FinancialAccount[]
  email: string
}) {
  const [bankId, setBankId] = useState('')
  const [cardId, setCardId] = useState('')
  const [amount, setAmount] = useState('')
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [memo, setMemo] = useState('카드 대금 납부')
  const [msg, setMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    const amt = parseFloat(amount)
    if (!bankId || !cardId || !Number.isFinite(amt) || amt <= 0) {
      setMsg('은행·카드 계정과 금액을 확인하세요.')
      return
    }
    setLoading(true)
    setMsg(null)
    try {
      const res = await fetch('/api/financial/journal/card-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entryDate,
          memo,
          bankFinancialAccountId: bankId,
          cardFinancialAccountId: cardId,
          amount: amt,
          createdBy: email || null
        })
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || '실패')
      setMsg(`분개 저장됨: ${j.journal_entry_id}`)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '오류')
    } finally {
      setLoading(false)
    }
  }

  const banks = accounts.filter((a) => a.account_type === 'bank')
  const cards = accounts.filter((a) => a.account_type === 'credit_card')

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-3 sm:p-4 space-y-3">
      <h3 className="font-semibold flex flex-wrap items-center gap-x-1 gap-y-1 text-sm sm:text-base">
        <AccountingTerm termKey="카드대금이체">카드 대금 이체</AccountingTerm>{' '}
        <AccountingTerm termKey="분개">분개</AccountingTerm> (선택)
      </h3>
      <p className="text-sm text-gray-600">
        은행에서 신용카드 <AccountingTerm termKey="청구서">청구액</AccountingTerm>을 지불한 경우 비용이 아니라{' '}
        <AccountingTerm termKey="부채">부채</AccountingTerm>·현금 이동으로 기록합니다.{' '}
        <AccountingTerm termKey="차변">차변</AccountingTerm> 카드(
        <AccountingTerm termKey="미지급">미지급</AccountingTerm> 감소), <AccountingTerm termKey="대변">대변</AccountingTerm>{' '}
        은행.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
        <label>
          <AccountingTerm termKey="은행계정">은행 계정</AccountingTerm>
          <select
            className="mt-1 border rounded px-2 py-1 w-full"
            value={bankId}
            onChange={(e) => setBankId(e.target.value)}
          >
            <option value="">선택</option>
            {banks.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <AccountingTerm termKey="카드계정">카드 계정</AccountingTerm>(
          <AccountingTerm termKey="미지급">미지급</AccountingTerm>)
          <select
            className="mt-1 border rounded px-2 py-1 w-full"
            value={cardId}
            onChange={(e) => setCardId(e.target.value)}
          >
            <option value="">선택</option>
            {cards.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          금액
          <input
            type="number"
            step="0.01"
            className="mt-1 border rounded px-2 py-1 w-full"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <label>
          거래일
          <input
            type="date"
            className="mt-1 border rounded px-2 py-1 w-full"
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
          />
        </label>
      </div>
      <input
        className="border rounded px-2 py-1 w-full max-w-lg text-sm"
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        placeholder="메모"
      />
      {msg && <p className="text-sm text-slate-700">{msg}</p>}
      <Button type="button" onClick={submit} disabled={loading}>
        <AccountingTerm termKey="분개">분개</AccountingTerm> 저장
      </Button>
    </section>
  )
}
