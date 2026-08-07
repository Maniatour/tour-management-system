export type TourPriceCheckJob = {
  bookingId: string
  hotel: string
  city?: string | null
  checkIn: string
  checkOut: string
  bookedUnitPrice?: number | null
  rooms?: number
}

export type TourPriceCheckRateItem = {
  roomType: string
  price: number
  matched?: boolean
}

export type TourPriceCheckResult = {
  bookingId: string
  ok: boolean
  marketPrice?: number
  roomType?: string
  bookedUnit?: number | null
  diff?: number | null
  rates?: TourPriceCheckRateItem[]
  error?: string
  destination?: string
  /** Linked hotels.hotel_id when persisted / hydrated from hotel_rates */
  hotelId?: string
  checkedAt?: string
}
