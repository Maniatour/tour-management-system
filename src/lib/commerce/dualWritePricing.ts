/**
 * Phase 2: dual-write legacy dynamic_pricing → Commerce Core v2 tables.
 * Best-effort: never throws to the caller (legacy save remains SSOT).
 *
 * Batch saves run many dates in parallel — use in-process locks + upsert
 * so concurrent writers do not hit unique-constraint races.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'
import { KOVEgAS_OPERATOR_ID } from '@/lib/operatorConstants'
import type { SimplePricingRuleDto } from '@/lib/types/dynamic-pricing'
import { parseChoicePricingMode } from '@/lib/choicePricingMode'
import { enqueuePushRatesAfterDualWrite } from '@/lib/commerce/ota/enqueueSyncEvent'

export type CommerceDb = SupabaseClient<Database>
type ChoicesPricing = NonNullable<SimplePricingRuleDto['choices_pricing']>

/** Serialize concurrent ensure* for the same key (batch parallel dual-write). */
const inflight = new Map<string, Promise<string | null>>()

function withInflight(key: string, fn: () => Promise<string | null>): Promise<string | null> {
  const existing = inflight.get(key)
  if (existing) return existing
  const p = fn().finally(() => {
    if (inflight.get(key) === p) inflight.delete(key)
  })
  inflight.set(key, p)
  return p
}

function isUniqueViolation(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false
  return err.code === '23505' || (err.message || '').includes('duplicate key')
}

function parseChoices(raw: unknown): ChoicesPricing {
  if (raw == null) return {}
  let parsed: unknown = raw
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed)
    } catch {
      return {}
    }
  }
  if (typeof parsed !== 'object' || Array.isArray(parsed)) return {}
  return parsed as ChoicesPricing
}

function splitOfferCode(code: string): string[] {
  return code
    .split('+')
    .map((p) => p.trim())
    .filter(Boolean)
}

async function ensureRatePlan(
  db: CommerceDb,
  params: {
    operatorId: string
    productId: string
    channelId: string
    variantKey: string
    pricingMode: 'rule_based' | 'offer_fixed' | 'hybrid'
    legacyPriceType: string
  }
): Promise<string | null> {
  const lockKey = `rp:${params.operatorId}:${params.productId}:${params.channelId}:${params.variantKey}`

  return withInflight(lockKey, async () => {
    const payload = {
      operator_id: params.operatorId,
      product_id: params.productId,
      channel_id: params.channelId,
      variant_key: params.variantKey,
      pricing_mode: params.pricingMode,
      legacy_price_type: params.legacyPriceType,
      is_active: true,
    }

    const { data: upserted, error } = await db
      .from('rate_plans')
      .upsert(payload, {
        onConflict: 'operator_id,product_id,channel_id,variant_key',
      })
      .select('id')
      .maybeSingle()

    if (!error && upserted?.id) return upserted.id

    const { data: existing } = await db
      .from('rate_plans')
      .select('id')
      .eq('operator_id', params.operatorId)
      .eq('product_id', params.productId)
      .eq('channel_id', params.channelId)
      .eq('variant_key', params.variantKey)
      .maybeSingle()

    if (existing?.id) {
      await db
        .from('rate_plans')
        .update({
          pricing_mode: params.pricingMode,
          legacy_price_type: params.legacyPriceType,
          is_active: true,
        })
        .eq('id', existing.id)
      return existing.id
    }

    if (error && !isUniqueViolation(error)) {
      console.warn('[dualWritePricing] rate_plans upsert:', error.message)
    }
    return null
  })
}

