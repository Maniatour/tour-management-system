import type { SupabaseClient } from '@supabase/supabase-js'

export type LedgerMatchRef = {
  source_table: string
  source_id: string
}

export type LedgerMatchDetail = {
  source_table: string
  source_id: string
  /** 이 명세 줄에 배정된 금액 */
  matched_amount: number | null
  ledger_amount: number
  date_primary_ymd: string
  date_secondary_ymd: string | null
  paid_to: string
  paid_for: string
  description: string | null
  payment_method: string | null
  rn_number: string | null
  check_in_date_ymd: string | null
  tour_date_ymd: string | null
}

function ymdFromIso(raw: string | null | undefined): string {
  const s = String(raw ?? '').trim()
  return s.length >= 10 ? s.slice(0, 10) : ''
}

function expensePaymentMethodFromRow(r: Record<string, unknown>): string | null {
  const pm = r.payment_method
  if (pm == null || pm === '') return null
  return String(pm)
}

async function fetchMatchAmountsOnLine(
  supabase: SupabaseClient,
  statementLineId: string,
  matches: LedgerMatchRef[]
): Promise<Map<string, number | null>> {
  const out = new Map<string, number | null>()
  const { data } = await supabase
    .from('reconciliation_matches')
    .select('source_table, source_id, matched_amount')
    .eq('statement_line_id', statementLineId)
  for (const row of (data || []) as {
    source_table: string
    source_id: string
    matched_amount: number | string | null
  }[]) {
    const key = `${row.source_table}:${row.source_id}`
    const amt =
      row.matched_amount != null && row.matched_amount !== ''
        ? Math.abs(Number(row.matched_amount))
        : null
    out.set(key, amt)
  }
  for (const m of matches) {
    const key = `${m.source_table}:${m.source_id}`
    if (!out.has(key)) out.set(key, null)
  }
  return out
}

async function fetchCompanyExpenseDetails(
  supabase: SupabaseClient,
  ids: string[],
  amounts: Map<string, number | null>
): Promise<LedgerMatchDetail[]> {
  if (ids.length === 0) return []
  const { data } = await supabase
    .from('company_expenses')
    .select('id,amount,submit_on,paid_to,paid_for,description,payment_method')
    .in('id', ids)
  return ((data || []) as Record<string, unknown>[]).map((r) => {
    const id = String(r.id)
    const key = `company_expenses:${id}`
    return {
      source_table: 'company_expenses',
      source_id: id,
      matched_amount: amounts.get(key) ?? null,
      ledger_amount: Math.abs(Number(r.amount ?? 0)),
      date_primary_ymd: ymdFromIso(String(r.submit_on ?? '')),
      date_secondary_ymd: null,
      paid_to: String(r.paid_to ?? '').trim() || '—',
      paid_for: String(r.paid_for ?? '').trim() || '—',
      description: r.description == null ? null : String(r.description).trim() || null,
      payment_method: expensePaymentMethodFromRow(r),
      rn_number: null,
      check_in_date_ymd: null,
      tour_date_ymd: null,
    }
  })
}

async function fetchTourExpenseDetails(
  supabase: SupabaseClient,
  ids: string[],
  amounts: Map<string, number | null>
): Promise<LedgerMatchDetail[]> {
  if (ids.length === 0) return []
  const { data } = await supabase
    .from('tour_expenses')
    .select('id,amount,submit_on,paid_to,paid_for,note,tour_date,payment_method')
    .in('id', ids)
  return ((data || []) as Record<string, unknown>[]).map((r) => {
    const id = String(r.id)
    const key = `tour_expenses:${id}`
    const submitYmd = ymdFromIso(String(r.submit_on ?? ''))
    const tourYmd = ymdFromIso(String(r.tour_date ?? ''))
    return {
      source_table: 'tour_expenses',
      source_id: id,
      matched_amount: amounts.get(key) ?? null,
      ledger_amount: Math.abs(Number(r.amount ?? 0)),
      date_primary_ymd: tourYmd || submitYmd,
      date_secondary_ymd: tourYmd && submitYmd && tourYmd !== submitYmd ? submitYmd : null,
      paid_to: String(r.paid_to ?? '').trim() || '—',
      paid_for: String(r.paid_for ?? '').trim() || '—',
      description: r.note == null ? null : String(r.note).trim() || null,
      payment_method: expensePaymentMethodFromRow(r),
      rn_number: null,
      check_in_date_ymd: null,
      tour_date_ymd: tourYmd || null,
    }
  })
}

