/**
 * Feature-flagged booking price from Commerce Core v2.
 * Returns null when v2 cannot confidently price → caller must use legacy RPC.
 */
import type { CommerceDb } from '@/lib/commerce/dualWritePricing'
import { resolvePriceV2 } from '@/lib/commerce/resolvePriceV2'
import { resolveOfferFromSelection } from '@/lib/commerce/resolveOfferFromSelection'
import { KOVEgAS_OPERATOR_ID } from '@/lib/operatorConstants'

/** Keep in sync with customerBookingCheckout.HOMEPAGE_CHANNEL_ID (avoid circular import). */
const HOMEPAGE_CHANNEL_ID = 'M00001'

export type BookingPriceV2Input = {
  client: CommerceDb
  operatorId?: string
  productId: string
  channelId?: string
  variantKey?: string | null
  tourDate: string
  adults: number
  child: number
  infant: number
  selectedOptions: Record<string, string>
  additionalOptionIds: string[]
}

export type BookingPriceV2Result = {
  basePrice: number
  choicesPrice: number
  additionalOptionsPrice: number
  subtotal: number
  calculationMethod: string
  ratePlanId: string
  offerId: string | null
  offerCode: string | null
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

function paxTotal(adults: number, child: number, infant: number): number {
  return Math.max(0, adults) + Math.max(0, child) + Math.max(0, infant)
}

async function sumAdditionalOptions(
  db: CommerceDb,
  optionIds: string[],
  totalPeople: number
): Promise<number> {
  if (optionIds.length === 0 || totalPeople <= 0) return 0
  const { data } = await db
    .from('product_options')
    .select('id, adult_price_adjustment')
    .in('id', optionIds)

  let sum = 0
  for (const opt of data || []) {
    sum += (Number(opt.adult_price_adjustment) || 0) * totalPeople
  }
  return roundMoney(sum)
}

export async function calculateBookingPriceV2(
  input: BookingPriceV2Input
): Promise<BookingPriceV2Result | null> {
  const db = input.client
  const operatorId = input.operatorId || KOVEgAS_OPERATOR_ID
  const channelId = input.channelId || HOMEPAGE_CHANNEL_ID
  const variantKey = input.variantKey || 'default'
  const adults = Math.max(0, input.adults)
  const child = Math.max(0, input.child)
  const infant = Math.max(0, input.infant)
  const totalPeople = paxTotal(adults, child, infant)
  if (totalPeople <= 0) return null

  const { data: plan } = await db
    .from('rate_plans')
    .select('id, pricing_mode')
    .eq('operator_id', operatorId)
    .eq('product_id', input.productId)
    .eq('channel_id', channelId)
    .eq('variant_key', variantKey)
    .eq('is_active', true)
    .maybeSingle()

  if (!plan?.id) return null

  const offerResolved = await resolveOfferFromSelection(db, {
    productId: input.productId,
    ratePlanId: plan.id,
    selectedOptions: input.selectedOptions,
  })

  const priced = await resolvePriceV2({
    client: db,
    operatorId,
    productId: input.productId,
    channelId,
    variantKey,
    date: input.tourDate,
    offerCode: offerResolved.offerCode,
  })

  if (!priced.found) return null
  if (!priced.isSaleAvailable) return null

  // Prefer dedicated offer override when selection resolved to an offer
  const usingOffer = priced.source === 'offer_override' && !!offerResolved.offerId

  let basePrice = 0
  let choicesPrice = 0
  let calculationMethod = `commerce_v2_${priced.source}`

  if (usingOffer || (offerResolved.offerId && priced.source === 'offer_override')) {
    // Absolute combination / offer-fixed: unit prices are final sell units
    const line =
      priced.adult * adults + priced.child * child + priced.infant * infant
    // If child/infant units are 0 but adult set (single-price style), bill all pax at adult
    const singleStyle =
      priced.adult > 0 && priced.child === 0 && priced.infant === 0 && (child > 0 || infant > 0)
    choicesPrice = roundMoney(singleStyle ? priced.adult * totalPeople : line)
    basePrice = 0
    calculationMethod = 'commerce_v2_offer_fixed'
  } else if (plan.pricing_mode === 'rule_based' || plan.pricing_mode === 'hybrid') {
    // base rule / plan override + choice_adjustment rules
    const planUnits = await resolvePriceV2({
      client: db,
      operatorId,
      productId: input.productId,
      channelId,
      variantKey,
      date: input.tourDate,
    })
    if (!planUnits.found || !planUnits.isSaleAvailable) return null

    basePrice = roundMoney(
      planUnits.adult * adults + planUnits.child * child + planUnits.infant * infant
    )

    let adjAdult = 0
    let adjChild = 0
    let adjInfant = 0
    if (offerResolved.optionKeys.length > 0) {
      const { data: rules } = await db
        .from('price_rules')
        .select('scope_key, adult_amount, child_amount, infant_amount')
        .eq('rate_plan_id', plan.id)
        .eq('rule_type', 'choice_adjustment')
        .eq('is_active', true)
        .in('scope_key', offerResolved.optionKeys)

      for (const r of rules || []) {
        adjAdult += Number(r.adult_amount ?? 0)
        adjChild += Number(r.child_amount ?? 0)
        adjInfant += Number(r.infant_amount ?? 0)
      }
    }

    choicesPrice = roundMoney(adjAdult * adults + adjChild * child + adjInfant * infant)
    calculationMethod = 'commerce_v2_rule_based'
  } else {
    // offer_fixed without matched offer — use plan units as base only
    basePrice = roundMoney(
      priced.adult * adults + priced.child * child + priced.infant * infant
    )
    choicesPrice = 0
    calculationMethod = 'commerce_v2_plan_only'
  }

  const additionalOptionsPrice = await sumAdditionalOptions(
    db,
    input.additionalOptionIds,
    totalPeople
  )

  const subtotal = roundMoney(basePrice + choicesPrice + additionalOptionsPrice)
  if (subtotal <= 0) return null

  return {
    basePrice,
    choicesPrice,
    additionalOptionsPrice,
    subtotal,
    calculationMethod,
    ratePlanId: plan.id,
    offerId: offerResolved.offerId,
    offerCode: offerResolved.offerCode,
  }
}
