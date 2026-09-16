/**
 * 이메일 예약 가져오기: 파싱·가격이 완전하면 확인 화면 없이 예약 생성.
 */
import {
  AUTO_CONFIRM_ADDED_BY,
  defaultChannelIdForPlatform,
  evaluateImportAutoConfirmReadiness,
} from '@/lib/emailReservationParseCatalog'
import { confirmReservationImport } from '@/lib/confirmReservationImport'
import {
  importChoiceOptionNamesFromExtracted,
  importCustomerTotalPayment,
  importDepositAmountForPaymentRecord,
  matchChoiceOptionFromImportNames,
  parseImportMoneyString,
  pickImportDynamicPricingOta,
  type ImportPricingRow,
} from '@/lib/importReservationPriceResolve'
import { canyonKeyFromLabels } from '@/lib/canyonChoice'
import {
  findCouponToMatchEmailAmount,
  findViatorNinePercentCoupon,
  importCouponDiscountSubtotal,
  type ImportCouponRow,
} from '@/lib/importReservationCouponResolve'
import { computeChannelCommissionAmountUsd } from '@/utils/balanceChannelRevenue'
import {
  channelIsOtaForPricingSection,
  computeChannelSettlementAmount,
} from '@/utils/channelSettlement'
import type { CouponChannelRow } from '@/utils/homepageBookingChannel'
import {
  mapSemanticVariantToChannelProductKey,
  resolveImportChannelVariantKey,
} from '@/lib/resolveImportChannelVariant'
import { isMyrealtripChannelName, isNolTripleChannelName } from '@/lib/platformChannelMapping'
import {
  extractPriceFromEmailBodyForImport,
  extractViatorNetRateFromEmailBodyForImport,
  matchPickupHotelId,
} from '@/utils/reservationUtils'
import { expandChannelRnMatchVariants } from '@/utils/channelRnMatch'
import {
  isCancellationRequestEmailSubject,
  isZoomZoomTourNewBookingEmailSubject,
} from '@/lib/emailReservationParser'
import { isZellePaymentSentEmail } from '@/lib/zellePaymentEmail'
import { isWellsFargoAtmReceiptEmail } from '@/lib/wellsFargoAtmReceipt'
import { isPickupImportNotDecidedLabel } from '@/lib/reservationImportPickup'
import { resolveImportCustomerLanguage } from '@/lib/importCustomerLanguage'
import type { ExtractedReservationData } from '@/types/reservationImport'
import type { SupabaseClient } from '@supabase/supabase-js'

const PRICE_MATCH_TOLERANCE = 0.2

function asExtracted(json: unknown): ExtractedReservationData {
  if (!json || typeof json !== 'object') return {}
  return json as ExtractedReservationData
}

async function resolveChannelId(
  client: SupabaseClient,
  platformKey: string | null,
  subject: string | null
): Promise<string | null> {
  const { data: channels } = await client.from('channels').select('id, name')
  const list = (channels || []) as Array<{ id: string; name: string | null }>
  if (!list.length) return defaultChannelIdForPlatform(platformKey)

  if (platformKey === 'zoomzoom' || isZoomZoomTourNewBookingEmailSubject(subject)) {
    const named = list.find((c) => /줌줌/.test((c.name || '').trim()))
    if (named) return named.id
  }
  if (platformKey === 'nol') {
    const named = list.find((c) => isNolTripleChannelName(c.name))
    if (named) return named.id
  }
  if (platformKey === 'myrealtrip') {
    const named = list.find((c) => isMyrealtripChannelName(c.name))
    if (named) return named.id
  }

  const mapped = defaultChannelIdForPlatform(platformKey)
  if (mapped) {
    const exact = list.find((c) => c.id === mapped)
    if (exact) return exact.id
    const named = list.find((c) => (c.name || '').toLowerCase().includes(mapped.toLowerCase()))
    if (named) return named.id
    return mapped
  }
  if (platformKey) {
    const named = list.find((c) => (c.name || '').toLowerCase().includes(platformKey.toLowerCase()))
    if (named) return named.id
  }
  return null
}

