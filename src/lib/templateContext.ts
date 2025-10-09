import { supabase } from '@/lib/supabase'
import { scheduleRenderers } from '@/utils/scheduleRenderer'

export interface TourScheduleItem {
  id: string
  product_id: string
  day_number: number
  start_time: string | null
  end_time: string | null
  duration_minutes: number | null
  is_break: boolean | null
  is_meal: boolean | null
  is_transport: boolean | null
  is_tour: boolean | null
  show_to_customers: boolean | null
  title_ko: string | null
  title_en: string | null
  description_ko: string | null
  description_en: string | null
  location_ko: string | null
  location_en: string | null
  guide_notes_ko: string | null
  guide_notes_en: string | null
  thumbnail_url: string | null
  order_index: number | null
}

export interface PickupScheduleItem {
  hotel: string
  location: string
  time: string
  description?: string
}

/**
 * 예약에 대한 투어 스케줄 데이터를 가져옵니다
 */
export async function getTourScheduleData(reservationId: string, language: 'ko' | 'en' = 'ko') {
  try {
    // 예약 정보에서 상품 ID 가져오기
    const { data: reservation, error: reservationError } = await supabase
      .from('reservations')
      .select('product_id')
      .eq('id', reservationId)
      .single()

    if (reservationError || !reservation) {
      console.error('예약 정보 조회 실패:', reservationError)
      return null
    }

    // 상품의 스케줄 데이터 가져오기
    const { data: schedules, error: scheduleError } = await supabase
      .from('product_schedules')
      .select('*')
      .eq('product_id', reservation.product_id)
      .order('day_number', { ascending: true })
      .order('order_index', { ascending: true })

    if (scheduleError) {
      console.error('스케줄 데이터 조회 실패:', scheduleError)
      return null
    }

    if (!schedules || schedules.length === 0) {
      return null
    }

    // 언어에 따라 적절한 필드 선택
    const processedSchedules = schedules.map(schedule => ({
      id: schedule.id,
      day_number: schedule.day_number,
      start_time: schedule.start_time,
      end_time: schedule.end_time,
      duration_minutes: schedule.duration_minutes,
      is_break: schedule.is_break,
      is_meal: schedule.is_meal,
      is_transport: schedule.is_transport,
      is_tour: schedule.is_tour,
      show_to_customers: schedule.show_to_customers,
      title: language === 'ko' ? schedule.title_ko : schedule.title_en,
      description: language === 'ko' ? schedule.description_ko : schedule.description_en,
      location: language === 'ko' ? schedule.location_ko : schedule.location_en,
      guide_notes: language === 'ko' ? schedule.guide_notes_ko : schedule.guide_notes_en,
      thumbnail_url: schedule.thumbnail_url,
      order_index: schedule.order_index
    }))

    // 일차별로 그룹화
    const schedulesByDay = processedSchedules.reduce((acc, schedule) => {
      const day = schedule.day_number
      if (!acc[day]) {
        acc[day] = []
      }
      acc[day].push(schedule)
      return acc
    }, {} as Record<number, typeof processedSchedules>)

    // 고객에게 표시되는 스케줄만 필터링
    const customerVisibleSchedules = processedSchedules.filter(s => s.show_to_customers)
    const customerVisibleByDay = customerVisibleSchedules.reduce((acc, schedule) => {
      const day = schedule.day_number
      if (!acc[day]) {
        acc[day] = []
      }
      acc[day].push(schedule)
      return acc
    }, {} as Record<number, typeof customerVisibleSchedules>)

    // 다양한 형태로 데이터 제공
    return {
      // 전체 스케줄
      all_days: JSON.stringify(processedSchedules),
      
      // 일차별 스케줄
      day_1: schedulesByDay[1] ? JSON.stringify(schedulesByDay[1]) : '[]',
      day_2: schedulesByDay[2] ? JSON.stringify(schedulesByDay[2]) : '[]',
      day_3: schedulesByDay[3] ? JSON.stringify(schedulesByDay[3]) : '[]',
      
      // 고객에게 표시되는 스케줄만 (전체)
      customer_visible: JSON.stringify(customerVisibleSchedules),
      
      // 고객에게 표시되는 스케줄만 (일차별)
      customer_day_1: customerVisibleByDay[1] ? JSON.stringify(customerVisibleByDay[1]) : '[]',
      customer_day_2: customerVisibleByDay[2] ? JSON.stringify(customerVisibleByDay[2]) : '[]',
      customer_day_3: customerVisibleByDay[3] ? JSON.stringify(customerVisibleByDay[3]) : '[]',
      
      // 고객에게 표시되는 스케줄만 (카테고리별)
      customer_tour_items: JSON.stringify(customerVisibleSchedules.filter(s => s.is_tour)),
      customer_transport_items: JSON.stringify(customerVisibleSchedules.filter(s => s.is_transport)),
      customer_meal_items: JSON.stringify(customerVisibleSchedules.filter(s => s.is_meal)),
      customer_break_items: JSON.stringify(customerVisibleSchedules.filter(s => s.is_break)),
      
      // 카테고리별 스케줄 (전체)
      tour_items: JSON.stringify(processedSchedules.filter(s => s.is_tour)),
      transport_items: JSON.stringify(processedSchedules.filter(s => s.is_transport)),
      meal_items: JSON.stringify(processedSchedules.filter(s => s.is_meal)),
      break_items: JSON.stringify(processedSchedules.filter(s => s.is_break))
    }
  } catch (error) {
    console.error('투어 스케줄 데이터 조회 중 오류:', error)
    return null
  }
}

