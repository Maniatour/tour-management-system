import type { PickupHotel } from '@/utils/pickupHotelUtils'
import {
  PICKUP_ACCESS_CLASSES,
  getPickupAccessClassLabel,
  type PickupAccessClass,
} from '@/lib/pickupAccessClass'

export type { PickupAccessClass }
export { PICKUP_ACCESS_CLASSES, getPickupAccessClassLabel }

/** NULL/empty = all access classes may enter */
export function isAllPickupAccessClassesAllowed(hotel: PickupHotel): boolean {
  return (
    !hotel.allowed_pickup_access_classes || hotel.allowed_pickup_access_classes.length === 0
  )
}

export function isPickupAccessClassAllowedAtHotel(
  hotel: PickupHotel,
  accessClass: PickupAccessClass | null | undefined
): boolean {
  if (!accessClass) return true
  if (isAllPickupAccessClassesAllowed(hotel)) return true
  return hotel.allowed_pickup_access_classes!.includes(accessClass)
}

export function getAllowedPickupAccessClasses(hotel: PickupHotel): PickupAccessClass[] {
  if (isAllPickupAccessClassesAllowed(hotel)) return [...PICKUP_ACCESS_CLASSES]
  return PICKUP_ACCESS_CLASSES.filter((c) => hotel.allowed_pickup_access_classes!.includes(c))
}

export function getBlockedPickupAccessClasses(hotel: PickupHotel): PickupAccessClass[] {
  if (isAllPickupAccessClassesAllowed(hotel)) return []
  const allowed = new Set(hotel.allowed_pickup_access_classes)
  return PICKUP_ACCESS_CLASSES.filter((c) => !allowed.has(c))
}

export function filterHotelsByPickupAccessClass(
  hotels: PickupHotel[],
  accessClass: PickupAccessClass | null,
  mode: 'allowed' | 'blocked' | 'all'
): PickupHotel[] {
  if (!accessClass || mode === 'all') return hotels
  return hotels.filter((hotel) => {
    const allowed = isPickupAccessClassAllowedAtHotel(hotel, accessClass)
    return mode === 'allowed' ? allowed : !allowed
  })
}

export interface PickupLocationDescriptionFields {
  description?: string | null
  fromInside?: string | null
  fromOutside?: string | null
}

export function getPickupLocationDescriptionFields(
  hotel: PickupHotel,
  locale: 'ko' | 'en'
): PickupLocationDescriptionFields {
  const isKo = locale === 'ko'
  return {
    description: isKo ? hotel.description_ko : hotel.description_en,
    fromInside: isKo ? hotel.from_inside_hotel_ko : hotel.from_inside_hotel_en,
    fromOutside: isKo ? hotel.from_outside_hotel_ko : hotel.from_outside_hotel_en,
  }
}

export function hasPickupLocationDescription(hotel: PickupHotel): boolean {
  return Boolean(
    hotel.description_ko ||
      hotel.description_en ||
      hotel.from_inside_hotel_ko ||
      hotel.from_inside_hotel_en ||
      hotel.from_outside_hotel_ko ||
      hotel.from_outside_hotel_en
  )
}

export function formatPickupLocationDescriptionText(
  hotel: PickupHotel,
  locale: 'ko' | 'en'
): string {
  const fields = getPickupLocationDescriptionFields(hotel, locale)
  const lines: string[] = []

  if (fields.description?.trim()) {
    lines.push('Location Description:', fields.description.trim(), '')
  }

  if (fields.fromInside?.trim()) {
    lines.push('From Inside Hotel:', fields.fromInside.trim(), '')
  }

  if (fields.fromOutside?.trim()) {
    lines.push('From Outside Hotel:', fields.fromOutside.trim())
  }

  return lines.join('\n').trim()
}

export function formatPickupLocationDescriptionHtml(
  hotel: PickupHotel,
  locale: 'ko' | 'en'
): string {
  const fields = getPickupLocationDescriptionFields(hotel, locale)
  const sections: string[] = []

  if (fields.description?.trim()) {
    sections.push(`
      <p style="margin: 0 0 4px; font-weight: 600; color: #374151;">Location Description:</p>
      <p style="margin: 0 0 12px; color: #4b5563; white-space: pre-line;">${escapeHtml(fields.description.trim())}</p>
    `)
  }

  if (fields.fromInside?.trim()) {
    sections.push(`
      <p style="margin: 0 0 4px; font-weight: 600; color: #374151;">From Inside Hotel:</p>
      <p style="margin: 0 0 12px; color: #4b5563; white-space: pre-line;">${escapeHtml(fields.fromInside.trim())}</p>
    `)
  }

  if (fields.fromOutside?.trim()) {
    sections.push(`
      <p style="margin: 0 0 4px; font-weight: 600; color: #374151;">From Outside Hotel:</p>
      <p style="margin: 0; color: #4b5563; white-space: pre-line;">${escapeHtml(fields.fromOutside.trim())}</p>
    `)
  }

  return sections.join('')
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
