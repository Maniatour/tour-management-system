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
  includeHiddenSections: boolean
): HomeLayoutSectionView[] {
  const { revision } = useCustomerPageFieldBindings()

  return useMemo(() => {
    void revision
    const layout = loadCustomerPageHomeLayout()

    if (includeHiddenSections) {
      return layout.sections.map((section, orderIndex) => ({
        instanceId: section.instanceId,
        visible: section.visible,
        orderIndex,
        section,
      }))
    }

    return layout.sections
      .filter((section) => section.visible)
      .map((section, orderIndex) => ({
        instanceId: section.instanceId,
        visible: true,
        orderIndex,
        section,
      }))
  }, [includeHiddenSections, revision])
}