/**
 * 예약에 대한 투어 스케줄 HTML 렌더링 데이터를 가져옵니다
 */
export async function getTourScheduleHtmlData(reservationId: string, language: 'ko' | 'en' = 'ko') {
  try {
    // 예약 정보에서 상품 ID 가져오기
    const { data: reservation, error: reservationError } = await supabase
      .from('reservations')
      .select('product_id')
      .eq('id', reservationId)
      .single()

    if (reservationError || !reservation) {
      console.error('예약 정보 조회 실패:', reservationError)
      return null
    }

    // 상품의 스케줄 데이터 가져오기
    const { data: schedules, error: scheduleError } = await supabase
      .from('product_schedules')
      .select('*')
      .eq('product_id', reservation.product_id)
      .order('day_number', { ascending: true })
      .order('order_index', { ascending: true })

    if (scheduleError) {
      console.error('스케줄 데이터 조회 실패:', scheduleError)
      return null
    }

    if (!schedules || schedules.length === 0) {
      return {}
    }

    // 고객에게 표시되는 스케줄만 필터링
    const customerVisibleSchedules = schedules.filter(s => s.show_to_customers)
    const customerVisibleByDay = customerVisibleSchedules.reduce((acc, schedule) => {
      const day = schedule.day_number
      if (!acc[day]) {
        acc[day] = []
      }
      acc[day].push(schedule)
      return acc
    }, {} as Record<number, typeof customerVisibleSchedules>)

    // HTML 렌더링된 스케줄들
    const tourScheduleHtmlContext: Record<string, string> = {}

    // 고객용 전체 스케줄 HTML
    tourScheduleHtmlContext.customer_visible_html = scheduleRenderers.renderCustomerSchedule(
      JSON.stringify(customerVisibleSchedules.map(s => ({
        day: s.day_number,
        time: s.start_time,
        title: s[`title_${language}`] || s.title_en || s.title_ko,
        location: s[`location_${language}`] || s.location_en || s.location_ko,
        description: s[`description_${language}`] || s.description_en || s.description_ko,
        show_to_customers: s.show_to_customers
      }))), language
    )

    // 고객용 일차별 스케줄 HTML
    for (const day in customerVisibleByDay) {
      tourScheduleHtmlContext[`customer_day_${day}_html`] = scheduleRenderers.renderCustomerDaySchedule(
        JSON.stringify(customerVisibleByDay[day].map(s => ({
          time: s.start_time,
          title: s[`title_${language}`] || s.title_en || s.title_ko,
          location: s[`location_${language}`] || s.location_en || s.location_ko,
          description: s[`description_${language}`] || s.description_en || s.description_ko,
          show_to_customers: s.show_to_customers
        }))), language
      )
    }

    // 고객용 카테고리별 스케줄 HTML
    tourScheduleHtmlContext.customer_tour_items_html = scheduleRenderers.renderCustomerTourItems(
      JSON.stringify(customerVisibleSchedules.filter(s => s.is_tour).map(s => ({
        day: s.day_number,
        time: s.start_time,
        title: s[`title_${language}`] || s.title_en || s.title_ko,
        location: s[`location_${language}`] || s.location_en || s.location_ko,
        description: s[`description_${language}`] || s.description_en || s.description_ko,
        show_to_customers: s.show_to_customers
      }))), language
    )

    tourScheduleHtmlContext.customer_transport_items_html = scheduleRenderers.renderCustomerTransportItems(
      JSON.stringify(customerVisibleSchedules.filter(s => s.is_transport).map(s => ({
        day: s.day_number,
        time: s.start_time,
        title: s[`title_${language}`] || s.title_en || s.title_ko,
        location: s[`location_${language}`] || s.location_en || s.location_ko,
        description: s[`description_${language}`] || s.description_en || s.description_ko,
        show_to_customers: s.show_to_customers
      }))), language
    )

    tourScheduleHtmlContext.customer_meal_items_html = scheduleRenderers.renderCustomerMealItems(
      JSON.stringify(customerVisibleSchedules.filter(s => s.is_meal).map(s => ({
        day: s.day_number,
        time: s.start_time,
        title: s[`title_${language}`] || s.title_en || s.title_ko,
        location: s[`location_${language}`] || s.location_en || s.location_ko,
        description: s[`description_${language}`] || s.description_en || s.description_ko,
        show_to_customers: s.show_to_customers
      }))), language
    )

    tourScheduleHtmlContext.customer_break_items_html = scheduleRenderers.renderCustomerBreakItems(
      JSON.stringify(customerVisibleSchedules.filter(s => s.is_break).map(s => ({
        day: s.day_number,
        time: s.start_time,
        title: s[`title_${language}`] || s.title_en || s.title_ko,
        location: s[`location_${language}`] || s.location_en || s.location_ko,
        description: s[`description_${language}`] || s.description_en || s.description_ko,
        show_to_customers: s.show_to_customers
      }))), language
    )

    return tourScheduleHtmlContext
  } catch (error) {
    console.error('투어 스케줄 HTML 데이터 조회 중 오류:', error)
    return null
  }
}

