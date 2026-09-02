/**
 * 이메일 예약 가져오기: 초이스·variant·동적가격 미스 보완.
 * 판매가의 1순위는 항상 dynamic_pricing. 이메일 금액은 조회가 비었을 때만 사용.
 */
import { PLATFORM_CHANNEL_MAP } from '@/lib/platformChannelMapping'
import {
  getFallbackOtaAndNotIncluded,
  getNoChoiceOtaAndNotIncluded,
} from '@/utils/choicePricingMatcher'
import {
  bookingTimeSelectedChoices,
  combinationKeyFromSelectedChoices,
  findBookingTimeChoicePricing,
  toOtaAndNotIncluded,
} from '@/lib/bookingTimeChoicePricing'

const HOMEPAGE_CHANNEL_IDS = new Set(['M00001'])

const CANYON_ALIASES: Array<{ canon: string; aliases: string[] }> = [
  {
    canon: 'antelope x canyon',
    aliases: ['x antelope canyon', 'antelope x', 'x antelope', '엑스 앤텔롭', '앤텔롭 x'],
  },
  {
    canon: 'lower antelope canyon',
    aliases: ['lower antelope', '로어 앤텔롭', '로어앤텔롭'],
  },
  {
    canon: 'upper antelope canyon',
    aliases: ['upper antelope', '어퍼 앤텔롭', '어퍼앤텔롭'],
  },
]

export function normalizeChoiceLabel(s: string): string {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function aliasKeys(normalized: string): string[] {
  const keys = new Set<string>([normalized])
  for (const row of CANYON_ALIASES) {
    const all = [row.canon, ...row.aliases].map(normalizeChoiceLabel)
    if (all.includes(normalized)) {
      all.forEach((a) => keys.add(a))
    }
  }
  return [...keys]
}

function labelsOfOption(opt: {
  option_name?: string | null
  option_name_ko?: string | null
  option_key?: string | null
}): string[] {
  return [opt.option_name, opt.option_name_ko, opt.option_key]
    .map((x) => normalizeChoiceLabel(String(x || '')))
    .filter((x) => x.length >= 2)
}

function tokenSubsetMatch(a: string, b: string): boolean {
  const ta = a.split(' ').filter((t) => t.length >= 2)
  const tb = b.split(' ').filter((t) => t.length >= 2)
  if (ta.length < 2 || tb.length < 2) return false
  const shorter = ta.length <= tb.length ? ta : tb
  const longer = ta.length <= tb.length ? tb : ta
  return shorter.every((t) => longer.includes(t))
}

/**
 * 이메일 옵션명 → choice_options. includes 오매칭(Antelope → Upper 먼저)을 피하고
 * 정확 일치 · 별칭 · 유일 부분일치만 허용.
 */
export function matchChoiceOptionFromImportNames<
  T extends {
    option_name?: string | null
    option_name_ko?: string | null
    option_key?: string | null
  },
>(options: T[] | null | undefined, importNames: string[] | null | undefined): T | null {
  if (!options?.length || !importNames?.length) return null
  const wanted = importNames.map(normalizeChoiceLabel).filter((n) => n.length >= 2)
  if (!wanted.length) return null

  const wantedKeys = new Set(wanted.flatMap(aliasKeys))

  for (const opt of options) {
    const labels = labelsOfOption(opt)
    if (labels.some((l) => wantedKeys.has(l) || aliasKeys(l).some((k) => wantedKeys.has(k)))) {
      return opt
    }
  }

  const uniqueHits: T[] = []
  for (const opt of options) {
    const labels = labelsOfOption(opt)
    const hit = labels.some((l) =>
      wanted.some((n) => {
        if (n.length < 8 && l.length < 8) return false
        return l === n || tokenSubsetMatch(l, n)
      })
    )
    if (hit) uniqueHits.push(opt)
  }
  if (uniqueHits.length === 1) return uniqueHits[0]
  return null
}

export function isLikelyOtaChannelId(
  channelId: string | null | undefined,
  channel?: { type?: string | null; category?: string | null } | null
): boolean {
  const id = String(channelId || '').trim()
  if (!id) return false
  const t = String(channel?.type || '').toLowerCase()
  const cat = String(channel?.category || '')
  if (t === 'ota' || cat === 'OTA') return true
  if (HOMEPAGE_CHANNEL_IDS.has(id)) return false
  return Object.values(PLATFORM_CHANNEL_MAP).some((mapped) => mapped === id && !HOMEPAGE_CHANNEL_IDS.has(mapped))
}

export function parseChoicesPricing(raw: unknown): Record<string, any> {
  if (!raw) return {}
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      return {}
    }
  }
  if (typeof raw === 'object') return raw as Record<string, any>
  return {}
}

export function dynamicPricingRowHasUsablePrice(row: {
  adult_price?: unknown
  choices_pricing?: unknown
} | null | undefined): boolean {
  if (!row) return false
  if (Number(row.adult_price) > 0) return true
  const cp = parseChoicesPricing(row.choices_pricing)
  return Object.values(cp).some((e: any) => Number(e?.ota_sale_price) > 0)
}

