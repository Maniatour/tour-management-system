'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import BasicInfoTab from '@/components/product/BasicInfoTab'

function safeJsonParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

type BasicFormData = Parameters<typeof BasicInfoTab>[0]['formData']

const EMPTY_FORM: BasicFormData = {
  name: '',
  productCode: '',
  category: 'nature',
  subCategory: '',
  description: '',
  duration: 1,
  maxParticipants: 10,
  status: 'active',
  departureCity: '',
  arrivalCity: '',
  departureCountry: '',
  arrivalCountry: '',
  languages: ['ko'],
  groupSize: ['private'],
  adultAge: 13,
  childAgeMin: 3,
  childAgeMax: 12,
  infantAge: 2,
  tourDepartureTimes: [],
  customerNameKo: '',
  customerNameEn: '',
  tags: [],
  transportationMethods: [],
  homepagePricingType: 'separate',
}

type CustomerPageProductBasicEmbedProps = {
  productId: string
  onSaved?: () => void
}

export default function CustomerPageProductBasicEmbed({
  productId,
  onSaved,
}: CustomerPageProductBasicEmbedProps) {
  const [formData, setFormData] = useState<BasicFormData>(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const { data, error: fetchError } = await supabase
          .from('products')
          .select('*')
          .eq('id', productId)
          .single()

        if (fetchError) throw fetchError
        if (cancelled || !data) return

        const productData = data as Record<string, unknown>
        const nextForm: BasicFormData = {
          ...EMPTY_FORM,
          name: String(productData.name ?? ''),
          productCode: String(productData.product_code ?? ''),
          category: String(productData.category ?? 'nature'),
          subCategory: String(productData.sub_category ?? ''),
          description: String(productData.description ?? ''),
          duration:
            typeof productData.duration === 'string'
              ? parseInt(productData.duration, 10) || 1
              : Number(productData.duration) || 1,
          basePrice: {
            adult: Number(productData.adult_base_price ?? productData.base_price) || 0,
            child: Number(productData.child_base_price) || 0,
            infant: Number(productData.infant_base_price) || 0,
          },
          basePriceAdult: Number(productData.adult_base_price ?? productData.base_price) || 0,
          basePriceChild: Number(productData.child_base_price) || 0,
          basePriceInfant: Number(productData.infant_base_price) || 0,
          maxParticipants: Number(productData.max_participants) || 10,
          status: (productData.status as BasicFormData['status']) || 'active',
          departureCity: String(productData.departure_city_ko ?? productData.departure_city ?? ''),
          arrivalCity: String(productData.arrival_city_ko ?? productData.arrival_city ?? ''),
          departureCountry: String(productData.departure_country_ko ?? productData.departure_country ?? ''),
          arrivalCountry: String(productData.arrival_country_ko ?? productData.arrival_country ?? ''),
          departureCityKo: String(productData.departure_city_ko ?? productData.departure_city ?? ''),
          departureCityEn: productData.departure_city_en ? String(productData.departure_city_en) : '',
          arrivalCityKo: String(productData.arrival_city_ko ?? productData.arrival_city ?? ''),
          arrivalCityEn: productData.arrival_city_en ? String(productData.arrival_city_en) : '',
          departureCountryKo: String(productData.departure_country_ko ?? productData.departure_country ?? ''),
          departureCountryEn: productData.departure_country_en
            ? String(productData.departure_country_en)
            : '',
          arrivalCountryKo: String(productData.arrival_country_ko ?? productData.arrival_country ?? ''),
          arrivalCountryEn: productData.arrival_country_en ? String(productData.arrival_country_en) : '',
          languages: Array.isArray(productData.languages) ? (productData.languages as string[]) : ['ko'],
          groupSize: productData.group_size
            ? String(productData.group_size).split(',').filter(Boolean)
            : ['private'],
          adultAge: Number(productData.adult_age) || 13,
          childAgeMin: Number(productData.child_age_min) || 3,
          childAgeMax: Number(productData.child_age_max) || 12,
          infantAge: Number(productData.infant_age) || 2,
          tourDepartureTimes: Array.isArray(productData.tour_departure_times)
            ? (productData.tour_departure_times as string[])
            : typeof productData.tour_departure_times === 'string'
              ? safeJsonParse<string[]>(productData.tour_departure_times, [])
              : [],
          customerNameKo: String(productData.customer_name_ko ?? ''),
          customerNameEn: String(productData.customer_name_en ?? ''),
          tags: Array.isArray(productData.tags) ? (productData.tags as string[]) : [],
          transportationMethods: Array.isArray(productData.transportation_methods)
            ? (productData.transportation_methods as string[])
            : [],
          homepagePricingType:
            (productData.homepage_pricing_type as 'single' | 'separate') || 'separate',
        }
        if (productData.name_en) nextForm.nameEn = String(productData.name_en)
        if (productData.summary_ko) nextForm.summaryKo = String(productData.summary_ko)
        if (productData.summary_en) nextForm.summaryEn = String(productData.summary_en)
        if (productData.tour_departure_time) {
          nextForm.tourDepartureTime = String(productData.tour_departure_time)
        }
        setFormData(nextForm)
      } catch (err) {
        if (!cancelled) setError(String(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [productId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        기본정보 불러오는 중…
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-red-600">불러오기 실패: {error}</p>
  }

  return (
    <BasicInfoTab
        formData={{
          ...formData,
          basePrice:
            typeof formData.basePrice === 'object'
              ? formData.basePrice.adult
              : (formData.basePrice as number) || 0,
          homepagePricingType: formData.homepagePricingType ?? 'separate',
        }}
        setFormData={(updater) => {
          setFormData((prev) => {
            const basePrev = {
              ...prev,
              basePrice:
                typeof prev.basePrice === 'object'
                  ? prev.basePrice.adult
                  : (prev.basePrice as number) || 0,
            }
            const next =
              typeof updater === 'function'
                ? (updater as (p: typeof basePrev) => typeof basePrev)(basePrev)
                : updater
            return { ...prev, ...(next as BasicFormData) }
          })
        }}
        productId={productId}
        isNewProduct={false}
        {...(onSaved ? { onSaveSuccess: onSaved } : {})}
      />
  )
}
