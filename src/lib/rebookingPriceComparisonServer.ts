import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import {
  calculateServerBookingPrice,
  defaultBookingTenantContext,
  type CustomerBookingLineInput,
} from '@/lib/customerBookingCheckout'
import { calculateChoiceLineTotal, parseChoicePricingUnit } from '@/lib/choicePricingUnit'
import { parseChoicePricingMode, resolveChoiceFinalPrices, expandOptionsPricingToChoicesPricing } from '@/lib/choicePricingMode'
import { calculateBookingPriceV2 } from '@/lib/commerce/calculateBookingPriceV2'
import { findChoicePricingData } from '@/utils/choicePricingMatcher'
import { REBOOKING_OUTREACH_COUPON_CODE } from '@/lib/customerRebookingUrl'
import type {
  RebookingPriceComparisonResult,
  RebookingPricingSnapshot,
} from '@/lib/rebookingPriceComparison'
import { resolveReservationChoices } from '@/lib/resolveReservationChoices'
import {
  computeCustomerPaymentTotalLineFormula,
  pricingFieldToNumber,
  type PartySizeSource,
} from '@/utils/reservationPricingBalance'

type AdminClient = SupabaseClient<Database>

type ChoiceSelection = {
  choice_id: string
  option_id: string
  quantity: number
}

function roundUsd2(n: number): number {
  return Math.round(n * 100) / 100
}

function isUndecidedOption(optionId: string | null | undefined): boolean {
  if (!optionId) return true
  const v = optionId.trim()
  return !v || v === '__undecided__' || v === 'undecided'
}

function parseChoicesJsonItems(raw: unknown): ChoiceSelection[] {
  if (!raw || typeof raw !== 'object') return []
  const obj = raw as { required?: unknown[]; optional?: unknown[] }
  const out: ChoiceSelection[] = []
  for (const list of [obj.required, obj.optional]) {
    if (!Array.isArray(list)) continue
    for (const item of list) {
      if (!item || typeof item !== 'object') continue
      const row = item as {
        choice_id?: string
        option_id?: string
        quantity?: number | null
      }
      const choiceId = String(row.choice_id ?? '').trim()
      const optionId = String(row.option_id ?? '').trim()
      if (!choiceId || isUndecidedOption(optionId)) continue
      out.push({
        choice_id: choiceId,
        option_id: optionId,
        quantity: Math.max(1, Number(row.quantity) || 1),
      })
    }
  }
  return out
}

function mergeChoiceSelections(...groups: ChoiceSelection[][]): ChoiceSelection[] {
  const byKey = new Map<string, ChoiceSelection>()
  for (const group of groups) {
    for (const row of group) {
      const key = `${row.choice_id}:${row.option_id}`
      const existing = byKey.get(key)
      if (existing) {
        existing.quantity = Math.max(existing.quantity, row.quantity)
      } else {
        byKey.set(key, { ...row })
      }
    }
  }
  return [...byKey.values()]
}

function selectionsToSelectedOptions(selections: ChoiceSelection[]): Record<string, string> {
  const selectedOptions: Record<string, string> = {}
  for (const row of selections) {
    selectedOptions[row.choice_id] = row.option_id
  }
  return selectedOptions
}

async function classifySelectedOptionsForRebooking(
  admin: AdminClient,
  productId: string,
  selectedOptions: Record<string, string>
): Promise<{ additionalOptionIds: string[] }> {
  const { data: productOptions } = await admin
    .from('product_options')
    .select('id')
    .eq('product_id', productId)

  const productOptionIds = new Set((productOptions ?? []).map((r) => r.id))
  const additionalOptionIds: string[] = []

  for (const optionId of Object.values(selectedOptions)) {
    if (!optionId) continue
    if (productOptionIds.has(optionId)) additionalOptionIds.push(optionId)
  }

  return { additionalOptionIds }
}

function billingPax(party: PartySizeSource): number {
  const a = party.adults ?? 0
  const c = (party.children ?? party.child ?? 0) ?? 0
  const i = (party.infants ?? party.infant ?? 0) ?? 0
  const n = a + c + i
  return n > 0 ? n : 1
}

/** 가격 정보 ① 고객 총 결제 금액(산식) — 취소 후 total_price=0 이면 산식 우선 */
function resolveOtaCustomerExpectedPayment(
  pricing: RebookingPricingSnapshot,
  party: PartySizeSource
): number {
  const formula = computeCustomerPaymentTotalLineFormula(pricing, party)
  const stored = pricingFieldToNumber(pricing.total_price)
  if (formula > 0.005) return formula
  return stored
}

