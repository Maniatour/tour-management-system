import { adultTotal, discountedPrice, normalizeDiscountPercent, toMoney } from './prices'
import type { OurChannelSettings, OurPricePoint } from './types'
import { OUR_CHANNEL_DISCOUNT_MODES } from './types'

export function defaultOurChannelSettings(): OurChannelSettings {
  return {
    discountMode: 'inherit',
    discountPercent: null,
    lowerSale: null,
    antelopeXSale: null,
  }
}

export function parseOurChannelSettings(raw: unknown): OurChannelSettings {
  const base = defaultOurChannelSettings()
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base
  const row = raw as Record<string, unknown>
  const mode = typeof row.discountMode === 'string' ? row.discountMode : ''
  const discountMode = (OUR_CHANNEL_DISCOUNT_MODES as readonly string[]).includes(mode)
    ? (mode as OurChannelSettings['discountMode'])
    : 'inherit'
  const percent = normalizeDiscountPercent(row.discountPercent)
  return {
    discountMode,
    discountPercent: percent > 0 ? percent : null,
    lowerSale: toMoney(row.lowerSale),
    antelopeXSale: toMoney(row.antelopeXSale),
  }
}

/**
 * 시장조사 비교에만 채널 설정을 얹는다. 동적가격 원본은 바꾸지 않는다.
 */
export function applyOurChannelSettings(
  point: OurPricePoint | undefined,
  settings: OurChannelSettings,
  canyon: 'lower' | 'antelope_x'
): OurPricePoint | undefined {
  const override = canyon === 'lower' ? settings.lowerSale : settings.antelopeXSale
  const sale = override ?? point?.sale ?? null
  if (!point && sale == null) return undefined

  let percent: number | null = null
  if (settings.discountMode === 'none') {
    percent = null
  } else if (settings.discountMode === 'custom') {
    const custom = normalizeDiscountPercent(settings.discountPercent)
    percent = custom > 0 ? custom : null
  } else {
    const inherited = point?.discountPercent
    percent = inherited != null && inherited > 0 ? inherited : null
  }

  const discounted = percent != null ? discountedPrice(sale, percent) : null
  const notIncluded = point?.notIncluded ?? (sale == null ? null : 0)
  return {
    sale,
    discounted,
    discountPercent: discounted != null ? percent : null,
    notIncluded,
    total: adultTotal(discounted ?? sale, notIncluded),
    source: point?.source ?? (sale != null ? 'product' : 'none'),
  }
}