async function upsertBaseRule(
  db: CommerceDb,
  operatorId: string,
  ratePlanId: string,
  adult: number,
  child: number,
  infant: number
): Promise<void> {
  const payload = {
    operator_id: operatorId,
    rate_plan_id: ratePlanId,
    rule_type: 'base' as const,
    scope_type: 'rate_plan' as const,
    scope_key: null as string | null,
    adult_amount: adult,
    child_amount: child,
    infant_amount: infant,
    priority: 10,
    is_active: true,
    source: 'dual_write',
  }

  const { data: existing } = await db
    .from('price_rules')
    .select('id')
    .eq('rate_plan_id', ratePlanId)
    .eq('rule_type', 'base')
    .eq('scope_type', 'rate_plan')
    .is('effective_from', null)
    .is('effective_to', null)
    .eq('is_active', true)
    .maybeSingle()

  if (existing?.id) {
    await db.from('price_rules').update(payload).eq('id', existing.id)
    return
  }

  const { error } = await db.from('price_rules').insert(payload)
  if (error && isUniqueViolation(error)) {
    const { data: again } = await db
      .from('price_rules')
      .select('id')
      .eq('rate_plan_id', ratePlanId)
      .eq('rule_type', 'base')
      .eq('scope_type', 'rate_plan')
      .eq('is_active', true)
      .maybeSingle()
    if (again?.id) await db.from('price_rules').update(payload).eq('id', again.id)
    return
  }
  if (error) console.warn('[dualWritePricing] price_rules base:', error.message)
}

async function upsertChoiceAdjustmentRules(
  db: CommerceDb,
  operatorId: string,
  ratePlanId: string,
  optionsPricing: NonNullable<SimplePricingRuleDto['options_pricing']>
): Promise<void> {
  for (const [scopeKey, amounts] of Object.entries(optionsPricing)) {
    if (!scopeKey) continue
    const payload = {
      operator_id: operatorId,
      rate_plan_id: ratePlanId,
      rule_type: 'choice_adjustment' as const,
      scope_type: 'choice_key' as const,
      scope_key: scopeKey,
      adult_amount: Number(amounts?.adult_price ?? 0),
      child_amount: Number(amounts?.child_price ?? 0),
      infant_amount: Number(amounts?.infant_price ?? 0),
      priority: 100,
      is_active: true,
      source: 'dual_write',
    }

    const { data: existing } = await db
      .from('price_rules')
      .select('id')
      .eq('rate_plan_id', ratePlanId)
      .eq('rule_type', 'choice_adjustment')
      .eq('scope_type', 'choice_key')
      .eq('scope_key', scopeKey)
      .is('effective_from', null)
      .is('effective_to', null)
      .eq('is_active', true)
      .maybeSingle()

    if (existing?.id) {
      await db.from('price_rules').update(payload).eq('id', existing.id)
      continue
    }

    const { error } = await db.from('price_rules').insert(payload)
    if (error && isUniqueViolation(error)) {
      const { data: again } = await db
        .from('price_rules')
        .select('id')
        .eq('rate_plan_id', ratePlanId)
        .eq('rule_type', 'choice_adjustment')
        .eq('scope_type', 'choice_key')
        .eq('scope_key', scopeKey)
        .eq('is_active', true)
        .maybeSingle()
      if (again?.id) await db.from('price_rules').update(payload).eq('id', again.id)
      continue
    }
    if (error) console.warn('[dualWritePricing] choice_adjustment:', error.message)
  }
}

