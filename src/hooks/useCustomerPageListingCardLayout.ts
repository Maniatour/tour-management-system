'use client'

import { useMemo } from 'react'
import { useCustomerPageFieldBindings } from '@/components/product/CustomerPageFieldBindingsProvider'
import { getListingCardLayoutViews } from '@/lib/customerPageListingCardLayout'
import { loadCustomerPageListingCardLayout } from '@/lib/customerPageLayoutPersistence'
import type { ListingCardSlotId } from '@/lib/customerPageListingCardLayoutCatalog'

export type ListingCardLayoutView = {
  slotId: ListingCardSlotId
  visible: boolean
  orderIndex: number
}

export function useCustomerPageListingCardLayoutViews(
  includeHidden: boolean
): ListingCardLayoutView[] {
  const { revision } = useCustomerPageFieldBindings()

  return useMemo(() => {
    void revision
    const layout = loadCustomerPageListingCardLayout()
    return getListingCardLayoutViews(layout, includeHidden)
  }, [includeHidden, revision])
}

export function useCustomerPageListingCardBodySlots(): ListingCardSlotId[] {
  const { revision } = useCustomerPageFieldBindings()

  return useMemo(() => {
    void revision
    const layout = loadCustomerPageListingCardLayout()
    const skip = new Set<ListingCardSlotId>(['listing-card-image', 'listing-card-cta'])
    return layout.slots.filter((s) => s.visible && !skip.has(s.slotId)).map((s) => s.slotId)
  }, [revision])
}

export function useCustomerPageListingCardSlotVisible(slotId: ListingCardSlotId): boolean {
  const { revision } = useCustomerPageFieldBindings()

  return useMemo(() => {
    void revision
    const layout = loadCustomerPageListingCardLayout()
    return layout.slots.find((s) => s.slotId === slotId)?.visible ?? true
  }, [revision, slotId])
}
