import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { Resend } from 'resend'

/**
 * POST /api/send-email
 * 
 * 예약 확인 이메일 발송 API
 * 
 * 요청 본문:
 * {
 *   reservationId: string,
 *   email: string,
 *   type: 'receipt' | 'voucher' | 'both',  // 영수증, 투어 바우처, 또는 둘 다
 *   locale?: 'ko' | 'en'
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { reservationId, email, type = 'both', locale = 'ko', sentBy } = body

    if (!reservationId || !email) {
      return NextResponse.json(
        { error: '예약 ID와 이메일 주소가 필요합니다.' },
        { status: 400 }
      )
    }

    // 예약 정보 조회 (별도 조회로 변경)
    const { data: reservation, error: reservationError } = await supabase
      .from('reservations')
      .select('*')
      .eq('id', reservationId)
      .single()

    if (reservationError || !reservation) {
      return NextResponse.json(
        { error: '예약을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    const reservationData = reservation as any

    // 고객 정보 조회
    let customer = null
    if (reservationData.customer_id) {
      const { data: customerData } = await supabase
        .from('customers')
        .select('id, name, email, language')
        .eq('id', reservationData.customer_id)
        .maybeSingle()
      customer = customerData as any
    }

    if (!customer) {
      return NextResponse.json(
        { error: '고객 정보를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 상품 정보 조회
    let product = null
    if (reservationData.product_id) {
      const { data: productData } = await supabase
        .from('products')
        .select('id, name, name_ko, name_en, customer_name_ko, customer_name_en, duration, departure_city, arrival_city')
        .eq('id', reservationData.product_id)
        .maybeSingle()
      product = productData as any
    }

    if (!product) {
      return NextResponse.json(
        { error: '상품 정보를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 가격 정보 조회
    let pricing = null
    const { data: pricingData } = await supabase
      .from('reservation_pricing')
      .select('*')
      .eq('reservation_id', reservationId)
      .maybeSingle()
    pricing = pricingData

    // 상품 상세 정보 조회 (multilingual)
    const customerData = customer as any
    const customerLanguage = customerData?.language?.toLowerCase() || 'ko'
    const emailLocale = locale === 'en' || customerLanguage === 'en' || customerLanguage === 'english' || customerLanguage === '영어' ? 'en' : 'ko'
    const languageCode = emailLocale === 'en' ? 'en' : 'ko'
    
    let productDetails = null
    if (reservationData.channel_id) {
      const { data: channelDetails } = await supabase
        .from('product_details_multilingual')
        .select('*')
        .eq('product_id', reservationData.product_id)
        .eq('language_code', languageCode)
        .eq('channel_id', reservationData.channel_id)
        .maybeSingle()
      productDetails = channelDetails as any
    }
    
    if (!productDetails) {
      const { data: commonDetails } = await supabase
        .from('product_details_multilingual')
        .select('*')
        .eq('product_id', reservationData.product_id)
        .eq('language_code', languageCode)
        .is('channel_id', null)
        .maybeSingle()
      productDetails = commonDetails as any
    }

    // 투어 스케줄 조회
    let productSchedules = null
    const { data: schedulesData } = await supabase
      .from('product_schedules')
      .select('id, day_number, start_time, end_time, title_ko, title_en, description_ko, description_en, show_to_customers, order_index')
      .eq('product_id', reservationData.product_id)
      .eq('show_to_customers', true)
      .order('day_number', { ascending: true })
      .order('order_index', { ascending: true })
    productSchedules = (schedulesData || []) as any[]

    // 투어 상태 조회 (recruiting vs confirmed)
    let tourStatus = null
    let tourDetails: any = null
    if (reservationData.tour_id) {
      const { data: tourData } = await supabase
        .from('tours')
        .select('*')
        .eq('id', reservationData.tour_id)
        .maybeSingle()
      
      const tourDataTyped = tourData as any
      tourStatus = tourDataTyped?.tour_status || tourDataTyped?.status || reservationData.status

      // Tour Details 조회 (가이드, 어시스턴트, 차량 정보)
      if (tourDataTyped) {
        let tourGuideInfo = null
        let assistantInfo = null
        let vehicleInfo = null

        if (tourDataTyped.tour_guide_id) {
          const { data: guideData } = await supabase
            .from('team')
            .select('name_ko, name_en, phone, email, languages')
            .eq('email', tourDataTyped.tour_guide_id)
            .maybeSingle()
          tourGuideInfo = guideData as any
        }

        if (tourDataTyped.assistant_id) {
          const { data: assistantData } = await supabase
            .from('team')
            .select('name_ko, name_en, phone, email')
            .eq('email', tourDataTyped.assistant_id)
            .maybeSingle()
          assistantInfo = assistantData as any
        }

        if (tourDataTyped.tour_car_id) {
          const { data: vehicleData } = await supabase
            .from('vehicles')
            .select('vehicle_type, capacity, color')
            .eq('id', tourDataTyped.tour_car_id)
            .maybeSingle()

          const vehicleDataTyped = vehicleData as any
          if (vehicleDataTyped?.vehicle_type) {
            const { data: vehicleTypeData } = await supabase
              .from('vehicle_types')
              .select('id, name, brand, model, passenger_capacity, description')
              .eq('name', vehicleDataTyped.vehicle_type)
              .maybeSingle()

            const { data: photosData } = await supabase
              .from('vehicle_type_photos')
              .select('photo_url, photo_name, description, is_primary, display_order')
              .eq('vehicle_type_id', (vehicleTypeData as any)?.id || '')
              .order('display_order', { ascending: true })
              .order('is_primary', { ascending: false })

            const vehicleTypeDataTyped = vehicleTypeData as any
            vehicleInfo = {
              vehicle_type: vehicleDataTyped.vehicle_type,
              color: vehicleDataTyped.color,
              vehicle_type_info: vehicleTypeDataTyped ? {
                name: vehicleTypeDataTyped.name,
                brand: vehicleTypeDataTyped.brand,
                model: vehicleTypeDataTyped.model,
                passenger_capacity: vehicleTypeDataTyped.passenger_capacity || vehicleDataTyped.capacity,
                description: vehicleTypeDataTyped.description
              } : {
                name: vehicleDataTyped.vehicle_type,
                passenger_capacity: vehicleDataTyped.capacity
              },
              vehicle_type_photos: photosData || []
            }
          }
        }

        tourDetails = {
          ...tourDataTyped,
          tour_guide: tourGuideInfo,
          assistant: assistantInfo,
          vehicle: vehicleInfo
        }
      }
    } else {
      tourStatus = reservationData.status
    }

    const isEnglish = emailLocale === 'en'

    // 이메일 내용 생성
    const isDepartureConfirmation = type === 'voucher'
    const emailContent = generateEmailContent(
      reservationData,
      customerData,
      product,
      pricing as any,
      productDetails,
      productSchedules,
      tourStatus,
      tourDetails,
      type,
      isEnglish,
      isDepartureConfirmation
    )
    
    // Resend를 사용한 이메일 발송
    const resendApiKey = process.env.RESEND_API_KEY
    if (!resendApiKey) {
      console.error('RESEND_API_KEY 환경 변수가 설정되지 않았습니다.')
      return NextResponse.json(
        { error: '이메일 서비스 설정 오류입니다.' },
        { status: 500 }
      )
    }

    const resend = new Resend(resendApiKey)
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'info@maniatour.com'
    // Reply-To 설정: 회신은 info@maniatour.com으로 받기
    const replyTo = process.env.RESEND_REPLY_TO || 'info@maniatour.com'

    try {
      const { data: emailResult, error: emailError } = await resend.emails.send({
        from: fromEmail,
        reply_to: replyTo,
        to: email,
        subject: emailContent.subject,
        html: emailContent.html,
        // 읽음 추적 활성화
        open_tracking: true,
        click_tracking: true,
      })

      if (emailError) {
        console.error('Resend 이메일 발송 오류:', emailError)
        
        // 실패 기록 저장
        try {
          const emailType = type === 'both' ? 'confirmation' : type === 'voucher' ? 'departure' : 'confirmation'
          await supabase
            .from('email_logs')
            .insert({
              reservation_id: reservationId,
              email: email,
              email_type: emailType,
              subject: emailContent.subject,
              status: 'failed',
              error_message: emailError.message || 'Email sending failed',
              sent_at: new Date().toISOString(),
              sent_by: sentBy || null
            } as never)
        } catch (logError) {
          // 무시
        }
        
        return NextResponse.json(
          { error: '이메일 발송에 실패했습니다.', details: emailError.message },
          { status: 500 }
        )
      }

      console.log('이메일 발송 성공:', {
        to: email,
        subject: emailContent.subject,
        type,
        reservationId,
        emailId: emailResult?.id
      })

      // 이메일 발송 기록 저장
      try {
        const emailType = type === 'both' ? 'confirmation' : type === 'voucher' ? 'departure' : 'confirmation'
        const { error: logError } = await supabase
          .from('email_logs')
          .insert({
            reservation_id: reservationId,
            email: email,
            email_type: emailType,
            subject: emailContent.subject,
            status: 'sent',
            sent_at: new Date().toISOString(),
            sent_by: sentBy || null,
            resend_email_id: emailResult?.id || null
          } as never)

        if (logError) {
          console.error('이메일 로그 저장 오류 (무시):', logError)
        }
      } catch (error) {
        console.log('이메일 로그 테이블이 없습니다. (무시됨)')
      }
    } catch (error) {
      console.error('이메일 발송 오류:', error)
      
      // 실패 기록 저장
      try {
        const emailType = type === 'both' ? 'confirmation' : type === 'voucher' ? 'departure' : 'confirmation'
        await supabase
          .from('email_logs')
          .insert({
            reservation_id: reservationId,
            email: email,
            email_type: emailType,
            subject: emailContent.subject,
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error',
            sent_at: new Date().toISOString(),
            sent_by: sentBy || null
          } as never)
      } catch (logError) {
        // 무시
      }
      
      return NextResponse.json(
        { error: '이메일 발송 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: '이메일이 발송되었습니다.',
      email: emailContent
    })

  } catch (error) {
    console.error('이메일 발송 오류:', error)
    return NextResponse.json(
      { error: '이메일 발송 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

export function generateEmailContent(
  reservation: any,
  customer: any,
  product: any,
  pricing: any,
  productDetails: any,
  productSchedules: any[],
  tourStatus: string | null,
  tourDetails: any,
  type: 'receipt' | 'voucher' | 'both',
  isEnglish: boolean,
  isDepartureConfirmation: boolean = false
) {
  const productName = isEnglish 
    ? (product?.customer_name_en || product?.name_en || product?.name) 
    : (product?.customer_name_ko || product?.name_ko || product?.name)
  
  const tourDate = new Date(reservation.tour_date).toLocaleDateString(isEnglish ? 'en-US' : 'ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  })

  const isRecruiting = tourStatus?.toLowerCase() === 'recruiting'
  const isConfirmed = tourStatus?.toLowerCase() === 'confirmed' || reservation.status?.toLowerCase() === 'confirmed'

  // 시간 포맷팅 함수
  const formatTime = (time: string) => {
    if (!time) return ''
    const [hours, minutes] = time.split(':')
    const hour = parseInt(hours, 10)
    const period = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    return `${displayHour}:${minutes || '00'} ${period}`
  }

  // 기간 계산 함수
  const calculateDuration = (start: string, end: string) => {
    if (!start || !end) return ''
    const [startHour, startMin] = start.split(':').map(Number)
    const [endHour, endMin] = end.split(':').map(Number)
    const startTotal = startHour * 60 + startMin
    const endTotal = endHour * 60 + endMin
    const diff = endTotal - startTotal
    if (diff < 0) return ''
    const hours = Math.floor(diff / 60)
    const minutes = diff % 60
    if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`
    if (hours > 0) return `${hours}h`
    return `${minutes}m`
  }

  // 인원 필드 매핑
  const adults = reservation.adults ?? 0
  const children = reservation.child ?? reservation.children ?? 0
  const infants = reservation.infant ?? reservation.infants ?? 0
  const totalPeople = reservation.total_people ?? (adults + children + infants)

  // 가격 정보
  const currency = pricing?.currency || 'USD'
  const currencySymbol = currency === 'KRW' ? '₩' : '$'
  const depositAmount = pricing?.deposit_amount || 0
  const balanceAmount = pricing?.balance_amount || 0

  let subject = ''
  let html = ''

  // 투어 출발 확정 안내문구 (voucher 타입일 때만)
  const departureNotice = isDepartureConfirmation ? `
    <div style="background: #dbeafe; border-left: 4px solid #3b82f6; padding: 20px; margin-bottom: 30px; border-radius: 4px;">
      <h2 style="margin: 0 0 10px 0; color: #1e40af; font-size: 20px; font-weight: bold;">
        ${isEnglish ? '🎉 Tour Departure Confirmed!' : '🎉 투어 출발이 확정되었습니다!'}
      </h2>
      <p style="margin: 0; color: #1e3a8a; font-size: 16px; line-height: 1.6;">
        ${isEnglish 
          ? `Your tour departure has been confirmed. We look forward to seeing you on ${tourDate}!`
          : `투어 출발이 확정되었습니다. ${tourDate}에 만나뵙기를 기대하겠습니다!`}
      </p>
    </div>
  ` : ''

  // Recruiting 상태 안내
  const recruitingNotice = isRecruiting ? `
    <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 20px; margin-bottom: 30px; border-radius: 4px;">
      <div style="display: flex; align-items: start;">
        <div style="flex-shrink: 0; margin-right: 12px;">
          <svg style="width: 24px; height: 24px; color: #3b82f6;" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
          </svg>
        </div>
        <div style="flex: 1;">
          <p style="margin: 0; font-size: 16px; font-weight: 600; color: #1e40af;">
            ${isEnglish ? 'Tour is Currently Recruiting' : '투어 모집 중'}
          </p>
          <p style="margin: 8px 0 0 0; font-size: 14px; color: #1e3a8a; line-height: 1.6;">
            ${isEnglish 
              ? 'This tour is currently recruiting participants. Your reservation will be confirmed once the minimum number of participants is reached. We will notify you as soon as the tour is confirmed.'
              : '현재 이 투어는 참가자를 모집 중입니다. 최소 인원이 충족되면 예약이 확정됩니다. 투어 확정 시 즉시 알려드리겠습니다.'}
          </p>
        </div>
      </div>
    </div>
  ` : ''

  // Confirmed 상태 안내
  const confirmedNotice = isConfirmed && !isRecruiting ? `
    <div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 20px; margin-bottom: 30px; border-radius: 4px;">
      <div style="display: flex; align-items: start;">
        <div style="flex-shrink: 0; margin-right: 12px;">
          <svg style="width: 24px; height: 24px; color: #10b981;" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
          </svg>
        </div>
        <div style="flex: 1;">
          <p style="margin: 0; font-size: 16px; font-weight: 600; color: #065f46;">
            ${isEnglish ? '✅ Reservation Confirmed' : '✅ 예약 확정'}
          </p>
          <p style="margin: 8px 0 0 0; font-size: 14px; color: #047857; line-height: 1.6;">
            ${isEnglish 
              ? 'Your reservation has been confirmed. We look forward to seeing you on the tour!'
              : '예약이 확정되었습니다. 투어에서 만나뵙기를 기대하겠습니다!'}
          </p>
        </div>
      </div>
    </div>
  ` : ''

  // 가격 정보 HTML 생성
  const generatePriceSection = () => {
    if (!pricing) return ''
    
    return `
      <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; margin-bottom: 30px;">
        <div style="background: #f9fafb; padding: 15px; border-bottom: 1px solid #e5e7eb;">
          <h3 style="margin: 0; font-size: 18px; font-weight: 600; color: #111827;">
            ${isEnglish ? '💰 Price Information' : '💰 가격 정보'}
          </h3>
        </div>
        <div style="padding: 20px;">
          ${adults > 0 ? `
          <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f3f4f6;">
            <span style="color: #6b7280; font-size: 14px;">${isEnglish ? 'Adults' : '성인'} x ${adults}</span>
            <span style="font-weight: 600; color: #111827;">${currencySymbol}${((pricing.adult_product_price || 0) * adults).toFixed(2)}</span>
          </div>
          ` : ''}
          ${children > 0 ? `
          <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f3f4f6;">
            <span style="color: #6b7280; font-size: 14px;">${isEnglish ? 'Children' : '아동'} x ${children}</span>
            <span style="font-weight: 600; color: #111827;">${currencySymbol}${((pricing.child_product_price || 0) * children).toFixed(2)}</span>
          </div>
          ` : ''}
          ${infants > 0 ? `
          <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f3f4f6;">
            <span style="color: #6b7280; font-size: 14px;">${isEnglish ? 'Infants' : '유아'} x ${infants}</span>
            <span style="font-weight: 600; color: #111827;">${currencySymbol}${((pricing.infant_product_price || 0) * infants).toFixed(2)}</span>
          </div>
          ` : ''}
          ${pricing.product_price_total ? `
          <div style="display: flex; justify-content: space-between; padding: 15px 0; margin-top: 10px; border-top: 2px solid #e5e7eb; border-bottom: 1px solid #f3f4f6;">
            <span style="font-weight: 600; color: #374151;">${isEnglish ? 'Product Total' : '상품 총액'}</span>
            <span style="font-weight: 600; color: #111827;">${currencySymbol}${pricing.product_price_total.toFixed(2)}</span>
          </div>
          ` : ''}
          ${pricing.coupon_discount && pricing.coupon_discount !== 0 ? `
          <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f3f4f6;">
            <span style="color: #10b981; font-size: 14px;">${isEnglish ? 'Coupon Discount' : '쿠폰 할인'}</span>
            <span style="font-weight: 600; color: #10b981;">-${currencySymbol}${Math.abs(pricing.coupon_discount).toFixed(2)}</span>
          </div>
          ` : ''}
          ${pricing.subtotal ? `
          <div style="display: flex; justify-content: space-between; padding: 20px 0; margin-top: 10px; background: #eff6ff; border-radius: 6px; padding: 15px;">
            <span style="font-size: 18px; font-weight: 700; color: #1e40af;">${isEnglish ? 'Grand Total' : '최종 결제 금액'}</span>
            <span style="font-size: 20px; font-weight: 700; color: #1e40af;">${currencySymbol}${(pricing.subtotal - Math.abs(pricing.coupon_discount || 0)).toFixed(2)}</span>
          </div>
          ` : ''}
          ${depositAmount > 0 ? `
          <div style="display: flex; justify-content: space-between; padding: 10px 0; margin-top: 15px; border-top: 1px solid #e5e7eb;">
            <span style="color: #6b7280; font-size: 14px;">${isEnglish ? 'Deposit' : '입금액'}</span>
            <span style="font-weight: 600; color: #7c3aed;">${currencySymbol}${depositAmount.toFixed(2)}</span>
          </div>
          ` : ''}
          ${balanceAmount > 0 ? `
          <div style="display: flex; justify-content: space-between; padding: 10px 0;">
            <span style="color: #6b7280; font-size: 14px;">${isEnglish ? 'Balance' : '잔액'}</span>
            <span style="font-weight: 600; color: #dc2626;">${currencySymbol}${balanceAmount.toFixed(2)}</span>
          </div>
          ` : ''}
        </div>
      </div>
    `
  }

  // 상품 상세 정보 HTML 생성
  const generateProductDetailsSection = () => {
    if (!productDetails) return ''
    
    const details = []
    if (productDetails.included) details.push({ title: isEnglish ? 'Included' : '포함 사항', content: productDetails.included })
    if (productDetails.not_included) details.push({ title: isEnglish ? 'Not Included' : '불포함 사항', content: productDetails.not_included })
    if (productDetails.pickup_drop_info) details.push({ title: isEnglish ? 'Meeting Point' : '만남 장소', content: productDetails.pickup_drop_info })
    if (productDetails.cancellation_policy) details.push({ title: isEnglish ? 'Cancellation Policy' : '취소 정책', content: productDetails.cancellation_policy })
    if (productDetails.luggage_info) details.push({ title: isEnglish ? 'Luggage Info' : '수하물 정보', content: productDetails.luggage_info })
    if (productDetails.tour_operation_info) details.push({ title: isEnglish ? 'Tour Operation Info' : '투어 운영 정보', content: productDetails.tour_operation_info })
    if (productDetails.preparation_info) details.push({ title: isEnglish ? 'Preparation Info' : '준비 사항', content: productDetails.preparation_info })
    if (productDetails.small_group_info) details.push({ title: isEnglish ? 'Small Group Info' : '소규모 그룹 정보', content: productDetails.small_group_info })
    if (productDetails.notice_info) details.push({ title: isEnglish ? 'Notice' : '안내 사항', content: productDetails.notice_info })
    if (productDetails.private_tour_info) details.push({ title: isEnglish ? 'Private Tour Info' : '프라이빗 투어 정보', content: productDetails.private_tour_info })
    
    if (details.length === 0) return ''
    
    return `
      <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; margin-bottom: 30px;">
        <div style="background: #f9fafb; padding: 15px; border-bottom: 1px solid #e5e7eb;">
          <h3 style="margin: 0; font-size: 18px; font-weight: 600; color: #111827;">
            📋 ${isEnglish ? 'Product Details' : '상품 상세 정보'}
          </h3>
        </div>
        <div style="padding: 20px; background: #f9fafb;">
          ${details.map(detail => `
            <div style="margin-bottom: 25px;">
              <h4 style="margin: 0 0 10px 0; font-size: 16px; font-weight: 700; color: #111827;">${detail.title}</h4>
              <p style="margin: 0; font-size: 14px; color: #374151; line-height: 1.8; white-space: pre-wrap;">${detail.content}</p>
            </div>
          `).join('')}
        </div>
      </div>
    `
  }

  // 투어 스케줄 HTML 생성
  const generateTourScheduleSection = () => {
    if (!productSchedules || productSchedules.length === 0) return ''
    
    return `
      <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; margin-bottom: 30px;">
        <div style="background: #f9fafb; padding: 15px; border-bottom: 1px solid #e5e7eb;">
          <h3 style="margin: 0; font-size: 18px; font-weight: 600; color: #111827;">
            📅 ${isEnglish ? 'Tour Schedule' : '투어 스케줄'}
          </h3>
        </div>
        <div style="padding: 20px;">
          ${productSchedules.map((schedule: any) => {
            const title = isEnglish ? (schedule.title_en || schedule.title_ko) : (schedule.title_ko || schedule.title_en)
            const description = isEnglish ? schedule.description_en : schedule.description_ko
            const duration = schedule.start_time && schedule.end_time ? calculateDuration(schedule.start_time, schedule.end_time) : ''
            
            return `
              <div style="padding: 15px; margin-bottom: 15px; background: #f0fdf4; border-left: 4px solid #10b981; border-radius: 4px;">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px; flex-wrap: wrap;">
                  ${schedule.start_time ? `
                  <span style="font-size: 16px; font-weight: 600; color: #059669;">
                    ${formatTime(schedule.start_time)}
                    ${schedule.end_time ? ` - ${formatTime(schedule.end_time)}` : ''}
                  </span>
                  ` : ''}
                  ${duration ? `
                  <span style="display: inline-flex; align-items: center; padding: 4px 10px; background: #d1fae5; color: #065f46; border-radius: 12px; font-size: 12px; font-weight: 600;">
                    ${duration}
                  </span>
                  ` : ''}
                </div>
                <div style="margin-bottom: 8px;">
                  <span style="font-size: 15px; font-weight: 600; color: #111827;">${title || ''}</span>
                </div>
                ${description ? `
                <p style="margin: 0; font-size: 13px; color: #4b5563; line-height: 1.6; white-space: pre-wrap;">${description}</p>
                ` : ''}
              </div>
            `
          }).join('')}
        </div>
      </div>
    `
  }

  // Tour Details HTML 생성
  const generateTourDetailsSection = () => {
    if (!tourDetails) return ''
    
    return `
      <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; margin-bottom: 30px;">
        <div style="background: #f9fafb; padding: 15px; border-bottom: 1px solid #e5e7eb;">
          <h3 style="margin: 0; font-size: 18px; font-weight: 600; color: #111827;">
            👥 ${isEnglish ? 'Tour Details' : '투어 상세 정보'}
          </h3>
        </div>
        <div style="padding: 20px;">
          ${tourDetails.tour_guide ? `
          <div style="margin-bottom: 20px; padding: 15px; background: #f0f9ff; border-radius: 8px; border-left: 4px solid #0ea5e9;">
            <div style="font-weight: 600; color: #0c4a6e; margin-bottom: 8px; font-size: 16px;">
              ${isEnglish ? '👨‍🏫 Tour Guide' : '👨‍🏫 투어 가이드'}
            </div>
            <div style="color: #1e293b;">
              <div style="margin-bottom: 5px;">
                <strong>${isEnglish ? 'Name:' : '이름:'}</strong> 
                ${isEnglish 
                  ? (tourDetails.tour_guide.name_en || tourDetails.tour_guide.name_ko || 'N/A')
                  : (tourDetails.tour_guide.name_ko || tourDetails.tour_guide.name_en || 'N/A')}
              </div>
              ${tourDetails.tour_guide.phone ? `
              <div style="margin-bottom: 5px;">
                <strong>${isEnglish ? 'Phone:' : '전화번호:'}</strong> ${tourDetails.tour_guide.phone}
              </div>
              ` : ''}
              ${tourDetails.tour_guide.languages ? `
              <div style="margin-bottom: 5px;">
                <strong>${isEnglish ? 'Languages:' : '언어:'}</strong> 
                ${Array.isArray(tourDetails.tour_guide.languages) 
                  ? tourDetails.tour_guide.languages.join(', ')
                  : tourDetails.tour_guide.languages}
              </div>
              ` : ''}
            </div>
          </div>
          ` : ''}
          ${tourDetails.assistant ? `
          <div style="margin-bottom: 20px; padding: 15px; background: #f0fdf4; border-radius: 8px; border-left: 4px solid #10b981;">
            <div style="font-weight: 600; color: #065f46; margin-bottom: 8px; font-size: 16px;">
              ${isEnglish ? '👨‍💼 Assistant' : '👨‍💼 어시스턴트'}
            </div>
            <div style="color: #1e293b;">
              <div style="margin-bottom: 5px;">
                <strong>${isEnglish ? 'Name:' : '이름:'}</strong> 
                ${isEnglish 
                  ? (tourDetails.assistant.name_en || tourDetails.assistant.name_ko || 'N/A')
                  : (tourDetails.assistant.name_ko || tourDetails.assistant.name_en || 'N/A')}
              </div>
              ${tourDetails.assistant.phone ? `
              <div style="margin-bottom: 5px;">
                <strong>${isEnglish ? 'Phone:' : '전화번호:'}</strong> ${tourDetails.assistant.phone}
              </div>
              ` : ''}
            </div>
          </div>
          ` : ''}
          ${tourDetails.vehicle ? `
          <div style="margin-bottom: 20px; padding: 15px; background: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
            <div style="font-weight: 600; color: #92400e; margin-bottom: 8px; font-size: 16px;">
              ${isEnglish ? '🚗 Vehicle' : '🚗 차량'}
            </div>
            <div style="color: #1e293b;">
              ${tourDetails.vehicle.vehicle_type_info ? `
              <div style="margin-bottom: 5px;">
                <strong>${isEnglish ? 'Type:' : '타입:'}</strong> ${tourDetails.vehicle.vehicle_type_info.name || tourDetails.vehicle.vehicle_type || 'N/A'}
              </div>
              ${tourDetails.vehicle.vehicle_type_info.brand && tourDetails.vehicle.vehicle_type_info.model ? `
              <div style="margin-bottom: 5px;">
                <strong>${isEnglish ? 'Model:' : '모델:'}</strong> ${tourDetails.vehicle.vehicle_type_info.brand} ${tourDetails.vehicle.vehicle_type_info.model}
              </div>
              ` : ''}
              ${tourDetails.vehicle.vehicle_type_info.passenger_capacity ? `
              <div style="margin-bottom: 5px;">
                <strong>${isEnglish ? 'Capacity:' : '정원:'}</strong> ${tourDetails.vehicle.vehicle_type_info.passenger_capacity} ${isEnglish ? 'people' : '명'}
              </div>
              ` : ''}
              ${tourDetails.vehicle.color ? `
              <div style="margin-bottom: 5px;">
                <strong>${isEnglish ? 'Color:' : '색상:'}</strong> ${tourDetails.vehicle.color}
              </div>
              ` : ''}
              ${tourDetails.vehicle.vehicle_type_info.description ? `
              <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #d1d5db;">
                <div style="font-size: 14px; color: #4b5563;">${tourDetails.vehicle.vehicle_type_info.description}</div>
              </div>
              ` : ''}
              ` : `
              <div style="margin-bottom: 5px;">
                <strong>${isEnglish ? 'Type:' : '타입:'}</strong> ${tourDetails.vehicle.vehicle_type || 'N/A'}
              </div>
              `}
            </div>
          </div>
          ` : ''}
        </div>
      </div>
    `
  }

  // 예약 정보 섹션
  const reservationInfoSection = `
    <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; margin-bottom: 30px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px;">
        <h1 style="margin: 0 0 10px 0; font-size: 28px; font-weight: 700;">${isEnglish ? 'Reservation Confirmation' : '예약 확인'}</h1>
        <p style="margin: 0; font-size: 16px; opacity: 0.9;">${isEnglish ? `Reservation ID: ${reservation.id}` : `예약 번호: ${reservation.id}`}</p>
      </div>
      <div style="padding: 25px;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
          <div>
            <div style="font-size: 12px; color: #6b7280; margin-bottom: 5px; font-weight: 600; text-transform: uppercase;">${isEnglish ? 'Customer Name' : '고객명'}</div>
            <div style="font-size: 16px; font-weight: 600; color: #111827;">${customer.name}</div>
          </div>
          <div>
            <div style="font-size: 12px; color: #6b7280; margin-bottom: 5px; font-weight: 600; text-transform: uppercase;">${isEnglish ? 'Tour Date' : '투어 날짜'}</div>
            <div style="font-size: 16px; font-weight: 600; color: #111827;">${tourDate}</div>
          </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
          <div>
            <div style="font-size: 12px; color: #6b7280; margin-bottom: 5px; font-weight: 600; text-transform: uppercase;">${isEnglish ? 'Product' : '상품'}</div>
            <div style="font-size: 16px; font-weight: 600; color: #111827;">${productName}</div>
          </div>
          <div>
            <div style="font-size: 12px; color: #6b7280; margin-bottom: 5px; font-weight: 600; text-transform: uppercase;">${isEnglish ? 'Total People' : '총 인원'}</div>
            <div style="font-size: 16px; font-weight: 600; color: #111827;">
              ${totalPeople} ${isEnglish ? (totalPeople === 1 ? 'person' : 'people') : '명'}
              <span style="font-size: 13px; color: #6b7280; font-weight: 400; margin-left: 8px;">
                (${isEnglish ? 'Adults' : '성인'}: ${adults}, ${isEnglish ? 'Children' : '아동'}: ${children}, ${isEnglish ? 'Infants' : '유아'}: ${infants})
              </span>
            </div>
          </div>
        </div>
        ${reservation.pickup_time ? `
        <div style="padding: 15px; background: #eff6ff; border-radius: 6px; border-left: 4px solid #3b82f6;">
          <div style="font-size: 12px; color: #1e40af; margin-bottom: 5px; font-weight: 600; text-transform: uppercase;">${isEnglish ? 'Pickup Time' : '픽업 시간'}</div>
          <div style="font-size: 18px; font-weight: 700; color: #1e40af;">${formatTime(reservation.pickup_time)}</div>
        </div>
        ` : ''}
      </div>
    </div>
  `

  // 메인 이메일 HTML 생성
  const mainEmailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
          line-height: 1.6; 
          color: #111827; 
          background-color: #f3f4f6;
          margin: 0;
          padding: 0;
        }
        .email-container { 
          max-width: 700px; 
          margin: 0 auto; 
          background: white;
        }
        .email-content {
          padding: 0;
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="email-content">
          ${departureNotice}
          ${recruitingNotice}
          ${!isDepartureConfirmation ? confirmedNotice : ''}
          ${reservationInfoSection}
          ${generatePriceSection()}
          ${generateProductDetailsSection()}
          ${generateTourScheduleSection()}
          ${generateTourDetailsSection()}
          <div style="background: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; font-size: 14px; color: #6b7280;">
              ${isEnglish 
                ? 'Thank you for your reservation! If you have any questions, please contact us.'
                : '예약해 주셔서 감사합니다! 궁금한 사항이 있으시면 언제든지 연락주세요.'}
            </p>
            <p style="margin: 15px 0 0 0; font-size: 12px; color: #9ca3af;">
              ${isEnglish 
                ? 'This is an automated email. Please do not reply to this email.'
                : '이 이메일은 자동으로 발송된 메일입니다. 회신하지 마세요.'}
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `

  if (type === 'voucher' || type === 'both') {
    subject = isEnglish 
      ? (isDepartureConfirmation 
        ? `Tour Departure Confirmed - ${reservation.id}`
        : `Reservation Confirmation - ${reservation.id}`)
      : (isDepartureConfirmation
        ? `투어 출발 확정 - ${reservation.id}`
        : `예약 확인 - ${reservation.id}`)
    
    html = mainEmailHtml
  } else {
    // receipt only
    subject = isEnglish 
      ? `Payment Receipt - Reservation ${reservation.id}`
      : `결제 영수증 - 예약 ${reservation.id}`
    
    html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
            line-height: 1.6; 
            color: #111827; 
            background-color: #f3f4f6;
            margin: 0;
            padding: 0;
          }
          .email-container { 
            max-width: 700px; 
            margin: 0 auto; 
            background: white;
          }
        </style>
      </head>
      <body>
        <div class="email-container">
          ${reservationInfoSection}
          ${generatePriceSection()}
          ${generateProductDetailsSection()}
          ${generateTourScheduleSection()}
          ${generateTourDetailsSection()}
          <div style="background: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; font-size: 14px; color: #6b7280;">
              ${isEnglish 
                ? 'Thank you for your reservation!'
                : '예약해 주셔서 감사합니다!'}
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  }

  return { subject, html }
}