/**
 * 예약에 대한 상품 세부정보 데이터를 가져옵니다 (다국어 지원)
 */
export async function getProductDetailsData(reservationId: string, language: 'ko' | 'en' = 'ko') {
  try {
    // 예약 정보에서 상품 ID 가져오기
    const { data: reservation, error: reservationError } = await supabase
      .from('reservations')
      .select('product_id')
      .eq('id', reservationId)
      .single()

    if (reservationError || !reservation) {
      console.error('예약 정보 조회 실패:', reservationError)
      return null
    }

    // 상품의 다국어 세부정보 데이터 가져오기
    const { data: productDetails, error: detailsError } = await supabase
      .from('product_details_multilingual')
      .select('*')
      .eq('product_id', reservation.product_id)
      .eq('language_code', language)
      .single()

    if (detailsError) {
      console.error('상품 세부정보 조회 실패:', detailsError)
      return null
    }

    if (!productDetails) {
      return {}
    }

    // 상품 세부정보 컨텍스트 구성
    return {
      slogan1: productDetails.slogan1 || '',
      slogan2: productDetails.slogan2 || '',
      slogan3: productDetails.slogan3 || '',
      description: productDetails.description || '',
      included: productDetails.included || '',
      not_included: productDetails.not_included || '',
      pickup_drop_info: productDetails.pickup_drop_info || '',
      luggage_info: productDetails.luggage_info || '',
      tour_operation_info: productDetails.tour_operation_info || '',
      preparation_info: productDetails.preparation_info || '',
      small_group_info: productDetails.small_group_info || '',
      companion_info: productDetails.companion_info || '',
      exclusive_booking_info: productDetails.exclusive_booking_info || '',
      cancellation_policy: productDetails.cancellation_policy || '',
      chat_announcement: productDetails.chat_announcement || ''
    }
  } catch (error) {
    console.error('상품 세부정보 데이터 조회 중 오류:', error)
    return null
  }
}