function uniquePositiveOta(
  choicesPricing: Record<string, any>
): { ota_sale_price: number; not_included_price?: number } | undefined {
  const seen = new Map<string, { ota: number; ni: number }>()
  for (const entry of Object.values(choicesPricing)) {
    if (!entry || typeof entry !== 'object') continue
    const ota = Number((entry as any).ota_sale_price)
    if (!Number.isFinite(ota) || ota <= 0) continue
    const ni = Number((entry as any).not_included_price) || 0
    const key = ota.toFixed(2)
    const prev = seen.get(key)
    seen.set(key, { ota, ni: Math.max(prev?.ni ?? 0, ni) })
  }
  if (seen.size !== 1) return undefined
  const only = [...seen.values()][0]
  return {
    ota_sale_price: only.ota,
    ...(only.ni > 0 ? { not_included_price: only.ni } : {}),
  }
}

export function resolveOtaFromChoicesPricing(
  choicesPricing: Record<string, any>,
  selectedChoices: Array<{ choice_id?: string; option_id?: string; option_key?: string; id?: string }>
): { ota_sale_price: number; not_included_price?: number } | undefined {
  if (!choicesPricing || Object.keys(choicesPricing).length === 0) return undefined
  const bookingChoices = bookingTimeSelectedChoices(selectedChoices)
  const comboKey = combinationKeyFromSelectedChoices(bookingChoices)
  const optionKeys = bookingChoices
    .map((choice) => String(choice.option_key || '').trim())
    .filter(Boolean)
  const catalog = toOtaAndNotIncluded(
    findBookingTimeChoicePricing(comboKey, choicesPricing, optionKeys)
  )
  if (catalog && catalog.ota_sale_price > 0) return catalog
  const fallback = comboKey
    ? getFallbackOtaAndNotIncluded({ id: comboKey, combination_key: comboKey }, choicesPricing)
    : undefined
  if (fallback && Number(fallback.ota_sale_price) > 0) return fallback
  const nc = getNoChoiceOtaAndNotIncluded(choicesPricing)
  if (nc && nc.ota_sale_price > 0) return nc
  return uniquePositiveOta(choicesPricing)
}

export function unitPriceFromEmailTotal(emailTotal: number | null | undefined, pax: number): number | null {
  if (emailTotal == null || !Number.isFinite(emailTotal) || emailTotal <= 0) return null
  const n = Math.max(1, Number(pax) || 1)
  return Math.round((emailTotal / n) * 100) / 100
}

export function shouldSwitchImportVariantPrice(
  mappedOta: number,
  candidateOta: number,
  emailUnit: number | null
): boolean {
  if (!(candidateOta > 0)) return false
  if (!(mappedOta > 0)) return true
  if (emailUnit == null || emailUnit <= 0) return false
  const mappedDiff = Math.abs(mappedOta - emailUnit) / emailUnit
  const otherDiff = Math.abs(candidateOta - emailUnit) / emailUnit
  return otherDiff < 0.15 && otherDiff < mappedDiff - 0.05
}

export type ImportPricingRow = {
  variant_key?: string | null
  choices_pricing?: unknown
  adult_price?: unknown
  not_included_price?: unknown
  commission_percent?: unknown
}

export type PickedImportOta = {
  variantKey: string
  ota: number
  notIncluded: number
  commissionPercent: number
}

export function pickImportDynamicPricingOta(args: {
  rows: ImportPricingRow[]
  selectedChoices: Array<{ choice_id?: string; option_id?: string; option_key?: string; id?: string }>
  preferredVariantKey: string
  emailUnit: number | null
}): PickedImportOta | null {
  let best: PickedImportOta | null = null
  let bestScore = -Infinity
  for (const row of args.rows || []) {
    const cp = parseChoicesPricing(row.choices_pricing)
    const hasCp = Object.keys(cp).length > 0
    const resolved = hasCp ? resolveOtaFromChoicesPricing(cp, args.selectedChoices) : undefined
    const ota = Number(resolved?.ota_sale_price) > 0
      ? Number(resolved!.ota_sale_price)
      : hasCp
        ? 0
        : Number(row.adult_price) || 0
    if (!(ota > 0)) continue
    const vk = String(row.variant_key || 'default')
    let score = 0
    if (vk === args.preferredVariantKey) score += 80
    if (args.emailUnit && args.emailUnit > 0) {
      const diff = Math.abs(ota - args.emailUnit) / args.emailUnit
      score += Math.max(0, 60 - diff * 120)
    } else {
      score += 1
    }
    if (score > bestScore) {
      bestScore = score
      const ni =
        Number(resolved?.not_included_price) > 0
          ? Number(resolved!.not_included_price)
          : Number(row.not_included_price) || 0
      best = {
        variantKey: vk,
        ota,
        notIncluded: ni,
        commissionPercent: Number(row.commission_percent) || 0,
      }
    }
  }
  return best
}
