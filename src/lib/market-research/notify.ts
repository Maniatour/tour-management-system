import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import { resolveOperatorId } from '@/lib/operators/scopeQuery'
import {
  MARKET_ALERT_COLUMNS,
  MARKET_ALERTS_TABLE,
} from './tables'
import type { MarketAlertKind, MarketPriceAlert } from './types'

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value)
    if (Number.isFinite(n)) return n
  }
  return null
}

export function mapMarketPriceAlertRow(row: Record<string, unknown>): MarketPriceAlert | null {
  const id = typeof row.id === 'string' ? row.id : ''
  const createdAt = typeof row.created_at === 'string' ? row.created_at : ''
  const kind = typeof row.kind === 'string' ? row.kind : ''
  const title = typeof row.title === 'string' ? row.title : ''
  if (!id || !createdAt || !title) return null
  if (kind !== 'price_changed' && kind !== 'fetch_failed' && kind !== 'stale') return null
  return {
    id,
    operator_id: typeof row.operator_id === 'string' ? row.operator_id : '',
    listing_id: typeof row.listing_id === 'string' ? row.listing_id : null,
    kind,
    title,
    body: typeof row.body === 'string' ? row.body : '',
    canyon_variant: typeof row.canyon_variant === 'string' ? row.canyon_variant : null,
    offer_type: typeof row.offer_type === 'string' ? row.offer_type : null,
    old_adult_total: toNumber(row.old_adult_total),
    new_adult_total: toNumber(row.new_adult_total),
    created_at: createdAt,
  }
}

export async function insertMarketPriceAlert(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  input: {
    operatorId?: string | null
    listingId?: string | null
    kind: MarketAlertKind
    title: string
    body: string
    canyonVariant?: string | null
    offerType?: string | null
    oldAdultTotal?: number | null
    newAdultTotal?: number | null
  }
): Promise<MarketPriceAlert | null> {
  const { data, error } = await fromUntypedTable(admin, MARKET_ALERTS_TABLE)
    .insert({
      operator_id: resolveOperatorId(input.operatorId),
      listing_id: input.listingId || null,
      kind: input.kind,
      title: input.title,
      body: input.body,
      canyon_variant: input.canyonVariant || null,
      offer_type: input.offerType || null,
      old_adult_total: input.oldAdultTotal ?? null,
      new_adult_total: input.newAdultTotal ?? null,
    } as never)
    .select(MARKET_ALERT_COLUMNS)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data || typeof data !== 'object') return null
  return mapMarketPriceAlertRow(data as Record<string, unknown>)
}
