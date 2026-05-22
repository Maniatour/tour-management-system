import type { SupabaseClient } from '@supabase/supabase-js'

export type StatementLinePairRow = {
  id: string
  outflow_line_id: string
  inflow_line_id: string
  note: string | null
  ticket_booking_id: string | null
  linked_by: string | null
  created_at?: string
  updated_at?: string
}

export type StatementLinePairCandidate = {
  lineId: string
  posted_date: string
  amount: number
  description: string
  amountDiff: number
  dayDiff: number
}

const PAIR_FETCH_CHUNK = 80
const PAIR_IN_CHUNK = 100

function ymdToDayNum(ymd: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim().slice(0, 10))
  if (!m) return Number.NaN
  return Math.floor(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86400000)
}

export function statementLinePairDayDiff(anchorYmd: string, otherYmd: string): number {
  const a = ymdToDayNum(anchorYmd)
  const b = ymdToDayNum(otherYmd)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.POSITIVE_INFINITY
  return Math.abs(a - b)
}

/** 상계 후보 점수(낮을수록 좋음) — 금액 일치 우선, 수입이 출금 이후면 가산 */
export function scoreStatementLinePairCandidate(
  anchor: { posted_date: string; amount: number; direction: string },
  other: { posted_date: string; amount: number; direction: string }
): number {
  const anchorAmt = Math.abs(Number(anchor.amount) || 0)
  const otherAmt = Math.abs(Number(other.amount) || 0)
  const amountDiff = Math.abs(anchorAmt - otherAmt)
  const dayDiff = statementLinePairDayDiff(anchor.posted_date, other.posted_date)
  let score = amountDiff * 10 + dayDiff
  if (anchor.direction === 'outflow' && other.direction === 'inflow') {
    const a = ymdToDayNum(anchor.posted_date)
    const b = ymdToDayNum(other.posted_date)
    if (Number.isFinite(a) && Number.isFinite(b) && b < a) score += 30
  }
  if (anchor.direction === 'inflow' && other.direction === 'outflow') {
    const a = ymdToDayNum(anchor.posted_date)
    const b = ymdToDayNum(other.posted_date)
    if (Number.isFinite(a) && Number.isFinite(b) && a < b) score += 30
  }
  return score
}

export function buildStatementLinePairCandidates(
  anchor: { id: string; posted_date: string; amount: number; direction: string },
  pool: Array<{
    id: string
    posted_date: string
    amount: number | string
    direction: string
    description?: string | null
    merchant?: string | null
  }>,
  opts?: { max?: number; amountEqualEps?: number }
): StatementLinePairCandidate[] {
  const max = opts?.max ?? 40
  const eps = opts?.amountEqualEps ?? 0.02
  const wantDir = anchor.direction === 'outflow' ? 'inflow' : 'outflow'
  const anchorAmt = Math.abs(Number(anchor.amount) || 0)
  const out: StatementLinePairCandidate[] = []

  for (const row of pool) {
    if (row.id === anchor.id) continue
    if ((row.direction ?? '').toLowerCase() !== wantDir) continue
    const amt = Math.abs(Number(row.amount) || 0)
    const amountDiff = Math.abs(anchorAmt - amt)
    const dayDiff = statementLinePairDayDiff(anchor.posted_date, row.posted_date)
    const desc = [row.description, row.merchant].filter(Boolean).join(' · ') || '—'
    out.push({
      lineId: row.id,
      posted_date: row.posted_date,
      amount: amt,
      description: desc,
      amountDiff,
      dayDiff,
    })
  }

  out.sort((a, b) => {
    const sa = scoreStatementLinePairCandidate(anchor, {
      posted_date: a.posted_date,
      amount: a.amount,
      direction: wantDir,
    })
    const sb = scoreStatementLinePairCandidate(anchor, {
      posted_date: b.posted_date,
      amount: b.amount,
      direction: wantDir,
    })
    if (sa !== sb) return sa - sb
    if (Math.abs(a.amountDiff - b.amountDiff) > eps) return a.amountDiff - b.amountDiff
    return a.dayDiff - b.dayDiff
  })

  return out.slice(0, max)
}

function dedupePairs(rows: StatementLinePairRow[]): StatementLinePairRow[] {
  const m = new Map<string, StatementLinePairRow>()
  for (const r of rows) {
    const key = `${r.outflow_line_id}|${r.inflow_line_id}`
    if (!m.has(key)) m.set(key, r)
  }
  return [...m.values()]
}

/** 명세 줄 id 목록에 걸린 상계(출금·수입 어느 쪽이든) */
export async function fetchStatementLinePairsForLineIds(
  supabase: SupabaseClient,
  lineIds: string[]
): Promise<StatementLinePairRow[]> {
  const ids = [...new Set(lineIds.filter(Boolean))]
  if (ids.length === 0) return []

  const out: StatementLinePairRow[] = []

  for (let i = 0; i < ids.length; i += PAIR_IN_CHUNK) {
    const chunk = ids.slice(i, i + PAIR_IN_CHUNK)
    const [outRes, inRes] = await Promise.all([
      supabase
        .from('statement_line_pairs')
        .select(
          'id,outflow_line_id,inflow_line_id,note,ticket_booking_id,linked_by,created_at,updated_at'
        )
        .in('outflow_line_id', chunk),
      supabase
        .from('statement_line_pairs')
        .select(
          'id,outflow_line_id,inflow_line_id,note,ticket_booking_id,linked_by,created_at,updated_at'
        )
        .in('inflow_line_id', chunk),
    ])
    if (outRes.error) throw outRes.error
    if (inRes.error) throw inRes.error
    for (const row of (outRes.data || []) as StatementLinePairRow[]) out.push(row)
    for (const row of (inRes.data || []) as StatementLinePairRow[]) out.push(row)
  }

  return dedupePairs(out)
}

export async function insertStatementLinePair(
  supabase: SupabaseClient,
  opts: {
    outflowLineId: string
    inflowLineId: string
    linkedBy: string
    note?: string | null
    ticketBookingId?: string | null
  }
): Promise<StatementLinePairRow> {
  const { data, error } = await supabase
    .from('statement_line_pairs')
    .insert({
      outflow_line_id: opts.outflowLineId,
      inflow_line_id: opts.inflowLineId,
      linked_by: opts.linkedBy,
      note: opts.note ?? null,
      ticket_booking_id: opts.ticketBookingId ?? null,
    })
    .select(
      'id,outflow_line_id,inflow_line_id,note,ticket_booking_id,linked_by,created_at,updated_at'
    )
    .single()

  if (error) throw error
  return data as StatementLinePairRow
}

export async function deleteStatementLinePair(
  supabase: SupabaseClient,
  pairId: string
): Promise<void> {
  const { error } = await supabase.from('statement_line_pairs').delete().eq('id', pairId)
  if (error) throw error
}

/** 출금·수입 id 정규화 */
export function normalizeStatementLinePairEndpoints(
  anchorDirection: string,
  anchorLineId: string,
  counterpartLineId: string
): { outflowLineId: string; inflowLineId: string } {
  const dir = (anchorDirection ?? '').toLowerCase()
  if (dir === 'outflow') {
    return { outflowLineId: anchorLineId, inflowLineId: counterpartLineId }
  }
  if (dir === 'inflow') {
    return { outflowLineId: counterpartLineId, inflowLineId: anchorLineId }
  }
  throw new Error('명세 줄 방향(outflow/inflow)이 없습니다.')
}