/**
 * 예약에 대한 픽업 스케줄 데이터를 가져옵니다
 */
export async function getPickupScheduleData(reservationId: string) {
  try {
    console.log('픽업 스케줄 데이터 조회 시작:', reservationId)
    
    // 예약 정보에서 픽업 정보 가져오기 (에러가 발생해도 계속 진행)
    let reservation = null
    try {
      const { data: reservationData, error: reservationError } = await supabase
        .from('reservations')
        .select('pickup_hotel_id, pickup_time')
        .eq('id', reservationId)
        .single()

      if (reservationError) {
        console.warn('예약 정보 조회 실패:', reservationError)
        console.log('기본 픽업 스케줄 데이터로 대체')
      } else {
        reservation = reservationData
        console.log('예약 정보 조회 성공:', reservation)
      }
    } catch (error) {
      console.warn('예약 정보 조회 중 예외 발생:', error)
      console.log('기본 픽업 스케줄 데이터로 대체')
    }

    console.log('픽업 호텔 데이터 조회 중...')
    // 픽업 호텔 정보 가져오기 (에러가 발생해도 기본 데이터 제공)
    let pickupHotels = []
    try {
      const { data: pickupHotelsData, error: pickupError } = await supabase
        .from('pickup_hotels')
        .select('*')
        .eq('is_active', true)
        .order('hotel_name', { ascending: true })

      if (pickupError) {
        console.warn('픽업 호텔 데이터 조회 실패:', pickupError)
        console.log('기본 픽업 호텔 데이터 사용')
        // 기본 픽업 호텔 데이터 제공
        pickupHotels = [
          {
            hotel_name: '기본 픽업 호텔',
            pick_up_location: '호텔 로비',
            description_ko: '호텔 로비에서 픽업',
            description_en: 'Pickup at hotel lobby',
            address: '',
            link: '',
            pin: ''
          }
        ]
      } else {
        pickupHotels = pickupHotelsData || []
        console.log('픽업 호텔 데이터 조회 성공:', pickupHotels.length, '개')
      }
    } catch (error) {
      console.warn('픽업 호텔 데이터 조회 중 예외 발생:', error)
      console.log('기본 픽업 호텔 데이터 사용')
      // 기본 픽업 호텔 데이터 제공
      pickupHotels = [
        {
          hotel_name: '기본 픽업 호텔',
          pick_up_location: '호텔 로비',
          description_ko: '호텔 로비에서 픽업',
          description_en: 'Pickup at hotel lobby',
          address: '',
          link: '',
          pin: ''
        }
      ]
    }

    // 기본 픽업 시간 설정
    const defaultPickupTime = reservation?.pickup_time || '09:00'

    // 픽업 위치 목록
    const pickupLocations = pickupHotels.map(hotel => ({
      hotel: hotel.hotel_name,
      location: hotel.pick_up_location,
      time: defaultPickupTime,
      description: hotel.description_ko || hotel.description_en || ''
    }))

    // 픽업 시간 목록 (고유한 시간들)
    const pickupTimes = [...new Set(pickupHotels.map(hotel => defaultPickupTime))]

    // 호텔 목록
    const hotelList = pickupHotels.map(hotel => hotel.hotel_name)

    // 픽업 상세 정보
    const pickupDetails = pickupHotels.reduce((acc, hotel) => {
      acc[hotel.hotel_name] = {
        location: hotel.pick_up_location,
        time: defaultPickupTime,
        description: hotel.description_ko || hotel.description_en || '',
        address: hotel.address || '',
        link: hotel.link || '',
        pin: hotel.pin || ''
      }
      return acc
    }, {} as Record<string, any>)

    console.log('픽업 스케줄 데이터 생성 완료')
    return {
      pickup_locations: JSON.stringify(pickupLocations),
      pickup_times: JSON.stringify(pickupTimes),
      hotel_list: JSON.stringify(hotelList),
      pickup_details: JSON.stringify(pickupDetails)
    }
  } catch (error) {
    console.error('픽업 스케줄 데이터 조회 중 오류:', error)
    return null
  }
}