async function resolveProductId(
  client: SupabaseClient,
  ext: ExtractedReservationData
): Promise<string | null> {
  const direct = String(ext.product_id || '').trim()
  if (direct) {
    const { data } = await client.from('products').select('id').eq('id', direct).maybeSingle()
    if (data?.id) return data.id
  }
  const name = String(ext.product_name || '').trim()
  if (!name) return null
  const { data: products } = await client.from('products').select('id, name, name_ko')
  const nameLower = name.toLowerCase()
  const matched = (products || []).find(
    (p: { name?: string | null; name_ko?: string | null }) =>
      (p.name && p.name.toLowerCase().includes(nameLower)) ||
      (p.name_ko && p.name_ko.toLowerCase().includes(nameLower)) ||
      (p.name && nameLower.includes(p.name.toLowerCase())) ||
      (p.name_ko && nameLower.includes(p.name_ko.toLowerCase()))
  )
  return matched?.id ?? null
}

async function channelRnAlreadyUsed(client: SupabaseClient, channelRn: string | null | undefined): Promise<boolean> {
  const variants = expandChannelRnMatchVariants(channelRn || '')
  if (variants.length === 0) return false
  const { data } = await client
    .from('reservations')
    .select('channel_rn')
    .in('channel_rn', variants)
    .not('channel_rn', 'is', null)
    .limit(1)
  return Boolean(data?.length)
}

function pricesClose(emailUnit: number, ota: number): boolean {
  if (!(ota > 0) || !(emailUnit > 0)) return false
  return Math.abs(emailUnit - ota) / ota <= PRICE_MATCH_TOLERANCE
}

export type AutoConfirmOutcome =
  | { attempted: false; reason: string }
  | { attempted: true; ok: true; reservation_id: string }
  | { attempted: true; ok: false; reason: string }

