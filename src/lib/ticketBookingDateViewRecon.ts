import type { SupabaseClient } from '@supabase/supabase-js'
import {
  TICKET_BOOKING_STATEMENT_DAY_WINDOW,
  addCalendarDaysYmd,
  unlinkAllMatchesOnStatementLines,
} from '@/lib/expense-reconciliation-similar-lines'
import { softDeleteExpenseRecord, type ExpenseSoftDeleteTable } from '@/lib/expense-soft-delete'
import { formatStatementLineDescription } from '@/lib/statement-display'
import { ticketBookingCanyonKeyFromBooking } from '@/lib/ticketBookingDateView'

export type CanyonVendorKey =
  | 'see_canyon'
  | 'dixie'
  | 'antelope_x'
  | 'mei_tour'
  | 'kens'
  | 'other_antelope'

const VENDOR_LABEL_KO: Record<CanyonVendorKey, string> = {
  see_canyon: 'SEE CANYON',
  dixie: 'Dixie',
  antelope_x: 'Antelope X',
  mei_tour: 'Mei Tour',
  kens: 'KENS',
  other_antelope: 'Antelope (기타)',
}

const VENDOR_LABEL_EN: Record<CanyonVendorKey, string> = {
  see_canyon: 'SEE CANYON',
  dixie: 'Dixie',
  antelope_x: 'Antelope X',
  mei_tour: 'Mei Tour',
  kens: 'KENS',
  other_antelope: 'Antelope (other)',
}

export function canyonVendorLabel(key: CanyonVendorKey, locale: string): string {
  return locale.startsWith('ko') ? VENDOR_LABEL_KO[key] : VENDOR_LABEL_EN[key]
}