/**
 * 예약 문서 템플릿에 사용할 전체 컨텍스트 데이터를 생성합니다
 */
export async function generateTemplateContext(reservationId: string, language: 'ko' | 'en' = 'ko') {
  try {
    console.log('템플릿 컨텍스트 생성 시작:', reservationId)
    
    // 기본 예약 정보만 먼저 가져오기 (에러가 발생해도 기본 데이터 제공)
    let reservation = null
    try {
      const { data: reservationData, error: reservationError } = await supabase
        .from('reservations')
        .select('*')
        .eq('id', reservationId)
        .single()

      if (reservationError) {
        console.warn('예약 정보 조회 실패:', reservationError)
        console.log('기본 예약 데이터로 대체')
        // 기본 예약 데이터 제공
        reservation = {
          id: reservationId,
          customer_id: null,
          product_id: null,
          channel_id: null,
          pickup_hotel_id: null,
          tour_date: new Date().toISOString().split('T')[0],
          tour_time: '09:00',
          pickup_time: '09:00',
          adults: 2,
          child: 0,
          infant: 0,
          total_price: 0,
          status: 'confirmed',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      } else {
        reservation = reservationData
        console.log('예약 정보 조회 성공:', reservation.id)
      }
    } catch (error) {
      console.warn('예약 정보 조회 중 예외 발생:', error)
      console.log('기본 예약 데이터로 대체')
      // 기본 예약 데이터 제공
      reservation = {
        id: reservationId,
        customer_id: null,
        product_id: null,
        channel_id: null,
        pickup_hotel_id: null,
        tour_date: new Date().toISOString().split('T')[0],
        tour_time: '09:00',
        pickup_time: '09:00',
        adults: 2,
        child: 0,
        infant: 0,
        total_price: 0,
        status: 'confirmed',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    }

    // 고객 정보 가져오기 (에러가 발생해도 기본 데이터 제공)
    let customer = null
    if (reservation.customer_id) {
      try {
        const { data: customerData, error: customerError } = await supabase
          .from('customers')
          .select('name, email, phone, language')
          .eq('id', reservation.customer_id)
          .single()
        
        if (!customerError && customerData) {
          customer = customerData
          console.log('고객 정보 조회 성공:', customer.name)
        } else {
          console.warn('고객 정보 조회 실패:', customerError)
          // 기본 고객 데이터 제공
          customer = {
            name: '고객',
            email: 'customer@example.com',
            phone: '010-0000-0000',
            language: 'ko'
          }
        }
      } catch (error) {
        console.warn('고객 정보 조회 중 예외 발생:', error)
        // 기본 고객 데이터 제공
        customer = {
          name: '고객',
          email: 'customer@example.com',
          phone: '010-0000-0000',
          language: 'ko'
        }
      }
    } else {
      // 기본 고객 데이터 제공
      customer = {
        name: '고객',
        email: 'customer@example.com',
        phone: '010-0000-0000',
        language: 'ko'
      }
    }

    // 상품 정보 가져오기 (에러가 발생해도 기본 데이터 제공)
    let product = null
    if (reservation.product_id) {
      try {
        const { data: productData, error: productError } = await supabase
          .from('products')
          .select('name, name_ko, name_en, display_name, category, sub_category, description, duration, base_price, max_participants, status, tags, created_at')
          .eq('id', reservation.product_id)
          .single()
        
        if (!productError && productData) {
          product = productData
          console.log('상품 정보 조회 성공:', product.name_ko)
        } else {
          console.warn('상품 정보 조회 실패:', productError)
          // 기본 상품 데이터 제공
          product = {
            name: 'tour-product',
            name_ko: '투어 상품',
            name_en: 'Tour Product',
            display_name: '투어 상품',
            category: '투어',
            sub_category: '일반',
            description: '투어 상품입니다',
            duration: 8,
            base_price: 100000,
            max_participants: 20,
            status: 'active',
            tags: ['투어'],
            created_at: new Date().toISOString()
          }
        }
      } catch (error) {
        console.warn('상품 정보 조회 중 예외 발생:', error)
        // 기본 상품 데이터 제공
        product = {
          name: 'tour-product',
          name_ko: '투어 상품',
          name_en: 'Tour Product',
          display_name: '투어 상품',
          category: '투어',
          sub_category: '일반',
          description: '투어 상품입니다',
          duration: 8,
          base_price: 100000,
          max_participants: 20,
          status: 'active',
          tags: ['투어'],
          created_at: new Date().toISOString()
        }
      }
    } else {
      // 기본 상품 데이터 제공
      product = {
        name: 'tour-product',
        name_ko: '투어 상품',
        name_en: 'Tour Product',
        display_name: '투어 상품',
        category: '투어',
        sub_category: '일반',
        description: '투어 상품입니다',
        duration: 8,
        base_price: 100000,
        max_participants: 20,
        status: 'active',
        tags: ['투어'],
        created_at: new Date().toISOString()
      }
    }

    // 채널 정보 가져오기 (에러가 발생해도 기본 데이터 제공)
    let channel = null
    if (reservation.channel_id) {
      try {
        const { data: channelData, error: channelError } = await supabase
          .from('channels')
          .select('name, type')
          .eq('id', reservation.channel_id)
          .single()
        
        if (!channelError && channelData) {
          channel = channelData
          console.log('채널 정보 조회 성공:', channel.name)
        } else {
          console.warn('채널 정보 조회 실패:', channelError)
          // 기본 채널 데이터 제공
          channel = {
            name: '일반 채널',
            type: 'direct'
          }
        }
      } catch (error) {
        console.warn('채널 정보 조회 중 예외 발생:', error)
        // 기본 채널 데이터 제공
        channel = {
          name: '일반 채널',
          type: 'direct'
        }
      }
    } else {
      // 기본 채널 데이터 제공
      channel = {
        name: '일반 채널',
        type: 'direct'
      }
    }

    // 픽업 호텔 정보 가져오기 (에러가 발생해도 기본 데이터 제공)
    let pickup = null
    if (reservation.pickup_hotel_id) {
      try {
        const { data: pickupData, error: pickupError } = await supabase
          .from('pickup_hotels')
          .select('hotel_name, pick_up_location, address, link, pin, description_ko, description_en')
          .eq('id', reservation.pickup_hotel_id)
          .single()
        
        if (!pickupError && pickupData) {
          pickup = pickupData
          console.log('픽업 호텔 정보 조회 성공:', pickup.hotel_name)
        } else {
          console.warn('픽업 호텔 정보 조회 실패:', pickupError)
          // 기본 픽업 호텔 데이터 제공
          pickup = {
            hotel_name: '기본 픽업 호텔',
            pick_up_location: '호텔 로비',
            address: '서울시 강남구',
            link: '',
            pin: '',
            description_ko: '호텔 로비에서 픽업',
            description_en: 'Pickup at hotel lobby'
          }
        }
      } catch (error) {
        console.warn('픽업 호텔 정보 조회 중 예외 발생:', error)
        // 기본 픽업 호텔 데이터 제공
        pickup = {
          hotel_name: '기본 픽업 호텔',
          pick_up_location: '호텔 로비',
          address: '서울시 강남구',
          link: '',
          pin: '',
          description_ko: '호텔 로비에서 픽업',
          description_en: 'Pickup at hotel lobby'
        }
      }
    } else {
      // 기본 픽업 호텔 데이터 제공
      pickup = {
        hotel_name: '기본 픽업 호텔',
        pick_up_location: '호텔 로비',
        address: '서울시 강남구',
        link: '',
        pin: '',
        description_ko: '호텔 로비에서 픽업',
        description_en: 'Pickup at hotel lobby'
      }
    }

    // 투어 스케줄 데이터 가져오기
    const tourSchedule = await getTourScheduleData(reservationId, language)
    
    // 투어 스케줄 HTML 렌더링 데이터 가져오기
    const tourScheduleHtml = await getTourScheduleHtmlData(reservationId, language)
    
    // 상품 세부정보 데이터 가져오기 (다국어 지원)
    const productDetails = await getProductDetailsData(reservationId, language)
    
    // 픽업 스케줄 데이터 가져오기
    const pickupSchedule = await getPickupScheduleData(reservationId)

    // 템플릿 컨텍스트 구성
    const context = {
      reservation: {
        id: reservation.id,
        tour_date: reservation.tour_date,
        tour_time: reservation.tour_time,
        pickup_time: reservation.pickup_time,
        adults: reservation.adults,
        child: reservation.child,
        infant: reservation.infant,
        selected_options: reservation.selected_options,
        selected_option_prices: reservation.selected_option_prices
      },
      customer: {
        name: customer?.name || '',
        email: customer?.email || '',
        phone: customer?.phone || '',
        language: customer?.language || 'ko'
      },
      product: {
        id: product?.id || '',
        name: product?.name || '',
        name_ko: product?.name_ko || '',
        name_en: product?.name_en || '',
        display_name: product?.display_name || {},
        category: product?.category || '',
        sub_category: product?.sub_category || '',
        description: product?.description || '',
        duration: product?.duration || '',
        base_price: product?.base_price || 0,
        max_participants: product?.max_participants || 0,
        status: product?.status || '',
        tags: product?.tags || [],
        created_at: product?.created_at || ''
      },
      channel: {
        name: channel?.name || '',
        type: channel?.type || ''
      },
      pickup: {
        display: pickup ? `${pickup.hotel_name} - ${pickup.pick_up_location}` : '',
        hotel: pickup?.hotel_name || '',
        pick_up_location: pickup?.pick_up_location || '',
        address: pickup?.address || '',
        link: pickup?.link || '',
        pin: pickup?.pin || '',
        description_ko: pickup?.description_ko || '',
        description_en: pickup?.description_en || ''
      },
      pricing: {
        total: reservation.total_price || 0,
        total_locale: new Intl.NumberFormat('ko-KR').format(reservation.total_price || 0),
        base_price: reservation.base_price || 0,
        adult_price: reservation.adult_price || 0,
        child_price: reservation.child_price || 0,
        infant_price: reservation.infant_price || 0,
        discount_amount: reservation.discount_amount || 0,
        commission_amount: reservation.commission_amount || 0,
        tax_amount: reservation.tax_amount || 0,
        currency: reservation.currency || 'USD'
      },
      tour_schedule: tourSchedule || {},
      tour_schedule_html: tourScheduleHtml || {},
      product_details: productDetails || {},
      product_details_multilingual: productDetails || {},
      pickup_schedule: pickupSchedule || {}
    }

    console.log('템플릿 컨텍스트 생성 완료:', Object.keys(context))
    return context
  } catch (error) {
    console.error('템플릿 컨텍스트 생성 중 오류:', error)
    return null
  }
}