type UnitPrice = { adult: number; child: number; infant: number }

function parseJsonRecord(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  return raw as Record<string, unknown>
}

function parseUnitPrice(node: unknown): UnitPrice | null {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return null
  const o = node as Record<string, unknown>
  return {
    adult: Number(o.adult_price ?? o.adult ?? 0) || 0,
    child: Number(o.child_price ?? o.child ?? 0) || 0,
    infant: Number(o.infant_price ?? o.infant ?? 0) || 0,
  }
}

function buildStablePricingKey(choiceGroupKey: string, optionKey: string): string {
  return `${choiceGroupKey}+${optionKey}`
}

function lookupOptionsPricing(
  optionsPricing: Record<string, unknown>,
  keys: string[]
): UnitPrice | null {
  for (const key of keys) {
    if (!key) continue
    const found = parseUnitPrice(optionsPricing[key])
    if (found && (found.adult !== 0 || found.child !== 0 || found.infant !== 0)) {
      return found
    }
  }
  return null
}

function parseChoiceOptionDynamicPrice(
  choicesPricingRaw: unknown,
  choiceId: string,
  optionId: string,
  stableKey?: string
): UnitPrice | null {
  if (!choicesPricingRaw || typeof choicesPricingRaw !== 'object') return null
  let parsed: Record<string, unknown> = choicesPricingRaw as Record<string, unknown>
  if ('combinations' in parsed && parsed.combinations && typeof parsed.combinations === 'object') {
    parsed = parsed.combinations as Record<string, unknown>
  }

  const lookupKeys = [stableKey, optionId, choiceId].filter(Boolean) as string[]
  for (const key of lookupKeys) {
    const flat = parsed[key]
    if (flat && typeof flat === 'object' && !Array.isArray(flat)) {
      const unit = parseUnitPrice(flat)
      if (unit) return unit
    }
  }

  const choiceNode = parsed[choiceId]
  if (choiceNode && typeof choiceNode === 'object' && !Array.isArray(choiceNode)) {
    const optionNode = (choiceNode as Record<string, unknown>)[optionId]
    if (optionNode && typeof optionNode === 'object' && !Array.isArray(optionNode)) {
      const unit = parseUnitPrice(optionNode)
      if (unit) return unit
    }
    const unit = parseUnitPrice(choiceNode)
    if (unit) return unit
  }

  return null
}

async function loadDynamicPricingForDate(
  admin: AdminClient,
  params: {
    productId: string
    tourDate: string
    channelId: string
    variantKey?: string | null
  }
) {
  const variantKeys = [
    params.variantKey?.trim() || '',
    'default',
  ].filter((v, i, arr) => v && arr.indexOf(v) === i)

  const candidates: Array<{
    adult_price: number | null
    child_price: number | null
    infant_price: number | null
    choices_pricing: unknown
    options_pricing: unknown
    price_calculation_method: string | null
    updated_at?: string | null
  }> = []

  for (const variantKey of variantKeys) {
    for (const priceType of ['dynamic', 'base', null] as const) {
      let query = admin
        .from('dynamic_pricing')
        .select(
          'adult_price, child_price, infant_price, choices_pricing, options_pricing, price_calculation_method, updated_at'
        )
        .eq('product_id', params.productId)
        .eq('channel_id', params.channelId)
        .eq('date', params.tourDate)
        .eq('variant_key', variantKey)
        .order('updated_at', { ascending: false })
        .limit(5)
      if (priceType) {
        query = query.eq('price_type', priceType)
      }
      const { data } = await query
      if (data?.length) candidates.push(...data)
    }
  }

  if (candidates.length === 0) return null

  const score = (row: (typeof candidates)[number]) => {
    const options = parseJsonRecord(row.options_pricing)
    const choices = parseJsonRecord(row.choices_pricing)
    let s = 0
    if (Object.keys(options).length > 0) s += 100
    if (Object.keys(choices).length > 0) s += 50
    if (row.price_calculation_method === 'base_plus') s += 25
    return s
  }

  candidates.sort((a, b) => {
    const diff = score(b) - score(a)
    if (diff !== 0) return diff
    return String(b.updated_at ?? '').localeCompare(String(a.updated_at ?? ''))
  })

  return candidates[0] ?? null
}

