'use client'

import { useRef, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'

type Props = {
  children: ReactNode
  ariaLabel?: string
}

export default function HomeManiaTourCarousel({ children, ariaLabel }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const scrollNext = () => {
    scrollRef.current?.scrollBy({ left: 320, behavior: 'smooth' })
  }

  return (
    <div className="kv-carousel-wrap">
      <div ref={scrollRef} className="kv-carousel" role="list" aria-label={ariaLabel}>
        {children}
      </div>
      <button
        type="button"
        className="kv-carousel-arrow hidden md:flex"
        onClick={scrollNext}
        aria-label={ariaLabel ? `${ariaLabel} next` : 'Next'}
      >
        <ChevronRight className="h-5 w-5" strokeWidth={2.25} aria-hidden />
      </button>
    </div>
  )
}
