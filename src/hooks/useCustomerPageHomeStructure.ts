'use client'

import { useMemo } from 'react'
import { useCustomerPageFieldBindings } from '@/components/product/CustomerPageFieldBindingsProvider'
import {
  DEFAULT_HOME_PAGE_STRUCTURE,
  getActiveHomePageStructure,
  type HomePageStructure,
} from '@/lib/customerPageHomeStructure'
import { loadCustomerPageHomeStructure } from '@/lib/customerPageHomeStructurePersistence'
import { getCustomerPageTemplateById } from '@/lib/customerPageTemplate'
import { loadCustomerPageTemplateId } from '@/lib/customerPageTemplatePersistence'

export function useCustomerPageHomeStructure(): HomePageStructure {
  const { revision } = useCustomerPageFieldBindings()

  return useMemo(() => {
    void revision
    const templateId = loadCustomerPageTemplateId()
    if (templateId) {
      return getCustomerPageTemplateById(templateId).structure
    }
    return getActiveHomePageStructure() ?? loadCustomerPageHomeStructure() ?? DEFAULT_HOME_PAGE_STRUCTURE
  }, [revision])
}
