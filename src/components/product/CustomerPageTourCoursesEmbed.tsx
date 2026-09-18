'use client'

import ProductTourCoursesWorkspace from '@/components/tour-courses/ProductTourCoursesWorkspace'

type CustomerPageTourCoursesEmbedProps = {
  productId: string
  locale?: string
  onSaved?: () => void
  onDirtyChange?: (dirty: boolean) => void
  onOpenFullAdmin?: (tabId: string) => void
}

export default function CustomerPageTourCoursesEmbed({
  productId,
  locale,
  onSaved,
  onDirtyChange,
}: CustomerPageTourCoursesEmbedProps) {
  return (
    <ProductTourCoursesWorkspace
      productId={productId}
      compact
      {...(locale ? { locale } : {})}
      onSaved={() => {
        onDirtyChange?.(false)
        onSaved?.()
      }}
    />
  )
}
