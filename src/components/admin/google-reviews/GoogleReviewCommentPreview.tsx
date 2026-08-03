'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  comment: string
  isKo: boolean
}

export default function GoogleReviewCommentPreview({ comment, isKo }: Props) {
  const ref = useRef<HTMLParagraphElement>(null)
  const [isTruncated, setIsTruncated] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const checkTruncation = () => {
      if (expanded) return
      setIsTruncated(element.scrollHeight > element.clientHeight + 1)
    }

    checkTruncation()
    window.addEventListener('resize', checkTruncation)
    return () => window.removeEventListener('resize', checkTruncation)
  }, [comment, expanded])

  const showToggle = isTruncated || expanded

  return (
    <div className="space-y-1">
      <p
        ref={ref}
        className={cn(
          'text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words transition-[max-height] duration-300 ease-out',
          !expanded && 'line-clamp-4'
        )}
      >
        {comment}
      </p>
      {showToggle ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            aria-expanded={expanded}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary underline underline-offset-2 hover:opacity-80"
          >
            {expanded ? (isKo ? '접기' : 'Collapse') : isKo ? '전체 보기' : 'View full review'}
            <ChevronDown
              className={cn('h-3.5 w-3.5 transition-transform duration-300', expanded && 'rotate-180')}
              aria-hidden
            />
          </button>
        </div>
      ) : null}
    </div>
  )
}
