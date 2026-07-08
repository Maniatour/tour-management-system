'use client'

import CustomerPageEditWorkbench from '@/components/product/CustomerPageEditWorkbench'

type CustomerPageEditModalProps = {
  isOpen: boolean
  onClose: () => void
  productId: string
  locale: string
  onNavigateToTab: (tabId: string) => void
}

export default function CustomerPageEditModal({
  isOpen,
  onClose,
  productId,
  locale,
}: CustomerPageEditModalProps) {
  return (
    <CustomerPageEditWorkbench
      locale={locale}
      variant="modal"
      isOpen={isOpen}
      onClose={onClose}
      initialPageId="product-detail"
      initialProductId={productId}
    />
  )
}
