import { randomUUID } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import type { Database, Json } from '@/lib/database.types'
import { generateCustomerId, generateReservationId } from '@/lib/entityIds'
import { couponMatchesProduct } from '@/lib/productDetailPromoCodes'
import { buildBookingGuestEventNote } from '@/lib/bookingFlowGuestNotes'
import {
  deliverCustomerBookingConfirmationEmail,
  parseBookingLocale,
} from '@/lib/customerBookingEmail'
import { resolvePriceV2 } from '@/lib/commerce/resolvePriceV2'
import { isCommerceV2ReadEnabled } from '@/lib/commerce/commerceV2Flags'
import { calculateBookingPriceV2 } from '@/lib/commerce/calculateBookingPriceV2'
import {
  commitInventoryForReservation,
  holdInventoryForBooking,
  releaseInventoryForReservation,
} from '@/lib/commerce/inventoryEngine'
import { buildBookingMoneyBreakdown } from '@/lib/commerce/bookingMoneyBreakdown'
import { KOVEgAS_DIRECT_CHANNEL_ID } from '@/lib/operators/resolvePublicDirectChannel'
import { KOVEgAS_OPERATOR_ID } from '@/lib/operatorConstants'
import { resolveOperatorId } from '@/lib/operators/scopeQuery'
import { lookupReservationOperatorId } from '@/lib/operators/lookupReservationOperatorId'
import {
  calculateChoiceLineTotal,
  isPerUnitPricing,
  parseChoicePricingUnit,
} from '@/lib/choicePricingUnit'

/** @deprecated Prefer KOVEgAS_DIRECT_CHANNEL_ID — kept for existing imports */
export const HOMEPAGE_CHANNEL_ID = KOVEgAS_DIRECT_CHANNEL_ID
export const CUSTOMER_CHECKOUT_PURPOSE = 'customer_web_booking'

export type BookingTenantContext = {
  operatorId: string
  channelId: string
}

export function defaultBookingTenantContext(): BookingTenantContext {
  return {
    operatorId: KOVEgAS_OPERATOR_ID,
    channelId: KOVEgAS_DIRECT_CHANNEL_ID,
  }
}
export const STRIPE_PI_NOTE_PREFIX = 'stripe_payment_intent_id:'

export type CustomerBookingCustomerInput = {
  name: string
  email: string
  phone: string
  language?: string | null
  specialRequests?: string | null
  localContactChannel?: string | null
  localContactHandle?: string | null
  pickupHotelCustom?: string | null
  alternativeDates?: string[]
  smsConsent?: boolean | null
}

export type CustomerBookingLineInput = {
  productId: string
  tourDate: string
  tourTime?: string | null
  adults: number
  child: number
  infant: number
  selectedOptions: Record<string, string>
  pickupHotelId?: string | null
  variantKey?: string | null
}

export type CustomerBookingPriceResult = {
  basePrice: number
  choicesPrice: number
  additionalOptionsPrice: number
  subtotal: number
  couponCode: string | null
  couponDiscount: number
  totalPrice: number
  calculationMethod: string
  /** Commerce v2 metadata when priced via v2; null/undefined for legacy */
  commerceRatePlanId?: string | null
  commerceOfferId?: string | null
  commerceOfferCode?: string | null
}

type AdminClient = SupabaseClient<Database>

let stripeInstance: Stripe | null = null

export function getStripeClient(): Stripe {
  if (!stripeInstance) {
    const secretKey = process.env.STRIPE_SECRET_KEY
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY가 환경 변수에 설정되지 않았습니다.')
    }
    stripeInstance = new Stripe(secretKey, {
      timeout: 30000,
      maxNetworkRetries: 3,
    })
  }
  return stripeInstance
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

function usdToCents(amountUsd: number): number {
  return Math.round(amountUsd * 100)
}

export function parseCustomerBookingLine(raw: unknown): CustomerBookingLineInput | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const productId = typeof o.productId === 'string' ? o.productId.trim() : ''
  const tourDate = typeof o.tourDate === 'string' ? o.tourDate.trim() : ''
  const adults = Number(o.adults)
  const child = Number(o.child ?? o.children ?? 0)
  const infant = Number(o.infant ?? o.infants ?? 0)
  if (!productId || !tourDate || !Number.isFinite(adults) || adults < 1) return null
  if (!Number.isFinite(child) || child < 0 || !Number.isFinite(infant) || infant < 0) return null

  const selectedOptionsRaw = o.selectedOptions
  const selectedOptions: Record<string, string> = {}
  if (selectedOptionsRaw && typeof selectedOptionsRaw === 'object' && !Array.isArray(selectedOptionsRaw)) {
    for (const [k, v] of Object.entries(selectedOptionsRaw as Record<string, unknown>)) {
      if (typeof v === 'string' && v.trim()) selectedOptions[k] = v.trim()
    }
  }

  return {
    productId,
    tourDate,
    tourTime: typeof o.tourTime === 'string' ? o.tourTime : typeof o.departureTime === 'string' ? o.departureTime : null,
    adults: Math.floor(adults),
    child: Math.floor(child),
    infant: Math.floor(infant),
    selectedOptions,
    pickupHotelId:
      typeof o.pickupHotelId === 'string' && o.pickupHotelId.trim() ? o.pickupHotelId.trim() : null,
    variantKey: typeof o.variantKey === 'string' && o.variantKey.trim() ? o.variantKey.trim() : null,
  }
}

