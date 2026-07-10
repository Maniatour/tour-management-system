import {
  normalizeListingCardLayout,
  type ListingCardLayout,
} from '@/lib/customerPageListingCardLayout'
import { persistCustomerPageListingCardLayout } from '@/lib/customerPageLayoutPersistence'
import { loadCustomerPageListingCardLayout } from '@/lib/customerPageLayoutPersistence'
import { emitCustomerPageBindingsUpdate } from '@/lib/customerPageBindingsSync'

export async function applyCustomerPageListingCardLayoutUpdate(
  updater: (layout: ListingCardLayout) => ListingCardLayout
): Promise<ListingCardLayout> {
  const current = loadCustomerPageListingCardLayout()
  const next = normalizeListingCardLayout(updater(current))
  await persistCustomerPageListingCardLayout(next)
  emitCustomerPageBindingsUpdate()
  return next
}
