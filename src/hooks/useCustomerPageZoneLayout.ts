'use client'

import { useMemo } from 'react'
import { useCustomerPageFieldBindings } from '@/components/product/CustomerPageFieldBindingsProvider'
import { getPageZoneLayoutViews } from '@/lib/customerPageZoneLayout'
import { loadCustomerPageZoneLayout } from '@/lib/customerPageLayoutPersistence'
import type { CustomerPageZone } from '@/lib/customerPageZones'
import type { ZoneLayoutPageId } from '@/lib/customerPageZoneLayoutCatalog'

export type PageZoneLayoutView = {
  zoneId: CustomerPageZone
  visible: boolean
  orderIndex: number
}

export function useCustomerPageZoneLayoutViews(
  pageId: ZoneLayoutPageId,
  includeHidden: boolean
): PageZoneLayoutView[] {
  const { revision } = useCustomerPageFieldBindings()

  return useMemo(() => {
    void revision
    const layout = loadCustomerPageZoneLayout(pageId)
    return getPageZoneLayoutViews(layout, includeHidden)
  }, [includeHidden, pageId, revision])
}
