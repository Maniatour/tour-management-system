'use client'

import type { ReactNode } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const tourGridVariants = cva('', {
  variants: {
    layout: {
      grid: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8',
      'grid-two': 'grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8',
      'featured-grid':
        'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 auto-rows-fr',
      list: 'flex flex-col gap-4 sm:gap-5',
      scroll: 'cp-home-scroll-row flex gap-4 sm:gap-6 pb-2',
    },
  },
  defaultVariants: {
    layout: 'grid',
  },
})

export type TourGridProps = VariantProps<typeof tourGridVariants> & {
  children: ReactNode
  className?: string
}

export default function TourGrid({ layout, className, children }: TourGridProps) {
  return <div className={cn(tourGridVariants({ layout }), className)}>{children}</div>
}

export { tourGridVariants }