export function parseCustomerBookingCustomer(raw: unknown): CustomerBookingCustomerInput | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const name = typeof o.name === 'string' ? o.name.trim() : ''
  const email = typeof o.email === 'string' ? o.email.trim() : ''
  const phone = typeof o.phone === 'string' ? o.phone.trim() : ''
  if (!name || !email || !phone) return null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null

  const alternativeDates = Array.isArray(o.alternativeDates)
    ? o.alternativeDates.filter((d): d is string => typeof d === 'string' && Boolean(d.trim()))
    : []

  return {
    name,
    email,
    phone,
    language: typeof o.customerLanguage === 'string' ? o.customerLanguage : typeof o.language === 'string' ? o.language : null,
    specialRequests: typeof o.specialRequests === 'string' ? o.specialRequests : null,
    localContactChannel: typeof o.localContactChannel === 'string' ? o.localContactChannel : null,
    localContactHandle: typeof o.localContactHandle === 'string' ? o.localContactHandle : null,
    pickupHotelCustom: typeof o.pickupHotelCustom === 'string' ? o.pickupHotelCustom : null,
    alternativeDates,
    smsConsent: typeof o.smsConsent === 'boolean' ? o.smsConsent : null,
  }
}

async function assertProductBookable(
  admin: AdminClient,
  productId: string,
  operatorId: string
): Promise<void> {
  const { data, error } = await admin
    .from('products')
    .select('id, status, is_published, operator_id')
    .eq('id', productId)
    .eq('operator_id', resolveOperatorId(operatorId))
    .maybeSingle()

  if (error || !data) {
    throw new Error('상품을 찾을 수 없습니다.')
  }
  if (data.status && data.status !== 'active') {
    throw new Error('현재 예약할 수 없는 상품입니다.')
  }
  if (data.is_published === false) {
    throw new Error('현재 예약할 수 없는 상품입니다.')
  }
}

async function assertDateSaleAvailable(
  admin: AdminClient,
  productId: string,
  tourDate: string,
  channelId: string,
  variantKey?: string | null
): Promise<void> {
  // When v2 read is enabled, prefer price_overrides / stop_sells for the plan
  if (isCommerceV2ReadEnabled(productId)) {
    try {
      const v2 = await resolvePriceV2({
        client: admin,
        productId,
        channelId,
        variantKey: variantKey || 'default',
        date: tourDate,
      })
      if (v2.found && !v2.isSaleAvailable) {
        throw new Error('선택한 날짜는 판매 중이 아닙니다.')
      }
      // If v2 found and open, still allow; if not found, fall through to legacy check
      if (v2.found && v2.isSaleAvailable) {
        return
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('판매 중')) throw err
      console.warn('[customerBookingCheckout] v2 sale check failed', err)
    }
  }

  let query = admin
    .from('dynamic_pricing')
    .select('id, is_sale_available')
    .eq('product_id', productId)
    .eq('channel_id', channelId)
    .eq('date', tourDate)
    .limit(5)

  if (variantKey) {
    query = query.eq('variant_key', variantKey)
  }

  const { data, error } = await query
  if (error) {
    console.warn('[customerBookingCheckout] dynamic_pricing lookup failed', error)
    return
  }
  if (!data || data.length === 0) {
    return
  }
  const anyAvailable = data.some((row) => row.is_sale_available !== false)
  if (!anyAvailable) {
    throw new Error('선택한 날짜는 판매 중이 아닙니다.')
  }
}

async function classifySelectedOptions(
  admin: AdminClient,
  productId: string,
  selectedOptions: Record<string, string>
): Promise<{
  choiceRows: Array<{ choice_id: string; option_id: string }>
  additionalOptionIds: string[]
  choiceOptionIds: string[]
}> {
  const { data: productOptions } = await admin
    .from('product_options')
    .select('id')
    .eq('product_id', productId)

  const productOptionIds = new Set((productOptions || []).map((r) => r.id))
  const choiceRows: Array<{ choice_id: string; option_id: string }> = []
  const additionalOptionIds: string[] = []
  const choiceOptionIds: string[] = []

  for (const [choiceId, optionId] of Object.entries(selectedOptions)) {
    if (!optionId) continue
    if (productOptionIds.has(optionId)) {
      additionalOptionIds.push(optionId)
    } else {
      choiceOptionIds.push(optionId)
      choiceRows.push({ choice_id: choiceId, option_id: optionId })
    }
  }

  return { choiceRows, additionalOptionIds, choiceOptionIds }
}

/**
 * dynamic_pricing이 없을 때 고객 화면(BookingFlow)과 동일하게
 * products / choice_options / product_options 카탈로그 가격으로 계산합니다.
 */
async function calculateCatalogFallbackPrice(
  admin: AdminClient,
  line: CustomerBookingLineInput,
  choiceOptionIds: string[],
  additionalOptionIds: string[]
): Promise<{
  basePrice: number
  choicesPrice: number
  additionalOptionsPrice: number
  subtotal: number
  calculationMethod: string
}> {
  const { data: product, error: productError } = await admin
    .from('products')
    .select('base_price, adult_base_price')
    .eq('id', line.productId)
    .maybeSingle()

  if (productError || !product) {
    throw new Error('상품 가격 정보를 찾을 수 없습니다.')
  }

  const totalPeople = line.adults + line.child + line.infant
  // BookingFlow: 동적 가격 없을 때 base_price(또는 adult_base_price) × 전체 인원
  const catalogBaseUnit =
    Number(product.base_price) || Number(product.adult_base_price) || 0
  const basePrice = roundMoney(catalogBaseUnit * totalPeople)

  let choicesPrice = 0
  if (choiceOptionIds.length > 0) {
    const { data: choiceOptions } = await admin
      .from('choice_options')
      .select('id, choice_id, adult_price, child_price, infant_price')
      .in('id', choiceOptionIds)

    const choiceIds = [
      ...new Set(
        (choiceOptions || [])
          .map((o) => o.choice_id)
          .filter((id): id is string => typeof id === 'string' && id.length > 0)
      ),
    ]
    const pricingUnitByChoiceId = new Map<string, string>()
    if (choiceIds.length > 0) {
      const { data: choiceRows } = await admin
        .from('product_choices')
        .select('id, pricing_unit')
        .in('id', choiceIds)
      for (const row of choiceRows || []) {
        pricingUnitByChoiceId.set(row.id, parseChoicePricingUnit(row.pricing_unit))
      }
    }

    for (const option of choiceOptions || []) {
      const choiceId = option.choice_id
      const pricingUnit =
        (typeof choiceId === 'string'
          ? pricingUnitByChoiceId.get(choiceId)
          : undefined) || 'per_person'
      choicesPrice += calculateChoiceLineTotal({
        pricingUnit,
        adultPrice: Number(option.adult_price) || 0,
        childPrice: Number(option.child_price) || 0,
        infantPrice: Number(option.infant_price) || 0,
        adults: line.adults,
        children: line.child,
        infants: line.infant,
        quantity: 1,
      })
    }
    choicesPrice = roundMoney(choicesPrice)
  }

  let additionalOptionsPrice = 0
  if (additionalOptionIds.length > 0) {
    const { data: productOptions } = await admin
      .from('product_options')
      .select('id, adult_price_adjustment')
      .in('id', additionalOptionIds)

    for (const option of productOptions || []) {
      const unit = Number(option.adult_price_adjustment) || 0
      additionalOptionsPrice += unit * totalPeople
    }
    additionalOptionsPrice = roundMoney(additionalOptionsPrice)
  }

  const subtotal = roundMoney(basePrice + choicesPrice + additionalOptionsPrice)
  return {
    basePrice,
    choicesPrice,
    additionalOptionsPrice,
    subtotal,
    calculationMethod: 'catalog_fallback',
  }
}

