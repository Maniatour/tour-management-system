'use client'

import { useRef, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'

type HomeGygCarouselProps = {
  children: ReactNode
  className?: string
  ariaLabel?: string
}

export default function HomeGygCarousel({ children, className = '', ariaLabel }: HomeGygCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const scrollNext = () => {
    scrollRef.current?.scrollBy({ left: 300, behavior: 'smooth' })
  }

  return (
    <div className="gyg-carousel-wrap">
      <div
        ref={scrollRef}
        className={`gyg-carousel ${className}`.trim()}
        role="list"
        aria-label={ariaLabel}
      >
        {children}
      </div>
      <button
        type="button"
        className="gyg-carousel-arrow hidden md:flex"
        onClick={scrollNext}
        aria-label={ariaLabel ? `${ariaLabel} next` : 'Next'}
      >
        <ChevronRight className="h-5 w-5 text-[#0071eb]" strokeWidth={2.5} />
      </button>
    </div>
  )
}
