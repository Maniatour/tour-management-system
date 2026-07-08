'use client'

import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export type TrustBadgeItem = {
  icon: LucideIcon
  label: string
}

type TrustBadgeRowProps = {
  items: TrustBadgeItem[]
  className?: string
  compact?: boolean
}

export default function TrustBadgeRow({ items, className, compact = false }: TrustBadgeRowProps) {
  return (
    <ul
      className={cn(
        'flex flex-wrap gap-2',
        compact ? 'gap-1.5' : 'gap-2 sm:gap-3',
        className
      )}
      aria-label="Trust badges"
    >
      {items.map(({ icon: Icon, label }) => (
        <li
          key={label}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/90 text-slate-700 shadow-sm',
            compact ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs sm:text-sm'
          )}
        >
          <Icon
            className={cn('shrink-0 text-[#0B5FFF]', compact ? 'h-3 w-3' : 'h-3.5 w-3.5 sm:h-4 sm:w-4')}
            aria-hidden
          />
          <span className="font-medium">{label}</span>
        </li>
      ))}
    </ul>
  )
}
