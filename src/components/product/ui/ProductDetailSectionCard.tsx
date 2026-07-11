'use client'

import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type ProductDetailSectionCardProps = {
  title: string
  icon?: LucideIcon
  iconClassName?: string
  iconBgClassName?: string
  children: ReactNode
  className?: string
  headerClassName?: string
}

export default function ProductDetailSectionCard({
  title,
  icon: Icon,
  iconClassName,
  iconBgClassName = 'bg-blue-50',
  children,
  className,
  headerClassName,
}: ProductDetailSectionCardProps) {
  return (
    <section
      className={cn(
        'rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm sm:rounded-2xl sm:p-6 lg:p-8',
        className
      )}
    >
      <div
        className={cn(
          'mb-4 flex items-center gap-2.5 border-b border-slate-100 pb-3 sm:mb-6 sm:gap-3 sm:pb-4',
          headerClassName
        )}
      >
        {Icon && (
          <div className={cn('rounded-lg p-2 sm:rounded-xl sm:p-2.5', iconBgClassName)}>
            <Icon className={cn('h-4 w-4 sm:h-5 sm:w-5', iconClassName ?? 'text-[#0B5FFF]')} aria-hidden />
          </div>
        )}
        <h2 className="text-base font-semibold tracking-tight text-slate-900 sm:text-xl lg:text-2xl">{title}</h2>
      </div>
      {children}
    </section>
  )
}
