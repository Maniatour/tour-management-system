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

/** Unbooked multi-day tour hotel market survey (Page + Kanab). */
export type TourHotelRateSurveyStay = {
  stayId: string
  checkIn: string
  checkOut: string
  nightIndex?: number
  tourId?: string
}

export type TourHotelRateSurveyResult = {
  stayId: string
  ok: boolean
  checkIn: string
  checkOut: string
  nightIndex?: number
  tourId?: string
  cheapestPrice?: number
  cheapestHotel?: string
  cheapestDestination?: string
  rates?: TourPriceCheckRateItem[]
  error?: string
  checkedAt?: string
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
   * Page / Kanab bookings: compare booked unit vs cheapest across both cities.
   * When set, UI shows a second badge.
   */
  compareAltCities?: boolean
  cheapestPrice?: number
  cheapestHotel?: string
  cheapestDestination?: string
  /** cheapest − booked */
  cheapestDiff?: number | null
}
