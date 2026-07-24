import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  calculateServerBookingPrice,
  createPendingCustomerBooking,
  createStripePaymentIntentForReservation,
  parseCustomerBookingCustomer,
  parseCustomerBookingLine,
  recordPendingStripePayment,
  resolveCartLineCouponDiscounts,
  type CreatePendingBookingResult,
  type CustomerBookingLineInput,
  type CustomerBookingPriceResult,
} from '@/lib/customerBookingCheckout'
import { resolveBundleDiscountsForCart } from '@/lib/productBundleDiscounts'
import { parseBookingLocale } from '@/lib/customerBookingEmail'
import { getPublicOperatorId } from '@/lib/operators/getPublicOperatorId'
import { resolvePublicDirectChannel } from '@/lib/operators/resolvePublicDirectChannel'
import { resolveConnectCheckoutDestination } from '@/lib/operators/stripeConnectCheckout'

/**
 * POST /api/booking/create-checkout
 * 서버에서 고객·예약(pending)·가격을 생성하고 Stripe PaymentIntent를 발급합니다.
 * 장바구니 합계 쿠폰은 합계 기준으로 계산한 뒤 라인에 비례 배분합니다.
 */
export async function POST(request: NextRequest) {
  const createdReservationIds: string[] = []

  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: '서버 결제 설정이 완료되지 않았습니다. (SUPABASE_SERVICE_ROLE_KEY)' },
        { status: 503 }
      )
    }

    const body = await request.json()
    const customer = parseCustomerBookingCustomer(body.customerInfo ?? body.customer)
    const couponCode = typeof body.couponCode === 'string' ? body.couponCode.trim() : ''
    const locale = parseBookingLocale(body.locale)

    if (!customer) {
      return NextResponse.json(
        { error: '고객 이름, 이메일, 전화번호가 필요합니다.' },
        { status: 400 }
      )
    }

    const publicOperatorId = await getPublicOperatorId()
    const direct = await resolvePublicDirectChannel(supabaseAdmin, publicOperatorId, {
      ensure: true,
    })
    const tenant = {
      operatorId: direct.operatorId,
      channelId: direct.channelId,
    }

    const rawItems = Array.isArray(body.items) ? body.items : null
    const parsedLines: Array<CustomerBookingLineInput | null> = rawItems
      ? rawItems.map((item: unknown) => parseCustomerBookingLine(item))
      : [parseCustomerBookingLine(body.line ?? body)]
    const lines: CustomerBookingLineInput[] = parsedLines.filter(
      (line): line is CustomerBookingLineInput => line != null
    )

    if (lines.length === 0) {
      return NextResponse.json(
        { error: '상품, 투어 날짜, 성인 인원이 필요합니다.' },
        { status: 400 }
      )
    }

    const basePrices: CustomerBookingPriceResult[] = []
    for (const line of lines) {
      basePrices.push(
        await calculateServerBookingPrice(supabaseAdmin, line, null, {
          enforceMinAmount: false,
          tenant,
        })
      )
    }

    const bundleResult = await resolveBundleDiscountsForCart(
      supabaseAdmin,
      lines.map((line, index) => ({
        productId: line.productId,
        subtotal: basePrices[index]!.subtotal,
      }))
    )

    let lineCouponDiscounts = lines.map(() => 0)
    let couponDiscountTotal = 0
    let appliedCouponCode: string | null = null

    if (couponCode) {
      const couponResult = await resolveCartLineCouponDiscounts(
        supabaseAdmin,
        couponCode,
        lines.map((line, index) => ({
          productId: line.productId,
          subtotal: basePrices[index]!.subtotal,
        }))
      )
      lineCouponDiscounts = couponResult.lineDiscounts
      couponDiscountTotal = couponResult.totalDiscount
      appliedCouponCode = couponResult.couponCode
    }

    const pricedLines: CustomerBookingPriceResult[] = basePrices.map((base, i) => {
      const bundleDiscount = bundleResult.lineDiscounts[i] || 0
      const couponDiscount = lineCouponDiscounts[i] || 0
      const totalPrice =
        Math.round(Math.max(0, base.subtotal - couponDiscount - bundleDiscount) * 100) / 100
      return {
        ...base,
        bundleDiscount,
        couponCode: couponDiscount > 0 ? appliedCouponCode : null,
        couponDiscount,
        totalPrice,
      }
    })

    const totalUsd = pricedLines.reduce((sum, p) => sum + p.totalPrice, 0)
    const totalCents = Math.round(totalUsd * 100)
    if (totalCents < 50) {
      throw new Error('최소 결제 금액은 $0.50입니다.')
    }

    const pendings: CreatePendingBookingResult[] = []
    for (let i = 0; i < lines.length; i++) {
      const pending = await createPendingCustomerBooking(supabaseAdmin, {
        customer,
        line: lines[i]!,
        status: 'pending',
        priceOverride: pricedLines[i],
        tenant,
      })
      createdReservationIds.push(pending.reservationId)
      pendings.push(pending)
    }

    const primary = pendings[0]!
    const reservationIdsCsv = pendings.map((p) => p.reservationId).join(',')
    const connectDest = await resolveConnectCheckoutDestination(
      supabaseAdmin,
      tenant.operatorId,
      totalCents
    )

    let paymentIntent
    try {
      paymentIntent = await createStripePaymentIntentForReservation({
        reservationId: primary.reservationId,
        amountCents: totalCents,
        customerName: customer.name,
        customerEmail: customer.email,
        connect:
          connectDest.mode === 'destination' && connectDest.connectedAccountId
            ? {
                destinationAccountId: connectDest.connectedAccountId,
                applicationFeeCents: connectDest.applicationFeeCents,
              }
            : null,
        extraMetadata: {
          reservation_ids: reservationIdsCsv,
          locale,
          operator_id: tenant.operatorId,
          channel_id: tenant.channelId,
          connect_reason: connectDest.reason,
          ...(appliedCouponCode ? { coupon_code: appliedCouponCode } : {}),
        },
      })

      for (const pending of pendings) {
        await recordPendingStripePayment(supabaseAdmin, {
          reservationId: pending.reservationId,
          amountUsd: pending.amountUsd,
          paymentIntentId: paymentIntent.id,
        })
      }
    } catch (stripeErr) {
      if (createdReservationIds.length > 0) {
        await supabaseAdmin.from('reservations').delete().in('id', createdReservationIds)
      }
      throw stripeErr
    }

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      reservationId: primary.reservationId,
      reservationIds: pendings.map((p) => p.reservationId),
      customerId: primary.customerId,
      amount: totalCents,
      amountUsd: Math.round(totalUsd * 100) / 100,
      couponDiscount: couponDiscountTotal,
      bundleDiscount: bundleResult.totalDiscount,
      couponCode: appliedCouponCode,
      currency: 'usd',
      price: primary.price,
    })
  } catch (error) {
    console.error('[api/booking/create-checkout]', error)
    if (supabaseAdmin && createdReservationIds.length > 0) {
      try {
        await supabaseAdmin.from('reservations').delete().in('id', createdReservationIds)
      } catch (cleanupErr) {
        console.error('[api/booking/create-checkout] cleanup failed', cleanupErr)
      }
    }
    const message = error instanceof Error ? error.message : '결제 준비 중 오류가 발생했습니다.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
