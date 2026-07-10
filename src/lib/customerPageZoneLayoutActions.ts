import {
  normalizePageZoneLayout,
  type PageZoneLayout,
} from '@/lib/customerPageZoneLayout'
import {
  loadCustomerPageZoneLayout,
  persistCustomerPageZoneLayout,
} from '@/lib/customerPageLayoutPersistence'
import type { ZoneLayoutPageId } from '@/lib/customerPageZoneLayoutCatalog'
import { emitCustomerPageBindingsUpdate } from '@/lib/customerPageBindingsSync'

export async function applyCustomerPageZoneLayoutUpdate(
  pageId: ZoneLayoutPageId,
  updater: (layout: PageZoneLayout) => PageZoneLayout
): Promise<PageZoneLayout> {
  const current = loadCustomerPageZoneLayout(pageId)
  const next = normalizePageZoneLayout(updater(current), pageId)
  await persistCustomerPageZoneLayout(pageId, next)
  emitCustomerPageBindingsUpdate()
  return next
}
