'use client'

import { useMemo } from 'react'
import { useCustomerPageFieldBindings } from '@/components/product/CustomerPageFieldBindingsProvider'
import {
  getGlobalThemeById,
  type CustomerPageGlobalThemeDefinition,
} from '@/lib/customerPageGlobalTheme'
import { loadCustomerPageGlobalThemeId } from '@/lib/customerPageGlobalThemePersistence'

export function useCustomerPageGlobalTheme(): CustomerPageGlobalThemeDefinition {
  const { revision } = useCustomerPageFieldBindings()

  return useMemo(() => {
    void revision
    return getGlobalThemeById(loadCustomerPageGlobalThemeId())
  }, [revision])
}
