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
  cheapest?: boolean
  /** Page AZ / Kanab UT */
  destination?: string
}

export type TourPriceCheckResult = {
  bookingId: string
  ok: boolean
  marketPrice?: number
  roomType?: string
  bookedUnit?: number | null
  /** Same-hotel market − booked (primary badge) */
  diff?: number | null
  rates?: TourPriceCheckRateItem[]
  error?: string
  destination?: string
  hotelId?: string
  checkedAt?: string
  /**
   * Page bookings: compare booked unit vs cheapest Page+Kanab property.
   * When set, UI shows a second badge.
   */
  compareAltCities?: boolean
  cheapestPrice?: number
  cheapestHotel?: string
  cheapestDestination?: string
  /** cheapest − booked */
  cheapestDiff?: number | null
}