function normVendorText(raw: string | null | undefined): string {
  return (raw || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

/** 명세·지출 텍스트에서 캐년 벤더 분류 (null = 비대상) */
export function classifyCanyonVendor(text: string | null | undefined): CanyonVendorKey | null {
  const k = normVendorText(text)
  if (!k) return null
  const canyonish =
    k.includes('antelope') ||
    /see\s*canyon|seecanyon/.test(k) ||
    /mei\s*tour|meitour/.test(k) ||
    k.includes('dixie') ||
    /\bkens\b|ken\'?s\s*tour/.test(k) ||
    /slot\s*canyon/.test(k) ||
    /navajo\s*tours?/.test(k)
  if (!canyonish) return null
  if (/antelope\s*x|\bx\s*canyon|antelope canyon x|canyon\s*x\b/.test(k)) return 'antelope_x'
  if (/mei\s*tour|meitour/.test(k)) return 'mei_tour'
  if (/\bkens\b|ken\'?s/.test(k)) return 'kens'
  if (k.includes('dixie')) return 'dixie'
  if (/see\s*canyon|seecanyon/.test(k)) return 'see_canyon'
  return 'other_antelope'
}

/** 은행 명세 줄 — merchant·raw description·표시용 설명 모두 검사 */
export function classifyCanyonVendorFromStatementLine(line: {
  description?: string | null
  merchant?: string | null
}): CanyonVendorKey | null {
  const merchant = String(line.merchant ?? '').trim()
  const raw = String(line.description ?? '').trim()
  const display = formatStatementLineDescription(raw || null, merchant || null)
  const combined = [merchant, raw, display].filter(Boolean).join(' ')
  return (
    classifyCanyonVendor(merchant) ||
    classifyCanyonVendor(display) ||
    classifyCanyonVendor(raw) ||
    classifyCanyonVendor(combined)
  )
}

const STATEMENT_LINES_PAGE = 1000

type RawStatementLine = {
  id: string
  statement_import_id: string | null
  posted_date: string | null
  amount: number | string | null
  direction: string | null
  description: string | null
  merchant: string | null
  matched_status: string | null
}

/** posted_date 구간의 은행 명세 줄 (출금·입금, statement_lines 직접 조회·페이지네이션) */
async function fetchStatementLinesByPostedDate(
  supabase: SupabaseClient,
  startYmd: string,
  endYmd: string,
  direction?: 'inflow' | 'outflow' | null
): Promise<RawStatementLine[]> {
  const out: RawStatementLine[] = []
  let from = 0
  for (;;) {
    let query = supabase
      .from('statement_lines')
      .select(
        'id,statement_import_id,posted_date,amount,direction,description,merchant,matched_status'
      )
      .gte('posted_date', startYmd)
      .lte('posted_date', endYmd)
    if (direction) query = query.eq('direction', direction)
    const { data, error } = await query
      .order('posted_date', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + STATEMENT_LINES_PAGE - 1)
    if (error) throw error
    const batch = (data || []) as RawStatementLine[]
    out.push(...batch)
    if (batch.length < STATEMENT_LINES_PAGE) break
    from += STATEMENT_LINES_PAGE
  }
  return out
}

export function classifyTicketBookingVendor(booking: {
  company?: string | null
  category?: string | null
}): CanyonVendorKey | null {
  const co = classifyCanyonVendor(booking.company)
  if (co) return co
  const cat = classifyCanyonVendor(booking.category)
  if (cat) return cat
  if (ticketBookingCanyonKeyFromBooking(booking)) return 'other_antelope'
  return null
}

export type DateViewLedgerRow = {
  sourceTable: 'ticket_bookings' | 'company_expenses' | 'tour_expenses'
  sourceId: string
  vendorKey: CanyonVendorKey
  vendorLabel: string
  amount: number
  /** 표시·대조 기준일(티켓: 체크인, 회사: 등록일, 투어: 투어일) */
  dateYmd: string
  /** 티켓 등록일(submit_on)이 기준일과 다를 때 */
  secondaryDateYmd?: string | null
  detail: string
  statementMatched: boolean
}

export type DateViewStatementRow = {
  lineId: string
  postedDate: string
  amount: number
  direction: 'inflow' | 'outflow'
  /** 표시용 한 줄 (merchant 우선) */
  description: string
  /** 은행 명세 원문(description 컬럼) */
  rawDescription: string
  financialAccountName: string
  vendorKey: CanyonVendorKey
  vendorLabel: string
  matchedStatus: string
  linkedSources: { source_table: string; source_id: string }[]
}

export type TicketDateViewReconBundle = {
  dateYmd: string
  ledgerRows: DateViewLedgerRow[]
  statementRows: DateViewStatementRow[]
  ledgerTotalByVendor: Partial<Record<CanyonVendorKey, number>>
  statementTotalByVendor: Partial<Record<CanyonVendorKey, number>>
}

type MatchRow = {
  source_table: string
  source_id: string
  statement_line_id: string
}

const CHUNK = 80

async function fetchMatchesForSources(
  supabase: SupabaseClient,
  pairs: { table: string; ids: string[] }[]
): Promise<Map<string, Set<string>>> {
  const out = new Map<string, Set<string>>()
  for (const { table, ids } of pairs) {
    const unique = [...new Set(ids.filter(Boolean))]
    for (let i = 0; i < unique.length; i += 200) {
      const chunk = unique.slice(i, i + 200)
      const { data, error } = await supabase
        .from('reconciliation_matches')
        .select('source_id, statement_line_id')
        .eq('source_table', table)
        .in('source_id', chunk)
      if (error) throw error
      for (const row of (data || []) as { source_id: string; statement_line_id: string }[]) {
        const sid = String(row.source_id ?? '').trim()
        const lid = String(row.statement_line_id ?? '').trim()
        if (!sid || !lid) continue
        const key = `${table}:${sid}`
        const set = out.get(key) ?? new Set<string>()
        set.add(lid)
        out.set(key, set)
      }
    }
  }
  return out
}

async function fetchLegacyStatementLineIds(
  supabase: SupabaseClient,
  table: 'ticket_bookings' | 'company_expenses' | 'tour_expenses',
  ids: string[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const unique = [...new Set(ids.filter(Boolean))]
  for (let i = 0; i < unique.length; i += 200) {
    const chunk = unique.slice(i, i + 200)
    const { data } = await supabase
      .from(table)
      .select('id, statement_line_id')
      .in('id', chunk)
      .not('statement_line_id', 'is', null)
    for (const row of (data || []) as { id: string; statement_line_id: string | null }[]) {
      const lid = String(row.statement_line_id ?? '').trim()
      if (row.id && lid) out.set(row.id, lid)
    }
  }
  return out
}

function isSourceMatched(
  table: string,
  id: string,
  matchMap: Map<string, Set<string>>,
  legacyLineById: Map<string, string>
): boolean {
  const key = `${table}:${id}`
  if ((matchMap.get(key)?.size ?? 0) > 0) return true
  return legacyLineById.has(id)
}

function addLedgerTotal(
  totals: Partial<Record<CanyonVendorKey, number>>,
  key: CanyonVendorKey,
  amount: number
) {
  totals[key] = (totals[key] || 0) + amount
}

/**
 * 체크인일 기준: 티켓 부킹(전달) + 회사지출(submit_on) + 투어지출(tour_date) + 명세(±dayWindow) 앤텔롭 벤더
 */
export async function fetchTicketDateViewReconForDates(
  supabase: SupabaseClient,
  dateYmds: string[],
  ticketBookingsByDate: Map<string, Array<Record<string, unknown>>>,
  locale: string,
  opts?: { dayWindow?: number }
): Promise<Map<string, TicketDateViewReconBundle>> {
  const out = new Map<string, TicketDateViewReconBundle>()
  const dates = [...new Set(dateYmds.map((d) => d.trim().slice(0, 10)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)))]
  if (dates.length === 0) return out

  const pad = opts?.dayWindow ?? TICKET_BOOKING_STATEMENT_DAY_WINDOW
  let globalStart = dates[0]!
  let globalEnd = dates[0]!
  for (const d of dates) {
    const s = addCalendarDaysYmd(d, -pad)
    const e = addCalendarDaysYmd(d, pad)
    if (s < globalStart) globalStart = s
    if (e > globalEnd) globalEnd = e
  }

  const ceRows: Record<string, unknown>[] = []
  const teRows: Record<string, unknown>[] = []
  const sortedDates = [...dates].sort()
  const rangeStartIso = `${sortedDates[0]}T00:00:00.000Z`
  const rangeEndIso = `${sortedDates[sortedDates.length - 1]}T23:59:59.999Z`
  const dateSet = new Set(dates)

  const [{ data: ceBatch }, { data: teBatch }] = await Promise.all([
    supabase
      .from('company_expenses')
      .select('id,amount,submit_on,paid_to,paid_for,description,statement_line_id')
      .gte('submit_on', rangeStartIso)
      .lte('submit_on', rangeEndIso)
      .is('deleted_at', null),
    supabase
      .from('tour_expenses')
      .select('id,amount,tour_date,submit_on,paid_to,paid_for,note,statement_line_id')
      .in('tour_date', dates),
  ])

  for (const r of ceBatch || []) {
    const text = [r.paid_to, r.paid_for, r.description].filter(Boolean).join(' ')
    if (!classifyCanyonVendor(text)) continue
    const submitYmd = r.submit_on ? String(r.submit_on).slice(0, 10) : ''
    if (dateSet.has(submitYmd)) ceRows.push({ ...r, _anchorYmd: submitYmd })
  }
  for (const r of teBatch || []) {
    const text = [r.paid_to, r.paid_for, r.note].filter(Boolean).join(' ')
    if (!classifyCanyonVendor(text)) continue
    const tourYmd = String(r.tour_date ?? '').slice(0, 10)
    if (dateSet.has(tourYmd)) teRows.push({ ...r, _anchorYmd: tourYmd })
  }

  const tbRows: Array<Record<string, unknown> & { _anchorYmd: string }> = []
  for (const dateYmd of dates) {
    for (const b of ticketBookingsByDate.get(dateYmd) || []) {
      if (classifyTicketBookingVendor(b as { company?: string; category?: string })) {
        tbRows.push({ ...b, _anchorYmd: dateYmd })
      }
    }
  }

  const tbIds = tbRows.map((r) => String(r.id ?? ''))
  const ceIds = ceRows.map((r) => String(r.id ?? ''))
  const teIds = teRows.map((r) => String(r.id ?? ''))

  const [matchMap, legacyTb, legacyCe, legacyTe] = await Promise.all([
    fetchMatchesForSources(supabase, [
      { table: 'ticket_bookings', ids: tbIds },
      { table: 'company_expenses', ids: ceIds },
      { table: 'tour_expenses', ids: teIds },
    ]),
    fetchLegacyStatementLineIds(supabase, 'ticket_bookings', tbIds),
    fetchLegacyStatementLineIds(supabase, 'company_expenses', ceIds),
    fetchLegacyStatementLineIds(supabase, 'tour_expenses', teIds),
  ])

  const bundles = new Map<string, TicketDateViewReconBundle>()
  for (const d of dates) {
    bundles.set(d, {
      dateYmd: d,
      ledgerRows: [],
      statementRows: [],
      ledgerTotalByVendor: {},
      statementTotalByVendor: {},
    })
  }

  const pushLedger = (
    anchorYmd: string,
    row: Omit<DateViewLedgerRow, 'vendorLabel'> & { vendorKey: CanyonVendorKey }
  ) => {
    const bundle = bundles.get(anchorYmd)
    if (!bundle) return
    const full: DateViewLedgerRow = {
      ...row,
      vendorLabel: canyonVendorLabel(row.vendorKey, locale),
    }
    bundle.ledgerRows.push(full)
    addLedgerTotal(bundle.ledgerTotalByVendor, row.vendorKey, row.amount)
  }

  for (const b of tbRows) {
    const id = String(b.id ?? '')
    const anchor = String(b._anchorYmd ?? '').slice(0, 10)
    const vk =
      classifyTicketBookingVendor(b as { company?: string; category?: string }) ?? 'other_antelope'
    const co = String(b.company ?? '').trim()
    const time = String(b.time ?? '').trim()
    const ea = Number(b.ea ?? 0)
    const checkInYmd = b.check_in_date ? String(b.check_in_date).slice(0, 10) : ''
    const submitYmd = b.submit_on ? String(b.submit_on).slice(0, 10) : ''
    const primaryYmd = checkInYmd || submitYmd || anchor
    pushLedger(anchor, {
      sourceTable: 'ticket_bookings',
      sourceId: id,
      vendorKey: vk,
      amount: Math.abs(Number(b.expense ?? 0)),
      dateYmd: primaryYmd,
      secondaryDateYmd:
        checkInYmd && submitYmd && checkInYmd !== submitYmd ? submitYmd : null,
      detail: [co, time, ea ? `×${ea}` : ''].filter(Boolean).join(' · '),
      statementMatched: isSourceMatched('ticket_bookings', id, matchMap, legacyTb),
    })
  }

  for (const r of ceRows) {
    const id = String(r.id ?? '')
    const anchor = String(r._anchorYmd ?? '').slice(0, 10)
    const text = [r.paid_to, r.paid_for, r.description].filter(Boolean).join(' ')
    const vk = classifyCanyonVendor(text) ?? 'other_antelope'
    pushLedger(anchor, {
      sourceTable: 'company_expenses',
      sourceId: id,
      vendorKey: vk,
      amount: Math.abs(Number(r.amount ?? 0)),
      dateYmd: anchor,
      detail: [r.paid_to, r.paid_for].filter(Boolean).join(' → '),
      statementMatched: isSourceMatched('company_expenses', id, matchMap, legacyCe),
    })
  }

  for (const r of teRows) {
    const id = String(r.id ?? '')
    const anchor = String(r._anchorYmd ?? '').slice(0, 10)
    const text = [r.paid_to, r.paid_for, r.note].filter(Boolean).join(' ')
    const vk = classifyCanyonVendor(text) ?? 'other_antelope'
    pushLedger(anchor, {
      sourceTable: 'tour_expenses',
      sourceId: id,
      vendorKey: vk,
      amount: Math.abs(Number(r.amount ?? 0)),
      dateYmd: anchor,
      detail: [r.paid_to, r.paid_for].filter(Boolean).join(' → '),
      statementMatched: isSourceMatched('tour_expenses', id, matchMap, legacyTe),
    })
  }

  const allLedgerSourceKeys = new Set<string>()
  for (const id of tbIds) if (id) allLedgerSourceKeys.add(`ticket_bookings:${id}`)
  for (const id of ceIds) if (id) allLedgerSourceKeys.add(`company_expenses:${id}`)
  for (const id of teIds) if (id) allLedgerSourceKeys.add(`tour_expenses:${id}`)

  const stmtRaw = await fetchStatementLinesByPostedDate(supabase, globalStart, globalEnd)

  const importIdsFromLines = [
    ...new Set(stmtRaw.map((l) => String(l.statement_import_id ?? '').trim()).filter(Boolean)),
  ]
  const importToAccount = new Map<string, string>()
  for (let i = 0; i < importIdsFromLines.length; i += CHUNK) {
    const chunk = importIdsFromLines.slice(i, i + CHUNK)
    const { data: imports, error: impErr } = await supabase
      .from('statement_imports')
      .select('id,financial_account_id')
      .in('id', chunk)
    if (impErr) throw impErr
    for (const im of (imports || []) as { id: string; financial_account_id: string }[]) {
      if (im.id) importToAccount.set(im.id, String(im.financial_account_id ?? ''))
    }
  }

  const accountIds = [...new Set([...importToAccount.values()].filter(Boolean))]
  const accountNameById = new Map<string, string>()
  for (let i = 0; i < accountIds.length; i += CHUNK) {
    const chunk = accountIds.slice(i, i + CHUNK)
    const { data: accs } = await supabase.from('financial_accounts').select('id,name').in('id', chunk)
    for (const a of (accs || []) as { id: string; name: string }[]) {
      accountNameById.set(a.id, String(a.name ?? '').trim() || a.id)
    }
  }

  const lineIdsAll = stmtRaw.map((l) => String(l.id ?? '')).filter(Boolean)
  const matchesByLine = new Map<string, MatchRow[]>()
  for (let i = 0; i < lineIdsAll.length; i += 200) {
    const chunk = lineIdsAll.slice(i, i + 200)
    const { data, error } = await supabase
      .from('reconciliation_matches')
      .select('source_table, source_id, statement_line_id')
      .in('statement_line_id', chunk)
    if (error) throw error
    for (const row of (data || []) as MatchRow[]) {
      const lid = String(row.statement_line_id ?? '').trim()
      if (!lid) continue
      const list = matchesByLine.get(lid) ?? []
      list.push(row)
      matchesByLine.set(lid, list)
    }
  }

  const lineLinkedToCanyonLedger = (lineId: string): boolean => {
    for (const m of matchesByLine.get(lineId) ?? []) {
      const key = `${m.source_table}:${m.source_id}`
      if (allLedgerSourceKeys.has(key)) return true
    }
    return false
  }

  const stmtLines = stmtRaw.filter((line) => {
    const lineId = String(line.id ?? '')
    if (lineLinkedToCanyonLedger(lineId)) return true
    return classifyCanyonVendorFromStatementLine(line) != null
  })

  for (const dateYmd of dates) {
    const winStart = addCalendarDaysYmd(dateYmd, -pad)
    const winEnd = addCalendarDaysYmd(dateYmd, pad)
    const bundle = bundles.get(dateYmd)!
    for (const line of stmtLines) {
      const posted = String(line.posted_date ?? '').slice(0, 10)
      if (posted < winStart || posted > winEnd) continue
      const desc = formatStatementLineDescription(
        line.description == null ? null : String(line.description),
        line.merchant == null ? null : String(line.merchant)
      )
      const vk =
        classifyCanyonVendorFromStatementLine(line) ??
        (lineLinkedToCanyonLedger(String(line.id ?? '')) ? 'other_antelope' : null)
      if (!vk) continue
      const lineId = String(line.id ?? '')
      const importId = String(line.statement_import_id ?? '')
      const accountId = importToAccount.get(importId) || ''
      const linked = (matchesByLine.get(lineId) ?? []).map((m) => ({
        source_table: String(m.source_table ?? ''),
        source_id: String(m.source_id ?? ''),
      }))
      const rawDesc = String(line.description ?? '').trim()
      const isInflow = String(line.direction ?? '').toLowerCase() === 'inflow'
      const absAmt = Math.abs(Number(line.amount ?? 0))
      const row: DateViewStatementRow = {
        lineId,
        postedDate: posted,
        amount: absAmt,
        direction: isInflow ? 'inflow' : 'outflow',
        description: desc,
        rawDescription: rawDesc || desc,
        financialAccountName: accountNameById.get(accountId) || accountId || '—',
        vendorKey: vk,
        vendorLabel: canyonVendorLabel(vk, locale),
        matchedStatus: String(line.matched_status ?? ''),
        linkedSources: linked,
      }
      bundle.statementRows.push(row)
      addLedgerTotal(bundle.statementTotalByVendor, vk, isInflow ? -absAmt : absAmt)
    }
    bundle.ledgerRows.sort((a, b) => a.vendorLabel.localeCompare(b.vendorLabel, locale) || a.detail.localeCompare(b.detail))
    bundle.statementRows.sort(
      (a, b) => a.postedDate.localeCompare(b.postedDate) || a.vendorLabel.localeCompare(b.vendorLabel, locale)
    )
    out.set(dateYmd, bundle)
  }

  return out
}

const DATE_VIEW_LEDGER_TABLES: ExpenseSoftDeleteTable[] = [
  'ticket_bookings',
  'company_expenses',
  'tour_expenses',
]

function isDateViewLedgerTable(t: string): t is ExpenseSoftDeleteTable {
  return (DATE_VIEW_LEDGER_TABLES as string[]).includes(t)
}

/** 날짜별 대조 패널 — 선택한 티켓·회사·투어 지출 soft delete */
export async function softDeleteDateViewLedgerRows(
  supabase: SupabaseClient,
  rows: Array<{ sourceTable: string; sourceId: string }>,
  deletedBy: string | null
): Promise<{ deletedCount: number }> {
  let deletedCount = 0
  const seen = new Set<string>()
  for (const row of rows) {
    const table = String(row.sourceTable ?? '').trim()
    const id = String(row.sourceId ?? '').trim()
    if (!table || !id || !isDateViewLedgerTable(table)) continue
    const key = `${table}:${id}`
    if (seen.has(key)) continue
    seen.add(key)
    await softDeleteExpenseRecord(supabase, table, id, deletedBy)
    deletedCount += 1
  }
  return { deletedCount }
}

/** 날짜별 대조 패널 — 선택한 명세 줄의 대조 연결만 해제 */
export async function unlinkDateViewStatementLineSelections(
  supabase: SupabaseClient,
  lineIds: string[]
): Promise<{ unlinkedCount: number }> {
  const { unlinkedCount } = await unlinkAllMatchesOnStatementLines(supabase, lineIds)
  return { unlinkedCount }
}
