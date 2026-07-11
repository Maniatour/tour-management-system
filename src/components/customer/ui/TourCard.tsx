'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const tourCardVariants = cva(
  'cp-ui-card-surface relative overflow-hidden border transition-all duration-300',
  {
    variants: {
      variant: {
        grid: 'rounded-card shadow-card hover:shadow-card-hover',
        stacked:
          'rounded-card shadow-card hover:shadow-card-hover flex flex-col sm:flex-row sm:items-stretch',
        horizontal:
          'rounded-card shadow-card hover:shadow-card-hover min-w-[min(88vw,320px)] shrink-0 snap-start sm:min-w-[340px]',
        featured:
          'rounded-card shadow-card hover:shadow-card-hover hover:-translate-y-0.5 sm:col-span-2 lg:row-span-2',
      },
    },
    defaultVariants: {
      variant: 'grid',
    },
  }
)

export type TourCardProps = VariantProps<typeof tourCardVariants> & {
  href: string
  className?: string
  image: ReactNode
  children: ReactNode
  ctaLabel?: string
  headerSlot?: ReactNode
}

export default function TourCard({
  href,
  className,
  variant,
  image,
  children,
  ctaLabel,
  headerSlot,
}: TourCardProps) {
  return (
    <article className={cn(tourCardVariants({ variant }), className)}>
      {headerSlot}
      <Link href={href} className="group block">
        {image}
        <div className="p-4 sm:p-6">{children}</div>
        {ctaLabel ? (
          <div className="px-4 pb-4 sm:px-6 sm:pb-6">
            <span className="cp-ui-btn-primary block w-full rounded-btn py-2.5 text-center text-sm font-semibold transition-colors">
              {ctaLabel}
            </span>
          </div>
        ) : null}
      </Link>
    </article>
  )
}

export { tourCardVariants }
