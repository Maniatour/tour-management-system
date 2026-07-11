'use client'

import { useRef, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

type ProductsHorizontalScrollProps = {
  children: ReactNode
  ariaLabel?: string
}

export default function ProductsHorizontalScroll({
  children,
  ariaLabel,
}: ProductsHorizontalScrollProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const scrollBy = (direction: 'left' | 'right') => {
    const amount = direction === 'left' ? -320 : 320
    scrollRef.current?.scrollBy({ left: amount, behavior: 'smooth' })
  }

  return (
    <div className="gyg-listing-scroll-wrap">
      <button
        type="button"
        className="gyg-listing-scroll-arrow gyg-listing-scroll-arrow-left hidden md:flex"
        onClick={() => scrollBy('left')}
        aria-label={ariaLabel ? `${ariaLabel} previous` : 'Previous'}
      >
        <ChevronLeft className="h-5 w-5 text-[#1a2b49]" strokeWidth={2.5} />
      </button>

      <div
        ref={scrollRef}
        className="gyg-listing-scroll"
        role="list"
        aria-label={ariaLabel}
      >
        {children}
      </div>

      <button
        type="button"
        className="gyg-listing-scroll-arrow gyg-listing-scroll-arrow-right hidden md:flex"
        onClick={() => scrollBy('right')}
        aria-label={ariaLabel ? `${ariaLabel} next` : 'Next'}
      >
        <ChevronRight className="h-5 w-5 text-[#1a2b49]" strokeWidth={2.5} />
      </button>
    </div>
  )
}
