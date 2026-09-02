import { supabase } from '@/lib/supabase'
import { isPickupHotelSelectable, type PickupHotel } from '@/utils/pickupHotelUtils'

export type CustomerPickupHotelLocation = PickupHotel & {
  latitude: number
  longitude: number
}

export function parsePickupHotelPin(pin: string | null | undefined) {
  if (!pin?.trim()) return null
  const [latRaw, lngRaw] = pin.split(',').map((part) => part.trim())
  const latitude = Number.parseFloat(latRaw ?? '')
  const longitude = Number.parseFloat(lngRaw ?? '')
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  return { latitude, longitude }
}

export function toCustomerPickupHotelLocation(
  hotel: PickupHotel
): CustomerPickupHotelLocation | null {
  const coords = parsePickupHotelPin(hotel.pin)
  if (!coords) return null
  return { ...hotel, ...coords }
}

export type CustomerPickupHotelOption = {
  id: string
  hotel: string
  pick_up_location: string | null
  address: string | null
}

type PickupHotelSearchFields = {
  hotel?: string | null
  pick_up_location?: string | null
  address?: string | null
}

export function filterCustomerPickupHotels<T extends PickupHotelSearchFields>(
  hotels: T[],
  query: string
): T[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return hotels

  return hotels.filter((hotel) => {
    const haystack = [hotel.hotel, hotel.pick_up_location, hotel.address]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return haystack.includes(normalized)
  })
}

export function formatCustomerPickupHotelLabel(hotel: CustomerPickupHotelOption): string {
  return `${hotel.hotel}${hotel.pick_up_location ? ` · ${hotel.pick_up_location}` : ''}`
}

async function fetchActivePickupHotels() {
  const { data, error } = await supabase
    .from('pickup_hotels')
    .select(
      'id, hotel, pick_up_location, address, pin, link, group_number, is_active, use_for_pickup, description_ko, description_en'
    )
    .eq('is_active', true)
    .order('hotel', { ascending: true })

  if (error) throw error
  return (data as PickupHotel[]).filter(isPickupHotelSelectable)
}

export async function fetchSelectablePickupHotels(): Promise<CustomerPickupHotelOption[]> {
  const hotels = await fetchActivePickupHotels()
  return hotels.map((hotel) => ({
    id: hotel.id,
    hotel: hotel.hotel,
    pick_up_location: hotel.pick_up_location ?? null,
    address: hotel.address ?? null,
  }))
}

export async function fetchCustomerPickupHotels() {
  const hotels = await fetchActivePickupHotels()
  return hotels
    .map(toCustomerPickupHotelLocation)
    .filter((hotel): hotel is CustomerPickupHotelLocation => Boolean(hotel))
}
