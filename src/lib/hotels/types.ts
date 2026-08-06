/**
 * Hotel Management Module — domain types
 * Tour-ops hotel procurement (not customer booking, not pickup hotels).
 */

export const HOTEL_SUPPLIERS = [
  'wyndham',
  'expedia_taap',
  'hotelbeds',
  'manual',
] as const

export type HotelSupplierCode = (typeof HOTEL_SUPPLIERS)[number]

export type HotelMetadataSource = 'stayapi' | 'manual' | 'supplier'

export type HotelReservationStatus =
  | 'draft'
  | 'pending'
  | 'confirmed'
  | 'cancelled'
  | 'failed'
  | 'needs_manual'

export type HotelSearchParams = {
  supplier?: HotelSupplierCode | undefined
  city?: string | undefined
  query?: string | undefined
  checkIn: string
  checkOut: string
  rooms?: number | undefined
  guests?: number | undefined
  hotelIds?: string[] | undefined
}

export type HotelSearchResult = {
  supplier: HotelSupplierCode
  supplierHotelId: string
  name: string
  address?: string | undefined
  city?: string | undefined
  state?: string | undefined
  country?: string | undefined
  raw?: Record<string, unknown> | undefined
}

export type RateQueryParams = {
  supplierHotelId: string
  checkIn: string
  checkOut: string
  rooms?: number | undefined
  guests?: number | undefined
  roomType?: string | undefined
  /** Destination / hotel name typed into supplier search box */
  destination?: string | undefined
}

export type HotelRateQuote = {
  supplier: HotelSupplierCode
  supplierHotelId: string
  supplierRoomId?: string | undefined
  roomType: string
  bedType?: string | undefined
  capacity?: number | undefined
  stayDate: string
  price: number
  currency: string
  cancellationPolicy?: string | undefined
  raw?: Record<string, unknown> | undefined
}

export type AvailabilityParams = RateQueryParams

export type AvailabilityResult = {
  available: boolean
  supplier: HotelSupplierCode
  supplierHotelId: string
  message?: string | undefined
  quotes?: HotelRateQuote[] | undefined
}

export type CreateReservationParams = {
  supplierHotelId: string
  supplierRoomId?: string | undefined
  checkIn: string
  checkOut: string
  rooms?: number | undefined
  guests: number
  guestName: string
  /** Internal hotel_id once cataloged */
  hotelId?: string | undefined
  roomId?: string | undefined
  dryRun?: boolean | undefined
}

export type SupplierReservationResult = {
  ok: boolean
  status: HotelReservationStatus
  supplier: HotelSupplierCode
  confirmationNumber?: string | undefined
  totalCost?: number | undefined
  currency?: string | undefined
  message?: string | undefined
  artifactPath?: string | undefined
  raw?: Record<string, unknown> | undefined
  needsManualIntervention?: boolean | undefined
}

export type CancelReservationParams = {
  confirmationNumber: string
  reason?: string | undefined
}

export type CancelResult = {
  ok: boolean
  status: HotelReservationStatus
  message?: string | undefined
  artifactPath?: string | undefined
}

export type StatusParams = {
  confirmationNumber: string
}

export type ReservationStatusResult = {
  status: HotelReservationStatus
  confirmationNumber: string
  supplier: HotelSupplierCode
  message?: string | undefined
  raw?: Record<string, unknown> | undefined
}

export type HotelMetadata = {
  name?: string | undefined
  description?: string | undefined
  address?: string | undefined
  city?: string | undefined
  state?: string | undefined
  country?: string | undefined
  latitude?: number | undefined
  longitude?: number | undefined
  images?: string[] | undefined
  amenities?: string[] | undefined
  raw?: Record<string, unknown> | undefined
}

/** DB row shapes (module-owned; keep in sync with migration) */
export type HotelRow = {
  hotel_id: string
  supplier: HotelSupplierCode
  supplier_hotel_id: string
  name: string
  address: string | null
  city: string | null
  state: string | null
  country: string | null
  metadata_source: HotelMetadataSource | null
  metadata_external_id: string | null
  metadata_json: Record<string, unknown>
  is_active: boolean
  created_at: string
  updated_at: string
}

export type HotelRoomRow = {
  room_id: string
  hotel_id: string
  room_type: string
  bed_type: string | null
  capacity: number
  supplier_room_id: string | null
  created_at: string
  updated_at: string
}

export type HotelRateRow = {
  rate_id: string
  hotel_id: string
  room_id: string | null
  supplier: HotelSupplierCode
  stay_date: string
  price: number
  currency: string
  cancellation_policy: string | null
  cancellation_policy_json: Record<string, unknown> | null
  checked_at: string
  created_at: string
}

export type HotelReservationRow = {
  reservation_id: string
  supplier: HotelSupplierCode
  supplier_confirmation_number: string | null
  hotel_id: string
  room_id: string | null
  guest_count: number
  rooms: number
  check_in: string
  check_out: string
  status: HotelReservationStatus
  total_cost: number | null
  currency: string
  guest_name: string | null
  supplier_payload: Record<string, unknown>
  automation_artifact_path: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type TourHotelAssignmentRow = {
  id: string
  tour_id: string
  reservation_id: string
  assigned_date: string
  created_at: string
}

export type HotelPriceAlertRow = {
  id: string
  hotel_id: string
  room_id: string | null
  supplier: HotelSupplierCode
  stay_date: string
  previous_price: number
  new_price: number
  currency: string
  message: string
  notified_at: string | null
  created_at: string
}

export const PRICE_ALERT_DECREASE_THRESHOLD_USD = 20
