/**
 * Compare legacy dynamic_pricing amounts vs Commerce Core v2 overrides.
 * Read-only; does not change booking behavior.
 */
import type { CommerceDb } from '@/lib/commerce/dualWritePricing'
import { resolvePriceV2 } from '@/lib/commerce/resolvePriceV2'
import { KOVEgAS_OPERATOR_ID } from '@/lib/operatorConstants'

export type ShadowDiff = {
  productId: string
  channelId: string
  variantKey: string
  date: string
  offerCode: string | null
  legacy: { adult: number; child: number; infant: number; isSaleAvailable: boolean }
  v2: {
    adult: number
    child: number
    infant: number
    isSaleAvailable: boolean
    source: string
    found: boolean
  }
  deltaAdult: number
  deltaChild: number
  deltaInfant: number
}

export type ShadowCompareResult = {
  compared: number
  matched: number
  mismatched: number
  missingInV2: number
  diffs: ShadowDiff[]
}

function nearlyEqual(a: number, b: number, eps = 0.01): boolean {
  return Math.abs(a - b) <= eps
}

function parseChoices(raw: unknown): Record<string, Record<string, unknown>> {
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
  return parsed as Record<string, Record<string, unknown>>
}

export async function shadowComparePricing(params: {
  client: CommerceDb
  operatorId?: string
  productId: string
  channelId?: string
  fromDate?: string
  limit?: number
  maxDiffs?: number
}): Promise<ShadowCompareResult> {
  const operatorId = params.operatorId || KOVEgAS_OPERATOR_ID
  const limit = Math.min(Math.max(params.limit ?? 50, 1), 200)
  const maxDiffs = params.maxDiffs ?? 40

  let query = params.client
    .from('dynamic_pricing')
    .select(
      'product_id, channel_id, date, variant_key, adult_price, child_price, infant_price, is_sale_available, choices_pricing'
    )
    .eq('product_id', params.productId)
    .order('date', { ascending: false })
    .limit(limit)

  if (params.channelId) query = query.eq('channel_id', params.channelId)
  if (params.fromDate) query = query.gte('date', params.fromDate)

  const { data: rows, error } = await query
  if (error) throw new Error(`shadow compare query failed: ${error.message}`)

  let compared = 0
  let matched = 0
  let mismatched = 0
  let missingInV2 = 0
  const diffs: ShadowDiff[] = []

  for (const row of rows || []) {
    if (!row.product_id || !row.channel_id || !row.date) continue
    const variantKey = row.variant_key || 'default'
    const date = String(row.date).split('T')[0]

    // Plan-level compare
    compared++
    const planV2 = await resolvePriceV2({
      client: params.client,
      operatorId,
      productId: row.product_id,
      channelId: row.channel_id,
      variantKey,
      date,
    })

    const legacyAdult = Number(row.adult_price ?? 0)
    const legacyChild = Number(row.child_price ?? 0)
    const legacyInfant = Number(row.infant_price ?? 0)
    const legacySale = row.is_sale_available !== false

    if (!planV2.found) {
      missingInV2++
      if (diffs.length < maxDiffs) {
        diffs.push({
          productId: row.product_id,
          channelId: row.channel_id,
          variantKey,
          date,
          offerCode: null,
          legacy: {
            adult: legacyAdult,
            child: legacyChild,
            infant: legacyInfant,
            isSaleAvailable: legacySale,
          },
          v2: {
            adult: 0,
            child: 0,
            infant: 0,
            isSaleAvailable: true,
            source: planV2.source,
            found: false,
          },
          deltaAdult: legacyAdult,
          deltaChild: legacyChild,
          deltaInfant: legacyInfant,
        })
      }
    } else {
      const ok =
        nearlyEqual(planV2.adult, legacyAdult) &&
        nearlyEqual(planV2.child, legacyChild) &&
        nearlyEqual(planV2.infant, legacyInfant) &&
        planV2.isSaleAvailable === legacySale
      if (ok) matched++
      else {
        mismatched++
        if (diffs.length < maxDiffs) {
          diffs.push({
            productId: row.product_id,
            channelId: row.channel_id,
            variantKey,
            date,
            offerCode: null,
            legacy: {
              adult: legacyAdult,
              child: legacyChild,
              infant: legacyInfant,
              isSaleAvailable: legacySale,
            },
            v2: {
              adult: planV2.adult,
              child: planV2.child,
              infant: planV2.infant,
              isSaleAvailable: planV2.isSaleAvailable,
              source: planV2.source,
              found: true,
            },
            deltaAdult: planV2.adult - legacyAdult,
            deltaChild: planV2.child - legacyChild,
            deltaInfant: planV2.infant - legacyInfant,
          })
        }
      }
    }

    // Offer-level (up to 5 codes per row to keep API fast)
    const choices = parseChoices(row.choices_pricing)
    let offerCount = 0
    for (const [code, choiceData] of Object.entries(choices)) {
      if (!code || code === '__no_choice__' || offerCount >= 5) continue
      offerCount++
      compared++

      const ota = Number(choiceData.ota_sale_price ?? 0)
      const lAdult = Number(choiceData.adult_price ?? choiceData.adult ?? ota ?? 0)
      const lChild = Number(choiceData.child_price ?? choiceData.child ?? ota ?? 0)
      const lInfant = Number(choiceData.infant_price ?? choiceData.infant ?? ota ?? 0)
      const lSale =
        choiceData.is_sale_available === undefined
          ? legacySale
          : choiceData.is_sale_available !== false

      const offerV2 = await resolvePriceV2({
        client: params.client,
        operatorId,
        productId: row.product_id,
        channelId: row.channel_id,
        variantKey,
        date,
        offerCode: code,
      })

      if (!offerV2.found || offerV2.source === 'plan_override' || offerV2.source === 'base_rule') {
        // No dedicated offer override — count as missing for this code
        missingInV2++
        if (diffs.length < maxDiffs) {
          diffs.push({
            productId: row.product_id,
            channelId: row.channel_id,
            variantKey,
            date,
            offerCode: code,
            legacy: {
              adult: lAdult,
              child: lChild,
              infant: lInfant,
              isSaleAvailable: lSale,
            },
            v2: {
              adult: offerV2.adult,
              child: offerV2.child,
              infant: offerV2.infant,
              isSaleAvailable: offerV2.isSaleAvailable,
              source: offerV2.source,
              found: offerV2.found,
            },
            deltaAdult: (offerV2.found ? offerV2.adult : 0) - lAdult,
            deltaChild: (offerV2.found ? offerV2.child : 0) - lChild,
            deltaInfant: (offerV2.found ? offerV2.infant : 0) - lInfant,
          })
        }
        continue
      }

      const ok =
        nearlyEqual(offerV2.adult, lAdult || ota) &&
        nearlyEqual(offerV2.child, lChild || ota) &&
        nearlyEqual(offerV2.infant, lInfant || ota)
      if (ok) matched++
      else {
        mismatched++
        if (diffs.length < maxDiffs) {
          diffs.push({
            productId: row.product_id,
            channelId: row.channel_id,
            variantKey,
            date,
            offerCode: code,
            legacy: {
              adult: lAdult || ota,
              child: lChild || ota,
              infant: lInfant || ota,
              isSaleAvailable: lSale,
            },
            v2: {
              adult: offerV2.adult,
              child: offerV2.child,
              infant: offerV2.infant,
              isSaleAvailable: offerV2.isSaleAvailable,
              source: offerV2.source,
              found: true,
            },
            deltaAdult: offerV2.adult - (lAdult || ota),
            deltaChild: offerV2.child - (lChild || ota),
            deltaInfant: offerV2.infant - (lInfant || ota),
          })
        }
      }
    }
  }

  return { compared, matched, mismatched, missingInV2, diffs }
}
