import { formatUsd } from './helpers'

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
}: {
  list: number | null | undefined
  discounted?: number | null
  percent?: number | null
  isKo: boolean
  size?: 'lg' | 'md'
}) {
  const hasDiscount = discounted != null && list != null && percent != null && percent > 0
  const saleClass =
    size === 'lg'
      ? 'text-3xl font-bold tracking-tight text-[#E85D04] lg:text-4xl'
      : 'text-lg font-bold tracking-tight text-[#E85D04]'
  const listClass =
    size === 'lg' ? 'text-3xl font-bold tracking-tight lg:text-4xl' : 'text-base font-semibold'
  const metaClass = size === 'lg' ? 'mt-1 min-h-5 text-sm' : 'mt-0.5 min-h-4 text-xs'

  return (
    <div
      aria-label={
        hasDiscount
          ? isKo
            ? `할인가 ${formatUsd(discounted)}, 정가 ${formatUsdCents(list)}, ${percent}% 할인`
            : `Sale ${formatUsd(discounted)}, was ${formatUsdCents(list)}, ${percent}% off`
          : undefined
      }
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
