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

export function getPickupHotelNameById(
  hotelId: string | null | undefined,
  pickupHotels: Array<{ id: string; hotel: string }>
): string {
  if (!hotelId) return ''
  return pickupHotels.find((h) => h.id === hotelId)?.hotel ?? ''
}
