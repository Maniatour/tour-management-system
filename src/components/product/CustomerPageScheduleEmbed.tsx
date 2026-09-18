'use client'

import ProductScheduleWorkspace from '@/components/product/ProductScheduleWorkspace'

type CustomerPageScheduleEmbedProps = {
  productId: string
  locale?: string
  onSaved?: () => void
  onDirtyChange?: (dirty: boolean) => void
  onOpenFullAdmin?: (tabId: string) => void
}

export default function CustomerPageScheduleEmbed({
  productId,
  locale,
  onSaved,
  onDirtyChange,
}: CustomerPageScheduleEmbedProps) {
  return (
    <ProductScheduleWorkspace
      productId={productId}
      compact
      {...(locale ? { locale } : {})}
      {...(onDirtyChange ? { onDirtyChange } : {})}
      onSaved={() => {
        onDirtyChange?.(false)
        onSaved?.()
      }}
    />
  )
}
