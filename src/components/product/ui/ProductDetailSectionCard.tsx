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
        'rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition-shadow duration-300 hover:shadow-md sm:p-8',
        className
      )}
    >
      <div
        className={cn(
          'mb-6 flex items-center gap-3 border-b border-slate-100 pb-4',
          headerClassName
        )}
      >
        {Icon && (
          <div className={cn('rounded-xl p-2.5', iconBgClassName)}>
            <Icon className={cn('h-5 w-5', iconClassName ?? 'text-[#0B5FFF]')} aria-hidden />
          </div>
        )}
        <h2 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{title}</h2>
      </div>
      {children}
    </section>
  )
}
