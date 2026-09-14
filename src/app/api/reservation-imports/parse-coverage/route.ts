import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  defaultChannelIdForPlatform,
  evaluateImportAutoConfirmReadiness,
  getOtaParseProductRules,
  OTA_PLATFORM_CATALOG,
  type OtaParseProductRule,
} from '@/lib/emailReservationParseCatalog'
import { isMyrealtripChannelName, isNolTripleChannelName } from '@/lib/platformChannelMapping'
import { isZellePaymentSentEmail } from '@/lib/zellePaymentEmail'
import type { ExtractedReservationData } from '@/types/reservationImport'

export const dynamic = 'force-dynamic'

type ChannelRow = { id: string; name: string | null; type?: string | null; category?: string | null }
type ChannelProductRow = {
  channel_id: string
  product_id: string
  variant_key: string
  variant_name_ko: string | null
  variant_name_en: string | null
  is_active: boolean | null
}
type ProductRow = { id: string; name: string | null; name_ko: string | null }

function parseExtracted(json: unknown): ExtractedReservationData {
  if (!json || typeof json !== 'object') return {}
  return json as ExtractedReservationData
}

function resolveChannelForPlatform(
  platformKey: string,
  channels: ChannelRow[]
): ChannelRow | null {
  const mapped = defaultChannelIdForPlatform(platformKey)
  if (platformKey === 'nol') {
    return channels.find((c) => isNolTripleChannelName(c.name)) ?? channels.find((c) => c.id === mapped) ?? null
  }
  if (platformKey === 'myrealtrip') {
    return channels.find((c) => isMyrealtripChannelName(c.name)) ?? channels.find((c) => c.id === mapped) ?? null
  }
  if (platformKey === 'zoomzoom') {
    return channels.find((c) => /줌줌/.test((c.name || '').trim())) ?? null
  }
  if (mapped) {
    return (
      channels.find((c) => c.id === mapped) ??
      channels.find((c) => (c.name || '').toLowerCase().includes(mapped.toLowerCase())) ??
      null
    )
  }
  return channels.find((c) => (c.name || '').toLowerCase().includes(platformKey.toLowerCase())) ?? null
}

function productDisplayName(p: ProductRow | undefined, fallback: string): string {
  return (p?.name_ko || p?.name || fallback || p?.id || '').trim()
}

function ruleMatchesSoldProduct(rule: OtaParseProductRule, productId: string, productName: string): boolean {
  if (rule.product_id && rule.product_id === productId) return true
  const want = (rule.product_name || '').toLowerCase()
  const have = productName.toLowerCase()
  if (!want || !have) return false
  return have.includes(want) || want.includes(have)
}

export async function GET() {
  const client = supabaseAdmin ?? (await import('@/lib/supabase')).supabase

  const [{ data: channels }, { data: channelProducts }, { data: products }, { data: imports }] = await Promise.all([
    client.from('channels').select('id, name, type, category'),
    client
      .from('channel_products')
      .select('channel_id, product_id, variant_key, variant_name_ko, variant_name_en, is_active')
      .eq('is_active', true),
    client.from('products').select('id, name, name_ko'),
    client
      .from('reservation_imports')
      .select('id, platform_key, subject, status, extracted_data, confirmed_by')
      .order('received_at', { ascending: false })
      .limit(800),
  ])

  const channelList = (channels || []) as ChannelRow[]
  const soldRows = (channelProducts || []) as ChannelProductRow[]
  const productList = (products || []) as ProductRow[]
  const productById = new Map(productList.map((p) => [p.id, p]))
  const rules = getOtaParseProductRules()

  const importRows = (imports || []).filter((row) => !isZellePaymentSentEmail(row.subject))

  const platforms = OTA_PLATFORM_CATALOG.map((meta) => {
    const channel = resolveChannelForPlatform(meta.key, channelList)
    const soldForChannel = channel ? soldRows.filter((r) => r.channel_id === channel.id) : []
    const soldByProduct = new Map<string, ChannelProductRow[]>()
    for (const row of soldForChannel) {
      const list = soldByProduct.get(row.product_id) || []
      list.push(row)
      soldByProduct.set(row.product_id, list)
    }

    const platformRules = rules.filter((r) => r.platform_key === meta.key)
    const soldProducts = [...soldByProduct.entries()].map(([productId, variants]) => {
      const prod = productById.get(productId)
      const name = productDisplayName(prod, productId)
      const matchedRules = platformRules.filter((r) => ruleMatchesSoldProduct(r, productId, name))
      const priceReady = matchedRules.some(
        (r) => r.price.amount || r.price.amount_excluded || r.price.viator_net_rate
      )
      return {
        product_id: productId,
        product_name: name,
        variants: variants.map((v) => ({
          variant_key: v.variant_key,
          variant_name: v.variant_name_ko || v.variant_name_en || v.variant_key,
        })),
        parse_rules: matchedRules,
        product_mapped: matchedRules.length > 0,
        price_connected: priceReady && meta.fieldCoverage.price !== 'none',
      }
    })

    const unmatchedRules = platformRules.filter(
      (r) => !soldProducts.some((p) => ruleMatchesSoldProduct(r, p.product_id, p.product_name))
    )

    const platformImports = importRows.filter((row) => (row.platform_key || '').toLowerCase() === meta.key)
    let withProduct = 0
    let withPrice = 0
    let autoReady = 0
    let confirmed = 0
    let autoConfirmed = 0
    for (const row of platformImports) {
      const ext = parseExtracted(row.extracted_data)
      const readiness = evaluateImportAutoConfirmReadiness({
        platformKey: meta.key,
        subject: row.subject,
        extracted: ext,
      })
      if (readiness.productId || ext.product_name) withProduct += 1
      if (readiness.amount != null || readiness.netRate != null) withPrice += 1
      if (readiness.ready) autoReady += 1
      if (row.status === 'confirmed') confirmed += 1
      if (String(row.confirmed_by || '').startsWith('system:email-auto-import')) autoConfirmed += 1
    }

    const soldCount = soldProducts.length
    const mappedCount = soldProducts.filter((p) => p.product_mapped).length
    const priceCount = soldProducts.filter((p) => p.price_connected).length

    return {
      ...meta,
      channel_id: channel?.id ?? null,
      channel_name: channel?.name ?? null,
      sold_products: soldProducts,
      unmatched_rules: unmatchedRules,
      stats: {
        import_count: platformImports.length,
        confirmed,
        auto_confirmed: autoConfirmed,
        with_product: withProduct,
        with_price: withPrice,
        auto_ready: autoReady,
        sold_count: soldCount,
        mapped_count: mappedCount,
        price_connected_count: priceCount,
      },
    }
  })

  return NextResponse.json({
    platforms,
    auto_confirm: {
      enabled: true,
      added_by: 'system:email-auto-import',
      requires: [
        '예약 접수 메일',
        '상품 매핑',
        '투어일',
        '인원',
        '고객명',
        '금액(또는 Viator Net Rate)',
        '해당일 동적가격',
      ],
    },
  })
}