type ChoiceCombinationLike = {
  id: string
  combination_key: string
  combination_details: Array<{
    groupId: string
    optionId: string
    optionKey?: string
  }>
}

function buildChoiceCombinationFromSelections(
  selections: ChoiceSelection[],
  optionById: Map<
    string,
    {
      id: string
      choice_id: string | null
      option_key: string | null
      adult_price: number | null
      child_price: number | null
      infant_price: number | null
    }
  >
): ChoiceCombinationLike | null {
  const details: ChoiceCombinationLike['combination_details'] = []
  for (const sel of selections) {
    const option = optionById.get(sel.option_id)
    if (!option?.choice_id) continue
    details.push({
      groupId: option.choice_id,
      optionId: sel.option_id,
      ...(option.option_key ? { optionKey: String(option.option_key) } : {}),
    })
  }
  if (details.length === 0) return null

  const optionKeys = details
    .map((d) => d.optionKey)
    .filter((k): k is string => Boolean(k))
    .sort()
  const optionIds = details.map((d) => d.optionId).sort()
  const combination_key = optionKeys.length > 0 ? optionKeys.join('+') : optionIds.join('+')
  return {
    id: combination_key,
    combination_key,
    combination_details: details,
  }
}

function buildOptionsPricingLookupIndex(
  optionsPricing: Record<string, unknown>,
  optionById: Map<
    string,
    { id: string; option_key: string | null; choice_id: string | null }
  >,
  choiceGroupKeyByChoiceId: Map<string, string>
): Map<string, UnitPrice> {
  const index = new Map<string, UnitPrice>()
  const aliasKeysFor = (optionId: string, optionKey: string, choiceId: string) => {
    const keys = [optionId, optionKey]
    const groupKey = choiceGroupKeyByChoiceId.get(choiceId)
    if (groupKey && optionKey) keys.push(buildStablePricingKey(groupKey, optionKey))
    return keys.filter(Boolean)
  }

  for (const [rawKey, rawVal] of Object.entries(optionsPricing)) {
    const unit = parseUnitPrice(rawVal)
    if (!unit) continue
    index.set(rawKey, unit)
    for (const option of optionById.values()) {
      const optionKey = String(option.option_key ?? '').trim()
      if (!option.choice_id) continue
      const aliases = aliasKeysFor(option.id, optionKey, option.choice_id)
      if (aliases.includes(rawKey)) {
        for (const alias of aliases) index.set(alias, unit)
      }
    }
  }

  return index
}

function sumPerOptionAdjustments(
  selections: ChoiceSelection[],
  optionById: Map<
    string,
    {
      id: string
      choice_id: string | null
      option_key: string | null
      adult_price: number | null
      child_price: number | null
      infant_price: number | null
    }
  >,
  pricingUnitByChoiceId: Map<string, string>,
  optionsIndex: Map<string, UnitPrice>,
  params: { adults: number; children: number; infants: number }
): number {
  let total = 0
  for (const sel of selections) {
    const option = optionById.get(sel.option_id)
    if (!option?.choice_id) continue
    const optionKey = String(option.option_key ?? '').trim()
    const keys = [sel.option_id, optionKey].filter(Boolean)
    let unit: UnitPrice | null = null
    for (const key of keys) {
      const found = optionsIndex.get(key)
      if (found) {
        unit = found
        break
      }
    }
    if (!unit) {
      unit = {
        adult: Number(option.adult_price) || 0,
        child: Number(option.child_price) || 0,
        infant: Number(option.infant_price) || 0,
      }
    }
    total += calculateChoiceLineTotal({
      pricingUnit: pricingUnitByChoiceId.get(option.choice_id) || 'per_person',
      adultPrice: unit.adult,
      childPrice: unit.child,
      infantPrice: unit.infant,
      adults: params.adults,
      children: params.children,
      infants: params.infants,
      quantity: sel.quantity,
    })
  }
  return total
}

