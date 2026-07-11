'use client'

import { cn } from '@/lib/utils'

export type PriceDisplayProps = {
  amount: number
  /** e.g. "From" */
  prefixLabel?: string
  /** e.g. "/ person" */
  suffixLabel?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
  showCurrency?: boolean
}

const sizeClasses: Record<NonNullable<PriceDisplayProps['size']>, string> = {
  sm: 'text-base font-bold',
  md: 'text-lg font-bold sm:text-xl',
  lg: 'text-2xl font-bold sm:text-3xl lg:text-4xl',
}

const suffixSizeClasses: Record<NonNullable<PriceDisplayProps['size']>, string> = {
  sm: 'text-xs font-medium',
  md: 'text-sm font-medium',
  lg: 'text-sm font-medium sm:text-base',
}

export default function PriceDisplay({
  amount,
  prefixLabel,
  suffixLabel,
  size = 'md',
  className,
  showCurrency = true,
}: PriceDisplayProps) {
  return (
    <p className={cn('tracking-tight text-foreground', className)}>
      {prefixLabel ? (
        <span className="mr-1 text-xs font-medium text-muted-foreground sm:text-sm">
          {prefixLabel}
        </span>
      ) : null}
      <span className={cn('cp-ui-price', sizeClasses[size])}>
        {showCurrency ? '$' : ''}
        {amount}
      </span>
      {suffixLabel ? (
        <span className={cn('ml-1 text-muted-foreground', suffixSizeClasses[size])}>
          {suffixLabel}
        </span>
      ) : null}
    </p>
  )
}
