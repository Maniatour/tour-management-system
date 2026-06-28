import { supabase } from '@/lib/supabase'
import {
  choiceOptionIdsForSupabaseIn,
  UNDECIDED_OPTION_ID,
  undecidedOptionDisplayNames,
} from '@/utils/usResidentChoiceSync'

export type RawCustomerReservation = Record<string, unknown> & {
  id: string
  product_id?: string | null
  channel_id?: string | null
  pickup_hotel?: string | null
}

type EnrichOptions = {
  locale: string
  noProductName: string
}

const emptyProduct = (noProductName: string) => ({
  name: noProductName,
  customer_name_ko: null,
  customer_name_en: null,
  duration: null,
  base_price: null,
})

export async function enrichCustomerReservation(
  reservation: RawCustomerReservation,
  options: EnrichOptions
): Promise<RawCustomerReservation> {
  const { locale, noProductName } = options
  try {
    const { data: productData, error: productError } = await supabase
      .from('products')
      .select('name, customer_name_ko, customer_name_en, duration, base_price, choices')
      .eq('id', reservation.product_id ?? '')
      .single()

    if (productError) {
      console.warn('productInfoError', {
        error: productError,
        message: productError?.message || 'Unknown error',
        code: productError?.code || 'No code',
        product_id: reservation.product_id,
        reservation_id: reservation.id
      })
    }

    // 다국어 상품 세부 정보도 함께 가져오기 (채널별 우선, 없으면 전체 공통)
    let multilingualDetails = null
    try {
      
      // 먼저 채널별 정보를 찾아보기 (채널 ID가 있는 경우에만)
      let detailsData: Record<string, unknown> | null = null
      if (reservation.channel_id) {
        const result = await supabase
          .from('product_details_multilingual')
          .select('*')
          .eq('product_id', reservation.product_id ?? '')
          .eq('language_code', locale)
          .eq('channel_id', reservation.channel_id ?? '')
          .maybeSingle() // single() 대신 maybeSingle() 사용
        
        detailsData = result.data
      }
      
      // 채널별 정보가 없으면 전체 공통 정보 가져오기
      if (!detailsData) {
        const result = await supabase
          .from('product_details_multilingual')
          .select('*')
          .eq('product_id', reservation.product_id ?? '')
          .eq('language_code', locale)
          .is('channel_id', null)
          .maybeSingle() // single() 대신 maybeSingle() 사용
        
        detailsData = result.data
      }
      
      multilingualDetails = detailsData
    } catch (error) {
      console.warn('다국어 상품 세부 정보 조회 실패:', error)
    }

    // 픽업 호텔 정보 가져오기
    let pickupHotelInfo = null
    if (reservation.pickup_hotel) {
      try {
        const { data: hotelData, error: hotelError } = await supabase
          .from('pickup_hotels')
          .select('hotel, pick_up_location, address, media, link, youtube_link')
          .eq('id', reservation.pickup_hotel)
          .single()
        
        if (!hotelError && hotelData) {
          pickupHotelInfo = hotelData
        } else {
          console.warn('픽업 호텔 정보 조회 실패:', hotelError)
        }
      } catch (error) {
        console.warn('픽업 호텔 정보 조회 중 오류:', error)
      }
    }

    // 가격 정보 가져오기
    let pricingInfo = null
    try {
      const { data: pricingData, error: pricingError } = await supabase
        .from('reservation_pricing')
        .select('adult_product_price, child_product_price, infant_product_price, product_price_total, required_options, required_option_total, subtotal, coupon_code, coupon_discount, additional_discount, additional_cost, card_fee, tax, prepayment_cost, prepayment_tip, selected_options, option_total, private_tour_additional_cost, total_price, deposit_amount, balance_amount, commission_percent, commission_amount, choices, choices_total')
        .eq('reservation_id', reservation.id.toString())
        .single()
      
      if (pricingError) {
        console.warn('가격 정보 조회 오류:', pricingError)
        // reservation_id가 TEXT 타입이므로 문자열로 변환해서 다시 시도
        const { data: retryData, error: retryError } = await supabase
          .from('reservation_pricing')
          .select('adult_product_price, child_product_price, infant_product_price, product_price_total, required_options, required_option_total, subtotal, coupon_code, coupon_discount, additional_discount, additional_cost, card_fee, tax, prepayment_cost, prepayment_tip, selected_options, option_total, private_tour_additional_cost, total_price, deposit_amount, balance_amount, commission_percent, commission_amount, choices, choices_total')
          .eq('reservation_id', String(reservation.id))
          .single()
        
        if (retryError) {
          console.warn('재시도 가격 정보 조회 오류:', retryError)
        } else {
          pricingInfo = retryData
        }
      } else {
        pricingInfo = pricingData
      }
    } catch (error) {
      console.warn('가격 정보 조회 실패:', error)
    }

    // 옵션 정보 가져오기
    let optionsInfo = null
    try {
      
      const { data: optionsData, error: optionsError } = await supabase
        .from('reservation_options')
        .select('id, option_id, ea, price, total_price, status, note')
        .eq('reservation_id', reservation.id.toString())
        .eq('status', 'active')
      
      if (optionsError) {
        console.warn('옵션 정보 조회 오류:', optionsError)
        // 재시도
        const { data: retryData, error: retryError } = await supabase
          .from('reservation_options')
          .select('id, option_id, ea, price, total_price, status, note')
          .eq('reservation_id', String(reservation.id))
          .eq('status', 'active')
        
        if (retryError) {
          console.warn('재시도 옵션 정보 조회 오류:', retryError)
        } else {
          optionsInfo = retryData
        }
      } else {
        optionsInfo = optionsData
      }
    } catch (error) {
      console.warn('옵션 정보 조회 실패:', error)
    }

     // 결제 정보 가져오기
     let paymentsInfo = null
     try {
       
       const { data: paymentsData, error: paymentsError } = await supabase
         .from('payment_records')
         .select('id, payment_status, amount, payment_method, note, submit_on, submit_by, confirmed_on, confirmed_by, amount_krw')
         .eq('reservation_id', reservation.id.toString())
         .order('submit_on', { ascending: false })
       
       if (paymentsError) {
         console.warn('결제 정보 조회 오류:', paymentsError)
         // 재시도
         const { data: retryData, error: retryError } = await supabase
           .from('payment_records')
           .select('id, payment_status, amount, payment_method, note, submit_on, submit_by, confirmed_on, confirmed_by, amount_krw')
           .eq('reservation_id', String(reservation.id))
           .order('submit_on', { ascending: false })
         
         if (retryError) {
           console.warn('재시도 결제 정보 조회 오류:', retryError)
         } else {
           paymentsInfo = retryData
         }
       } else {
         paymentsInfo = paymentsData
       }
     } catch (error) {
       console.warn('결제 정보 조회 실패:', error)
     }

     // 예약 선택 옵션 정보 가져오기
     let reservationChoicesInfo = null
     try {
       
       const { data: choicesData, error: choicesError } = await supabase
         .from('reservation_choices')
         .select('id, choice_id, option_id, quantity, total_price')
         .eq('reservation_id', reservation.id.toString())
       
       if (choicesError) {
         console.warn('예약 선택 옵션 조회 오류:', choicesError)
         // 재시도
         const { data: retryData, error: retryError } = await supabase
           .from('reservation_choices')
           .select('id, choice_id, option_id, quantity, total_price')
           .eq('reservation_id', String(reservation.id))
         
         if (retryError) {
           console.warn('재시도 예약 선택 옵션 조회 오류:', retryError)
         } else {
           reservationChoicesInfo = retryData
         }
       } else {
         reservationChoicesInfo = choicesData
       }
       
       // 새로운 테이블에서 choice와 option 정보 가져와서 매핑
       if (reservationChoicesInfo && reservationChoicesInfo.length > 0) {
         try {
           // reservation_choices에서 choice_id와 option_id를 가져와서 새로운 테이블에서 정보 조회
           const choiceIds = [...new Set(reservationChoicesInfo.map((c: { choice_id: string | null }) => c.choice_id ?? '').filter(Boolean))]
           const optionIds = [...new Set(reservationChoicesInfo.map((c: { option_id: string | null }) => c.option_id ?? '').filter(Boolean))]
           const optionIdsForDb = choiceOptionIdsForSupabaseIn(optionIds)
           const undecidedNames = undecidedOptionDisplayNames()
           
           // product_choices 테이블에서 choice 정보 조회
           const { data: choicesData, error: choicesError } = await supabase
             .from('product_choices')
             .select('id, choice_group, choice_group_ko')
             .in('id', choiceIds)
           
           // choice_options 테이블에서 option 정보 조회
           const { data: optionsData, error: optionsError } =
             optionIdsForDb.length > 0
               ? await supabase
                   .from('choice_options')
                   .select('id, option_key, option_name, option_name_ko')
                   .in('id', optionIdsForDb)
               : { data: [] as { id: string; option_key?: string; option_name: string; option_name_ko: string }[], error: null }
           
           if (!choicesError && !optionsError && choicesData && optionsData) {
             // choice와 option 정보를 매핑
             reservationChoicesInfo = reservationChoicesInfo.map((choice: {
               id: string
               choice_id: string | null
               option_id: string | null
               quantity: number | null
               total_price: number | null
             }) => {
               const choiceInfo = choicesData.find((c: { id: string; choice_group: string; choice_group_ko: string }) => c.id === (choice.choice_id ?? '')) as { id: string; choice_group: string; choice_group_ko: string } | undefined
               const optionInfo = optionsData.find((o: { id: string; option_name: string; option_name_ko: string }) => o.id === (choice.option_id ?? '')) as { id: string; option_name: string; option_name_ko: string } | undefined
               
              return {
                ...choice,
                choice: choiceInfo ? {
                  id: choiceInfo.id,
                  name_ko: choiceInfo.choice_group_ko,
                  name_en: choiceInfo.choice_group
                } : null,
                option: optionInfo ? {
                  id: optionInfo.id,
                  name_ko: optionInfo.option_name_ko,
                  name_en: optionInfo.option_name
                } : (choice.option_id === UNDECIDED_OPTION_ID ? {
                  id: UNDECIDED_OPTION_ID,
                  name_ko: undecidedNames.name_ko,
                  name_en: undecidedNames.name_en
                } : null)
              }
             })
           }
         } catch (error) {
           console.warn('새로운 테이블에서 초이스 정보 조회 실패:', error)
         }
       }
     } catch (error) {
       console.warn('예약 선택 옵션 조회 실패:', error)
     }

    return {
      ...reservation,
      products: productData || { 
        name: noProductName, 
        customer_name_ko: null,
        customer_name_en: null,
        duration: null, 
        base_price: null
      },
      multilingualDetails,
      pickupHotelInfo,
      pricing: pricingInfo,
      options: optionsInfo,
      payments: paymentsInfo,
      reservationChoices: reservationChoicesInfo,
    }
  } catch (error) {
    console.error('상품 정보 조회 중 예외:', error)
    return {
      ...reservation,
      products: emptyProduct(noProductName),
      multilingualDetails: null,
      pickupHotelInfo: null,
      pricing: null,
      options: null,
      payments: null,
      reservationChoices: null,
    }
  }
}

export async function enrichCustomerReservations(
  reservations: RawCustomerReservation[],
  options: EnrichOptions
): Promise<RawCustomerReservation[]> {
  return Promise.all(reservations.map((r) => enrichCustomerReservation(r, options)))
}
