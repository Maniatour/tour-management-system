'use client'

import {
  resolveZoneUiStyle,
  type ResolvedZoneUiStyle,
  zoneSupportsUiStyle,
} from '@/lib/customerPageZoneUiStyle'
import { resolveCustomerPageZone } from '@/lib/customerPageZoneEditMap'
import { loadZoneUiStylePatch } from '@/lib/customerPageUiStylePersistence'
import { useCustomerPageFieldBindings } from '@/components/product/CustomerPageFieldBindingsProvider'

export function useCustomerPageZoneUiStyle(zone: string): ResolvedZoneUiStyle | null {
  const { revision } = useCustomerPageFieldBindings()
  const resolvedZone = resolveCustomerPageZone(zone)

  if (!zoneSupportsUiStyle(resolvedZone)) {
    return null
  }

  void revision
  const patch = loadZoneUiStylePatch(resolvedZone)
  return resolveZoneUiStyle(resolvedZone, patch)
}
