import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { logSupabaseStatus } from '@/lib/supabaseHealthCheck'
import { throttledSupabaseRequest } from '@/lib/requestThrottle'
import { getCachedOrFetch, cacheKeys } from '@/lib/dataCache'
import { useOptimizedData } from './useOptimizedData'
import type { Database } from '@/lib/supabase'
import type { 
  Customer, 
  Product, 
  Channel, 
  ProductOption, 
  ProductOptionChoice, 
  Option, 
  PickupHotel, 
  Reservation 
} from '@/types/reservation'

export function useReservationData() {
  // 최적화된 데이터 로딩
  const { data: customers = [], loading: customersLoading, refetch: refetchCustomers } = useOptimizedData({
    fetchFn: async () => {
      let allCustomers: Customer[] = []
      let from = 0
      const pageSize = 1000
      let hasMore = true

      while (hasMore) {
        const { data, error } = await supabase
          .from('customers')
          .select('*')
          .order('created_at', { ascending: false })
          .range(from, from + pageSize - 1)

        if (error) {
          console.warn('Error fetching customers:', error)
          break
        }

        if (data && data.length > 0) {
          allCustomers = [...allCustomers, ...data]
          from += pageSize
          hasMore = data.length >= pageSize
        } else {
          hasMore = false
        }
      }

      return allCustomers
    },
    cacheKey: 'reservation-customers',
    cacheTime: 5 * 60 * 1000 // 5분 캐시
  })

  const { data: products = [], loading: productsLoading, refetch: refetchProducts } = useOptimizedData({
    fetchFn: async () => {
      let allProducts: Product[] = []
      let from = 0
      const pageSize = 1000
      let hasMore = true

      while (hasMore) {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .order('name', { ascending: true })
          .range(from, from + pageSize - 1)

        if (error) {
          console.warn('Error fetching products:', error)
          break
        }

        if (data && data.length > 0) {
          allProducts = [...allProducts, ...data]
          from += pageSize
          hasMore = data.length >= pageSize
        } else {
          hasMore = false
        }
      }

      return allProducts
    },
    cacheKey: 'reservation-products',
    cacheTime: 10 * 60 * 1000 // 10분 캐시
  })

  const { data: channels = [], loading: channelsLoading, refetch: refetchChannels } = useOptimizedData({
    fetchFn: async () => {
      const { data, error } = await supabase
        .from('channels')
        .select('id, name, type, favicon_url')
        .order('name', { ascending: true })

      if (error) {
        console.warn('Error fetching channels:', error)
        return []
      }

      console.log('Fetched channels with favicon_url:', data?.map(ch => ({ name: ch.name, favicon_url: ch.favicon_url })))
      return data || []
    },
    cacheKey: 'reservation-channels',
    cacheTime: 0 // 캐시 비활성화로 최신 데이터 가져오기
  })

  const { data: productOptions = [], loading: productOptionsLoading, refetch: refetchProductOptions } = useOptimizedData({
    fetchFn: async () => {
      const { data, error } = await supabase
        .from('product_options')
        .select('*')
        .order('name', { ascending: true })

      if (error) {
        console.warn('Error fetching product options:', error)
        return []
      }

      return data || []
    },
    cacheKey: 'reservation-product-options',
    cacheTime: 10 * 60 * 1000 // 10분 캐시
  })

  const { data: optionChoices = [], loading: optionChoicesLoading, refetch: refetchOptionChoices } = useOptimizedData({
    fetchFn: async () => {
      const { data, error } = await supabase
        .from('product_options')
        .select(`
          id,
          name,
          description,
          choice_name,
          choice_description,
          adult_price_adjustment,
          child_price_adjustment,
          infant_price_adjustment,
          is_default,
          product_id
        `)
        .order('name', { ascending: true })

      if (error) {
        console.warn('Error fetching option choices:', error)
        return []
      }
      
      const transformedChoices = (data || []).map(item => ({
        id: item.id,
        name: item.choice_name || item.name,
        description: item.choice_description || item.description,
        adult_price_adjustment: item.adult_price_adjustment,
        child_price_adjustment: item.child_price_adjustment,
        infant_price_adjustment: item.infant_price_adjustment,
        is_default: item.is_default,
        product_option_id: item.id,
        created_at: item.created_at,
        updated_at: item.updated_at
      }))
      
      return transformedChoices
    },
    cacheKey: 'reservation-option-choices',
    cacheTime: 10 * 60 * 1000 // 10분 캐시
  })

  const { data: options = [], loading: optionsLoading, refetch: refetchOptions } = useOptimizedData({
    fetchFn: async () => {
      const { data, error } = await supabase
        .from('options')
        .select('*')
        .order('name', { ascending: true })

      if (error) {
        console.warn('Error fetching options:', error)
        return []
      }

      return data || []
    },
    cacheKey: 'reservation-options',
    cacheTime: 10 * 60 * 1000 // 10분 캐시
  })

  const { data: pickupHotels = [], loading: pickupHotelsLoading, refetch: refetchPickupHotels } = useOptimizedData({
    fetchFn: async () => {
      const { data, error } = await supabase
        .from('pickup_hotels')
        .select('*')
        .eq('is_active', true)
        .order('hotel', { ascending: true })

      if (error) {
        console.warn('Error fetching pickup hotels:', error)
        return []
      }

      return data || []
    },
    cacheKey: 'reservation-pickup-hotels',
    cacheTime: 10 * 60 * 1000 // 10분 캐시
  })

  const { data: coupons = [], loading: couponsLoading, refetch: refetchCoupons } = useOptimizedData({
    fetchFn: async () => {
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('status', 'active')
        .order('coupon_code', { ascending: true })

      if (error) {
        console.warn('Error fetching coupons:', error)
        return []
      }

      return data || []
    },
    cacheKey: 'reservation-coupons',
    cacheTime: 5 * 60 * 1000 // 5분 캐시
  })

  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loadingProgress, setLoadingProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 })

  const loading = customersLoading || productsLoading || channelsLoading || productOptionsLoading || optionChoicesLoading || optionsLoading || pickupHotelsLoading || couponsLoading

  // 예약 데이터 로딩 (복잡한 로직 유지)

  const fetchReservations = async () => {
    try {
      console.log('예약 데이터 로딩 시작...')
      
      // 먼저 총 개수를 가져오기
      const { count } = await supabase
        .from('reservations')
        .select('*', { count: 'exact', head: true })

      const totalCount = count || 0
      console.log(`총 예약 수: ${totalCount}개`)
      
      // 진행률 초기화
      setLoadingProgress({ current: 0, total: totalCount })
      
      // 모든 예약 데이터를 페이지네이션으로 로드
      let allReservations: Reservation[] = []
      let from = 0
      const pageSize = 1000
      let hasMore = true

      while (hasMore) {
        console.log(`예약 데이터 로딩: ${from} ~ ${from + pageSize - 1}`)
        
        const { data, error } = await supabase
          .from('reservations')
          .select('*, choices')
          .order('created_at', { ascending: false })
          .range(from, from + pageSize - 1)

        if (error) {
          console.warn('Error fetching reservations, using fallback data:', error)
          return
        }

        if (data && data.length > 0) {
          // choices 데이터가 있는 예약들 로그
          const reservationsWithChoices = data.filter((res: Reservation) => res.choices && Object.keys(res.choices).length > 0)
          if (reservationsWithChoices.length > 0) {
            console.log(`Found ${reservationsWithChoices.length} reservations with choices:`, reservationsWithChoices.map((r: Reservation) => ({
              id: r.id,
              product_id: r.product_id,
              choices: r.choices
            })))
          }
          
          allReservations = [...allReservations, ...data]
          console.log(`예약 데이터 로딩 완료: ${data.length}개 추가, 총 ${allReservations.length}개`)
          
          // 진행률 업데이트
          setLoadingProgress({ current: allReservations.length, total: totalCount })
          
          from += pageSize
          // 더 안전한 종료 조건: 데이터가 페이지 크기보다 적으면 마지막 페이지
          hasMore = data.length >= pageSize
        } else {
          hasMore = false
        }
      }

      console.log(`전체 예약 데이터 로딩 완료: ${allReservations.length}개`)

      // 모든 상품 정보를 캐시에서 가져오기 또는 새로 로드
      const allProducts = await getCachedOrFetch(
        cacheKeys.productSubCategories(),
        async () => {
          const { data } = await throttledSupabaseRequest(() =>
            supabase
              .from('products')
              .select('id, sub_category')
              .in('id', allReservations.map(r => r.product_id).filter(Boolean))
          )
          return data || []
        },
        10 * 60 * 1000 // 10분 캐시
      )

      // 상품 정보를 Map으로 변환하여 빠른 조회 가능하게 함
      const productMap = new Map(
        allProducts.map(p => [p.id, p.sub_category])
      )

      // 모든 투어 정보를 한 번에 가져오기 (Mania Tour/Service만, 캐시 사용)
      const maniaProductIds = Array.from(productMap.entries())
        .filter(([_, subCategory]) => subCategory === 'Mania Tour' || subCategory === 'Mania Service')
        .map(([id, _]) => id)

      const allTours = await getCachedOrFetch(
        cacheKeys.tours(maniaProductIds, allReservations.map(r => r.tour_date).filter(Boolean)),
        async () => {
          const { data } = await throttledSupabaseRequest(() =>
            supabase
              .from('tours')
              .select('product_id, tour_date')
              .in('product_id', maniaProductIds)
              .in('tour_date', allReservations.map(r => r.tour_date).filter(Boolean))
          )
          return data || []
        },
        5 * 60 * 1000 // 5분 캐시
      )

      // 투어 존재 여부를 Map으로 변환
      const tourMap = new Map(
        allTours.map(t => [`${t.product_id}-${t.tour_date}`, true])
      )

      // 예약 데이터 매핑 (개별 요청 없이)
      const mappedReservations: Reservation[] = allReservations.map((item) => {
        const subCategory = productMap.get(item.product_id)
        const isManiaTour = subCategory === 'Mania Tour' || subCategory === 'Mania Service'
        const hasExistingTour = isManiaTour ? tourMap.has(`${item.product_id}-${item.tour_date}`) : false

        return {
          id: item.id,
          customerId: item.customer_id || '',
          productId: item.product_id || '',
          tourDate: item.tour_date || '',
          tourTime: item.tour_time || '',
          eventNote: item.event_note || '',
          pickUpHotel: item.pickup_hotel || '',
          pickUpTime: item.pickup_time || '',
          adults: item.adults || 0,
          child: item.child || 0,
          infant: item.infant || 0,
          totalPeople: item.total_people || 0,
          channelId: item.channel_id || '',
          channelRN: item.channel_rn || '',
          addedBy: item.added_by || '',
          addedTime: item.created_at || '',
          tourId: item.tour_id || '',
          status: (item.status as 'pending' | 'confirmed' | 'completed' | 'cancelled') || 'pending',
          selectedOptions: (typeof item.selected_options === 'string'
            ? (() => { try { return JSON.parse(item.selected_options as unknown as string) } catch { return {} } })()
            : (item.selected_options as { [optionId: string]: string[] }) || {}),
          selectedOptionPrices: (typeof item.selected_option_prices === 'string'
            ? (() => { try { return JSON.parse(item.selected_option_prices as unknown as string) } catch { return {} } })()
            : (item.selected_option_prices as { [key: string]: number }) || {}),
          choices: item.choices || null,
          hasExistingTour
        }
      })

      setReservations(mappedReservations)
      console.log(`예약 데이터 매핑 완료: ${mappedReservations.length}개`)
    } catch (error) {
      console.warn('Error fetching reservations, using fallback data:', error)
      setReservations([])
    }
  }

  // 예약 데이터만 별도로 로드
  useEffect(() => {
    fetchReservations()
  }, [])

  return {
    // 데이터
    reservations,
    customers,
    products,
    channels,
    productOptions,
    optionChoices,
    options,
    pickupHotels,
    coupons,
    loading,
    loadingProgress,
    
    // 리프레시 함수들
    refreshReservations: fetchReservations,
    refreshCustomers: refetchCustomers,
    refreshProducts: refetchProducts,
    refreshChannels: refetchChannels,
    refreshProductOptions: refetchProductOptions,
    refreshOptionChoices: refetchOptionChoices,
    refreshOptions: refetchOptions,
    refreshPickupHotels: refetchPickupHotels,
    refreshCoupons: refetchCoupons,
    refreshAll: () => {
      refetchCustomers()
      refetchProducts()
      refetchChannels()
      refetchProductOptions()
      refetchOptionChoices()
      refetchOptions()
      refetchPickupHotels()
      refetchCoupons()
      fetchReservations()
    }
  }
}