export async function tryAutoConfirmReservationImport(
  client: SupabaseClient,
  importId: string
): Promise<AutoConfirmOutcome> {
  const { data: row, error } = await client
    .from('reservation_imports')
    .select(
      'id, status, platform_key, subject, source_email, raw_body_text, raw_body_html, extracted_data'
    )
    .eq('id', importId)
    .maybeSingle()

  if (error || !row) return { attempted: false, reason: 'not_found' }
  if (row.status !== 'pending') return { attempted: false, reason: 'not_pending' }
  if (isZellePaymentSentEmail(row.subject)) return { attempted: false, reason: 'zelle' }
  if (isWellsFargoAtmReceiptEmail({ subject: row.subject, platformKey: row.platform_key })) {
    return { attempted: false, reason: 'atm' }
  }
  if (isCancellationRequestEmailSubject(row.subject)) {
    return { attempted: false, reason: 'cancellation' }
  }

  const ext = asExtracted(row.extracted_data)
  const amountFromBody =
    ext.amount ||
    extractPriceFromEmailBodyForImport(row.raw_body_text) ||
    extractPriceFromEmailBodyForImport(row.raw_body_html)
  const netFromBody =
    ext.viator_net_rate_usd ||
    extractViatorNetRateFromEmailBodyForImport(row.raw_body_text) ||
    extractViatorNetRateFromEmailBodyForImport(row.raw_body_html)
  const merged: ExtractedReservationData = {
    ...ext,
    ...(amountFromBody ? { amount: amountFromBody } : {}),
    ...(netFromBody ? { viator_net_rate_usd: netFromBody } : {}),
  }

  const readiness = evaluateImportAutoConfirmReadiness({
    platformKey: row.platform_key,
    subject: row.subject,
    extracted: merged,
  })
  if (!readiness.ready) {
    return { attempted: false, reason: `incomplete:${readiness.missing.join(',')}` }
  }

  const productId = await resolveProductId(client, merged)
  if (!productId) return { attempted: false, reason: 'product_unresolved' }

  const channelId = await resolveChannelId(client, row.platform_key, row.subject)
  if (!channelId) return { attempted: false, reason: 'channel_unresolved' }

  if (await channelRnAlreadyUsed(client, merged.channel_rn)) {
    return { attempted: false, reason: 'duplicate_channel_rn' }
  }

  const tourDate = String(merged.tour_date || '').slice(0, 10)
  const adults = Math.max(1, Number(merged.adults) || Number(merged.total_people) || 1)
  const child = Math.max(0, Number(merged.children) || 0)
  const infant = Math.max(0, Number(merged.infants) || 0)
  const totalPeople = adults + child + infant
  const emailTotal =
    parseImportMoneyString(merged.amount) ?? parseImportMoneyString(merged.viator_net_rate_usd)
  const emailUnit = emailTotal != null ? Math.round((emailTotal / Math.max(1, adults)) * 100) / 100 : null
  const isViator = (row.platform_key || '').toLowerCase() === 'viator'
  const netTotal = parseImportMoneyString(merged.viator_net_rate_usd)

  const semanticVariant =
    resolveImportChannelVariantKey(merged.channel_variant_key, merged.channel_variant_label) ||
    merged.channel_variant_key ||
    'default'

  const { data: cpRows } = await client
    .from('channel_products')
    .select('variant_key, variant_name_ko, variant_name_en')
    .eq('channel_id', channelId)
    .eq('product_id', productId)
    .eq('is_active', true)

  const variantRows = (cpRows || []) as Array<{
    variant_key?: string
    variant_name_ko?: string | null
    variant_name_en?: string | null
  }>
  const dbVariantKey =
    mapSemanticVariantToChannelProductKey(
      variantRows.map((r) => ({
        variant_key: r.variant_key || 'default',
        variant_name_ko: r.variant_name_ko ?? null,
        variant_name_en: r.variant_name_en ?? null,
      })),
      semanticVariant,
      merged.channel_variant_label
    ) || semanticVariant || 'default'

  const { data: choices } = await client
    .from('product_choices')
    .select('id, choice_group, choice_group_ko, is_required')
    .eq('product_id', productId)
    .eq('is_active', true)

  const choiceList = (choices || []) as Array<{
    id: string
    choice_group: string
    choice_group_ko: string
    is_required: boolean | null
  }>
  const choiceIds = choiceList.map((c) => c.id)
  const { data: options } =
    choiceIds.length > 0
      ? await client
          .from('choice_options')
          .select(
            'id, choice_id, option_name, option_name_ko, option_key, adult_price, canyon_key, canonical_option_key'
          )
          .in('choice_id', choiceIds)
      : { data: [] }

  const optionList = (options || []) as Array<{
    id: string
    choice_id: string
    option_name?: string | null
    option_name_ko?: string | null
    option_key?: string | null
    adult_price?: number | null
    canyon_key?: string | null
    canonical_option_key?: string | null
  }>

  const selectedChoices: Array<{
    choice_id: string
    option_id: string
    option_key: string | null
    option_name?: string | null
    option_name_ko?: string | null
    canyon_key?: string | null
    canonical_option_key?: string | null
    quantity: number
    total_price: number
  }> = []
  const undecidedChoices: typeof selectedChoices = []
  const undecidedGroups = new Set(
    (merged.import_choice_undecided_groups || []).map((g) => g.toLowerCase().replace(/\s+/g, ''))
  )
  const importOptionNames = importChoiceOptionNamesFromExtracted(merged)

  for (const choice of choiceList) {
    const groupBlob = `${choice.choice_group} ${choice.choice_group_ko}`.toLowerCase()
    const groupCompact = groupBlob.replace(/\s+/g, '')
    const isUndecidedGroup = [...undecidedGroups].some(
      (g) => groupCompact.includes(g) || g.includes(groupCompact)
    )
    if (isUndecidedGroup) {
      undecidedChoices.push({
        choice_id: choice.id,
        option_id: '__undecided__',
        option_key: '__undecided__',
        option_name_ko: '미정',
        quantity: Math.max(1, totalPeople),
        total_price: 0,
      })
      continue
    }
    const opts = optionList.filter((o) => o.choice_id === choice.id)
    const matched = matchChoiceOptionFromImportNames(opts, importOptionNames)
    if (matched) {
      const canyonKey =
        matched.canyon_key ||
        canyonKeyFromLabels(matched.option_name_ko, matched.option_name, matched.option_key)
      selectedChoices.push({
        choice_id: choice.id,
        option_id: matched.id,
        option_key: matched.option_key ?? null,
        option_name: matched.option_name ?? null,
        option_name_ko: matched.option_name_ko ?? null,
        ...(canyonKey ? { canyon_key: canyonKey } : {}),
        ...(matched.canonical_option_key ? { canonical_option_key: matched.canonical_option_key } : {}),
        quantity: 1,
        total_price: Number(matched.adult_price) || 0,
      })
    } else if (choice.is_required) {
      const looksCanyon = /앤텔롭|antelope|canyon/i.test(groupBlob)
      if (looksCanyon) {
        return { attempted: false, reason: 'required_choice_unmatched' }
      }
    }
  }

  const [{ data: pricingRows }, { data: couponRows }, { data: channelRows }] = await Promise.all([
    client
      .from('dynamic_pricing')
      .select('variant_key, choices_pricing, adult_price, not_included_price, commission_percent, price_type, updated_at')
      .eq('product_id', productId)
      .eq('date', tourDate)
      .eq('channel_id', channelId)
      .order('updated_at', { ascending: false })
      .limit(40),
    client
      .from('coupons')
      .select(
        'coupon_code, discount_type, percentage_value, fixed_value, channel_id, product_id, start_date, end_date, status'
      )
      .eq('status', 'active'),
    client.from('channels').select('id, name, type, category, pricing_type'),
  ])

  const rows = (pricingRows || []) as ImportPricingRow[]
  if (!rows.length) return { attempted: false, reason: 'no_dynamic_pricing' }
  const coupons = (couponRows || []) as ImportCouponRow[]
  const couponChannels = (channelRows || []) as Array<
    CouponChannelRow & { pricing_type?: string | null }
  >
  const channelMeta = couponChannels.find((c) => c.id === channelId) ?? null

  const picked = pickImportDynamicPricingOta({
    rows,
    selectedChoices: selectedChoices.map((c) => {
      const mapped: { choice_id: string; option_id: string; option_key?: string } = {
        choice_id: c.choice_id,
        option_id: c.option_id,
      }
      if (c.option_key) mapped.option_key = c.option_key
      return mapped
    }),
    preferredVariantKey: dbVariantKey,
    emailUnit: isViator ? null : emailUnit,
  })
  if (!picked || !(picked.ota > 0)) {
    return { attempted: false, reason: 'dynamic_pricing_unusable' }
  }

  const productPriceTotal = Math.round(picked.ota * adults * 100) / 100
  const notIncluded = picked.notIncluded || 0
  const couponBase = importCouponDiscountSubtotal({
    productPriceTotal,
    notIncludedPerPerson: notIncluded,
    pricingAdults: adults,
    reservationAdults: adults,
    child,
    infant,
    channel: channelMeta,
  })
  const couponMatchArgs = {
    couponBase,
    coupons,
    channelId,
    productId,
    tourDate,
    channels: couponChannels,
  }

  let couponCode: string | null = null
  let couponDiscount = 0
  if (isViator && netTotal != null) {
    const commissionPct = picked.commissionPercent || 0
    const trialCommission = computeChannelCommissionAmountUsd(productPriceTotal, commissionPct)
    const isOta = channelIsOtaForPricingSection(channelMeta)
    const notIncludedTotal = notIncluded * Math.max(1, totalPeople)
    const settlementUi = computeChannelSettlementAmount({
      depositAmount: netTotal,
      onlinePaymentAmount: netTotal,
      productPriceTotal: productPriceTotal + notIncludedTotal,
      couponDiscount: 0,
      additionalDiscount: 0,
      optionTotalSum: 0,
      additionalCost: 0,
      tax: 0,
      cardFee: 0,
      prepaymentTip: 0,
      onSiteBalanceAmount: 0,
      returnedAmount: 0,
      commissionAmount: trialCommission,
      isOTAChannel: isOta,
    })
    if (Math.abs(settlementUi - netTotal) >= 0.02) {
      const nine = findViatorNinePercentCoupon(couponMatchArgs)
      if (nine) {
        couponCode = nine.couponCode
        couponDiscount = nine.couponDiscount
      }
    }
  } else if (emailTotal != null) {
    const matched = findCouponToMatchEmailAmount({ ...couponMatchArgs, emailTarget: emailTotal })
    if (matched) {
      couponCode = matched.couponCode
      couponDiscount = matched.couponDiscount
    }
  }

  const afterCouponUnit =
    adults > 0 ? Math.round(((couponBase - couponDiscount) / adults) * 100) / 100 : picked.ota
  if (
    !isViator &&
    emailUnit != null &&
    !pricesClose(emailUnit, picked.ota) &&
    !pricesClose(emailUnit, afterCouponUnit)
  ) {
    return { attempted: false, reason: 'price_mismatch' }
  }

  const commissionPercent = picked.commissionPercent || 0
  const customerTotalPayment = importCustomerTotalPayment(productPriceTotal, couponDiscount)
  const depositAmount = importDepositAmountForPaymentRecord({
    isViator,
    customerTotalPayment,
    emailTotal,
  })
  const onlinePaymentAmount = isViator ? customerTotalPayment : depositAmount
  const commissionAmount =
    isViator && netTotal != null
      ? Math.round(Math.max(0, customerTotalPayment - netTotal) * 100) / 100
      : computeChannelCommissionAmountUsd(customerTotalPayment, commissionPercent)
  const viatorSettlement = isViator && netTotal != null ? Math.round(netTotal * 100) / 100 : null

  let pickupHotel: string | null = merged.pickup_hotel ?? null
  if (pickupHotel && !isPickupImportNotDecidedLabel(pickupHotel)) {
    const { data: hotels } = await client
      .from('pickup_hotels')
      .select('id, hotel, pick_up_location, address, internal_name')
    const matchedId = matchPickupHotelId(pickupHotel, hotels || [])
    if (matchedId) pickupHotel = matchedId
  }

  const result = await confirmReservationImport(client, importId, {
    customer_name: String(merged.customer_name || '').trim(),
    ...(merged.customer_email ? { customer_email: merged.customer_email } : {}),
    ...(merged.customer_phone ? { customer_phone: merged.customer_phone } : {}),
    customer_language: resolveImportCustomerLanguage(merged, row.platform_key),
    product_id: productId,
    tour_date: tourDate,
    tour_time: merged.tour_time ?? null,
    pickup_hotel: pickupHotel,
    adults,
    child,
    infant,
    total_people: totalPeople,
    channel_id: channelId,
    channel_rn: merged.channel_rn ?? null,
    event_note: merged.note || merged.special_requests || null,
    added_by: AUTO_CONFIRM_ADDED_BY,
    variant_key: picked.variantKey || dbVariantKey,
    selected_choices: [...selectedChoices, ...undecidedChoices].map((c) => ({
      choice_id: c.choice_id,
      option_id: c.option_id,
      quantity: c.quantity,
      total_price: c.total_price,
      option_key: c.option_key,
      ...(c.option_name ? { option_name: c.option_name } : {}),
      ...(c.option_name_ko ? { option_name_ko: c.option_name_ko } : {}),
      ...(c.canyon_key ? { canyon_key: c.canyon_key } : {}),
      ...(c.canonical_option_key ? { canonical_option_key: c.canonical_option_key } : {}),
    })),
    pricingInfo: {
      adultProductPrice: picked.ota,
      childProductPrice: 0,
      infantProductPrice: 0,
      productPriceTotal,
      not_included_price: notIncluded,
      depositAmount,
      onlinePaymentAmount,
      commission_percent: commissionPercent,
      commission_amount: commissionAmount,
      pricingAdults: adults,
      totalPrice: Math.max(0, productPriceTotal + notIncluded * totalPeople - couponDiscount),
      ...(couponCode ? { couponCode, couponDiscount } : {}),
      ...(viatorSettlement != null ? { channel_settlement_amount: viatorSettlement, balanceAmount: 0 } : {}),
    },
  })

  if (!result.ok) {
    return { attempted: true, ok: false, reason: result.error }
  }
  return { attempted: true, ok: true, reservation_id: result.reservation_id }
}
