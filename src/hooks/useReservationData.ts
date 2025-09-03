import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
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

  // 데이터 fetching 함수들
  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching customers:', error)
        return
      }
      setCustomers(data || [])
    } catch (error) {
      console.error('Error fetching customers:', error)
    }
  }

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name', { ascending: true })

      if (error) {
        console.error('Error fetching products:', error)
        return
      }
      setProducts(data || [])
    } catch (error) {
      console.error('Error fetching products:', error)
    }
  }

  const fetchChannels = async () => {
    try {
      const { data, error } = await supabase
        .from('channels')
        .select('*')
        .order('name', { ascending: true })

      if (error) {
        console.error('Error fetching channels:', error)
        return
      }
      setChannels(data || [])
    } catch (error) {
      console.error('Error fetching channels:', error)
    }
  }

  const fetchProductOptions = async () => {
    try {
      const { data, error } = await supabase
        .from('product_options')
        .select('*')
        .order('name', { ascending: true })

      if (error) {
        console.error('Error fetching product options:', error)
        return
      }
      setProductOptions(data || [])
    } catch (error) {
      console.error('Error fetching product options:', error)
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
        console.error('Error fetching option choices:', error)
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
      console.error('Error fetching option choices:', error)
    }
  }

  const fetchOptions = async () => {
    try {
      const { data, error } = await supabase
        .from('options')
        .select('*')
        .order('name', { ascending: true })

      if (error) {
        console.error('Error fetching options:', error)
        return
      }
      setOptions(data || [])
    } catch (error) {
      console.error('Error fetching options:', error)
    }
  }

  const fetchPickupHotels = async () => {
    try {
      const { data, error } = await supabase
        .from('pickup_hotels')
        .select('*')
        .order('hotel', { ascending: true })

      if (error) {
        console.error('Error fetching pickup hotels:', error)
        return
      }
      setPickupHotels(data || [])
    } catch (error) {
      console.error('Error fetching pickup hotels:', error)
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
        console.error('Error fetching coupons:', error)
        return
      }
      setCoupons(data || [])
    } catch (error) {
      console.error('Error fetching coupons:', error)
    }
  }

  const fetchReservations = async () => {
    try {
      const { data, error } = await supabase
        .from('reservations')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching reservations:', error)
        return
      }

      const mappedReservations: Reservation[] = (data || []).map(item => ({
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
        selectedOptions: (item.selected_options as { [optionId: string]: string[] }) || {},
        selectedOptionPrices: (item.selected_option_prices as { [key: string]: number }) || {}
      }))

      setReservations(mappedReservations)
    } catch (error) {
      console.error('Error fetching reservations:', error)
    }
  }

  // 모든 데이터 로드
  const loadAllData = async () => {
    setLoading(true)
    await Promise.all([
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
    setLoading(false)
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