/**
 * RPC/v2가 인원 곱셈으로 계산한 choices_price를
 * product_choices.pricing_unit=per_unit 이면 단위 고정가로 보정합니다.
 */
async function applyPerUnitChoicesAdjustment(
  admin: AdminClient,
  line: CustomerBookingLineInput,
  choiceOptionIds: string[],
  current: {
    basePrice: number
    choicesPrice: number
    additionalOptionsPrice: number
    subtotal: number
  }
): Promise<{
  basePrice: number
  choicesPrice: number
  additionalOptionsPrice: number
  subtotal: number
  adjusted: boolean
}> {
  if (choiceOptionIds.length === 0) {
    return { ...current, adjusted: false }
  }

  const { data: choiceOptions } = await admin
    .from('choice_options')
    .select('id, choice_id, adult_price, child_price, infant_price')
    .in('id', choiceOptionIds)

  if (!choiceOptions?.length) {
    return { ...current, adjusted: false }
  }

  const choiceIds = [
    ...new Set(
      choiceOptions
        .map((o) => o.choice_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    ),
  ]
  const { data: choiceRows } = await admin
    .from('product_choices')
    .select('id, pricing_unit')
    .in('id', choiceIds)

  const pricingUnitByChoiceId = new Map<string, string>()
  for (const row of choiceRows || []) {
    pricingUnitByChoiceId.set(row.id, parseChoicePricingUnit(row.pricing_unit))
  }

  const hasPerUnit = choiceOptions.some((o) =>
    typeof o.choice_id === 'string'
      ? isPerUnitPricing(pricingUnitByChoiceId.get(o.choice_id))
      : false
  )
  if (!hasPerUnit) {
    return { ...current, adjusted: false }
  }

  let choicesPrice = 0
  for (const option of choiceOptions) {
    const choiceId = option.choice_id
    choicesPrice += calculateChoiceLineTotal({
      pricingUnit:
        (typeof choiceId === 'string'
          ? pricingUnitByChoiceId.get(choiceId)
          : undefined) || 'per_person',
      adultPrice: Number(option.adult_price) || 0,
      childPrice: Number(option.child_price) || 0,
      infantPrice: Number(option.infant_price) || 0,
      adults: line.adults,
      children: line.child,
      infants: line.infant,
      quantity: 1,
    })
  }
  choicesPrice = roundMoney(choicesPrice)
  const subtotal = roundMoney(
    current.basePrice + choicesPrice + current.additionalOptionsPrice
  )

  return {
    basePrice: current.basePrice,
    choicesPrice,
    additionalOptionsPrice: current.additionalOptionsPrice,
    subtotal,
    adjusted: true,
  }
}

export async function calculateServerBookingPrice(
  admin: AdminClient,
  line: CustomerBookingLineInput,
  couponCode?: string | null,
  opts?: { enforceMinAmount?: boolean; tenant?: BookingTenantContext }
): Promise<CustomerBookingPriceResult> {
  const enforceMinAmount = opts?.enforceMinAmount !== false
  const tenant = opts?.tenant || defaultBookingTenantContext()
  await assertProductBookable(admin, line.productId, tenant.operatorId)
  await assertDateSaleAvailable(
    admin,
    line.productId,
    line.tourDate,
    tenant.channelId,
    line.variantKey
  )

  const { choiceOptionIds, additionalOptionIds } = await classifySelectedOptions(
    admin,
    line.productId,
    line.selectedOptions
  )

  let basePrice = 0
  let choicesPrice = 0
  let additionalOptionsPrice = 0
  let subtotal = 0
  let calculationMethod = 'unknown'
  let usedCommerceV2 = false
  let commerceRatePlanId: string | null = null
  let commerceOfferId: string | null = null
  let commerceOfferCode: string | null = null

  // Feature-flagged Commerce Core v2 read (falls back to legacy RPC on any miss)
  if (isCommerceV2ReadEnabled(line.productId)) {
    try {
      const v2 = await calculateBookingPriceV2({
        client: admin,
        productId: line.productId,
        channelId: tenant.channelId,
        operatorId: tenant.operatorId,
        variantKey: line.variantKey || 'default',
        tourDate: line.tourDate,
        adults: line.adults,
        child: line.child,
        infant: line.infant,
        selectedOptions: line.selectedOptions,
        additionalOptionIds,
      })
      if (v2 && v2.subtotal > 0) {
        basePrice = v2.basePrice
        choicesPrice = v2.choicesPrice
        additionalOptionsPrice = v2.additionalOptionsPrice
        subtotal = v2.subtotal
        calculationMethod = v2.calculationMethod
        commerceRatePlanId = v2.ratePlanId
        commerceOfferId = v2.offerId
        commerceOfferCode = v2.offerCode
        usedCommerceV2 = true
        console.info('[customerBookingCheckout] commerce_v2 price', {
          productId: line.productId,
          date: line.tourDate,
          method: calculationMethod,
          subtotal,
          offerCode: v2.offerCode,
        })
      } else {
        console.warn('[customerBookingCheckout] commerce_v2 miss → legacy RPC', {
          productId: line.productId,
          date: line.tourDate,
        })
      }
    } catch (v2Err) {
      console.warn('[customerBookingCheckout] commerce_v2 error → legacy RPC', v2Err)
    }
  }

  if (!usedCommerceV2) {
    const { data, error } = await admin.rpc('calculate_dynamic_price', {
      p_product_id: line.productId,
      p_channel_id: tenant.channelId,
      p_date: line.tourDate,
      p_adults: line.adults,
      p_children: line.child,
      p_infants: line.infant,
      p_selected_choices: choiceOptionIds as unknown as Json,
      p_selected_additional_options: additionalOptionIds as unknown as Json,
    })

    if (error) {
      console.error('[customerBookingCheckout] calculate_dynamic_price', error)
      throw new Error('서버 가격 계산에 실패했습니다.')
    }

    const row = data?.[0]
    basePrice = Number(row?.base_price) || 0
    choicesPrice = Number(row?.choices_price) || 0
    additionalOptionsPrice = Number(row?.additional_options_price) || 0
    subtotal = roundMoney(
      Number(row?.total_price) || basePrice + choicesPrice + additionalOptionsPrice
    )
    calculationMethod = row?.calculation_method || 'unknown'

    // 동적 가격 미설정(not_found / $0)이면 상품 카탈로그 가격으로 폴백
    if (subtotal <= 0 || calculationMethod === 'not_found') {
      const fallback = await calculateCatalogFallbackPrice(
        admin,
        line,
        choiceOptionIds,
        additionalOptionIds
      )
      basePrice = fallback.basePrice
      choicesPrice = fallback.choicesPrice
      additionalOptionsPrice = fallback.additionalOptionsPrice
      subtotal = fallback.subtotal
      calculationMethod = fallback.calculationMethod
    }
  }

  const adjusted = await applyPerUnitChoicesAdjustment(admin, line, choiceOptionIds, {
    basePrice,
    choicesPrice,
    additionalOptionsPrice,
    subtotal,
  })
  if (adjusted.adjusted) {
    basePrice = adjusted.basePrice
    choicesPrice = adjusted.choicesPrice
    additionalOptionsPrice = adjusted.additionalOptionsPrice
    subtotal = adjusted.subtotal
    calculationMethod = `${calculationMethod}+per_unit`
  }

  if (subtotal <= 0) {
    throw new Error('계산된 결제 금액이 올바르지 않습니다. 날짜/옵션을 다시 확인해 주세요.')
  }

  // Phase 2 shadow: log-only compare vs Commerce Core v2 (never affects checkout)
  if (process.env.COMMERCE_V2_SHADOW === '1') {
    const shadowLine = line
    const shadowBase = basePrice
    const shadowSubtotal = subtotal
    const shadowMethod = calculationMethod
    void (async () => {
      try {
        const v2 = await resolvePriceV2({
          client: admin,
          productId: shadowLine.productId,
          channelId: tenant.channelId,
          variantKey: shadowLine.variantKey || 'default',
          date: shadowLine.tourDate,
        })
        console.info('[commerce-v2-shadow]', {
          productId: shadowLine.productId,
          date: shadowLine.tourDate,
          variantKey: shadowLine.variantKey || 'default',
          legacy: {
            basePrice: shadowBase,
            subtotal: shadowSubtotal,
            method: shadowMethod,
          },
          v2: {
            found: v2.found,
            source: v2.source,
            adult: v2.adult,
            child: v2.child,
            infant: v2.infant,
            isSaleAvailable: v2.isSaleAvailable,
          },
        })
      } catch (shadowErr) {
        console.warn('[commerce-v2-shadow] failed', shadowErr)
      }
    })()
  }

  let couponDiscount = 0
  let appliedCouponCode: string | null = null

  if (couponCode && couponCode.trim()) {
    const discount = await resolveCouponDiscount(admin, couponCode.trim(), subtotal, [line.productId])
    couponDiscount = discount.discountAmount
    appliedCouponCode = discount.couponCode
  }

  const totalPrice = roundMoney(Math.max(0, subtotal - couponDiscount))
  if (enforceMinAmount && totalPrice < 0.5) {
    throw new Error('최소 결제 금액은 $0.50입니다.')
  }

  return {
    basePrice: roundMoney(basePrice),
    choicesPrice: roundMoney(choicesPrice),
    additionalOptionsPrice: roundMoney(additionalOptionsPrice),
    subtotal,
    couponCode: appliedCouponCode,
    couponDiscount,
    totalPrice,
    calculationMethod,
    commerceRatePlanId,
    commerceOfferId,
    commerceOfferCode,
  }
}

/** 장바구니 합계 할인액을 라인 소계 비율로 배분 (센트 단위 largest remainder) */
export function allocateCartCouponDiscount(lineSubtotals: number[], discountUsd: number): number[] {
  if (lineSubtotals.length === 0) return []
  const discountCents = Math.round(Math.max(0, discountUsd) * 100)
  const subtotalCents = lineSubtotals.map((n) => Math.round(Math.max(0, n) * 100))
  const cartCents = subtotalCents.reduce((a, b) => a + b, 0)
  if (cartCents <= 0 || discountCents <= 0) return lineSubtotals.map(() => 0)

  const capped = Math.min(discountCents, cartCents)
  const raw = subtotalCents.map((c) => (c * capped) / cartCents)
  const floors = raw.map((x) => Math.floor(x))
  let remainder = capped - floors.reduce((a, b) => a + b, 0)
  const order = raw
    .map((x, i) => ({ i, frac: x - floors[i] }))
    .sort((a, b) => b.frac - a.frac)
  for (const item of order) {
    if (remainder <= 0) break
    floors[item.i] += 1
    remainder -= 1
  }
  return floors.map((c) => roundMoney(c / 100))
}

export async function resolveCouponDiscount(
  admin: AdminClient,
  couponCode: string,
  totalAmount: number,
  productIds: string[]
): Promise<{ discountAmount: number; couponCode: string }> {
  const { data: coupons, error } = await admin.from('coupons').select('*').eq('status', 'active')
  if (error || !coupons) {
    throw new Error('쿠폰 조회에 실패했습니다.')
  }

  const coupon = coupons.find(
    (c) => c.coupon_code && c.coupon_code.trim().toLowerCase() === couponCode.toLowerCase()
  )
  if (!coupon) {
    throw new Error('유효하지 않은 쿠폰 코드입니다.')
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (coupon.start_date) {
    const startDate = new Date(coupon.start_date)
    startDate.setHours(0, 0, 0, 0)
    if (today < startDate) throw new Error('쿠폰 사용 기간이 아직 시작되지 않았습니다.')
  }
  if (coupon.end_date) {
    const endDate = new Date(coupon.end_date)
    endDate.setHours(23, 59, 59, 999)
    if (today > endDate) throw new Error('쿠폰 사용 기간이 만료되었습니다.')
  }

  if (coupon.product_id && productIds.length > 0) {
    if (!productIds.some((id) => couponMatchesProduct(coupon.product_id, id))) {
      throw new Error('이 쿠폰은 해당 상품에 사용할 수 없습니다.')
    }
  }

  let discountAmount = 0
  if (coupon.discount_type === 'fixed' && coupon.fixed_value) {
    discountAmount = Number(coupon.fixed_value) || 0
  } else if (coupon.discount_type === 'percentage' && coupon.percentage_value) {
    discountAmount = (totalAmount * Number(coupon.percentage_value)) / 100
  } else if (coupon.fixed_value && coupon.percentage_value) {
    const fixedDiscount = Number(coupon.fixed_value) || 0
    const percentageDiscount = ((totalAmount - fixedDiscount) * Number(coupon.percentage_value)) / 100
    discountAmount = fixedDiscount + percentageDiscount
  } else if (coupon.fixed_value) {
    discountAmount = Number(coupon.fixed_value) || 0
  } else if (coupon.percentage_value) {
    discountAmount = (totalAmount * Number(coupon.percentage_value)) / 100
  }

  return {
    discountAmount: roundMoney(Math.min(discountAmount, totalAmount)),
    couponCode: coupon.coupon_code || couponCode,
  }
}

async function createOrReuseCustomer(
  admin: AdminClient,
  customer: CustomerBookingCustomerInput,
  tenant: BookingTenantContext
): Promise<string> {
  const email = customer.email.trim().toLowerCase()
  const { data: existing } = await admin
    .from('customers')
    .select('id')
    .ilike('email', email)
    .eq('operator_id', tenant.operatorId)
    .eq('archive', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing?.id) {
    await admin
      .from('customers')
      .update({
        name: customer.name,
        phone: customer.phone,
        language: customer.language || null,
        special_requests: customer.specialRequests || null,
        channel_id: tenant.channelId,
        operator_id: tenant.operatorId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
    return existing.id
  }

  const customerId = generateCustomerId()
  const { error } = await admin.from('customers').insert({
    id: customerId,
    name: customer.name,
    email,
    phone: customer.phone,
    language: customer.language || null,
    special_requests: customer.specialRequests || null,
    channel_id: tenant.channelId,
    operator_id: tenant.operatorId,
    status: 'active',
  })
  if (error) {
    console.error('[customerBookingCheckout] customers insert', error)
    throw new Error('고객 정보 저장에 실패했습니다.')
  }
  return customerId
}

async function insertReservationChoicesAndOptions(
  admin: AdminClient,
  reservationId: string,
  line: CustomerBookingLineInput,
  totalPeople: number
): Promise<{ choicesTotal: number; optionTotal: number }> {
  const { choiceRows, additionalOptionIds } = await classifySelectedOptions(
    admin,
    line.productId,
    line.selectedOptions
  )

  let choicesTotal = 0
  let optionTotal = 0

  if (choiceRows.length > 0) {
    const rows = choiceRows.map((row) => ({
      reservation_id: reservationId,
      choice_id: row.choice_id,
      option_id: row.option_id,
      quantity: totalPeople,
      total_price: 0,
    }))
    const { error } = await admin.from('reservation_choices').insert(rows)
    if (error) {
      console.error('[customerBookingCheckout] reservation_choices', error)
      throw new Error('선택 옵션 저장에 실패했습니다.')
    }
  }

  if (additionalOptionIds.length > 0) {
    const { data: optionsMeta } = await admin
      .from('product_options')
      .select('id, adult_price_adjustment')
      .in('id', additionalOptionIds)

    const priceById = new Map<string, number>()
    for (const opt of optionsMeta || []) {
      const price = Number(opt.adult_price_adjustment ?? 0) || 0
      priceById.set(opt.id, price)
    }

    const rows = additionalOptionIds.map((optionId) => {
      const unit = priceById.get(optionId) || 0
      const lineTotal = roundMoney(unit * totalPeople)
      optionTotal += lineTotal
      return {
        reservation_id: reservationId,
        option_id: optionId,
        ea: totalPeople,
        price: unit,
        total_price: lineTotal,
        status: 'active',
      }
    })

    const { error } = await admin.from('reservation_options').insert(rows)
    if (error) {
      console.error('[customerBookingCheckout] reservation_options', error)
      throw new Error('추가 옵션 저장에 실패했습니다.')
    }
  }

  return { choicesTotal, optionTotal }
}

async function upsertReservationPricing(
  admin: AdminClient,
  reservationId: string,
  price: CustomerBookingPriceResult,
  adults: number
): Promise<void> {
  const { data: existing } = await admin
    .from('reservation_pricing')
    .select('id')
    .eq('reservation_id', reservationId)
    .maybeSingle()

  const payload = {
    reservation_id: reservationId,
    product_price_total: price.basePrice,
    choices_total: price.choicesPrice,
    option_total: price.additionalOptionsPrice,
    subtotal: price.subtotal,
    coupon_code: price.couponCode,
    coupon_discount: price.couponDiscount,
    total_price: price.totalPrice,
    deposit_amount: price.totalPrice,
    balance_amount: 0,
    pricing_adults: adults,
    updated_at: new Date().toISOString(),
  }

  if (existing?.id) {
    const { error } = await admin.from('reservation_pricing').update(payload).eq('id', existing.id)
    if (error) throw new Error(`가격 정보 업데이트 실패: ${error.message}`)
    return
  }

  const { error } = await admin.from('reservation_pricing').insert({
    id: randomUUID(),
    ...payload,
  })
  if (error) throw new Error(`가격 정보 저장 실패: ${error.message}`)
}

export type CreatePendingBookingResult = {
  reservationId: string
  customerId: string
  amountUsd: number
  amountCents: number
  price: CustomerBookingPriceResult
}

export async function createPendingCustomerBooking(
  admin: AdminClient,
  args: {
    customer: CustomerBookingCustomerInput
    line: CustomerBookingLineInput
    couponCode?: string | null
    status?: 'pending' | 'inquiry'
    /** 장바구니 합계 쿠폰 배분 등 사전 계산된 가격 */
    priceOverride?: CustomerBookingPriceResult
    /** Public host tenant; defaults to Kovegas + M00001 */
    tenant?: BookingTenantContext
  }
): Promise<CreatePendingBookingResult> {
  const tenant = args.tenant || defaultBookingTenantContext()
  const price =
    args.priceOverride ||
    (await calculateServerBookingPrice(admin, args.line, args.couponCode, { tenant }))
  const customerId = await createOrReuseCustomer(admin, args.customer, tenant)
  const reservationId = generateReservationId()
  const totalPeople = args.line.adults + args.line.child + args.line.infant
  const now = new Date().toISOString()

  const eventNote = buildBookingGuestEventNote({
    ...(args.customer.localContactChannel
      ? { localContactChannel: args.customer.localContactChannel }
      : {}),
    ...(args.customer.localContactHandle
      ? { localContactHandle: args.customer.localContactHandle }
      : {}),
    ...(args.customer.pickupHotelCustom
      ? { pickupHotelCustom: args.customer.pickupHotelCustom }
      : {}),
    ...(args.customer.alternativeDates && args.customer.alternativeDates.length > 0
      ? { alternativeDates: args.customer.alternativeDates }
      : {}),
    ...(typeof args.customer.smsConsent === 'boolean'
      ? { smsConsent: args.customer.smsConsent }
      : {}),
  })

  const specialNote = args.customer.specialRequests?.trim()
  const combinedEventNote = [eventNote, specialNote ? `Special requests: ${specialNote}` : null]
    .filter(Boolean)
    .join('\n') || null

  const moneyBreakdown = buildBookingMoneyBreakdown({
    calculationMethod: price.calculationMethod,
    channelId: tenant.channelId,
    variantKey: args.line.variantKey || 'default',
    tourDate: args.line.tourDate,
    productId: args.line.productId,
    adults: args.line.adults,
    child: args.line.child,
    infant: args.line.infant,
    basePrice: price.basePrice,
    choicesPrice: price.choicesPrice,
    additionalOptionsPrice: price.additionalOptionsPrice,
    subtotal: price.subtotal,
    couponCode: price.couponCode,
    couponDiscount: price.couponDiscount,
    totalPrice: price.totalPrice,
    ratePlanId: price.commerceRatePlanId ?? null,
    offerId: price.commerceOfferId ?? null,
    offerCode: price.commerceOfferCode ?? null,
  })

  const reservationInsert: Database['public']['Tables']['reservations']['Insert'] = {
    id: reservationId,
    product_id: args.line.productId,
    channel_id: tenant.channelId,
    operator_id: tenant.operatorId,
    customer_id: customerId,
    tour_date: args.line.tourDate,
    tour_time: args.line.tourTime || null,
    adults: args.line.adults,
    child: args.line.child,
    infant: args.line.infant,
    total_people: totalPeople,
    pickup_hotel: args.line.pickupHotelId || null,
    customer_communication_channel: args.customer.localContactChannel || null,
    event_note: combinedEventNote,
    selected_options: args.line.selectedOptions as unknown as Json,
    selected_choices: args.line.selectedOptions as unknown as Json,
    status: args.status || 'pending',
    commerce_offer_id: price.commerceOfferId ?? null,
    commerce_rate_plan_id: price.commerceRatePlanId ?? null,
    commerce_pricing_source: price.calculationMethod,
    money_breakdown_json: moneyBreakdown as unknown as Json,
    created_at: now,
    updated_at: now,
  }
  if (args.line.variantKey) {
    reservationInsert.variant_key = args.line.variantKey
  }

  const { error: reservationError } = await admin.from('reservations').insert(reservationInsert)

  if (reservationError) {
    console.error('[customerBookingCheckout] reservations insert', reservationError)
    throw new Error(`예약 생성 실패: ${reservationError.message}`)
  }

  try {
    await insertReservationChoicesAndOptions(admin, reservationId, args.line, totalPeople)
    await upsertReservationPricing(admin, reservationId, price, args.line.adults)

    const choiceOptionIds = Object.values(args.line.selectedOptions || {}).filter(Boolean)
    const hold = await holdInventoryForBooking(admin, {
      productId: args.line.productId,
      tourDate: args.line.tourDate,
      tourTime: args.line.tourTime || null,
      guestQty: totalPeople,
      reservationId,
      choiceOptionIds,
    })
    if (!hold.ok) {
      throw new Error(hold.reason || '재고 확보에 실패했습니다.')
    }

    if (hold.holdIds.length > 0) {
      const { error: holdSnapErr } = await admin
        .from('reservations')
        .update({
          inventory_hold_ids: hold.holdIds,
          updated_at: new Date().toISOString(),
        })
        .eq('id', reservationId)
      if (holdSnapErr) {
        console.warn(
          '[customerBookingCheckout] inventory_hold_ids snapshot failed',
          holdSnapErr.message
        )
      }
    }
  } catch (err) {
    await releaseInventoryForReservation(admin, reservationId).catch(() => 0)
    await admin.from('reservations').delete().eq('id', reservationId)
    throw err
  }

  return {
    reservationId,
    customerId,
    amountUsd: price.totalPrice,
    amountCents: usdToCents(price.totalPrice),
    price,
  }
}

export async function createStripePaymentIntentForReservation(args: {
  reservationId: string
  amountCents: number
  customerName: string
  customerEmail: string
  extraMetadata?: Record<string, string>
  /** Phase 5f: when set, create destination charge to Connect account */
  connect?: {
    destinationAccountId: string
    applicationFeeCents?: number
  } | null
}): Promise<Stripe.PaymentIntent> {
  const stripe = getStripeClient()
  const connect = args.connect
  const useDestination =
    !!connect?.destinationAccountId && connect.destinationAccountId.trim().length > 0
  const applicationFeeCents =
    useDestination && connect?.applicationFeeCents != null && connect.applicationFeeCents > 0
      ? Math.min(connect.applicationFeeCents, Math.max(0, args.amountCents - 1))
      : 0

  const params: Stripe.PaymentIntentCreateParams = {
    amount: args.amountCents,
    currency: 'usd',
    metadata: {
      purpose: CUSTOMER_CHECKOUT_PURPOSE,
      reservation_id: args.reservationId,
      reservationId: args.reservationId,
      customerName: args.customerName,
      customerEmail: args.customerEmail,
      connect_mode: useDestination ? 'destination' : 'platform',
      ...(useDestination
        ? {
            connect_account_id: connect!.destinationAccountId,
            ...(applicationFeeCents > 0
              ? { application_fee_cents: String(applicationFeeCents) }
              : {}),
          }
        : {}),
      ...(args.extraMetadata || {}),
    },
    automatic_payment_methods: { enabled: true },
    receipt_email: args.customerEmail,
    description: `Tour booking ${args.reservationId}`,
  }

  if (useDestination) {
    params.transfer_data = {
      destination: connect!.destinationAccountId,
    }
    if (applicationFeeCents > 0) {
      params.application_fee_amount = applicationFeeCents
    }
    console.info('[customerBookingCheckout] Connect destination PI', {
      reservationId: args.reservationId,
      destination: connect!.destinationAccountId,
      applicationFeeCents,
    })
  }

  return stripe.paymentIntents.create(params)
}

export async function recordPendingStripePayment(
  admin: AdminClient,
  args: {
    reservationId: string
    amountUsd: number
    paymentIntentId: string
  }
): Promise<void> {
  const { data: existing } = await admin
    .from('payment_records')
    .select('id')
    .eq('reservation_id', args.reservationId)
    .ilike('note', `${STRIPE_PI_NOTE_PREFIX}${args.paymentIntentId}`)
    .maybeSingle()

  if (existing?.id) return

  const operatorId = await lookupReservationOperatorId(admin, args.reservationId)

  const { error } = await admin.from('payment_records').insert({
    operator_id: operatorId,
    reservation_id: args.reservationId,
    amount: args.amountUsd,
    payment_method: 'card',
    payment_status: 'pending',
    note: `${STRIPE_PI_NOTE_PREFIX}${args.paymentIntentId}`,
    submit_by: 'customer_web_checkout',
    submit_on: new Date().toISOString(),
  })
  if (error) {
    console.error('[customerBookingCheckout] pending payment_records', error)
    throw new Error('결제 대기 기록 저장에 실패했습니다.')
  }
}

function reservationIdsFromPaymentIntent(pi: Stripe.PaymentIntent): string[] {
  const csv = pi.metadata?.reservation_ids || ''
  const fromCsv = csv
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (fromCsv.length > 0) return fromCsv
  const single = pi.metadata?.reservation_id || pi.metadata?.reservationId || ''
  return single ? [single] : []
}

async function finalizeSingleReservationPayment(
  admin: AdminClient,
  args: {
    reservationId: string
    paymentIntentId: string
    amountUsdForRecord: number
    sendEmail: boolean
    locale?: 'ko' | 'en'
    origin?: string
  }
): Promise<boolean> {
  const { data: reservation, error: reservationError } = await admin
    .from('reservations')
    .select('id, status, customer_id')
    .eq('id', args.reservationId)
    .maybeSingle()

  if (reservationError || !reservation) {
    throw new Error(`예약을 찾을 수 없습니다: ${args.reservationId}`)
  }

  const { data: confirmedPayment } = await admin
    .from('payment_records')
    .select('id')
    .eq('reservation_id', args.reservationId)
    .eq('payment_status', 'confirmed')
    .ilike('note', `%${args.paymentIntentId}%`)
    .maybeSingle()

  // 결제는 확인되었어도 예약 status는 관리자 수동 확정(pending → confirmed)까지 대기중 유지
  if (confirmedPayment?.id) {
    if (args.sendEmail && reservation.customer_id) {
      const { data: customer } = await admin
        .from('customers')
        .select('email')
        .eq('id', reservation.customer_id)
        .maybeSingle()
      const email = customer?.email?.trim() || null
      if (email) {
        await deliverCustomerBookingConfirmationEmail(admin, {
          reservationId: args.reservationId,
          email,
          locale: args.locale || 'en',
          ...(args.origin ? { origin: args.origin } : {}),
          skipIfAlreadySent: true,
        })
      }
    }
    return true
  }

  const { data: pendingRow } = await admin
    .from('payment_records')
    .select('id')
    .eq('reservation_id', args.reservationId)
    .ilike('note', `%${args.paymentIntentId}%`)
    .maybeSingle()

  if (pendingRow?.id) {
    const { error: payUpdateError } = await admin
      .from('payment_records')
      .update({
        payment_status: 'confirmed',
        amount: args.amountUsdForRecord,
        confirmed_on: new Date().toISOString(),
        confirmed_by: 'stripe_webhook_or_confirm',
        note: `${STRIPE_PI_NOTE_PREFIX}${args.paymentIntentId}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', pendingRow.id)
    if (payUpdateError) throw new Error(`결제 기록 확정 실패: ${payUpdateError.message}`)
  } else {
    const operatorId = await lookupReservationOperatorId(admin, args.reservationId)
    const { error: payInsertError } = await admin.from('payment_records').insert({
      operator_id: operatorId,
      reservation_id: args.reservationId,
      amount: args.amountUsdForRecord,
      payment_method: 'card',
      payment_status: 'confirmed',
      note: `${STRIPE_PI_NOTE_PREFIX}${args.paymentIntentId}`,
      submit_by: 'customer_web_checkout',
      submit_on: new Date().toISOString(),
      confirmed_by: 'stripe_webhook_or_confirm',
      confirmed_on: new Date().toISOString(),
    })
    if (payInsertError) throw new Error(`결제 기록 저장 실패: ${payInsertError.message}`)
  }

  // 예약 status는 pending/inquiry 유지 — 관리자가 시스템에서 수동으로 confirmed 처리

  try {
    await commitInventoryForReservation(admin, args.reservationId)
  } catch (invErr) {
    console.error(
      '[customerBookingCheckout] inventory commit failed (payment already confirmed)',
      args.reservationId,
      invErr
    )
  }

  if (args.sendEmail && reservation.customer_id) {
    const { data: customer } = await admin
      .from('customers')
      .select('email')
      .eq('id', reservation.customer_id)
      .maybeSingle()
    const email = customer?.email?.trim() || null
    if (email) {
      await deliverCustomerBookingConfirmationEmail(admin, {
        reservationId: args.reservationId,
        email,
        locale: args.locale || 'en',
        ...(args.origin ? { origin: args.origin } : {}),
        skipIfAlreadySent: true,
      })
    }
  }

  return false
}

export async function finalizeCustomerBookingPayment(
  admin: AdminClient,
  args: {
    reservationId: string
    paymentIntentId: string
    locale?: 'ko' | 'en'
    origin?: string
  }
): Promise<{ alreadyFinalized: boolean; reservationId: string; reservationIds: string[] }> {
  const stripe = getStripeClient()
  const pi = await stripe.paymentIntents.retrieve(args.paymentIntentId)

  const reservationIds = reservationIdsFromPaymentIntent(pi)
  if (!reservationIds.includes(args.reservationId)) {
    throw new Error('결제 정보와 예약이 일치하지 않습니다.')
  }
  if (pi.metadata?.purpose && pi.metadata.purpose !== CUSTOMER_CHECKOUT_PURPOSE) {
    throw new Error('이 결제 의도는 고객 웹 예약용이 아닙니다.')
  }
  if (pi.status !== 'succeeded') {
    throw new Error(`결제가 완료되지 않았습니다. (status: ${pi.status})`)
  }

  const locale = args.locale || parseBookingLocale(pi.metadata?.locale)
  const amountUsd = roundMoney((pi.amount_received || pi.amount) / 100)
  let allAlready = true

  for (let i = 0; i < reservationIds.length; i++) {
    const reservationId = reservationIds[i]
    const { data: pricing } = await admin
      .from('reservation_pricing')
      .select('total_price')
      .eq('reservation_id', reservationId)
      .maybeSingle()
    const lineAmount =
      reservationIds.length === 1
        ? amountUsd
        : roundMoney(Number(pricing?.total_price) || 0) || amountUsd

    const already = await finalizeSingleReservationPayment(admin, {
      reservationId,
      paymentIntentId: args.paymentIntentId,
      amountUsdForRecord: lineAmount,
      sendEmail: true,
      locale,
      ...(args.origin ? { origin: args.origin } : {}),
    })
    if (!already) allAlready = false
  }

  return {
    alreadyFinalized: allAlready,
    reservationId: args.reservationId,
    reservationIds,
  }
}

export async function finalizeCustomerBookingPaymentByIntent(
  admin: AdminClient,
  paymentIntentId: string,
  origin?: string
): Promise<{ reservationId: string | null; alreadyFinalized: boolean }> {
  const stripe = getStripeClient()
  const pi = await stripe.paymentIntents.retrieve(paymentIntentId)
  const reservationIds = reservationIdsFromPaymentIntent(pi)
  const reservationId = reservationIds[0] || null
  if (!reservationId) {
    return { reservationId: null, alreadyFinalized: false }
  }
  if (pi.metadata?.purpose && pi.metadata.purpose !== CUSTOMER_CHECKOUT_PURPOSE) {
    return { reservationId: null, alreadyFinalized: false }
  }
  const locale = parseBookingLocale(pi.metadata?.locale)
  const result = await finalizeCustomerBookingPayment(admin, {
    reservationId,
    paymentIntentId,
    locale,
    ...(origin ? { origin } : {}),
  })
  return { reservationId: result.reservationId, alreadyFinalized: result.alreadyFinalized }
}