/** 홈페이지 직판가: 동적 기본가 + 예약 초이스(전체) 날짜별 단가 합산 */
async function computeExplicitDirectWebsiteSubtotal(
  admin: AdminClient,
  params: {
    productId: string
    tourDate: string
    channelId: string
    variantKey?: string | null
    adults: number
    children: number
    infants: number
    selections: ChoiceSelection[]
  }
): Promise<number> {
  const dp = await loadDynamicPricingForDate(admin, {
    productId: params.productId,
    tourDate: params.tourDate,
    channelId: params.channelId,
    ...(params.variantKey != null ? { variantKey: params.variantKey } : {}),
  })

  const pricingMode = parseChoicePricingMode(dp?.price_calculation_method)
  const optionsPricing = parseJsonRecord(dp?.options_pricing)
  const baseUnit: UnitPrice = dp
    ? {
        adult: Number(dp.adult_price) || 0,
        child: Number(dp.child_price) || 0,
        infant: Number(dp.infant_price) || 0,
      }
    : { adult: 0, child: 0, infant: 0 }

  let base = 0
  if (dp) {
    base =
      baseUnit.adult * params.adults +
      baseUnit.child * params.children +
      baseUnit.infant * params.infants
  } else {
    const { data: product } = await admin
      .from('products')
      .select('base_price, adult_base_price')
      .eq('id', params.productId)
      .maybeSingle()
    const unit = Number(product?.base_price) || Number(product?.adult_base_price) || 0
    const pax = params.adults + params.children + params.infants || 1
    base = unit * pax
    baseUnit.adult = unit
  }

  const optionIds = [...new Set(params.selections.map((s) => s.option_id).filter(Boolean))]
  if (optionIds.length === 0) return roundUsd2(base)

  const { data: choiceOptions } = await admin
    .from('choice_options')
    .select('id, choice_id, option_key, adult_price, child_price, infant_price')
    .in('id', optionIds)

  const choiceIds = [
    ...new Set(
      (choiceOptions ?? [])
        .map((o) => o.choice_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    ),
  ]

  const pricingUnitByChoiceId = new Map<string, string>()
  const choiceGroupKeyByChoiceId = new Map<string, string>()
  if (choiceIds.length > 0) {
    const { data: productChoices } = await admin
      .from('product_choices')
      .select('id, pricing_unit, choice_group_key')
      .in('id', choiceIds)
    for (const row of productChoices ?? []) {
      pricingUnitByChoiceId.set(row.id, parseChoicePricingUnit(row.pricing_unit))
      if (row.choice_group_key) {
        choiceGroupKeyByChoiceId.set(row.id, row.choice_group_key)
      }
    }
  }

  const optionById = new Map((choiceOptions ?? []).map((o) => [o.id, o]))
  const combination = buildChoiceCombinationFromSelections(params.selections, optionById)
  const choicesPricing = parseJsonRecord(dp?.choices_pricing)
  const optionsIndex = buildOptionsPricingLookupIndex(optionsPricing, optionById, choiceGroupKeyByChoiceId)

  let choicesTotal = 0

  if (pricingMode === 'base_plus' && combination) {
    const match = findChoicePricingData(combination, choicesPricing)
    const comboUnit = parseUnitPrice(match.data)
    if (comboUnit && (comboUnit.adult !== 0 || comboUnit.child !== 0 || comboUnit.infant !== 0)) {
      choicesTotal = calculateChoiceLineTotal({
        pricingUnit: 'per_person',
        adultPrice: comboUnit.adult,
        childPrice: comboUnit.child,
        infantPrice: comboUnit.infant,
        adults: params.adults,
        children: params.children,
        infants: params.infants,
        quantity: 1,
      })
      return roundUsd2(base + choicesTotal)
    }

    if (Object.keys(optionsPricing).length > 0) {
      const expanded = expandOptionsPricingToChoicesPricing(
        optionsPricing as Record<
          string,
          { adult_price?: number; child_price?: number; infant_price?: number }
        >,
        [
          {
            id: combination.id,
            combination_details: combination.combination_details.map((d) => ({
              optionId: d.optionId,
              ...(d.optionKey ? { optionKey: d.optionKey } : {}),
            })),
          },
        ]
      )
      const expandedUnit = parseUnitPrice(expanded[combination.id])
      if (
        expandedUnit &&
        (expandedUnit.adult !== 0 || expandedUnit.child !== 0 || expandedUnit.infant !== 0)
      ) {
        choicesTotal = calculateChoiceLineTotal({
          pricingUnit: 'per_person',
          adultPrice: expandedUnit.adult,
          childPrice: expandedUnit.child,
          infantPrice: expandedUnit.infant,
          adults: params.adults,
          children: params.children,
          infants: params.infants,
          quantity: 1,
        })
        return roundUsd2(base + choicesTotal)
      }
    }

    choicesTotal = sumPerOptionAdjustments(
      params.selections,
      optionById,
      pricingUnitByChoiceId,
      optionsIndex,
      params
    )
    return roundUsd2(base + choicesTotal)
  }

  for (const sel of params.selections) {
    const option = optionById.get(sel.option_id)
    if (!option?.choice_id) continue

    const choiceId = option.choice_id
    const optionKey = String(option.option_key ?? '').trim()
    const choiceGroupKey = choiceGroupKeyByChoiceId.get(choiceId) || ''
    const stableKey =
      choiceGroupKey && optionKey ? buildStablePricingKey(choiceGroupKey, optionKey) : ''
    const lookupKeys = [sel.option_id, optionKey, stableKey].filter(Boolean)

    const pricingUnit = pricingUnitByChoiceId.get(choiceId) || 'per_person'
    let adultPrice = Number(option.adult_price) || 0
    let childPrice = Number(option.child_price) || 0
    let infantPrice = Number(option.infant_price) || 0

    if (pricingMode === 'base_plus') {
      const optionAdjustment =
        lookupOptionsPricing(optionsPricing, lookupKeys) ||
        optionsIndex.get(sel.option_id) ||
        (optionKey ? optionsIndex.get(optionKey) : null) ||
        parseChoiceOptionDynamicPrice(dp?.choices_pricing, choiceId, sel.option_id, stableKey)
      if (optionAdjustment) {
        adultPrice = optionAdjustment.adult
        childPrice = optionAdjustment.child
        infantPrice = optionAdjustment.infant
      }
    } else {
      const dynamic =
        parseChoiceOptionDynamicPrice(dp?.choices_pricing, choiceId, sel.option_id, stableKey) ||
        lookupOptionsPricing(optionsPricing, lookupKeys)
      const resolved = resolveChoiceFinalPrices({
        mode: pricingMode,
        base: baseUnit,
        choiceData: dynamic
          ? {
              adult_price: dynamic.adult,
              child_price: dynamic.child,
              infant_price: dynamic.infant,
            }
          : {
              adult_price: adultPrice,
              child_price: childPrice,
              infant_price: infantPrice,
            },
      })
      adultPrice = resolved.adult
      childPrice = resolved.child
      infantPrice = resolved.infant
    }

    choicesTotal += calculateChoiceLineTotal({
      pricingUnit,
      adultPrice,
      childPrice,
      infantPrice,
      adults: params.adults,
      children: params.children,
      infants: params.infants,
      quantity: sel.quantity,
    })
  }

  return roundUsd2(base + choicesTotal)
}

export async function fetchRebookingPriceComparisonForReservation(
  admin: AdminClient,
  params: {
    reservationId: string
    couponCode?: string
    channelName?: string | null
  }
): Promise<RebookingPriceComparisonResult | null> {
  const reservationId = params.reservationId.trim()
  if (!reservationId) return null

  const { data: reservation, error: resError } = await admin
    .from('reservations')
    .select(
      'id, product_id, tour_date, adults, child, infant, channel_id, choices, variant_key'
    )
    .eq('id', reservationId)
    .maybeSingle()

  if (resError || !reservation?.product_id || !reservation.tour_date) {
    return null
  }

  const { data: pricingRow } = await admin
    .from('reservation_pricing')
    .select('*')
    .eq('reservation_id', reservationId)
    .maybeSingle()

  if (!pricingRow) return null

  const pricing = pricingRow as RebookingPricingSnapshot & {
    pricing_adults?: number | null
    total_price?: number | null
    choices?: unknown
  }

  const adults = Math.max(0, Number(reservation.adults) || 0)
  const children = Math.max(0, Number(reservation.child) || 0)
  const infants = Math.max(0, Number(reservation.infant) || 0)
  const pricingAdults =
    pricing.pricing_adults != null && Number(pricing.pricing_adults) >= 0
      ? Number(pricing.pricing_adults)
      : adults

  const party: PartySizeSource = {
    adults: pricingAdults,
    children,
    infants,
  }

  const otaGrandTotal = resolveOtaCustomerExpectedPayment(pricing, party)
  if (otaGrandTotal <= 0.005) return null

  const pax = billingPax(party)
  const notIncludedPerPerson = pricingFieldToNumber(pricing.not_included_price)
  const notIncludedTotal = roundUsd2(notIncludedPerPerson * pax)
  const otaTourFare = roundUsd2(Math.max(0, otaGrandTotal - notIncludedTotal))

  let channelName = params.channelName?.trim() || ''
  if (!channelName && reservation.channel_id) {
    const { data: channel } = await admin
      .from('channels')
      .select('name')
      .eq('id', reservation.channel_id)
      .maybeSingle()
    channelName = String(channel?.name ?? '').trim()
  }

  const resolved = await resolveReservationChoices(admin, reservationId)
  const resolvedSelections: ChoiceSelection[] = resolved.map((row) => ({
    choice_id: row.choice_id,
    option_id: row.option_id,
    quantity: Math.max(1, Number(row.quantity) || 1),
  }))

  const selections = mergeChoiceSelections(
    parseChoicesJsonItems(pricing.choices),
    parseChoicesJsonItems(reservation.choices),
    resolvedSelections
  )

  const selectedOptions = selectionsToSelectedOptions(selections)
  const effectiveAdults = adults + children + infants > 0 ? Math.max(1, adults) : 1
  const tourDate = String(reservation.tour_date).slice(0, 10)
  const directChannelId = defaultBookingTenantContext().channelId

  const line: CustomerBookingLineInput = {
    productId: reservation.product_id,
    tourDate,
    adults: effectiveAdults,
    child: children,
    infant: infants,
    selectedOptions,
    ...(reservation.variant_key?.trim()
      ? { variantKey: reservation.variant_key.trim() }
      : {}),
  }

  const couponCode = (params.couponCode?.trim() || REBOOKING_OUTREACH_COUPON_CODE).toUpperCase()

  let directListTotal = 0
  let directAfterCoupon = 0
  let couponPercent = 0

  try {
    const tenant = defaultBookingTenantContext()
    const { additionalOptionIds } = await classifySelectedOptionsForRebooking(
      admin,
      reservation.product_id,
      selectedOptions
    )

    const [listQuote, couponQuote, explicitSubtotal, v2Quote] = await Promise.all([
      calculateServerBookingPrice(admin, line, null, { enforceMinAmount: false }),
      calculateServerBookingPrice(admin, line, couponCode, { enforceMinAmount: false }),
      computeExplicitDirectWebsiteSubtotal(admin, {
        productId: reservation.product_id,
        tourDate,
        channelId: directChannelId,
        variantKey: reservation.variant_key,
        adults: effectiveAdults,
        children,
        infants,
        selections,
      }),
      calculateBookingPriceV2({
        client: admin,
        operatorId: tenant.operatorId,
        productId: reservation.product_id,
        channelId: tenant.channelId,
        variantKey: reservation.variant_key,
        tourDate,
        adults: effectiveAdults,
        child: children,
        infant: infants,
        selectedOptions,
        additionalOptionIds,
      }).catch(() => null),
    ])

    directListTotal = Math.max(listQuote.subtotal, explicitSubtotal, v2Quote?.subtotal ?? 0)
    const couponDiscount =
      directListTotal > 0 && couponQuote.couponDiscount > 0 && listQuote.subtotal > 0
        ? roundUsd2((couponQuote.couponDiscount / listQuote.subtotal) * directListTotal)
        : couponQuote.couponDiscount
    directAfterCoupon = roundUsd2(Math.max(0, directListTotal - couponDiscount))

    if (directListTotal > 0 && couponDiscount > 0) {
      couponPercent = roundUsd2((couponDiscount / directListTotal) * 100)
    } else if (couponQuote.subtotal > 0 && couponQuote.couponDiscount > 0) {
      couponPercent = roundUsd2((couponQuote.couponDiscount / couponQuote.subtotal) * 100)
      directAfterCoupon = roundUsd2(couponQuote.totalPrice)
    }
  } catch {
    return null
  }

  if (directListTotal <= 0) return null

  if (couponPercent <= 0 && directListTotal > directAfterCoupon) {
    couponPercent = roundUsd2(((directListTotal - directAfterCoupon) / directListTotal) * 100)
  }

  const savings = roundUsd2(otaGrandTotal - directAfterCoupon)
  if (savings < 0.5) return null

  return {
    channelName: channelName || 'OTA',
    otaTourFare,
    otaNotIncludedTotal: notIncludedTotal,
    otaGrandTotal,
    directListTotal,
    couponPercent,
    directAfterCoupon,
    savings,
    billingPax: pax,
    notIncludedPerPerson,
  }
}
