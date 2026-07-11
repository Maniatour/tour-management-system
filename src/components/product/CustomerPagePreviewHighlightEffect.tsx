'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect } from 'react'

const HIGHLIGHT_CLASS = 'customer-page-zone--highlighted'

/**
 * preview=1&highlight=zone 쿼리 시 해당 data-customer-zone 요소를 스크롤·강조
 */
export default function CustomerPagePreviewHighlightEffect() {
  const searchParams = useSearchParams()
  const highlight = searchParams.get('highlight')
  const preview = searchParams.get('preview') === '1'

  useEffect(() => {
    if (!preview || !highlight) return

    const apply = () => {
      document.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach((el) => {
        el.classList.remove(HIGHLIGHT_CLASS)
      })

      const el = document.querySelector(`[data-customer-zone="${CSS.escape(highlight)}"]`)
      if (!el) return

      el.classList.add(HIGHLIGHT_CLASS)
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }

    const t1 = window.setTimeout(apply, 400)
    const t2 = window.setTimeout(apply, 1200)

    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      document.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach((el) => {
        el.classList.remove(HIGHLIGHT_CLASS)
      })
    }
  }, [highlight, preview])

  if (!preview || !highlight) return null

  return (
    <div
      className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] pointer-events-none"
      aria-hidden
    >
      <div className="flex items-center gap-2 rounded-full bg-primary text-primary-foreground text-xs font-medium px-3 py-1.5 shadow-lg animate-bounce">
        <span className="inline-block w-2 h-2 rounded-full bg-white" />
        편집 내용이 표시되는 영역
      </div>
    </div>
  )
}
