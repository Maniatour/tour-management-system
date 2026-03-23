import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabase } from '@/lib/supabase-server'
import type { Database } from '@/lib/database.types'
import {
  calculateOperatingProfit,
  type ReservationPricingRow
} from '@/lib/tourStatsCalculator'
import {
  hotelAmountForSettlement,
  isHotelBookingIncludedInSettlement,
  isTicketBookingEaIncludedInNetCount,
  isTicketBookingIncludedInSettlement,
  ticketEaAsNumber,
  ticketExpenseForSettlement
} from '@/lib/bookingSettlement'

const BATCH = 150
const NON_RESIDENT_OPTION_ID = '6941b5d0'
const VALID_TOUR_STATUSES = ['Recruiting', 'Confirmed', 'Completed']

function excludeStatus(s: string) {
  const lower = (s || '').toLowerCase().trim()
  return lower === 'cancelled' || lower === 'refunded'
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

    let supabase: ReturnType<typeof createClient<Database>>

    if (token) {
      // 클라이언트에서 전달한 JWT로 인증 (localStorage 세션)
      supabase = createClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: {
            headers: { Authorization: `Bearer ${token}` }
          }
        }
      )
      const { data: { user }, error } = await supabase.auth.getUser(token)
      if (error || !user) {
        return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
      }
    } else {
      // 쿠키 기반 세션 (SSR)
      const serverSupabase = await createServerSupabase()
      const { data: { session } } = await serverSupabase.auth.getSession()
      if (!session) {
        return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
      }
      supabase = serverSupabase
    }

    const { searchParams } = new URL(request.url)
    const start = searchParams.get('start')
    const end = searchParams.get('end')
    if (!start || !end) {
      return NextResponse.json({ error: 'start, end 쿼리 파라미터가 필요합니다.' }, { status: 400 })
    }

    // 1) 기간 내 투어 조회
    const { data: toursData, error: toursError } = await supabase
      .from('tours')
      .select('id, tour_date, tour_status, reservation_ids, product_id, guide_fee, assistant_fee')
      .gte('tour_date', start)
      .lte('tour_date', end)

    if (toursError) {
      console.error('투어 조회 오류:', toursError)
      return NextResponse.json({ error: toursError.message }, { status: 500 })
    }

    const allTours = toursData || []
    const validTours = allTours.filter(
      (t: { tour_status?: string }) => VALID_TOUR_STATUSES.includes(t.tour_status || '')
    )
    if (validTours.length === 0) {
      return NextResponse.json({
        totalTours: 0,
        totalRevenue: 0,
        totalExpenses: 0,
        netProfit: 0,
        averageProfitPerTour: 0,
        totalAdditionalCostRounded: 0,
        tourStats: [],
        expenseBreakdown: [],
        vehicleStats: []
      })
    }

    const tourIds = validTours.map((t: { id: string }) => t.id)
    const allReservationIds = validTours.flatMap(
      (t: { reservation_ids?: string[] }) => Array.isArray(t.reservation_ids) ? t.reservation_ids : []
    )
    const uniqueReservationIds = [...new Set(allReservationIds)].filter(Boolean)

    // 2) 예약 일괄 조회
    let reservations: { id: string; customer_id?: string; total_people?: number; channel_id?: string }[] = []
    for (let i = 0; i < uniqueReservationIds.length; i += BATCH) {
      const batch = uniqueReservationIds.slice(i, i + BATCH)
      const { data, error } = await supabase
        .from('reservations')
        .select('id, customer_id, total_people, channel_id')
        .in('id', batch)
      if (!error && data?.length) reservations = reservations.concat(data)
    }

    // 3) reservation_pricing 일괄 조회
    let reservationPricing: ReservationPricingRow[] = []
    for (let i = 0; i < uniqueReservationIds.length; i += BATCH) {
      const batch = uniqueReservationIds.slice(i, i + BATCH)
      const { data } = await supabase
        .from('reservation_pricing')
        .select('reservation_id, total_price, product_price_total, option_total, choices_total, coupon_discount, additional_discount, additional_cost, not_included_price, card_fee, prepayment_tip, commission_amount, commission_percent')
        .in('reservation_id', batch)
      if (data?.length) reservationPricing = reservationPricing.concat(data)
    }

    // 4) reservation_expenses 일괄 조회
    const reservationExpensesMap: Record<string, number> = {}
    for (let i = 0; i < uniqueReservationIds.length; i += BATCH) {
      const batch = uniqueReservationIds.slice(i, i + BATCH)
      const { data } = await supabase
        .from('reservation_expenses')
        .select('reservation_id, amount')
        .in('reservation_id', batch)
      if (data?.length) {
        data.forEach((row: { reservation_id: string; amount?: number }) => {
          const id = row.reservation_id
          if (!reservationExpensesMap[id]) reservationExpensesMap[id] = 0
          reservationExpensesMap[id] += row.amount || 0
        })
      }
    }

    // 5) 채널 정보 (커미션 계산용)
    const channelIds = [...new Set(reservations.map(r => r.channel_id).filter(Boolean))] as string[]
    let channelMap: Record<string, { commission_base_price_only?: boolean }> = {}
    if (channelIds.length > 0) {
      const { data: channels } = await supabase
        .from('channels')
        .select('id, commission_base_price_only')
        .in('id', channelIds)
      if (channels?.length) {
        channels.forEach((c: { id: string; commission_base_price_only?: boolean }) => {
          channelMap[c.id] = { commission_base_price_only: c.commission_base_price_only }
        })
      }
    }
    const reservationChannels: Record<string, { commission_base_price_only?: boolean }> = {}
    reservations.forEach(r => {
      if (r.channel_id) reservationChannels[r.id] = channelMap[r.channel_id] || {}
    })

    // 6) 투어 지출 / 입장권 / 호텔 일괄 조회
    const { data: tourExpensesAll } = await supabase
      .from('tour_expenses')
      .select('tour_id, amount')
      .in('tour_id', tourIds)

    const { data: ticketBookingsAll } = await supabase
      .from('ticket_bookings')
      .select('tour_id, expense, ea, status')
      .in('tour_id', tourIds)

    const { data: hotelBookingsAll } = await supabase
      .from('tour_hotel_bookings')
      .select('tour_id, total_price, unit_price, rooms, status')
      .in('tour_id', tourIds)

    // 7) 상품명
    const productIds = [...new Set(validTours.map((t: { product_id?: string }) => t.product_id).filter(Boolean))] as string[]
    let productMap: Record<string, string> = {}
    if (productIds.length > 0) {
      const { data: products } = await supabase
        .from('products')
        .select('id, name_ko, name_en, name')
        .in('id', productIds)
      if (products?.length) {
        products.forEach((p: { id: string; name_ko?: string; name_en?: string; name?: string }) => {
          productMap[p.id] = p.name_ko || p.name_en || p.name || 'Unknown'
        })
      }
    }

    // 8) 비거주자 옵션 비용 (reservation_options + options)
    let reservationOptionsRows: { reservation_id: string; option_id: string; total_price?: number; ea?: number; price?: number; status?: string }[] = []
    for (let i = 0; i < uniqueReservationIds.length; i += BATCH) {
      const batch = uniqueReservationIds.slice(i, i + BATCH)
      const { data } = await supabase
        .from('reservation_options')
        .select('reservation_id, option_id, total_price, ea, price, status')
        .in('reservation_id', batch)
      if (data?.length) reservationOptionsRows = reservationOptionsRows.concat(data)
    }
    const validOptions = reservationOptionsRows.filter(r => !excludeStatus(r?.status || ''))
    const fromFixedId = validOptions
      .filter(r => String(r?.option_id || '').trim() === NON_RESIDENT_OPTION_ID)
      .reduce((sum, r) => sum + (Number(r.total_price) || (Number(r.ea ?? 1) * Number(r.price ?? 0))), 0)
    let optionIdToIsNonResident: Record<string, boolean> = {}
    if (fromFixedId === 0 && validOptions.length > 0) {
      const uniqueOptionIds = [...new Set(validOptions.map(r => String(r.option_id || '').trim()).filter(Boolean))]
      if (uniqueOptionIds.length > 0) {
        const { data: opts } = await supabase
          .from('options')
          .select('id, name, category')
          .in('id', uniqueOptionIds)
        if (opts?.length) {
          opts.forEach((o: { id: string; name?: string; category?: string }) => {
            const name = (o.name || '').toLowerCase()
            const cat = (o.category || '').toLowerCase()
            const isNr = name.includes('entrance') || name.includes('비거주자') || name.includes('입장료') || cat.includes('entrance') || cat.includes('fee')
            optionIdToIsNonResident[o.id] = isNr
          })
        }
      }
    }

    const reservationPeopleMap: Record<string, number> = {}
    reservations.forEach(r => { reservationPeopleMap[r.id] = r.total_people || 0 })

    // 투어별 비거주자 옵션 비용 (클라이언트와 동일: 고정 ID 우선, 없으면 옵션명/카테고리 매칭)
    function getTourNotIncludedPrice(reservationIdsArray: string[], pricingList: ReservationPricingRow[]) {
      const tourOptions = validOptions.filter(o => reservationIdsArray.includes(o.reservation_id))
      const fromFixedId = tourOptions
        .filter(r => String(r?.option_id || '').trim() === NON_RESIDENT_OPTION_ID)
        .reduce((sum, r) => sum + (Number(r.total_price) || (Number(r.ea ?? 1) * Number(r.price ?? 0))), 0)
      if (fromFixedId > 0) return fromFixedId
      const fromNonResident = tourOptions
        .filter(r => optionIdToIsNonResident[String(r.option_id || '').trim()])
        .reduce((sum, r) => sum + (Number(r.total_price) || (Number(r.ea ?? 1) * Number(r.price ?? 0))), 0)
      if (fromNonResident > 0) return fromNonResident
      return pricingList.reduce((sum, pricing) => {
        const people = reservationPeopleMap[pricing.reservation_id] || 0
        return sum + (pricing.not_included_price || 0) * people
      }, 0)
    }

    // 투어별 통계 계산
    const tourStats: Array<{
      tourId: string
      tourDate: string
      productName: string
      totalPeople: number
      revenue: number
      expenses: number
      netProfit: number
      additionalCostRounded: number
      vehicleType?: string
      gasCost?: number
      ticketBookingsCost?: number
      ticketBookingsEa?: number
      hotelBookingsCost?: number
      guideFee?: number
      assistantFee?: number
      notIncludedPrice?: number
      hasValidTourId?: boolean
    }> = []

    const expensesByTour: Record<string, number> = {}
    ;(tourExpensesAll || []).forEach((row: { tour_id: string; amount?: number }) => {
      if (!expensesByTour[row.tour_id]) expensesByTour[row.tour_id] = 0
      expensesByTour[row.tour_id] += row.amount || 0
    })
    const ticketByTour: Record<string, { cost: number; ea: number }> = {}
    ;(ticketBookingsAll || []).forEach(
      (row: { tour_id: string; expense?: number; ea?: number | string | null; status?: string }) => {
        const tid = row.tour_id
        if (!ticketByTour[tid]) ticketByTour[tid] = { cost: 0, ea: 0 }
        if (isTicketBookingIncludedInSettlement(row.status)) {
          ticketByTour[tid].cost += ticketExpenseForSettlement(row)
        }
        if (isTicketBookingEaIncludedInNetCount(row.status)) {
          ticketByTour[tid].ea += ticketEaAsNumber(row.ea)
        }
      }
    )
    const hotelByTour: Record<string, number> = {}
    ;(hotelBookingsAll || []).forEach(
      (row: {
        tour_id: string
        total_price?: number
        unit_price?: number
        rooms?: number
        status?: string
      }) => {
        if (!isHotelBookingIncludedInSettlement(row.status)) return
        if (!hotelByTour[row.tour_id]) hotelByTour[row.tour_id] = 0
        hotelByTour[row.tour_id] += hotelAmountForSettlement(row)
      }
    )

    const pricingByReservation = reservationPricing.reduce((acc, p) => {
      acc[p.reservation_id] = p
      return acc
    }, {} as Record<string, ReservationPricingRow>)

    for (const tour of validTours) {
      const tid = tour.id
      const reservationIdsArray = Array.isArray(tour.reservation_ids) ? tour.reservation_ids : []
      const tourReservations = reservations.filter(r => reservationIdsArray.includes(r.id))
      const filteredPricing = reservationPricing.filter(p => reservationIdsArray.includes(p.reservation_id))

      const totalOperatingProfit = filteredPricing.reduce((sum, pricing) => {
        return sum + calculateOperatingProfit(pricing, pricing.reservation_id, reservationExpensesMap, reservationChannels)
      }, 0)
      const totalAdditionalCostRounded = filteredPricing.reduce((sum, pricing) => {
        const additionalCost = pricing.additional_cost || 0
        return sum + Math.floor(additionalCost / 100) * 100
      }, 0)

      const totalNotIncludedPrice = getTourNotIncludedPrice(reservationIdsArray, filteredPricing)

      const totalExpenses = expensesByTour[tid] || 0
      const totalFees = (tour.guide_fee || 0) + (tour.assistant_fee || 0)
      const ticket = ticketByTour[tid] || { cost: 0, ea: 0 }
      const totalTicketCosts = ticket.cost
      const totalTicketEa = ticket.ea
      const totalHotelCosts = hotelByTour[tid] || 0
      const totalExpensesWithFeesAndBookings = totalExpenses + totalFees + totalTicketCosts + totalHotelCosts
      const profit = totalOperatingProfit - totalExpensesWithFeesAndBookings
      const totalPeople = tourReservations.reduce((sum, r) => sum + (r.total_people || 0), 0)

      tourStats.push({
        tourId: tid,
        tourDate: tour.tour_date,
        productName: productMap[tour.product_id] || 'Unknown',
        totalPeople,
        revenue: totalOperatingProfit,
        expenses: totalExpensesWithFeesAndBookings,
        netProfit: profit,
        additionalCostRounded: totalAdditionalCostRounded,
        vehicleType: totalPeople > 10 ? '대형버스' : '소형버스',
        gasCost: totalExpenses,
        ticketBookingsCost: totalTicketCosts,
        ticketBookingsEa: totalTicketEa,
        hotelBookingsCost: totalHotelCosts,
        guideFee: totalFees,
        assistantFee: 0,
        notIncludedPrice: totalNotIncludedPrice,
        hasValidTourId: true
      })
    }

    const totalTours = tourStats.length
    const totalRevenue = tourStats.reduce((s, t) => s + t.revenue, 0)
    const totalExpenses = tourStats.reduce((s, t) => s + t.expenses, 0)
    const netProfit = totalRevenue - totalExpenses
    const averageProfitPerTour = totalTours > 0 ? netProfit / totalTours : 0
    const totalAdditionalCostRounded = tourStats.reduce((s, t) => s + (t.additionalCostRounded || 0), 0)

    const totalTourExpenses = tourStats.reduce((s, t) => s + (t.gasCost || 0), 0)
    const totalTicketBookings = tourStats.reduce((s, t) => s + (t.ticketBookingsCost || 0), 0)
    const totalHotelBookings = tourStats.reduce((s, t) => s + (t.hotelBookingsCost || 0), 0)
    const totalGuideFees = tourStats.reduce((s, t) => s + (t.guideFee || 0), 0)
    const expenseBreakdown = [
      { category: '투어 지출', amount: totalTourExpenses, percentage: 0 },
      { category: '입장권 부킹', amount: totalTicketBookings, percentage: 0 },
      { category: '호텔 부킹', amount: totalHotelBookings, percentage: 0 },
      { category: '가이드/어시스턴트비', amount: totalGuideFees, percentage: 0 }
    ]
    expenseBreakdown.forEach(item => {
      item.percentage = totalExpenses > 0 ? (item.amount / totalExpenses) * 100 : 0
    })

    const vehicleGroups: Record<string, { vehicleType: string; totalTours: number; totalPeople: number; totalGasCost: number }> = {}
    tourStats.forEach(tour => {
      const vt = tour.vehicleType || '소형버스'
      if (!vehicleGroups[vt]) {
        vehicleGroups[vt] = { vehicleType: vt, totalTours: 0, totalPeople: 0, totalGasCost: 0 }
      }
      vehicleGroups[vt].totalTours++
      vehicleGroups[vt].totalPeople += tour.totalPeople
      vehicleGroups[vt].totalGasCost += tour.gasCost || 0
    })
    const vehicleStats = Object.values(vehicleGroups).map(v => ({
      ...v,
      averageGasCost: v.totalTours > 0 ? v.totalGasCost / v.totalTours : 0
    }))

    return NextResponse.json({
      totalTours,
      totalRevenue,
      totalExpenses,
      netProfit,
      averageProfitPerTour,
      totalAdditionalCostRounded,
      tourStats,
      expenseBreakdown,
      vehicleStats
    })
  } catch (error) {
    console.error('투어 통계 API 오류:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '서버 오류' },
      { status: 500 }
    )
  }
}
