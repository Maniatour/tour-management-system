import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { logSupabaseStatus } from '@/lib/supabaseHealthCheck'
import { throttledSupabaseRequest } from '@/lib/requestThrottle'
import { getCachedOrFetch, cacheKeys } from '@/lib/dataCache'
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
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [productOptions, setProductOptions] = useState<ProductOption[]>([])
  const [optionChoices, setOptionChoices] = useState<ProductOptionChoice[]>([])
  const [options, setOptions] = useState<Option[]>([])
  const [pickupHotels, setPickupHotels] = useState<PickupHotel[]>([])
  const [coupons, setCoupons] = useState<Database['public']['Tables']['coupons']['Row'][]>([])
  const [loading, setLoading] = useState(true)
  const [loadingProgress, setLoadingProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 })

  // 데이터 fetching 함수들
  const fetchCustomers = async () => {
    try {
      console.log('고객 데이터 로딩 시작...')
      
      // Supabase 연결 테스트 (제한된 요청)
      const { data: testData, error: testError } = await throttledSupabaseRequest(() =>
        supabase
          .from('customers')
          .select('count', { count: 'exact', head: true })
      )

      if (testError) {
        console.warn('Supabase connection failed, using fallback data:', testError)
        // 폴백 데이터 설정
        setCustomers([])
        return
      }

      const totalCount = testData || 0
      console.log(`총 고객 수: ${totalCount}개`)
      
      // 모든 고객 데이터를 페이지네이션으로 로드
      let allCustomers: any[] = []
      let from = 0
      const pageSize = 1000
      let hasMore = true

      while (hasMore) {
        console.log(`고객 데이터 로딩: ${from} ~ ${from + pageSize - 1}`)
        
        const { data, error } = await supabase
          .from('customers')
          .select('*')
          .order('created_at', { ascending: false })
          .range(from, from + pageSize - 1)

        if (error) {
          console.warn('Error fetching customers, using fallback data:', error)
          setCustomers([])
          return
        }

        if (data && data.length > 0) {
          allCustomers = [...allCustomers, ...data]
          console.log(`고객 데이터 로딩 완료: ${data.length}개 추가, 총 ${allCustomers.length}개`)
          
          from += pageSize
          hasMore = data.length >= pageSize
        } else {
          hasMore = false
        }
      }

      console.log(`전체 고객 데이터 로딩 완료: ${allCustomers.length}개`)
      setCustomers(allCustomers)
    } catch (error) {
      console.warn('Error fetching customers, using fallback data:', error)
      // 빈 배열로 설정하여 앱이 크래시되지 않도록 함
      setCustomers([])
    }
  }

  const fetchProducts = async () => {
    try {
      console.log('상품 데이터 로딩 시작...')
      
      // Supabase 연결 테스트
      const { data: testData, error: testError } = await supabase
        .from('products')
        .select('count', { count: 'exact', head: true })

      if (testError) {
        console.warn('Supabase connection failed, using fallback data:', testError)
        setProducts([])
        return
      }

      const totalCount = testData || 0
      console.log(`총 상품 수: ${totalCount}개`)
      
      // 모든 상품 데이터를 페이지네이션으로 로드
      let allProducts: any[] = []
      let from = 0
      const pageSize = 1000
      let hasMore = true

      while (hasMore) {
        console.log(`상품 데이터 로딩: ${from} ~ ${from + pageSize - 1}`)
        
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .order('name', { ascending: true })
          .range(from, from + pageSize - 1)

        if (error) {
          console.warn('Error fetching products, using fallback data:', error)
          setProducts([])
          return
        }

        if (data && data.length > 0) {
          allProducts = [...allProducts, ...data]
          console.log(`상품 데이터 로딩 완료: ${data.length}개 추가, 총 ${allProducts.length}개`)
          
          from += pageSize
          hasMore = data.length >= pageSize
        } else {
          hasMore = false
        }
      }

      console.log(`전체 상품 데이터 로딩 완료: ${allProducts.length}개`)
      setProducts(allProducts)
    } catch (error) {
      console.warn('Error fetching products, using fallback data:', error)
      setProducts([])
    }
  }

  const fetchChannels = async () => {
    try {
      console.log('채널 데이터 로딩 시작...')
      
      const { data, error } = await supabase
        .from('channels')
        .select('*')
        .order('name', { ascending: true })

      if (error) {
        console.warn('Error fetching channels, using fallback data:', error)
        setChannels([])
        return
      }

      console.log(`채널 데이터 로딩 완료: ${data?.length || 0}개`)
      setChannels(data || [])
    } catch (error) {
      console.warn('Error fetching channels, using fallback data:', error)
      setChannels([])
    }
  }

  const fetchProductOptions = async () => {
    try {
      const { data, error } = await supabase
        .from('product_options')
        .select('*')
        .order('name', { ascending: true })

        if (error) {
          console.warn('Error fetching product options, using fallback data:', error)
          setProductOptions([])
          return
        }
      setProductOptions(data || [])
    } catch (error) {
      console.warn('Error fetching product options, using fallback data:', error)
      setProductOptions([])
    }
  }

  const fetchOptionChoices = async () => {
    try {
      // 병합된 테이블 구조에서는 product_options에서 선택지 정보를 가져옴
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
        console.warn('Error fetching option choices, using fallback data:', error)
        return
      }
      
      // 새로운 구조에 맞게 데이터 변환
      const transformedChoices = (data || []).map(item => ({
        id: item.id,
        name: item.choice_name || item.name,
        description: item.choice_description || item.description,
        adult_price_adjustment: item.adult_price_adjustment,
        child_price_adjustment: item.child_price_adjustment,
        infant_price_adjustment: item.infant_price_adjustment,
        is_default: item.is_default,
        product_option_id: item.id, // 자기 자신을 참조
        created_at: item.created_at,
        updated_at: item.updated_at
      }))
      
      setOptionChoices(transformedChoices)
    } catch (error) {
      console.warn('Error fetching option choices, using fallback data:', error)
      setOptionChoices([])
    }
  }

  const fetchOptions = async () => {
    try {
      const { data, error } = await supabase
        .from('options')
        .select('*')
        .order('name', { ascending: true })

      if (error) {
        console.warn('Error fetching options, using fallback data:', error)
        return
      }
      setOptions(data || [])
    } catch (error) {
      console.warn('Error fetching options, using fallback data:', error)
      setOptions([])
    }
  }

  const fetchPickupHotels = async () => {
    try {
      const { data, error } = await supabase
        .from('pickup_hotels')
        .select('*')
        .order('hotel', { ascending: true })

      if (error) {
        console.warn('Error fetching pickup hotels, using fallback data:', error)
        return
      }
      setPickupHotels(data || [])
    } catch (error) {
      console.warn('Error fetching pickup hotels, using fallback data:', error)
      setPickupHotels([])
    }
  }

  const fetchCoupons = async () => {
    try {
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('status', 'active')
        .order('coupon_code', { ascending: true })

      if (error) {
        console.warn('Error fetching coupons, using fallback data:', error)
        return
      }
      setCoupons(data || [])
    } catch (error) {
      console.warn('Error fetching coupons, using fallback data:', error)
      setCoupons([])
    }
  }

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
      let allReservations: any[] = []
      let from = 0
      const pageSize = 1000
      let hasMore = true

      while (hasMore) {
        console.log(`예약 데이터 로딩: ${from} ~ ${from + pageSize - 1}`)
        
        const { data, error } = await supabase
          .from('reservations')
          .select('*')
          .order('created_at', { ascending: false })
          .range(from, from + pageSize - 1)

        if (error) {
          console.warn('Error fetching reservations, using fallback data:', error)
          return
        }

        if (data && data.length > 0) {
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

  // 모든 데이터 로드
  const loadAllData = async () => {
    setLoading(true)
    
    // Supabase 연결 상태 확인
    await logSupabaseStatus()
    
    try {
      await Promise.allSettled([
        fetchCustomers(),
        fetchProducts(),
        fetchChannels(),
        fetchProductOptions(),
        fetchOptionChoices(),
        fetchOptions(),
        fetchPickupHotels(),
        fetchCoupons(),
        fetchReservations()
      ])
    } catch (error) {
      console.warn('Error loading data, using fallback data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAllData()
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
    refreshCustomers: fetchCustomers,
    refreshProducts: fetchProducts,
    refreshChannels: fetchChannels,
    refreshProductOptions: fetchProductOptions,
    refreshOptionChoices: fetchOptionChoices,
    refreshOptions: fetchOptions,
    refreshPickupHotels: fetchPickupHotels,
    refreshCoupons: fetchCoupons,
    refreshAll: loadAllData
  }
}