async function ensureOffer(
  db: CommerceDb,
  operatorId: string,
  ratePlanId: string,
  code: string
): Promise<string | null> {
  const lockKey = `offer:${ratePlanId}:${code}`

  return withInflight(lockKey, async () => {
    const { data: upserted, error } = await db
      .from('offers')
      .upsert(
        {
          operator_id: operatorId,
          rate_plan_id: ratePlanId,
          code,
          name: code,
          creation_mode: 'dual_write',
          is_active: true,
        },
        { onConflict: 'rate_plan_id,code' }
      )
      .select('id')
      .maybeSingle()

    let offerId = upserted?.id ?? null

    if (!offerId) {
      const { data: existing } = await db
        .from('offers')
        .select('id')
        .eq('rate_plan_id', ratePlanId)
        .eq('code', code)
        .maybeSingle()
      offerId = existing?.id ?? null
    }

    if (!offerId) {
      if (error && !isUniqueViolation(error)) {
        console.warn('[dualWritePricing] offers upsert:', error.message)
      }
      return null
    }

    const parts = splitOfferCode(code)
    if (parts.length > 0) {
      const rows = parts.map((component_key) => ({
        operator_id: operatorId,
        offer_id: offerId as string,
        component_key,
        choice_option_id: null as string | null,
      }))
      const { error: compErr } = await db
        .from('offer_components')
        .upsert(rows, { onConflict: 'offer_id,component_key', ignoreDuplicates: true })
      if (compErr && !isUniqueViolation(compErr)) {
        console.warn('[dualWritePricing] offer_components:', compErr.message)
      }
    }

    return offerId
  })
}

async function upsertPlanOverride(
  db: CommerceDb,
  params: {
    operatorId: string
    ratePlanId: string
    date: string
    adult: number
    child: number
    infant: number
    isSaleAvailable: boolean
    notIncluded?: number | null
    commission?: number | null
    markupAmount?: number | null
    markupPercent?: number | null
    couponPercent?: number | null
    legacyId?: string | null
  }
): Promise<void> {
  const payload = {
    operator_id: params.operatorId,
    rate_plan_id: params.ratePlanId,
    offer_id: null as string | null,
    date: params.date,
    adult_price: params.adult,
    child_price: params.child,
    infant_price: params.infant,
    is_sale_available: params.isSaleAvailable,
    not_included_price: params.notIncluded ?? null,
    commission_percent: params.commission ?? null,
    markup_amount: params.markupAmount ?? null,
    markup_percent: params.markupPercent ?? null,
    coupon_percent: params.couponPercent ?? null,
    source: 'dual_write',
    legacy_dynamic_pricing_id: params.legacyId ?? null,
  }

  const { data: existing } = await db
    .from('price_overrides')
    .select('id')
    .eq('rate_plan_id', params.ratePlanId)
    .is('offer_id', null)
    .eq('date', params.date)
    .maybeSingle()

  if (existing?.id) {
    await db.from('price_overrides').update(payload).eq('id', existing.id)
  } else {
    const { error } = await db.from('price_overrides').insert(payload)
    if (error && isUniqueViolation(error)) {
      const { data: again } = await db
        .from('price_overrides')
        .select('id')
        .eq('rate_plan_id', params.ratePlanId)
        .is('offer_id', null)
        .eq('date', params.date)
        .maybeSingle()
      if (again?.id) await db.from('price_overrides').update(payload).eq('id', again.id)
    } else if (error) {
      console.warn('[dualWritePricing] plan override:', error.message)
    }
  }

  await db
    .from('stop_sells')
    .delete()
    .eq('rate_plan_id', params.ratePlanId)
    .is('offer_id', null)
    .eq('date', params.date)

  if (!params.isSaleAvailable) {
    const { error } = await db.from('stop_sells').insert({
      operator_id: params.operatorId,
      rate_plan_id: params.ratePlanId,
      offer_id: null,
      date: params.date,
      reason: 'is_sale_available=false',
      source: 'dual_write',
    })
    if (error && !isUniqueViolation(error)) {
      console.warn('[dualWritePricing] stop_sells:', error.message)
    }
  }
}