async function fetchReservationExpenseDetails(
  supabase: SupabaseClient,
  ids: string[],
  amounts: Map<string, number | null>
): Promise<LedgerMatchDetail[]> {
  if (ids.length === 0) return []
  const { data } = await supabase
    .from('reservation_expenses')
    .select('id,amount,submit_on,paid_to,paid_for,note,payment_method')
    .in('id', ids)
  return ((data || []) as Record<string, unknown>[]).map((r) => {
    const id = String(r.id)
    const key = `reservation_expenses:${id}`
    return {
      source_table: 'reservation_expenses',
      source_id: id,
      matched_amount: amounts.get(key) ?? null,
      ledger_amount: Math.abs(Number(r.amount ?? 0)),
      date_primary_ymd: ymdFromIso(String(r.submit_on ?? '')),
      date_secondary_ymd: null,
      paid_to: String(r.paid_to ?? '').trim() || '—',
      paid_for: String(r.paid_for ?? '').trim() || '—',
      description: r.note == null ? null : String(r.note).trim() || null,
      payment_method: expensePaymentMethodFromRow(r),
      rn_number: null,
      check_in_date_ymd: null,
      tour_date_ymd: null,
    }
  })
}

async function fetchTicketBookingDetails(
  supabase: SupabaseClient,
  ids: string[],
  amounts: Map<string, number | null>
): Promise<LedgerMatchDetail[]> {
  if (ids.length === 0) return []
  const { data } = await supabase
    .from('ticket_bookings')
    .select(
      'id,expense,submit_on,check_in_date,category,company,rn_number,note,payment_method'
    )
    .in('id', ids)
  return ((data || []) as Record<string, unknown>[]).map((r) => {
    const id = String(r.id)
    const key = `ticket_bookings:${id}`
    const checkIn = ymdFromIso(String(r.check_in_date ?? ''))
    const submitYmd = ymdFromIso(String(r.submit_on ?? ''))
    return {
      source_table: 'ticket_bookings',
      source_id: id,
      matched_amount: amounts.get(key) ?? null,
      ledger_amount: Math.abs(Number(r.expense ?? 0)),
      date_primary_ymd: checkIn || submitYmd,
      date_secondary_ymd: checkIn && submitYmd && checkIn !== submitYmd ? submitYmd : null,
      paid_to: String(r.company ?? '').trim() || '—',
      paid_for: String(r.category ?? '').trim() || '—',
      description: r.note == null ? null : String(r.note).trim() || null,
      payment_method: expensePaymentMethodFromRow(r),
      rn_number: r.rn_number == null ? null : String(r.rn_number).trim() || null,
      check_in_date_ymd: checkIn || null,
      tour_date_ymd: null,
    }
  })
}

async function fetchTourHotelBookingDetails(
  supabase: SupabaseClient,
  ids: string[],
  amounts: Map<string, number | null>
): Promise<LedgerMatchDetail[]> {
  if (ids.length === 0) return []
  const { data } = await supabase
    .from('tour_hotel_bookings')
    .select(
      'id,total_price,submit_on,check_in_date,check_out_date,hotel,reservation_name,note,payment_method'
    )
    .in('id', ids)
  return ((data || []) as Record<string, unknown>[]).map((r) => {
    const id = String(r.id)
    const key = `tour_hotel_bookings:${id}`
    const checkIn = ymdFromIso(String(r.check_in_date ?? ''))
    return {
      source_table: 'tour_hotel_bookings',
      source_id: id,
      matched_amount: amounts.get(key) ?? null,
      ledger_amount: Math.abs(Number(r.total_price ?? 0)),
      date_primary_ymd: checkIn || ymdFromIso(String(r.submit_on ?? '')),
      date_secondary_ymd: null,
      paid_to: String(r.hotel ?? '').trim() || '—',
      paid_for: String(r.reservation_name ?? '').trim() || '—',
      description: r.note == null ? null : String(r.note).trim() || null,
      payment_method: expensePaymentMethodFromRow(r),
      rn_number: null,
      check_in_date_ymd: checkIn || null,
      tour_date_ymd: null,
    }
  })
}

