import type { CustomerReservationPricingData } from '@/components/customer/CustomerReservationPricing'

export interface ProductDetails {  description?: string
  highlights?: string
  included?: string
  not_included?: string
  meeting_point?: string
  cancellation_policy?: string
}

export interface PickupInfo {
  reservation_id: string
  pickup_time: string
  pickup_hotel: string
  hotel: string
  pick_up_location: string
  address?: string
  link?: string
  customer_name: string
  total_people: number
  tour_date?: string
}

export interface PickupSchedule {
  pickup_hotel?: string | null
  pickup_time?: string | null
  tour_date?: string | null
  tour_time?: string | null
  pickup_hotels?: {
    hotel?: string
    pick_up_location?: string
    address?: string
    description_ko?: string
    link?: string
    media?: string | string[]
    youtube_link?: string
  } | null
  allPickups?: PickupInfo[]
}

export interface TourDetails {
  id?: string
  tour_guide_id?: string
  assistant_id?: string
  tour_car_id?: string
  status?: string
  tour_status?: string
  tour_guide?: {
    name_ko?: string
    name_en?: string
    phone?: string
    email?: string
    languages?: string[] | string
  }
  assistant?: {
    name_ko?: string
    name_en?: string
    phone?: string
    email?: string
  }
  vehicle?: {
    vehicle_type?: string
    color?: string
    vehicle_type_info?: {
      name?: string
      brand?: string
      model?: string
      passenger_capacity?: number
      description?: string
    }
    vehicle_type_photos?: {
      photo_url?: string
      photo_name?: string
      description?: string
      is_primary?: boolean
    }[]
  }
}

export interface ProductSchedule {
  id: string
  day_number: number
  start_time: string | null
  end_time: string | null
  title_ko: string | null
  title_en: string | null
  description_ko: string | null
  description_en: string | null
  show_to_customers: boolean
  order_index: number | null
}

export interface ReservationDetails {
  productDetails?: ProductDetails | null
  pickupSchedule?: PickupSchedule | null
  tourDetails?: TourDetails | null
  productSchedules?: ProductSchedule[] | null
}

export interface MultilingualProductDetails {
  description?: string
  slogan1?: string
  slogan2?: string
  slogan3?: string
  included?: string
  not_included?: string
  pickup_drop_info?: string
  luggage_info?: string
  tour_operation_info?: string
  preparation_info?: string
  small_group_info?: string
  notice_info?: string
  private_tour_info?: string
  cancellation_policy?: string
  chat_announcement?: string
}

export interface CustomerReservationCustomer {
  id: string
  name: string
  email: string
  phone: string | null
}

/** 예약 목록 페이지 고객 프로필 (language 등 추가 필드) */
export interface CustomerListCustomer extends CustomerReservationCustomer {
  language: string | null
  created_at: string
}

export interface CustomerReservationChannel {
  id: string
  name: string
  favicon_url?: string
}

export interface CustomerReservationCardData extends CustomerReservationPricingData {
  id: string
  customer_id: string
  customer_email?: string | null
  product_id: string
  tour_date: string
  tour_time?: string | null
  pickup_hotel: string | null
  pickup_time: string | null
  status: string
  event_note: string | null
  channel_id: string | null
  channel_rn: string | null
  created_at: string
  products?: CustomerReservationPricingData['products'] & {
    name: string
    customer_name_ko: string | null
    customer_name_en: string | null
    duration: number | null
  }
  multilingualDetails?: MultilingualProductDetails | null
  pickupHotelInfo?: {
    hotel: string
    pick_up_location: string
    address?: string
  } | null
  reservationChoices?: Array<{
    choice_id: string
    option_id: string
    quantity: number
    total_price: number
    choice?: { id: string; name_ko: string; name_en: string }
    option?: { id: string; name_ko: string; name_en: string }
  }>
}