async function upsertOfferOverride(
  db: CommerceDb,
  params: {
    operatorId: string
    ratePlanId: string
    offerId: string
    date: string
    adult: number
    child: number
    infant: number
    otaSalePrice?: number | null
    notIncluded?: number | null
    isSaleAvailable: boolean
    legacyId?: string | null
  }
): Promise<void> {
  const payload = {
    operator_id: params.operatorId,
    rate_plan_id: params.ratePlanId,
    offer_id: params.offerId,
    date: params.date,
    adult_price: params.adult,
    child_price: params.child,
    infant_price: params.infant,
    ota_sale_price: params.otaSalePrice ?? null,
    not_included_price: params.notIncluded ?? null,
    is_sale_available: params.isSaleAvailable,
    source: 'dual_write',
    legacy_dynamic_pricing_id: params.legacyId ?? null,
  }

  const { data: existing } = await db
    .from('price_overrides')
    .select('id')
    .eq('rate_plan_id', params.ratePlanId)
    .eq('offer_id', params.offerId)
    .eq('date', params.date)
    .maybeSingle()

  if (existing?.id) {
    await db.from('price_overrides').update(payload).eq('id', existing.id)
    return
  }

  const { error } = await db.from('price_overrides').insert(payload)
  if (error && isUniqueViolation(error)) {
    const { data: again } = await db
      .from('price_overrides')
      .select('id')
      .eq('rate_plan_id', params.ratePlanId)
      .eq('offer_id', params.offerId)
      .eq('date', params.date)
      .maybeSingle()
    if (again?.id) await db.from('price_overrides').update(payload).eq('id', again.id)
    return
  }
  if (error) console.warn('[dualWritePricing] offer override:', error.message)
}

/**
 * Mirror one saved dynamic_pricing row into v2 tables.
 */
export async function dualWriteDynamicPricingToV2(params: {
  rule: SimplePricingRuleDto
  legacyRowId?: string | null
  operatorId?: string
  client?: CommerceDb
}): Promise<{ ok: boolean; ratePlanId?: string }> {
  try {
    const db = params.client ?? supabase
    const operatorId = params.operatorId || KOVEgAS_OPERATOR_ID
    const rule = params.rule
    const variantKey = rule.variant_key || 'default'
    const mode = parseChoicePricingMode(rule.price_calculation_method)
    const pricingMode =
      mode === 'base_plus'
        ? 'rule_based'
        : Object.keys(parseChoices(rule.choices_pricing)).length > 0
          ? 'offer_fixed'
          : 'hybrid'

    const ratePlanId = await ensureRatePlan(db, {
      operatorId,
      productId: rule.product_id,
      channelId: rule.channel_id,
      variantKey,
      pricingMode: pricingMode as 'rule_based' | 'offer_fixed' | 'hybrid',
      legacyPriceType: rule.price_type || 'dynamic',
    })
    if (!ratePlanId) return { ok: false }

    await upsertBaseRule(
      db,
      operatorId,
      ratePlanId,
      Number(rule.adult_price ?? 0),
      Number(rule.child_price ?? 0),
      Number(rule.infant_price ?? 0)
    )

    if (mode === 'base_plus' && rule.options_pricing) {
      await upsertChoiceAdjustmentRules(db, operatorId, ratePlanId, rule.options_pricing)
    }

    await upsertPlanOverride(db, {
      operatorId,
      ratePlanId,
      date: rule.date,
      adult: Number(rule.adult_price ?? 0),
      child: Number(rule.child_price ?? 0),
      infant: Number(rule.infant_price ?? 0),
      isSaleAvailable: rule.is_sale_available !== false,
      notIncluded: rule.not_included_price ?? null,
      commission: rule.commission_percent,
      markupAmount: rule.markup_amount,
      markupPercent: rule.markup_percent ?? null,
      couponPercent: rule.coupon_percent,
      legacyId: params.legacyRowId ?? null,
    })

    const choices = parseChoices(rule.choices_pricing)
    for (const [code, choiceData] of Object.entries(choices)) {
      if (!code || code === '__no_choice__') continue
      const offerId = await ensureOffer(db, operatorId, ratePlanId, code)
      if (!offerId || !choiceData) continue

      const adult = Number(
        choiceData.adult_price ?? (choiceData as { adult?: number }).adult ?? 0
      )
      const child = Number(
        choiceData.child_price ?? (choiceData as { child?: number }).child ?? 0
      )
      const infant = Number(
        choiceData.infant_price ?? (choiceData as { infant?: number }).infant ?? 0
      )
      const ota = Number(choiceData.ota_sale_price ?? 0)
      const choiceSaleAvailable =
        choiceData.is_sale_available === undefined
          ? rule.is_sale_available !== false
          : choiceData.is_sale_available !== false

      await upsertOfferOverride(db, {
        operatorId,
        ratePlanId,
        offerId,
        date: rule.date,
        adult: adult || ota,
        child: child || ota,
        infant: infant || ota,
        otaSalePrice: ota || null,
        notIncluded:
          choiceData.not_included_price != null
            ? Number(choiceData.not_included_price)
            : null,
        isSaleAvailable: choiceSaleAvailable,
        legacyId: params.legacyRowId ?? null,
      })
    }

    // Phase 4a: best-effort OTA outbox (gated by COMMERCE_V2_OTA_SYNC)
    void enqueuePushRatesAfterDualWrite(
      db,
      {
        productId: rule.product_id,
        channelId: rule.channel_id,
        variantKey,
        date: rule.date,
        ratePlanId,
        adult: Number(rule.adult_price ?? 0),
        child: Number(rule.child_price ?? 0),
        infant: Number(rule.infant_price ?? 0),
        isSaleAvailable: rule.is_sale_available !== false,
        source: 'dual_write_dynamic_pricing',
      },
      operatorId
    )

    return { ok: true, ratePlanId }
  } catch (err) {
    console.warn('[dualWritePricing] unexpected:', err)
    return { ok: false }
  }
}

