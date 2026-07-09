'use client'

import { useMemo } from 'react'
import { useCustomerPageFieldBindings } from '@/components/product/CustomerPageFieldBindingsProvider'
import {
  detectMatchingTemplateId,
  getCustomerPageTemplateById,
  type CustomerPageTemplateDefinition,
} from '@/lib/customerPageTemplate'
import { getActiveHomePageStructure } from '@/lib/customerPageHomeStructure'
import { loadCustomerPageGlobalThemeId } from '@/lib/customerPageGlobalThemePersistence'
import { loadCustomerPageHomeLayout } from '@/lib/customerPageLayoutPersistence'
import { loadCustomerPageTemplateId } from '@/lib/customerPageTemplatePersistence'

export type CustomerPageTemplateState = {
  savedTemplateId: string | null
  effectiveTemplate: CustomerPageTemplateDefinition | null
  isCustomized: boolean
}

export function useCustomerPageTemplate(): CustomerPageTemplateState {
  const { revision } = useCustomerPageFieldBindings()

  return useMemo(() => {
    void revision
    const savedTemplateId = loadCustomerPageTemplateId()
    const themeId = loadCustomerPageGlobalThemeId()
    const homeLayout = loadCustomerPageHomeLayout()
    const structure = getActiveHomePageStructure()
    const matchedId = detectMatchingTemplateId(themeId, homeLayout, structure)
    const effectiveId = matchedId ?? savedTemplateId

    if (!effectiveId) {
      return {
        savedTemplateId,
        effectiveTemplate: null,
        isCustomized: true,
      }
    }

    const template = getCustomerPageTemplateById(effectiveId)
    const isCustomized = matchedId === null

    return {
      savedTemplateId,
      effectiveTemplate: isCustomized ? null : template,
      isCustomized,
    }
  }, [revision])
}
