import { formatUsd } from './helpers'

function priceAriaLabel(input: {
  hasDiscount: boolean
  discounted: number | null | undefined
  list: number | null | undefined
  percent: number | null | undefined
  isKo: boolean
  tone: 'higher' | 'lower' | null
}): string | undefined {
  const compare =
    input.tone === 'higher'
      ? input.isKo
        ? '우리보다 높음'
        : 'Higher than ours'
      : input.tone === 'lower'
        ? input.isKo
          ? '우리보다 낮음'
          : 'Lower than ours'
        : ''
  if (!input.hasDiscount && !compare) return undefined
  const price = input.hasDiscount
    ? input.isKo
      ? `할인가 ${formatUsd(input.discounted)}, 정가 ${formatUsdCents(input.list!)}, ${input.percent}% 할인`
      : `Sale ${formatUsd(input.discounted)}, was ${formatUsdCents(input.list!)}, ${input.percent}% off`
    : ''
  return [price, compare].filter(Boolean).join(', ')
}

function formatUsdCents(value: number): string {
  return `$${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function MarketResearchPriceStack({
  list,
  discounted,
  percent,
  isKo,
  size = 'md',
  tone = null,
}: {
  list: number | null | undefined
  discounted?: number | null
  percent?: number | null
  isKo: boolean
  size?: 'lg' | 'md'
  tone?: 'higher' | 'lower' | null
}) {
  const hasDiscount = discounted != null && list != null && percent != null && percent > 0
  const toneClass = tone === 'higher' ? 'text-emerald-600' : tone === 'lower' ? 'text-red-600' : 'text-[#E85D04]'
  const saleClass =
    size === 'lg'
      ? `text-3xl font-bold tracking-tight lg:text-4xl ${toneClass}`
      : `text-lg font-bold tracking-tight ${toneClass}`
  const listClass =
    size === 'lg'
      ? `text-3xl font-bold tracking-tight lg:text-4xl ${tone ? toneClass : ''}`
      : `text-base font-semibold ${tone ? toneClass : ''}`
  const metaClass = size === 'lg' ? 'mt-1 min-h-5 text-sm' : 'mt-0.5 min-h-4 text-xs'

  return (
    <div
      aria-label={priceAriaLabel({ hasDiscount, discounted, list, percent, isKo, tone })}
    >
      <div className={hasDiscount ? saleClass : listClass}>
        {formatUsd(hasDiscount ? discounted : list)}
      </div>
      {hasDiscount ? (
        <div className={`flex items-baseline justify-center gap-1.5 ${metaClass}`}>
          <span className="text-slate-400 line-through decoration-slate-400">{formatUsdCents(list)}</span>
          <span className="font-semibold text-[#E85D04]">-{percent}%</span>
        </div>
      ) : (
        <div className={metaClass} aria-hidden="true" />
      )}
    </div>
  )
}
