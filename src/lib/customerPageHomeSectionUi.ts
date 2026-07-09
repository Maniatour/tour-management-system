import type { CSSProperties } from 'react'
import { resolveZoneUiStyle, zoneUiStyleToCssProperties } from '@/lib/customerPageZoneUiStyle'
import type { CustomerPageZone } from '@/lib/customerPageZones'
import type { HomePageSectionEntry } from '@/lib/customerPageHomeSectionCatalog'
import { getBuiltinZoneId } from '@/lib/customerPageHomeSectionCatalog'

export function sectionPresetToCssProperties(
  section: HomePageSectionEntry
): CSSProperties | undefined {
  const presetId = section.config.uiPresetId
  if (!presetId) return undefined
  const zone = getBuiltinZoneId(section) as CustomerPageZone
  const style = resolveZoneUiStyle(zone, { presetId })
  return zoneUiStyleToCssProperties(style)
}
