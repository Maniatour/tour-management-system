/**
 * Phase 2 stub: resolve price from Commerce Core v2 tables.
 * Not used by checkout yet — legacy calculate_dynamic_price remains SSOT.
 * Intended for shadow compares and future cutover.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'
import { KOVEgAS_OPERATOR_ID } from '@/lib/operatorConstants'

type Db = SupabaseClient<Database>

export type ResolvePriceV2Input = {
  operatorId?: string
  productId: string
  channelId: string
  variantKey?: string
  date: string
  offerCode?: string | null
  client?: Db
}

export type ResolvePriceV2Result = {
  found: boolean
  ratePlanId?: string
  offerId?: string | null
  adult: number
  child: number
  infant: number
  isSaleAvailable: boolean
  source: 'offer_override' | 'plan_override' | 'base_rule' | 'not_found'
}

export async function resolvePriceV2(
  input: ResolvePriceV2Input
): Promise<ResolvePriceV2Result> {
  const db = input.client ?? supabase
  const operatorId = input.operatorId || KOVEgAS_OPERATOR_ID
  const variantKey = input.variantKey || 'default'

  const { data: plan } = await db
    .from('rate_plans')
    .select('id')
    .eq('operator_id', operatorId)
    .eq('product_id', input.productId)
    .eq('channel_id', input.channelId)
    .eq('variant_key', variantKey)
    .eq('is_active', true)
    .maybeSingle()

  if (!plan?.id) {
    return {
      found: false,
      adult: 0,
      child: 0,
      infant: 0,
      isSaleAvailable: true,
      source: 'not_found',
    }
  }

  let offerId: string | null = null
  if (input.offerCode) {
    const { data: offer } = await db
      .from('offers')
      .select('id')
      .eq('rate_plan_id', plan.id)
      .eq('code', input.offerCode)
      .eq('is_active', true)
      .maybeSingle()
    offerId = offer?.id ?? null

    if (offerId) {
      const { data: offerOv } = await db
        .from('price_overrides')
        .select('adult_price, child_price, infant_price, is_sale_available, ota_sale_price')
        .eq('rate_plan_id', plan.id)
        .eq('offer_id', offerId)
        .eq('date', input.date)
        .maybeSingle()

      if (offerOv) {
        const ota = Number(offerOv.ota_sale_price ?? 0)
        return {
          found: true,
          ratePlanId: plan.id,
          offerId,
          adult: Number(offerOv.adult_price) || ota,
          child: Number(offerOv.child_price) || ota,
          infant: Number(offerOv.infant_price) || ota,
          isSaleAvailable: offerOv.is_sale_available !== false,
          source: 'offer_override',
        }
      }
    }
  }

  const { data: planOv } = await db
    .from('price_overrides')
    .select('adult_price, child_price, infant_price, is_sale_available')
    .eq('rate_plan_id', plan.id)
    .is('offer_id', null)
    .eq('date', input.date)
    .maybeSingle()

  if (planOv) {
    return {
      found: true,
      ratePlanId: plan.id,
      offerId,
      adult: Number(planOv.adult_price) || 0,
      child: Number(planOv.child_price) || 0,
      infant: Number(planOv.infant_price) || 0,
      isSaleAvailable: planOv.is_sale_available !== false,
      source: 'plan_override',
    }
  }

  const { data: baseRule } = await db
    .from('price_rules')
    .select('adult_amount, child_amount, infant_amount')
    .eq('rate_plan_id', plan.id)
    .eq('rule_type', 'base')
    .eq('is_active', true)
    .maybeSingle()

  if (baseRule) {
    return {
      found: true,
      ratePlanId: plan.id,
      offerId,
      adult: Number(baseRule.adult_amount) || 0,
      child: Number(baseRule.child_amount) || 0,
      infant: Number(baseRule.infant_amount) || 0,
      isSaleAvailable: true,
      source: 'base_rule',
    }
  }

  return {
    found: false,
    ratePlanId: plan.id,
    offerId,
    adult: 0,
    child: 0,
    infant: 0,
    isSaleAvailable: true,
    source: 'not_found',
  }
}
