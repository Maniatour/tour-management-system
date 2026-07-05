'use client'

import type { PickupHotel } from '@/utils/pickupHotelUtils'
import {
  getPickupLocationDescriptionFields,
  hasPickupLocationDescription,
} from '@/lib/pickupHotelVehicleAccess'

interface PickupHotelLocationDescriptionDisplayProps {
  hotel: PickupHotel
  locale?: 'ko' | 'en'
  compact?: boolean
}

export default function PickupHotelLocationDescriptionDisplay({
  hotel,
  locale = 'ko',
  compact = false,
}: PickupHotelLocationDescriptionDisplayProps) {
  if (!hasPickupLocationDescription(hotel)) return null

  const fields = getPickupLocationDescriptionFields(hotel, locale)
  const sectionClass = compact ? 'text-xs' : 'text-sm'

  return (
    <div className={`space-y-2 ${sectionClass}`}>
      {fields.description?.trim() && (
        <div>
          <p className="font-medium text-gray-800">Location Description:</p>
          <p className="text-gray-700 whitespace-pre-line">{fields.description.trim()}</p>
        </div>
      )}
      {fields.fromInside?.trim() && (
        <div>
          <p className="font-medium text-gray-800">From Inside Hotel:</p>
          <p className="text-gray-700 whitespace-pre-line">{fields.fromInside.trim()}</p>
        </div>
      )}
      {fields.fromOutside?.trim() && (
        <div>
          <p className="font-medium text-gray-800">From Outside Hotel:</p>
          <p className="text-gray-700 whitespace-pre-line">{fields.fromOutside.trim()}</p>
        </div>
      )}
    </div>
  )
}