/** Exported for backfill mapping */
export function mapDynamicPricingRowToRuleDto(row: {
  id?: string
  product_id: string | null
  channel_id: string | null
  date: string
  adult_price: number
  child_price: number
  infant_price: number
  commission_percent?: number | null
  markup_amount?: number | null
  markup_percent?: number | null
  coupon_percent?: number | null
  is_sale_available?: boolean | null
  not_included_price?: number | null
  price_type?: string | null
  variant_key?: string | null
  price_calculation_method?: string | null
  choices_pricing?: unknown
  options_pricing?: unknown
  price_adjustment_adult?: number | null
  price_adjustment_child?: number | null
  price_adjustment_infant?: number | null
}): SimplePricingRuleDto | null {
  if (!row.product_id || !row.channel_id || !row.date) return null
  return {
    product_id: row.product_id,
    channel_id: row.channel_id,
    date: String(row.date).split('T')[0],
    adult_price: Number(row.adult_price ?? 0),
    child_price: Number(row.child_price ?? 0),
    infant_price: Number(row.infant_price ?? 0),
    commission_percent: Number(row.commission_percent ?? 0),
    markup_amount: Number(row.markup_amount ?? 0),
    coupon_percent: Number(row.coupon_percent ?? 0),
    is_sale_available: row.is_sale_available !== false,
    not_included_price: Number(row.not_included_price ?? 0),
    markup_percent: Number(row.markup_percent ?? 0),
    price_type: row.price_type === 'base' ? 'base' : 'dynamic',
    variant_key: row.variant_key || 'default',
    price_calculation_method:
      row.price_calculation_method === 'base_plus' ? 'base_plus' : 'absolute',
    price_adjustment_adult: Number(row.price_adjustment_adult ?? 0),
    price_adjustment_child: Number(row.price_adjustment_child ?? 0),
    price_adjustment_infant: Number(row.price_adjustment_infant ?? 0),
    ...(row.options_pricing && typeof row.options_pricing === 'object'
      ? {
          options_pricing: row.options_pricing as SimplePricingRuleDto['options_pricing'],
        }
      : {}),
    ...(row.choices_pricing
      ? { choices_pricing: parseChoices(row.choices_pricing) }
      : {}),
  }
}
