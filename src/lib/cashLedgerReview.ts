import { supabase } from '@/lib/supabase'
import { mapIdsInConcurrentChunks } from '@/lib/fetchSupabaseInChunks'

export const CASH_WITHDRAWAL_NOTIFY_EMAIL = 'info@maniatour.com'
export const CASH_LEDGER_REVIEW_CHANGED_EVENT = 'cash-ledger-review-changed'

export type CashLedgerReviewSource =
  | 'cash_transactions'
  | 'payment_records'
  | 'company_expenses'
  | 'reservation_expenses'

export type CashLedgerReviewStatus = 'approved' | 'unapproved' | 'flagged'

export const DEFAULT_CASH_LEDGER_REVIEW_STATUS: CashLedgerReviewStatus = 'unapproved'

export const CASH_LEDGER_REVIEW_OPTIONS: Array<{
  value: CashLedgerReviewStatus
  label: string
}> = [
  { value: 'approved', label: '승인' },
  { value: 'unapproved', label: '비승인' },
  { value: 'flagged', label: '플래그' },
]

export function cashLedgerReviewKey(source: CashLedgerReviewSource, sourceId: string): string {
  return `${source}:${sourceId}`
}

export function cashLedgerRefFromRow(tx: {
  id: string
  source?: CashLedgerReviewSource | string | null
}): { source: CashLedgerReviewSource; sourceId: string } | null {
  const source = tx.source
  if (source === 'payment_records') {
    return { source, sourceId: tx.id.startsWith('pr_') ? tx.id.slice(3) : tx.id }
  }
  if (source === 'company_expenses') {
    return { source, sourceId: tx.id.startsWith('ce_') ? tx.id.slice(3) : tx.id }
  }
  if (source === 'reservation_expenses') {
    return { source, sourceId: tx.id.startsWith('re_') ? tx.id.slice(3) : tx.id }
  }
  if (source === 'cash_transactions' || !source) {
    return { source: 'cash_transactions', sourceId: tx.id }
  }
  return null
}

export function cashLedgerReviewStatusOf(
  tx: { id: string; source?: CashLedgerReviewSource | string | null },
  map: ReadonlyMap<string, CashLedgerReviewStatus>
): CashLedgerReviewStatus {
  const ref = cashLedgerRefFromRow(tx)
  if (!ref) return DEFAULT_CASH_LEDGER_REVIEW_STATUS
  return map.get(cashLedgerReviewKey(ref.source, ref.sourceId)) ?? DEFAULT_CASH_LEDGER_REVIEW_STATUS
}

function isReviewStatus(value: string | null | undefined): value is CashLedgerReviewStatus {
  return value === 'approved' || value === 'unapproved' || value === 'flagged'
}

export async function fetchCashLedgerReviewMap(
  refs: Array<{ source: CashLedgerReviewSource; sourceId: string }>
): Promise<Map<string, CashLedgerReviewStatus>> {
  const ids = [...new Set(refs.map((r) => r.sourceId).filter(Boolean))]
  if (ids.length === 0) return new Map()

  const rows = await mapIdsInConcurrentChunks(ids, 150, 4, async (chunk) => {
    const { data, error } = await (supabase as any)
      .from('cash_ledger_reviews')
      .select('source, source_id, review_status')
      .in('source_id', chunk)
    if (error) {
      console.error('현금 거래 검토 상태 조회 오류:', error)
      return []
    }
    return data ?? []
  })

  const wanted = new Set(refs.map((r) => cashLedgerReviewKey(r.source, r.sourceId)))
  const out = new Map<string, CashLedgerReviewStatus>()
  for (const row of rows as Array<{ source?: string; source_id?: string; review_status?: string }>) {
    const source = row.source as CashLedgerReviewSource
    const sourceId = String(row.source_id ?? '')
    const key = cashLedgerReviewKey(source, sourceId)
    if (!wanted.has(key)) continue
    if (isReviewStatus(row.review_status)) out.set(key, row.review_status)
  }
  return out
}

export function dispatchCashLedgerReviewChanged(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(CASH_LEDGER_REVIEW_CHANGED_EVENT))
}

export async function upsertCashLedgerReview(args: {
  source: CashLedgerReviewSource
  sourceId: string
  status: CashLedgerReviewStatus
  reviewedBy: string
}): Promise<boolean> {
  const result = await bulkUpsertCashLedgerReviews({
    refs: [{ source: args.source, sourceId: args.sourceId }],
    status: args.status,
    reviewedBy: args.reviewedBy,
  })
  return result.updated > 0 && result.failed === 0
}

export async function bulkUpsertCashLedgerReviews(args: {
  refs: Array<{ source: CashLedgerReviewSource; sourceId: string }>
  status: CashLedgerReviewStatus
  reviewedBy: string
}): Promise<{ updated: number; failed: number }> {
  const seen = new Set<string>()
  const refs = args.refs.filter((ref) => {
    const sourceId = String(ref.sourceId ?? '').trim()
    if (!sourceId) return false
    const key = cashLedgerReviewKey(ref.source, sourceId)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  if (refs.length === 0) return { updated: 0, failed: 0 }

  const now = new Date().toISOString()
  const chunkSize = 100
  let updated = 0
  let failed = 0

  for (let i = 0; i < refs.length; i += chunkSize) {
    const chunk = refs.slice(i, i + chunkSize)
    const rows = chunk.map((ref) => ({
      source: ref.source,
      source_id: ref.sourceId,
      review_status: args.status,
      reviewed_by: args.reviewedBy,
      reviewed_at: now,
      updated_at: now,
    }))
    const { error } = await (supabase as any).from('cash_ledger_reviews').upsert(rows, {
      onConflict: 'source,source_id',
    })
    if (error) {
      console.error('현금 거래 일괄 검토 저장 오류:', error)
      failed += chunk.length
      continue
    }
    updated += chunk.length

    const bySource = new Map<CashLedgerReviewSource, string[]>()
    for (const ref of chunk) {
      const ids = bySource.get(ref.source) ?? []
      ids.push(ref.sourceId)
      bySource.set(ref.source, ids)
    }
    for (const [source, sourceIds] of bySource) {
      await (supabase as any)
        .from('cash_withdrawal_notifications')
        .update({ read_at: now })
        .eq('source', source)
        .in('source_id', sourceIds)
        .is('read_at', null)
    }
  }

  dispatchCashLedgerReviewChanged()
  return { updated, failed }
}

export async function markCashWithdrawalNotificationRead(id: string): Promise<void> {
  await (supabase as any)
    .from('cash_withdrawal_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
}
