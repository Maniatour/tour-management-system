/**
 * Backfill recent/legacy dynamic_pricing rows into Commerce Core v2.
 * Uses service-role or staff client; processes in pages to avoid timeouts.
 */
import type { CommerceDb } from '@/lib/commerce/dualWritePricing'
import {
  dualWriteDynamicPricingToV2,
  mapDynamicPricingRowToRuleDto,
} from '@/lib/commerce/dualWritePricing'
import { KOVEgAS_OPERATOR_ID } from '@/lib/operatorConstants'

export type BackfillV2Params = {
  client: CommerceDb
  operatorId?: string
  productId?: string
  channelId?: string
  /** Inclusive lower bound YYYY-MM-DD (default: today - monthsBack) */
  fromDate?: string
  monthsBack?: number
  limit?: number
  offset?: number
}

export type BackfillV2Result = {
  scanned: number
  written: number
  skipped: number
  failed: number
  nextOffset: number | null
  sampleErrors: string[]
}

function defaultFromDate(monthsBack: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() - monthsBack)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export async function backfillDynamicPricingToV2(
  params: BackfillV2Params
): Promise<BackfillV2Result> {
  const operatorId = params.operatorId || KOVEgAS_OPERATOR_ID
  const limit = Math.min(Math.max(params.limit ?? 100, 1), 500)
  const offset = Math.max(params.offset ?? 0, 0)
  const fromDate = params.fromDate || defaultFromDate(params.monthsBack ?? 3)

  let query = params.client
    .from('dynamic_pricing')
    .select(
      'id, product_id, channel_id, date, adult_price, child_price, infant_price, commission_percent, markup_amount, markup_percent, coupon_percent, is_sale_available, not_included_price, price_type, variant_key, price_calculation_method, choices_pricing, options_pricing, price_adjustment_adult, price_adjustment_child, price_adjustment_infant'
    )
    .gte('date', fromDate)
    .order('date', { ascending: true })
    .order('id', { ascending: true })
    .range(offset, offset + limit - 1)

  if (params.productId) query = query.eq('product_id', params.productId)
  if (params.channelId) query = query.eq('channel_id', params.channelId)

  const { data: rows, error } = await query
  if (error) {
    throw new Error(`backfill query failed: ${error.message}`)
  }

  let written = 0
  let skipped = 0
  let failed = 0
  const sampleErrors: string[] = []

  for (const row of rows || []) {
    const rule = mapDynamicPricingRowToRuleDto(row)
    if (!rule) {
      skipped++
      continue
    }
    const result = await dualWriteDynamicPricingToV2({
      rule,
      legacyRowId: row.id != null ? String(row.id) : null,
      operatorId,
      client: params.client,
    })
    if (result.ok) {
      written++
    } else {
      failed++
      if (sampleErrors.length < 10) {
        sampleErrors.push(
          `${rule.product_id}/${rule.channel_id}/${rule.date}/${rule.variant_key}`
        )
      }
    }
  }

  const scanned = rows?.length ?? 0
  const nextOffset = scanned < limit ? null : offset + scanned

  return {
    scanned,
    written,
    skipped,
    failed,
    nextOffset,
    sampleErrors,
  }
}
