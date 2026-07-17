import type { Database } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

type ProductRow = Database['public']['Tables']['products']['Row']

export type AdminProductCardEditSection =
  | 'location'
  | 'basic'
  | 'tour-details'
  | 'pricing'
  | 'media'
  | 'tags'

export type AdminProductCardEditProduct = ProductRow & {
  primary_image?: string | null
  departure_city_ko?: string | null
  departure_city_en?: string | null
  arrival_city_ko?: string | null
  arrival_city_en?: string | null
  departure_country_ko?: string | null
  departure_country_en?: string | null
  arrival_country_ko?: string | null
  arrival_country_en?: string | null
}

export function parseTourDepartureTimes(raw: Json | null | undefined): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.map((value) => String(value))
  return []
}

export function buildDepartureUpdateFields(form: {
  departureCityKo: string
  departureCityEn: string
  arrivalCityKo: string
  arrivalCityEn: string
  departureCountryKo: string
  departureCountryEn: string
  arrivalCountryKo: string
  arrivalCountryEn: string
}) {
  const departureCityKo = form.departureCityKo.trim()
  const departureCityEn = form.departureCityEn.trim() || null
  const arrivalCityKo = form.arrivalCityKo.trim()
  const arrivalCityEn = form.arrivalCityEn.trim() || null
  const departureCountryKo = form.departureCountryKo.trim()
  const departureCountryEn = form.departureCountryEn.trim() || null
  const arrivalCountryKo = form.arrivalCountryKo.trim()
  const arrivalCountryEn = form.arrivalCountryEn.trim() || null

  return {
    departure_city: departureCityKo,
    departure_city_ko: departureCityKo,
    departure_city_en: departureCityEn,
    arrival_city: arrivalCityKo,
    arrival_city_ko: arrivalCityKo,
    arrival_city_en: arrivalCityEn,
    departure_country: departureCountryKo,
    departure_country_ko: departureCountryKo,
    departure_country_en: departureCountryEn,
    arrival_country: arrivalCountryKo,
    arrival_country_ko: arrivalCountryKo,
    arrival_country_en: arrivalCountryEn,
  }
}

export function productToLocationForm(product: AdminProductCardEditProduct) {
  const record = product as Record<string, unknown>
  return {
    departureCityKo: String(record.departure_city_ko ?? product.departure_city ?? ''),
    departureCityEn: String(record.departure_city_en ?? ''),
    arrivalCityKo: String(record.arrival_city_ko ?? product.arrival_city ?? ''),
    arrivalCityEn: String(record.arrival_city_en ?? ''),
    departureCountryKo: String(record.departure_country_ko ?? product.departure_country ?? ''),
    departureCountryEn: String(record.departure_country_en ?? ''),
    arrivalCountryKo: String(record.arrival_country_ko ?? product.arrival_country ?? ''),
    arrivalCountryEn: String(record.arrival_country_en ?? ''),
  }
}

export function productToBasicForm(product: AdminProductCardEditProduct) {
  return {
    name: product.name ?? '',
    nameEn: product.name_en ?? '',
    customerNameKo: product.customer_name_ko ?? '',
    customerNameEn: product.customer_name_en ?? '',
    productCode: product.product_code ?? '',
    status: (product.status ?? 'inactive') as 'active' | 'inactive' | 'draft',
    category: product.category ?? '',
    subCategory: product.sub_category ?? '',
    summaryKo: product.summary_ko ?? '',
    summaryEn: product.summary_en ?? '',
  }
}

export function productToTourDetailsForm(product: AdminProductCardEditProduct) {
  return {
    duration: product.duration ?? '',
    maxParticipants: product.max_participants ?? 1,
    tourDepartureTimes: parseTourDepartureTimes(product.tour_departure_times),
  }
}

export function productToPricingForm(product: AdminProductCardEditProduct) {
  return {
    basePrice: product.base_price ?? 0,
    adultBasePrice: product.adult_base_price ?? product.base_price ?? 0,
    childBasePrice: product.child_base_price ?? 0,
    infantBasePrice: product.infant_base_price ?? 0,
    homepagePricingType: (product.homepage_pricing_type === 'single' ? 'single' : 'separate') as
      | 'single'
      | 'separate',
  }
}

export async function fetchProductPrimaryImage(productId: string): Promise<string | null> {
  const { data: mediaData } = await supabase
    .from('product_media')
    .select('file_url')
    .eq('product_id', productId)
    .eq('file_type', 'image')
    .eq('is_active', true)
    .eq('is_primary', true)
    .maybeSingle()

  if (mediaData && 'file_url' in mediaData && mediaData.file_url) {
    return String(mediaData.file_url)
  }

  const { data: firstMediaData } = await supabase
    .from('product_media')
    .select('file_url')
    .eq('product_id', productId)
    .eq('file_type', 'image')
    .eq('is_active', true)
    .order('order_index', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (firstMediaData && 'file_url' in firstMediaData && firstMediaData.file_url) {
    return String(firstMediaData.file_url)
  }

  return null
}