async function fetchPaymentRecordDetails(
  supabase: SupabaseClient,
  ids: string[],
  amounts: Map<string, number | null>
): Promise<LedgerMatchDetail[]> {
  if (ids.length === 0) return []
  const { data } = await supabase
    .from('payment_records')
    .select('id,amount,submit_on,note,reservation_id,payment_method')
    .in('id', ids)
  return ((data || []) as Record<string, unknown>[]).map((r) => {
    const id = String(r.id)
    const key = `payment_records:${id}`
    const note = r.note == null ? null : String(r.note).trim() || null
    const rid = r.reservation_id == null ? null : String(r.reservation_id).trim() || null
    return {
      source_table: 'payment_records',
      source_id: id,
      matched_amount: amounts.get(key) ?? null,
      ledger_amount: Math.abs(Number(r.amount ?? 0)),
      date_primary_ymd: ymdFromIso(String(r.submit_on ?? '')),
      date_secondary_ymd: null,
      paid_to: rid ? `예약 ${rid.slice(0, 8)}…` : '—',
      paid_for: note || '입금',
      description: note,
      payment_method: expensePaymentMethodFromRow(r),
      rn_number: null,
      check_in_date_ymd: null,
      tour_date_ymd: null,
    }
  })
}

/** 명세 줄에 연결된 원장 행 — 대조 모달·충돌 안내용 상세 */
export async function fetchLedgerMatchDetails(
  supabase: SupabaseClient,
  statementLineId: string,
  matches: LedgerMatchRef[]
): Promise<LedgerMatchDetail[]> {
  if (matches.length === 0) return []
  const amounts = await fetchMatchAmountsOnLine(supabase, statementLineId, matches)

  const byTable = new Map<string, string[]>()
  for (const m of matches) {
    const t = String(m.source_table ?? '').trim()
    const id = String(m.source_id ?? '').trim()
    if (!t || !id) continue
    if (!byTable.has(t)) byTable.set(t, [])
    byTable.get(t)!.push(id)
  }

  const chunks = await Promise.all([
    fetchCompanyExpenseDetails(supabase, byTable.get('company_expenses') ?? [], amounts),
    fetchTourExpenseDetails(supabase, byTable.get('tour_expenses') ?? [], amounts),
    fetchReservationExpenseDetails(supabase, byTable.get('reservation_expenses') ?? [], amounts),
    fetchTicketBookingDetails(supabase, byTable.get('ticket_bookings') ?? [], amounts),
    fetchTourHotelBookingDetails(supabase, byTable.get('tour_hotel_bookings') ?? [], amounts),
    fetchPaymentRecordDetails(supabase, byTable.get('payment_records') ?? [], amounts),
  ])

  const byKey = new Map<string, LedgerMatchDetail>()
  for (const d of chunks.flat()) {
    byKey.set(`${d.source_table}:${d.source_id}`, d)
  }

  return matches
    .map((m) => byKey.get(`${m.source_table}:${m.source_id}`))
    .filter((d): d is LedgerMatchDetail => d != null)
}

export function sourceTableLabelKey(
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

export function formatLedgerMatchDetailLines(
  d: LedgerMatchDetail,
  labels: {
    sourceType: string
    allocatedOnStatement: string
    ledgerAmount: string
    paidTo: string
    paidFor: string
    submitDate: string
    checkInDate: string
    tourDate: string
    rn: string
    description: string
    paymentMethod: string
    recordId: string
    notFound: string
  },
  paymentMethodLabel: string | null
): { headline: string; rows: { label: string; value: string }[] } {
  const alloc =
    d.matched_amount != null && Number.isFinite(d.matched_amount)
      ? ` · ${labels.allocatedOnStatement} $${d.matched_amount.toFixed(2)}`
      : ''
  const headline = `${labels.sourceType} · ${labels.ledgerAmount} $${d.ledger_amount.toFixed(2)}${alloc}`

  const rows: { label: string; value: string }[] = [
    { label: labels.paidTo, value: d.paid_to },
    { label: labels.paidFor, value: d.paid_for },
  ]

  if (d.check_in_date_ymd) {
    rows.push({ label: labels.checkInDate, value: d.check_in_date_ymd })
  }
  if (d.tour_date_ymd && d.tour_date_ymd !== d.date_primary_ymd) {
    rows.push({ label: labels.tourDate, value: d.tour_date_ymd })
  }
  if (d.date_primary_ymd) {
    rows.push({
      label: labels.submitDate,
      value: d.date_secondary_ymd
        ? `${d.date_primary_ymd} (${d.date_secondary_ymd})`
        : d.date_primary_ymd,
    })
  }
  if (d.rn_number) {
    rows.push({ label: labels.rn, value: d.rn_number })
  }
  if (d.description) {
    rows.push({ label: labels.description, value: d.description })
  }
  if (paymentMethodLabel) {
    rows.push({ label: labels.paymentMethod, value: paymentMethodLabel })
  }
  rows.push({ label: labels.recordId, value: d.source_id })

  return { headline, rows }
}
