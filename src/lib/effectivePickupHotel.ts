export {
  getEffectivePickupHotelId,
  isPickupRedirected,
  getMainGroupFromHotelId,
  getPickupModeForGroup,
  buildPickupResolveContextFromTour,
  resolvePickupContext,
  type PickupResolveContext,
  type PickupGroupMode,
} from '@/lib/pickupGroupPreset'

import { getPickupHotelPrimaryName } from '@/utils/pickupHotelUtils'

export function getPickupHotelNameById(
  hotelId: string | null | undefined,
  pickupHotels: Array<{ id: string; hotel: string; internal_name?: string | null }>,
  options?: { preferInternalName?: boolean }
): string {
  if (!hotelId) return ''
  const hotel = pickupHotels.find((h) => h.id === hotelId)
  if (!hotel) return ''
  return options?.preferInternalName ? getPickupHotelPrimaryName(hotel) : (hotel.hotel ?? '')
}
