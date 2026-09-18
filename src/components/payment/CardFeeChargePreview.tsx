'use client'

import {
  CHOICE_CARD_PROCESSING_FEE_RATE,
  choiceProcessingFeeAmount,
  withChoiceProcessingFee,
} from '@/lib/choiceProcessingFee'

const CARD_FEE_PERCENT = Math.round(CHOICE_CARD_PROCESSING_FEE_RATE * 100)

function formatUsd(amount: number): string {
  return `$${amount.toFixed(2)}`
}

export function cardFeeChargeTotals(baseAmountUsd: number): {
  base: number
  fee: number
  total: number
} {
  const base = Number(baseAmountUsd) || 0
  if (base <= 0) return { base: 0, fee: 0, total: 0 }
  const fee = choiceProcessingFeeAmount(base)
  const total = withChoiceProcessingFee(base, true) ?? base
  return { base, fee, total }
}

export default function CardFeeChargePreview({
  baseAmountUsd,
  locale = 'ko',
}: {
  baseAmountUsd: number
  locale?: string
}) {
  const isKo = locale.startsWith('ko')
  const { base, fee, total } = cardFeeChargeTotals(baseAmountUsd)
  if (base <= 0) return null

  return (
    <div
      className="rounded-xl border border-border/60 bg-muted/40 px-3 py-2.5 text-sm"
      aria-live="polite"
    >
      <dl className="space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">{isKo ? '실 금액' : 'Actual amount'}</dt>
          <dd className="tabular-nums text-foreground">{formatUsd(base)}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">
            {isKo ? `카드수수료 ${CARD_FEE_PERCENT}%` : `${CARD_FEE_PERCENT}% card fee`}
          </dt>
          <dd className="tabular-nums text-foreground">+{formatUsd(fee)}</dd>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-1.5">
          <dt className="font-semibold text-foreground">{isKo ? '총 청구금액' : 'Total charge'}</dt>
          <dd className="font-semibold tabular-nums text-foreground">{formatUsd(total)}</dd>
        </div>
      </dl>
    </div>
  )
}
