import type { PickupHotel } from '@/utils/pickupHotelUtils'
import {
  PICKUP_ACCESS_CLASSES,
  getPickupAccessClassLabel,
  type PickupAccessClass,
} from '@/lib/pickupAccessClass'
import { parseDirectionSteps } from '@/lib/pickupHotelDirectionSteps'

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

function buildDirectionStepsEmailHtml(
  text: string | null | undefined,
  accent: 'blue' | 'green'
): string {
  const steps = parseDirectionSteps(text)
  if (steps.length === 0) return ''

  const badgeBg = accent === 'green' ? '#10b981' : '#2563eb'

  const stepsHtml = steps
    .map(
      (step, index) => `
    <tr>
      <td style="vertical-align: top; padding: 0 0 10px 0; width: 32px;">
        <div style="width: 24px; height: 24px; background: ${badgeBg}; color: #ffffff; border-radius: 50%; font-size: 12px; font-weight: 600; line-height: 24px; text-align: center;">
          ${index + 1}
        </div>
      </td>
      <td style="vertical-align: top; padding: 2px 0 10px 8px; font-size: 14px; line-height: 1.6; color: #334155;">
        ${escapeHtml(step)}
      </td>
    </tr>`
    )
    .join('')

  return `<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="width: 100%;">${stepsHtml}</table>`
}

export function formatPickupLocationDescriptionHtml(
  hotel: PickupHotel,
  locale: 'ko' | 'en'
): string {
  const fields = getPickupLocationDescriptionFields(hotel, locale)
  const sections: string[] = []

  if (fields.description?.trim()) {
    sections.push(`
      <div style="overflow: hidden; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff; margin-bottom: 12px;">
        <div style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #2563eb; font-size: 14px; font-weight: 600;">
          📍 Location Description
        </div>
        <div style="padding: 12px 14px; background: rgba(239, 246, 255, 0.8);">
          <p style="margin: 0; font-size: 14px; line-height: 1.65; color: #334155; white-space: pre-line;">${escapeHtml(fields.description.trim())}</p>
        </div>
      </div>
    `)
  }

  if (fields.fromInside?.trim()) {
    sections.push(`
      <div style="overflow: hidden; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff; margin-bottom: 12px;">
        <div style="padding: 10px 14px; background: #eff6ff; color: #2563eb; font-size: 14px; font-weight: 600;">
          🏨 From Inside Hotel
        </div>
        <div style="padding: 12px 14px;">
          ${buildDirectionStepsEmailHtml(fields.fromInside, 'blue')}
        </div>
      </div>
    `)
  }

  if (fields.fromOutside?.trim()) {
    sections.push(`
      <div style="overflow: hidden; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
        <div style="padding: 10px 14px; background: #ecfdf5; color: #059669; font-size: 14px; font-weight: 600;">
          👣 From Outside Hotel
        </div>
        <div style="padding: 12px 14px;">
          ${buildDirectionStepsEmailHtml(fields.fromOutside, 'green')}
        </div>
      </div>
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
