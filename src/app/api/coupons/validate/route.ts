import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

/**
 * POST /api/coupons/validate
 * 
 * 쿠폰 코드 검증 및 할인 금액 계산 API
 * 
 * 요청 본문:
 * {
 *   couponCode: string,        // 쿠폰 코드
 *   totalAmount: number,      // 총 결제 금액
 *   productIds?: string[],   // 상품 ID 배열 (선택사항)
 * }
 * 
 * 응답:
 * {
 *   valid: boolean,
 *   discountAmount: number,  // 할인 금액
 *   finalAmount: number,     // 최종 결제 금액
 *   coupon: {                // 쿠폰 정보
 *     id: string,
 *     code: string,
 *     discount_type: string,
 *     percentage_value: number,
 *     fixed_value: number,
 *     description: string
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // 요청 본문 파싱
    let body
    try {
      body = await request.json()
    } catch (parseError) {
      console.error('쿠폰 검증 요청 파싱 오류:', parseError)
      return NextResponse.json(
        { error: '잘못된 요청 형식입니다.' },
        { status: 400 }
      )
    }

    const { couponCode, totalAmount, productIds = [] } = body

    console.log('쿠폰 검증 요청:', { couponCode, totalAmount, productIds })

    // 필수 필드 검증
    if (!couponCode || typeof couponCode !== 'string' || couponCode.trim().length === 0) {
      console.error('쿠폰 코드 검증 실패:', couponCode)
      return NextResponse.json(
        { 
          valid: false,
          error: '쿠폰 코드가 필요합니다.' 
        },
        { status: 200 } // 400 대신 200으로 반환하여 프론트엔드에서 처리
      )
    }

    if (totalAmount === undefined || totalAmount === null || isNaN(Number(totalAmount)) || Number(totalAmount) <= 0) {
      console.error('결제 금액 검증 실패:', totalAmount)
      return NextResponse.json(
        { 
          valid: false,
          error: '유효한 결제 금액이 필요합니다.' 
        },
        { status: 200 } // 400 대신 200으로 반환하여 프론트엔드에서 처리
      )
    }

    // 쿠폰 조회 (대소문자 구분 없이 비교)
    const normalizedCouponCode = couponCode.trim()
    
    // 모든 활성 쿠폰을 가져와서 대소문자 구분 없이 비교
    const { data: coupons, error: couponsError } = await supabase
      .from('coupons')
      .select('*')
      .eq('status', 'active')

    if (couponsError) {
      console.error('쿠폰 조회 오류:', couponsError)
      return NextResponse.json({
        valid: false,
        error: '쿠폰 조회 중 오류가 발생했습니다.'
      }, { status: 200 })
    }

    // 대소문자 구분 없이 쿠폰 찾기
    const coupon = coupons?.find(c => 
      c.coupon_code && 
      c.coupon_code.trim().toLowerCase() === normalizedCouponCode.toLowerCase()
    )

    if (!coupon) {
      return NextResponse.json({
        valid: false,
        error: '유효하지 않은 쿠폰 코드입니다.'
      }, { status: 200 })
    }

    // 날짜 검증
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    if (coupon.start_date) {
      const startDate = new Date(coupon.start_date)
      startDate.setHours(0, 0, 0, 0)
      if (today < startDate) {
        return NextResponse.json({
          valid: false,
          error: '쿠폰 사용 기간이 아직 시작되지 않았습니다.'
        }, { status: 200 })
      }
    }

    if (coupon.end_date) {
      const endDate = new Date(coupon.end_date)
      endDate.setHours(23, 59, 59, 999)
      if (today > endDate) {
        return NextResponse.json({
          valid: false,
          error: '쿠폰 사용 기간이 만료되었습니다.'
        }, { status: 200 })
      }
    }

    // 상품 ID 검증 (product_id가 지정된 경우)
    if (coupon.product_id && productIds.length > 0) {
      if (!productIds.includes(coupon.product_id)) {
        return NextResponse.json({
          valid: false,
          error: '이 쿠폰은 해당 상품에 사용할 수 없습니다.'
        }, { status: 200 })
      }
    }

    // 할인 금액 계산
    let discountAmount = 0

    if (coupon.discount_type === 'fixed' && coupon.fixed_value) {
      // 고정 할인
      discountAmount = coupon.fixed_value
    } else if (coupon.discount_type === 'percentage' && coupon.percentage_value) {
      // 퍼센트 할인
      discountAmount = (totalAmount * coupon.percentage_value) / 100
    } else {
      // 이중 할인 (고정값과 퍼센트 모두 있는 경우)
      if (coupon.fixed_value && coupon.percentage_value) {
        // 우선순위에 따라 계산 (현재는 fixed_first로 가정)
        const fixedDiscount = coupon.fixed_value
        const percentageDiscount = ((totalAmount - fixedDiscount) * coupon.percentage_value) / 100
        discountAmount = fixedDiscount + percentageDiscount
      } else if (coupon.fixed_value) {
        discountAmount = coupon.fixed_value
      } else if (coupon.percentage_value) {
        discountAmount = (totalAmount * coupon.percentage_value) / 100
      }
    }

    // 최소 금액 검증 (필요시)
    // 최대 할인 금액 제한 (필요시)

    // 최종 금액 계산 (할인 금액이 총액을 초과하지 않도록)
    const finalAmount = Math.max(0, totalAmount - discountAmount)

    return NextResponse.json({
      valid: true,
      discountAmount: Math.round(discountAmount * 100) / 100,
      finalAmount: Math.round(finalAmount * 100) / 100,
      coupon: {
        id: coupon.id,
        code: coupon.coupon_code,
        discount_type: coupon.discount_type,
        percentage_value: coupon.percentage_value,
        fixed_value: coupon.fixed_value,
        description: coupon.description
      }
    })

  } catch (error) {
    console.error('쿠폰 검증 오류:', error)
    return NextResponse.json(
      { error: '쿠폰 검증 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

