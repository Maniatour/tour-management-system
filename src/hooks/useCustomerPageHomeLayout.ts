'use client'

import { useMemo } from 'react'
import { useCustomerPageFieldBindings } from '@/components/product/CustomerPageFieldBindingsProvider'
import {
  getOrderedVisibleHomeSections,
  type HomePageSectionEntry,
} from '@/lib/customerPageHomeLayout'
import { loadCustomerPageHomeLayout } from '@/lib/customerPageLayoutPersistence'

export type HomeLayoutSectionView = {
  instanceId: string
  visible: boolean
  orderIndex: number
  section: HomePageSectionEntry
}

export function useCustomerPageHomeLayout(): HomePageSectionEntry[] {
  const { revision } = useCustomerPageFieldBindings()

  return useMemo(() => {
    void revision
    return getOrderedVisibleHomeSections(loadCustomerPageHomeLayout())
  }, [revision])
}

export function useCustomerPageHomeLayoutSections(
  _includeHiddenSections = false
): HomeLayoutSectionView[] {
  const { revision } = useCustomerPageFieldBindings()

  return useMemo(() => {
    void revision
    void _includeHiddenSections
    const layout = loadCustomerPageHomeLayout()

    return layout.sections
      .filter((section) => section.visible)
      .map((section, orderIndex) => ({
        instanceId: section.instanceId,
        visible: true,
        orderIndex,
        section,
      }))
  }, [_includeHiddenSections, revision])
}
