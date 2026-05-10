import React, { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, isAbortLikeError } from '@/lib/supabase'
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
import type { ReservationPricingMapValue } from '@/types/reservationPricingMap'
import {
  aggregateReservationOptionSumsByReservationId,
  type ReservationOptionSumRow,
} from '@/lib/syncReservationPricingAggregates'
import { parseEmbeddedChannelNameFromReservationRow } from '@/utils/reservationUtils'

/** `useReservationData`의 tours 맵 행 — 운영 큐 전량 하이드레이트 결과에도 동일 구조 사용 */
export type ReservationListTourMapRow = {
  id: string
  tour_status: string | null
  tour_guide_id: string | null
  assistant_id: string | null
  reservation_ids: string[]
  tour_car_id: string | null
  tour_date: string | null
  tour_start_datetime: string | null
  product_id: string | null
}

export type AdminListHydratedSnapshot = {
  reservations: Reservation[]
  pricingMap: Map<string, ReservationPricingMapValue>
  reservationOptionsPresenceByReservationId: Map<string, boolean>
  toursMap: Map<string, ReservationListTourMapRow>
}

/** PostgREST 400: `select`에 원격 DB에 없는 컬럼이 포함된 경우(마이그레이션 미적용 등) */
function isReservationPricingSelectSchemaError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false
  const code = String(err.code ?? '')
  const msg = (err.message ?? '').toLowerCase()
  return (
    code === '42703' ||
    code === 'PGRST204' ||
    (/column/.test(msg) && /does not exist/.test(msg)) ||
    (/could not find/.test(msg) && /column/.test(msg))
  )
}

/** 예약 목록용: mapRawToReservation 에 필요한 컬럼만 (전체 행 스캔·전송량 감소) + 채널명 embed */
const RESERVATION_LIST_SELECT =
  [
    'id',
    'customer_id',
    'product_id',
    'tour_date',
    'tour_time',
    'event_note',
    'pickup_hotel',
    'pickup_time',
    'adults',
    'child',
    'infant',
    'total_people',
    'channel_id',
    'variant_key',
    'channel_rn',
    'added_by',
    'created_at',
    'tour_id',
    'status',
    'updated_at',
    'amount_audited',
    'amount_audited_at',
    'amount_audited_by',
    'selected_options',
    'selected_option_prices',
    'choices',
  ].join(',') + ',channels(name)'

/** PostgREST or= 필터용: 큰 OFFSET 대신 (created_at DESC, id DESC) 키셋 페이지네이션 */
function customersCreatedAtDescKeysetOr(created_at: string, id: string): string {
  const q = (s: string) => String(s).replace(/"/g, '""')
  return `created_at.lt."${q(created_at)}",and(created_at.eq."${q(created_at)}",id.lt."${q(id)}")`
}

export type UseReservationDataOptions = {
  /** true이면 예약 전량 자동 로드를 하지 않음(예약 관리 목록을 서버 페이지 쿼리로만 채울 때). */
  disableReservationsAutoLoad?: boolean
  /**
   * true이면 고객 테이블 전량 키셋 로드 대신, 목록에 필요한 customer_id만 `.in()`으로 조회.
   * 예약 관리(서버 페이지네이션)와 함께 쓸 것.
   */
  customersByReservationIds?: boolean
}

export function useReservationData(hookOptions?: UseReservationDataOptions) {
  const disableReservationsAutoLoad = hookOptions?.disableReservationsAutoLoad === true
  const customersByReservationIds = hookOptions?.customersByReservationIds === true

  const fetchAllCustomers = useCallback(async () => {
    const allCustomers: Customer[] = []
    const pageSize = 1000

    // 1) created_at 이 있는 행: OFFSET 없이 키셋 (깊은 페이지에서 500/타임아웃 방지)
    let cursor: { created_at: string; id: string } | null = null
    for (;;) {
      let q = supabase
        .from('customers')
        .select('*')
        .not('created_at', 'is', null)
        .order('created_at', { ascending: false, nullsFirst: false })
        .order('id', { ascending: false })
        .limit(pageSize)

      if (cursor) {
        q = q.or(customersCreatedAtDescKeysetOr(cursor.created_at, cursor.id))
      }

      const { data, error } = await q

      if (error) {
        if (!isAbortLikeError(error)) console.warn('Error fetching customers:', error)
        break
      }

      const batch = (data || []) as Customer[]
      if (batch.length === 0) break

      allCustomers.push(...batch)
      if (batch.length < pageSize) break

      const last = batch[batch.length - 1] as { created_at?: string | null; id: string }
      const lastTs = last.created_at
      if (lastTs == null || lastTs === '') break
      cursor = { created_at: lastTs, id: last.id }
    }

    // 2) created_at IS NULL (있으면 id 내림차순으로 이어서 로드)
    let nullCursor: string | null = null
    for (;;) {
      let q = supabase
        .from('customers')
        .select('*')
        .is('created_at', null)
        .order('id', { ascending: false })
        .limit(pageSize)

      if (nullCursor) {
        q = q.lt('id', nullCursor)
      }

      const { data, error } = await q

      if (error) {
        if (!isAbortLikeError(error)) console.warn('Error fetching customers (null created_at batch):', error)
        break
      }

      const batch = (data || []) as Customer[]
      if (batch.length === 0) break

      allCustomers.push(...batch)
      if (batch.length < pageSize) break

      nullCursor = (batch[batch.length - 1] as { id: string }).id
    }

    return allCustomers
  }, [])

  // 최적화된 데이터 로딩
  const {
    data: customersFullData,
    loading: customersFullLoading,
    refetch: refetchCustomers,
  } = useOptimizedData({
    fetchFn: fetchAllCustomers,
    cacheKey: 'reservation-customers',
    cacheTime: 10 * 60 * 1000, // 10분 캐시 (SWR 로 stale 즉시 표시 + 백그라운드 갱신)
    enabled: !customersByReservationIds,
    dependencies: [customersByReservationIds],
  })

  const [customersById, setCustomersById] = useState<Map<string, Customer>>(() => new Map())
  const loadedCustomerIdsRef = useRef<Set<string>>(new Set())

  const loadCustomersByIds = useCallback(async (rawIds: string[], opts?: { reload?: boolean }) => {
    const unique = [...new Set(rawIds.map((id) => String(id ?? '').trim()).filter(Boolean))]
    if (unique.length === 0) return

    if (opts?.reload) {
      for (const id of unique) {
        loadedCustomerIdsRef.current.delete(id)
      }
    }

    const need = unique.filter((id) => !loadedCustomerIdsRef.current.has(id))
    if (need.length === 0) return

    const CHUNK = 200
    const collected: Customer[] = []
    try {
      for (let i = 0; i < need.length; i += CHUNK) {
        const chunk = need.slice(i, i + CHUNK)
        const { data, error } = await supabase.from('customers').select('*').in('id', chunk)
        if (error) {
          if (!isAbortLikeError(error)) console.warn('Error fetching customers by id:', error)
          continue
        }
        for (const row of (data || []) as Customer[]) {
          collected.push(row)
          loadedCustomerIdsRef.current.add(row.id)
        }
      }
      if (collected.length > 0) {
        setCustomersById((prev) => {
          const next = new Map(prev)
          for (const row of collected) {
            next.set(row.id, row)
          }
          return next
        })
      }
    } catch (e) {
      if (!isAbortLikeError(e)) console.warn('loadCustomersByIds:', e)
    }
  }, [])

  const mergeCustomers = useCallback((rows: Customer[]) => {
    if (!rows.length) return
    setCustomersById((prev) => {
      const next = new Map(prev)
      for (const row of rows) {
        next.set(row.id, row)
        loadedCustomerIdsRef.current.add(row.id)
      }
      return next
    })
  }, [])

  const customers = customersByReservationIds
    ? Array.from(customersById.values())
    : (customersFullData ?? [])
  const customersLoading = customersByReservationIds ? false : customersFullLoading

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
          if (!isAbortLikeError(error)) console.warn('Error fetching products:', error)
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
    cacheTime: 30 * 60 * 1000 // 30분 캐시 — 상품은 거의 변하지 않음, SWR 로 자동 갱신
  })

  const { data: channels = [], loading: channelsLoading, refetch: refetchChannels } = useOptimizedData({
    fetchFn: async () => {
      const { data, error } = await supabase
        .from('channels')
        .select('id, name, type, favicon_url, pricing_type, commission_base_price_only, category, has_not_included_price, not_included_type, not_included_price, commission_percent, commission, sub_channels')
        .order('name', { ascending: true })

      if (error) {
        if (!isAbortLikeError(error)) console.warn('Error fetching channels:', error)
        return []
      }

      return data || []
    },
    cacheKey: 'reservation-channels',
    // 짧은 fresh TTL(60초) + SWR — 같은 페이지 내 짧은 시간엔 추가 호출 생략, 그 후엔 stale 즉시 표시 + 백그라운드 갱신
    cacheTime: 60 * 1000
  })

  const { data: productOptions = [], loading: productOptionsLoading, refetch: refetchProductOptions } = useOptimizedData({
    fetchFn: async () => {
      const { data, error } = await supabase
        .from('product_options')
        .select('*')
        .order('name', { ascending: true })

      if (error) {
        if (!isAbortLikeError(error)) console.warn('Error fetching product options:', error)
        return []
      }

      return data || []
    },
    cacheKey: 'reservation-product-options',
    cacheTime: 30 * 60 * 1000 // 30분 캐시 — 상품 옵션 정의는 거의 변하지 않음
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
        if (!isAbortLikeError(error)) console.warn('Error fetching option choices:', error)
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
    cacheTime: 30 * 60 * 1000 // 30분 캐시 — 옵션 초이스 역시 거의 변하지 않음
  })

  const { data: options = [], loading: optionsLoading, refetch: refetchOptions } = useOptimizedData({
    fetchFn: async () => {
      const { data, error } = await supabase
        .from('options')
        .select('*')
        .order('name', { ascending: true })

      if (error) {
        if (!isAbortLikeError(error)) console.warn('Error fetching options:', error)
        return []
      }

      return data || []
    },
    cacheKey: 'reservation-options',
    cacheTime: 30 * 60 * 1000 // 30분 캐시
  })

  const { data: pickupHotels = [], loading: pickupHotelsLoading, refetch: refetchPickupHotels } = useOptimizedData({
    fetchFn: async () => {
      const { data, error } = await supabase
        .from('pickup_hotels')
        .select('*')
        .eq('use_for_pickup', true)
        .or('is_active.is.null,is_active.eq.true')
        .order('hotel', { ascending: true })

      if (error) {
        if (!isAbortLikeError(error)) console.warn('Error fetching pickup hotels:', error)
        return []
      }

      return data || []
    },
    cacheKey: 'reservation-pickup-hotels',
    cacheTime: 60 * 60 * 1000 // 60분 캐시 — 픽업 호텔 마스터는 거의 정적
  })

  const { data: coupons = [], loading: couponsLoading, refetch: refetchCoupons } = useOptimizedData({
    fetchFn: async () => {
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('status', 'active')
        .order('coupon_code', { ascending: true })

      if (error) {
        if (!isAbortLikeError(error)) console.warn('Error fetching coupons:', error)
        return []
      }

      return data || []
    },
    cacheKey: 'reservation-coupons',
    cacheTime: 15 * 60 * 1000 // 15분 캐시 — SWR 로 자동 갱신
  })

  const [reservations, setReservations] = useState<Reservation[]>([])
  const reservationsRef = useRef<Reservation[]>([])
  useEffect(() => {
    reservationsRef.current = reservations
  }, [reservations])

  const refreshCustomersByIds = useCallback(async () => {
    const ids = [...new Set(reservationsRef.current.map((r) => r.customerId).filter(Boolean))]
    await loadCustomersByIds(ids, { reload: true })
  }, [loadCustomersByIds])

  const [reservationsLoading, setReservationsLoading] = useState(!disableReservationsAutoLoad)
  /** 첫 배치만 반영된 채로 집계하지 않도록: fetchReservations 전체(백그라운드 페이지 포함) 완료 후 true */
  const [reservationsAggregateReady, setReservationsAggregateReady] = useState(disableReservationsAutoLoad)
  const [loadingProgress, setLoadingProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 })
  const [reservationPricingMap, setReservationPricingMap] = useState<Map<string, ReservationPricingMapValue>>(new Map())
  const [reservationOptionsPresenceByReservationId, setReservationOptionsPresenceByReservationId] =
    useState<Map<string, boolean>>(new Map())
  const [toursMap, setToursMap] = useState<Map<string, ReservationListTourMapRow>>(new Map())

  const loading = reservationsLoading || customersLoading || productsLoading || channelsLoading || productOptionsLoading || optionChoicesLoading || optionsLoading || pickupHotelsLoading || couponsLoading

  // 예약 데이터 로딩: 첫 배치 빠른 표시 후 나머지 백그라운드 로드
  const FIRST_BATCH_SIZE = 500
  const PAGE_SIZE = 1000
  const CHUNK_SIZE = 1000

  const toNumber = (val: number | null | undefined): number => {
    if (val === null || val === undefined) return 0
    if (typeof val === 'string') return parseFloat(val) || 0
    return val || 0
  }

  const mapRawToReservation = (
    raw: Record<string, unknown>[],
    productMap: Map<string, string>,
    tourMap: Map<string, boolean>
  ): Reservation[] =>
    raw.map((item: Record<string, unknown>) => {
      const subCategory = productMap.get((item.product_id as string) || '')
      const isManiaTour = subCategory === 'Mania Tour' || subCategory === 'Mania Service'
      const hasExistingTour = isManiaTour ? tourMap.has(`${item.product_id}-${item.tour_date}`) : false
      return {
        id: item.id as string,
        customerId: (item.customer_id as string) || '',
        productId: (item.product_id as string) || '',
        tourDate: (item.tour_date as string) || '',
        tourTime: (item.tour_time as string) || '',
        eventNote: (item.event_note as string) || '',
        pickUpHotel: (item.pickup_hotel as string) || '',
        pickUpTime: (item.pickup_time as string) || '',
        adults: (item.adults as number) || 0,
        child: (item.child as number) || 0,
        infant: (item.infant as number) || 0,
        totalPeople: (item.total_people as number) || 0,
        channelId: (item.channel_id as string) || '',
        channelNameSnapshot: parseEmbeddedChannelNameFromReservationRow(item) ?? null,
        variantKey: (item.variant_key as string) || 'default',
        channelRN: (item.channel_rn as string) || '',
        addedBy: (item.added_by as string) || '',
        addedTime: (item.created_at as string) || '',
        tourId: (item.tour_id as string) || '',
        status: ((item.status as string) as 'inquiry' | 'pending' | 'confirmed' | 'completed' | 'cancelled') || 'pending',
        updated_at: (item.updated_at as string | null) ?? null,
        amount_audited: !!item.amount_audited,
        amount_audited_at: (item.amount_audited_at as string | null) ?? null,
        amount_audited_by: (item.amount_audited_by as string | null) ?? null,
        selectedOptions: (typeof item.selected_options === 'string'
          ? (() => { try { return JSON.parse(item.selected_options as string) } catch { return {} } })()
          : (item.selected_options as { [k: string]: string[] }) || {}),
        selectedOptionPrices: (typeof item.selected_option_prices === 'string'
          ? (() => { try { return JSON.parse(item.selected_option_prices as string) } catch { return {} } })()
          : (item.selected_option_prices as { [k: string]: number }) || {}),
        choices: (item.choices as Reservation['choices']) || null,
        hasExistingTour
      }
    })

  const fetchPricingMap = async (reservationIds: string[]) => {
    const map = new Map<string, ReservationPricingMapValue>()
    const PRICING_SELECT_WITH_REVENUE =
      'reservation_id, id, total_price, balance_amount, adult_product_price, child_product_price, infant_product_price, product_price_total, required_option_total, subtotal, coupon_code, coupon_discount, additional_discount, additional_cost, card_fee, tax, prepayment_cost, prepayment_tip, option_total, choices_total, not_included_price, private_tour_additional_cost, refund_amount, commission_percent, commission_amount, commission_base_price, channel_settlement_amount, deposit_amount, company_total_revenue, operating_profit'
    const PRICING_SELECT_BASE =
      'reservation_id, id, total_price, balance_amount, adult_product_price, child_product_price, infant_product_price, product_price_total, required_option_total, subtotal, coupon_code, coupon_discount, additional_discount, additional_cost, card_fee, tax, prepayment_cost, prepayment_tip, option_total, choices_total, not_included_price, private_tour_additional_cost, refund_amount, commission_percent, commission_amount, commission_base_price, channel_settlement_amount, deposit_amount'

    let pricingSelect = PRICING_SELECT_WITH_REVENUE
    for (let i = 0; i < reservationIds.length; i += CHUNK_SIZE) {
      const chunk = reservationIds.slice(i, i + CHUNK_SIZE)
      let { data, error } = await supabase.from('reservation_pricing').select(pricingSelect).in('reservation_id', chunk)

      if (
        error &&
        pricingSelect === PRICING_SELECT_WITH_REVENUE &&
        isReservationPricingSelectSchemaError(error)
      ) {
        if (!isAbortLikeError(error)) {
          console.warn(
            '[useReservationData] reservation_pricing에 총매출/운영이익 컬럼이 없어 select에서 제외 후 재시도합니다. Supabase에 supabase/migrations/20260508200000_reservation_pricing_company_revenue.sql 을 적용하는 것을 권장합니다.'
          )
        }
        pricingSelect = PRICING_SELECT_BASE
        const retry = await supabase.from('reservation_pricing').select(pricingSelect).in('reservation_id', chunk)
        data = retry.data
        error = retry.error
      }

      if (error && !isAbortLikeError(error)) {
        console.warn('[useReservationData] reservation_pricing 조회 오류:', error.message)
      }

      if (data) {
        data.forEach((p: Record<string, unknown>) => {
          map.set(p.reservation_id as string, {
            id: p.id != null ? String(p.id) : undefined,
            total_price: toNumber(p.total_price),
            balance_amount: toNumber(p.balance_amount),
            adult_product_price: toNumber(p.adult_product_price),
            child_product_price: toNumber(p.child_product_price),
            infant_product_price: toNumber(p.infant_product_price),
            product_price_total: toNumber(p.product_price_total),
            required_option_total: toNumber(p.required_option_total),
            subtotal: toNumber(p.subtotal),
            coupon_code: p.coupon_code != null ? String(p.coupon_code) : null,
            coupon_discount: toNumber(p.coupon_discount),
            additional_discount: toNumber(p.additional_discount),
            additional_cost: toNumber(p.additional_cost),
            card_fee: toNumber(p.card_fee),
            tax: toNumber(p.tax),
            prepayment_cost: toNumber(p.prepayment_cost),
            prepayment_tip: toNumber(p.prepayment_tip),
            option_total: toNumber(p.option_total),
            choices_total: toNumber(p.choices_total),
            not_included_price: toNumber(p.not_included_price),
            private_tour_additional_cost: toNumber(p.private_tour_additional_cost),
            refund_amount: toNumber(p.refund_amount),
            commission_percent:
              p.commission_percent === null || p.commission_percent === undefined
                ? undefined
                : toNumber(p.commission_percent),
            commission_amount: toNumber(p.commission_amount),
            commission_base_price: toNumber(p.commission_base_price),
            channel_settlement_amount: toNumber(p.channel_settlement_amount),
            deposit_amount: toNumber(p.deposit_amount),
            company_total_revenue:
              p.company_total_revenue === null || p.company_total_revenue === undefined
                ? undefined
                : toNumber(p.company_total_revenue),
            operating_profit:
              p.operating_profit === null || p.operating_profit === undefined
                ? undefined
                : toNumber(p.operating_profit),
            currency: 'USD'
          })
        })
      }
      // reservation_options.reservation_id 기준 합계로 option_total 동기화 (sync API와 동일 규칙)
      const { data: optionRows } = await supabase
        .from('reservation_options')
        .select('reservation_id, total_price, price, ea, status')
        .in('reservation_id', chunk)
      const sumsByRid = aggregateReservationOptionSumsByReservationId(
        (optionRows || []) as ReservationOptionSumRow[]
      )
      for (const [rid, sum] of sumsByRid) {
        const row = map.get(rid)
        if (row) row.option_total = sum
      }
    }
    return map
  }

  const fetchReservationOptionsPresenceMap = async (reservationIds: string[]) => {
    const map = new Map<string, boolean>()
    const unique = [...new Set(reservationIds.map((id) => String(id ?? '').trim()).filter(Boolean))]
    for (let i = 0; i < unique.length; i += CHUNK_SIZE) {
      const chunk = unique.slice(i, i + CHUNK_SIZE)
      for (const id of chunk) map.set(id, false)
      const { data, error } = await supabase
        .from('reservation_options')
        .select('reservation_id')
        .in('reservation_id', chunk)
      if (error) {
        if (!isAbortLikeError(error)) console.warn('Error fetching reservation_options presence:', error)
        continue
      }
      const withRows = new Set(
        (data || []).map((r: { reservation_id: string }) => r.reservation_id).filter(Boolean)
      )
      for (const id of chunk) {
        map.set(id, withRows.has(id))
      }
    }
    return map
  }

  const TOUR_LIST_SELECT =
    'id, tour_status, tour_guide_id, assistant_id, reservation_ids, tour_car_id, tour_date, tour_start_datetime, product_id'

  const parseTourRow = (tour: Record<string, unknown>): ReservationListTourMapRow => {
    const resIds = Array.isArray(tour.reservation_ids)
      ? (tour.reservation_ids as string[])
      : tour.reservation_ids
        ? String(tour.reservation_ids)
            .split(',')
            .map((id: string) => id.trim())
            .filter(Boolean)
        : []
    return {
      id: tour.id as string,
      tour_status: tour.tour_status as string | null,
      tour_guide_id: tour.tour_guide_id as string | null,
      assistant_id: tour.assistant_id as string | null,
      reservation_ids: resIds,
      tour_car_id: tour.tour_car_id as string | null,
      tour_date: tour.tour_date as string | null,
      tour_start_datetime: tour.tour_start_datetime as string | null,
      product_id: (tour.product_id as string | null) ?? null,
    }
  }

  const mergeTourMaps = (
    ...maps: Array<Map<string, ReservationListTourMapRow>>
  ): Map<string, ReservationListTourMapRow> => {
    const out = new Map<string, ReservationListTourMapRow>()
    for (const m of maps) {
      m.forEach((v, k) => out.set(k, v))
    }
    return out
  }

  const fetchToursMap = async (tourIds: string[]) => {
    const toursMap = new Map<string, ReservationListTourMapRow>()
    for (let i = 0; i < tourIds.length; i += CHUNK_SIZE) {
      const chunk = tourIds.slice(i, i + CHUNK_SIZE)
      const { data } = await supabase.from('tours').select(TOUR_LIST_SELECT).in('id', chunk)
      if (data) {
        data.forEach((tour: Record<string, unknown>) => {
          const row = parseTourRow(tour)
          toursMap.set(row.id, row)
        })
      }
    }
    return toursMap
  }

  /** 예약 row의 tour_id가 비어 있어도 tours.reservation_ids에만 포함된 배정을 찾기 */
  const fetchToursOverlappingReservationIds = async (reservationIds: string[]) => {
    const toursMap = new Map<string, ReservationListTourMapRow>()
    const unique = [...new Set(reservationIds.filter((id) => id && String(id).trim()))]
    if (unique.length === 0) return toursMap
    for (let i = 0; i < unique.length; i += CHUNK_SIZE) {
      const chunk = unique.slice(i, i + CHUNK_SIZE)
      const { data } = await supabase.from('tours').select(TOUR_LIST_SELECT).overlaps('reservation_ids', chunk)
      if (data) {
        data.forEach((tour: Record<string, unknown>) => {
          const row = parseTourRow(tour)
          toursMap.set(row.id, row)
        })
      }
    }
    return toursMap
  }

  const fetchReservations = async () => {
    setReservationsAggregateReady(false)
    setReservationsLoading(true)
    setLoadingProgress({ current: 0, total: 0 })
    try {
      // 1) count 쿼리 생략 → 첫 배치만 먼저 로드해 빠르게 표시
      const { data: firstBatchRaw, error: firstError } = await supabase
        .from('reservations')
        .select(RESERVATION_LIST_SELECT)
        .order('created_at', { ascending: false })
        .range(0, FIRST_BATCH_SIZE - 1)

      if (firstError) {
        if (isAbortLikeError(firstError)) return
        console.warn('Error fetching reservations:', firstError)
        setReservations([])
        return
      }

      const firstBatch = (firstBatchRaw || []) as Record<string, unknown>[]
      if (firstBatch.length === 0) {
        setReservations([])
        setReservationsLoading(false)
        setLoadingProgress({ current: 0, total: 0 })
        return
      }

      const firstProductIds = [...new Set(firstBatch.map((r: Record<string, unknown>) => r.product_id as string).filter(Boolean))]
      const firstTourDates = firstBatch.map((r: Record<string, unknown>) => r.tour_date).filter(Boolean) as string[]

      const firstProducts =
        firstProductIds.length > 0
          ? (await throttledSupabaseRequest(() =>
              supabase.from('products').select('id, sub_category').in('id', firstProductIds)
            )).data || []
          : []
      const productMapFirst = new Map((firstProducts as { id: string; sub_category?: string }[]).map(p => [p.id, p.sub_category || '']))
      const maniaIdsFirst = firstProductIds.filter(id => {
        const sc = productMapFirst.get(id)
        return sc === 'Mania Tour' || sc === 'Mania Service'
      })
      const firstToursExistence =
        maniaIdsFirst.length > 0 && firstTourDates.length > 0
          ? (await supabase.from('tours').select('product_id, tour_date').in('product_id', maniaIdsFirst).in('tour_date', firstTourDates)).data || []
          : []
      const tourMapFirst = new Map(
        (firstToursExistence as { product_id: string; tour_date: string }[]).map(t => [`${t.product_id}-${t.tour_date}`, true])
      )

      const firstMapped = mapRawToReservation(firstBatch, productMapFirst, tourMapFirst)
      const firstResIds = firstMapped.map(r => r.id)
      const firstTourIds = [...new Set(firstMapped.map(r => r.tourId).filter(id => id && id.trim() && id !== 'null' && id !== 'undefined'))]

      const [firstPricingMap, firstToursById, firstToursByOverlap, firstOptionsPresenceMap] = await Promise.all([
        fetchPricingMap(firstResIds),
        fetchToursMap(firstTourIds),
        fetchToursOverlappingReservationIds(firstResIds),
        fetchReservationOptionsPresenceMap(firstResIds),
      ])

      setReservations(firstMapped)
      setReservationPricingMap(firstPricingMap)
      setReservationOptionsPresenceByReservationId(firstOptionsPresenceMap)
      setToursMap(mergeTourMaps(firstToursById, firstToursByOverlap))
      setLoadingProgress({ current: firstMapped.length, total: firstMapped.length })
      setReservationsLoading(false)

      if (firstBatch.length < FIRST_BATCH_SIZE) {
        return
      }

      // 2) 나머지 백그라운드 로드 후 병합
      let from = FIRST_BATCH_SIZE
      let restRaw: Record<string, unknown>[] = []
      let hasMore = true
      while (hasMore) {
        const { data: page, error } = await supabase
          .from('reservations')
          .select(RESERVATION_LIST_SELECT)
          .order('created_at', { ascending: false })
          .range(from, from + PAGE_SIZE - 1)
        if (error) break
        const list = (page || []) as Record<string, unknown>[]
        if (list.length === 0) break
        restRaw = restRaw.concat(list)
        setLoadingProgress(prev => ({ ...prev, current: firstMapped.length + restRaw.length }))
        hasMore = list.length >= PAGE_SIZE
        from += PAGE_SIZE
      }

      if (restRaw.length === 0) return

      const allRaw = [...firstBatch, ...restRaw]
      const allProductIds = [...new Set(allRaw.map((r: Record<string, unknown>) => r.product_id as string).filter(Boolean))]
      const allTourDates = allRaw.map((r: Record<string, unknown>) => r.tour_date).filter(Boolean) as string[]

      const allProducts = await getCachedOrFetch(
        cacheKeys.productSubCategories(),
        () => throttledSupabaseRequest(() => supabase.from('products').select('id, sub_category').in('id', allProductIds)).then(({ data }) => data || []),
        10 * 60 * 1000
      )
      const productMapFull = new Map((allProducts as { id: string; sub_category?: string }[]).map(p => [p.id, p.sub_category || '']))
      const maniaIdsFull = allProductIds.filter(id => {
        const sc = productMapFull.get(id)
        return sc === 'Mania Tour' || sc === 'Mania Service'
      })
      const allToursExistence = await getCachedOrFetch(
        cacheKeys.tours(allProductIds, allTourDates),
        () =>
          maniaIdsFull.length === 0
            ? Promise.resolve([])
            : supabase.from('tours').select('product_id, tour_date').in('product_id', maniaIdsFull).in('tour_date', allTourDates).then(({ data }) => data || []),
        5 * 60 * 1000
      )
      const tourMapFull = new Map((allToursExistence as { product_id: string; tour_date: string }[]).map(t => [`${t.product_id}-${t.tour_date}`, true]))
      const restMapped = mapRawToReservation(restRaw, productMapFull, tourMapFull)
      const restResIds = restMapped.map(r => r.id)
      const restTourIds = [...new Set(restMapped.map(r => r.tourId).filter(id => id && id.trim() && id !== 'null' && id !== 'undefined'))]

      const [restPricingMap, restToursById, restToursByOverlap, restOptionsPresenceMap] = await Promise.all([
        fetchPricingMap(restResIds),
        fetchToursMap(restTourIds),
        fetchToursOverlappingReservationIds(restResIds),
        fetchReservationOptionsPresenceMap(restResIds),
      ])
      const totalCount = firstMapped.length + restMapped.length

      setReservations(prev => {
        const ids = new Set(prev.map((r) => r.id))
        const extra = restMapped.filter((r) => !ids.has(r.id))
        return extra.length === 0 ? prev : [...prev, ...extra]
      })
      setReservationPricingMap(prev => new Map([...prev, ...restPricingMap]))
      setReservationOptionsPresenceByReservationId(
        (prev) => new Map([...prev, ...restOptionsPresenceMap])
      )
      setToursMap(prev => mergeTourMaps(prev, restToursById, restToursByOverlap))
      setLoadingProgress({ current: totalCount, total: totalCount })
    } catch (error) {
      if (isAbortLikeError(error)) return
      console.warn('Error fetching reservations:', error)
      setReservations([])
    } finally {
      setReservationsLoading(false)
      setReservationsAggregateReady(true)
    }
  }

  /**
   * reservation_pricing만 부분 갱신 — 전체 fetchReservations 없이 맵 병합.
   * (예: 예약 처리 필요 모달에서 총액/보증금/잔액 반영 시 모달·탭 상태 유지)
   */
  const refreshReservationPricingForIds = async (reservationIds: string[]) => {
    const unique = [...new Set(reservationIds.map((id) => String(id ?? '').trim()).filter(Boolean))]
    if (unique.length === 0) return
    const map = await fetchPricingMap(unique)
    setReservationPricingMap((prev) => {
      const next = new Map(prev)
      map.forEach((v, k) => next.set(k, v))
      return next
    })
  }

  const refreshReservationOptionsPresenceForIds = async (reservationIds: string[]) => {
    const unique = [...new Set(reservationIds.map((id) => String(id ?? '').trim()).filter(Boolean))]
    if (unique.length === 0) return
    const map = await fetchReservationOptionsPresenceMap(unique)
    setReservationOptionsPresenceByReservationId((prev) => {
      const next = new Map(prev)
      map.forEach((v, k) => next.set(k, v))
      return next
    })
  }

  type QueryResultListOpts = {
    skipLoadingFlags?: boolean
    /** 훅 `loadingProgress` — 예약 관리 주간 뷰에서 서버 total과 맞출 때 사용 */
    listProgress?: { current: number; total: number | null }
  }

  /**
   * 서버 목록 쿼리 결과만 반영(예약 관리 카드/캘린더).
   * skipLoadingFlags: 예약 관리 페이지에서 자체 로딩 스피너를 쓸 때 true.
   */
  const replaceReservationsFromQueryResult = async (
    raw: Record<string, unknown>[],
    opts?: QueryResultListOpts
  ) => {
    const quiet = opts?.skipLoadingFlags === true
    if (!quiet) {
      setReservationsLoading(true)
      setReservationsAggregateReady(false)
    }
    try {
      if (raw.length === 0) {
        setReservations([])
        setReservationPricingMap(new Map())
        setReservationOptionsPresenceByReservationId(new Map())
        setToursMap(new Map())
        setLoadingProgress({ current: 0, total: 0 })
        if (customersByReservationIds) {
          loadedCustomerIdsRef.current.clear()
          setCustomersById(new Map())
        }
        return
      }
      const productIds = [...new Set(raw.map((r) => r.product_id as string).filter(Boolean))]
      const tourDates = raw.map((r) => r.tour_date).filter(Boolean) as string[]
      const productsBatch =
        productIds.length > 0
          ? (await throttledSupabaseRequest(() =>
              supabase.from('products').select('id, sub_category').in('id', productIds)
            )).data || []
          : []
      const productMap = new Map((productsBatch as { id: string; sub_category?: string }[]).map((p) => [p.id, p.sub_category || '']))
      const maniaIds = productIds.filter((id) => {
        const sc = productMap.get(id)
        return sc === 'Mania Tour' || sc === 'Mania Service'
      })
      const toursExistence =
        maniaIds.length === 0 || tourDates.length === 0
          ? []
          : (await supabase
              .from('tours')
              .select('product_id, tour_date')
              .in('product_id', maniaIds)
              .in('tour_date', tourDates)).data || []
      const tourMap = new Map(
        (toursExistence as { product_id: string; tour_date: string }[]).map((t) => [`${t.product_id}-${t.tour_date}`, true])
      )
      const mapped = mapRawToReservation(raw, productMap, tourMap)
      const resIds = mapped.map((r) => r.id)
      const tourIds = [...new Set(mapped.map((r) => r.tourId).filter((id) => id && id.trim() && id !== 'null' && id !== 'undefined'))]
      const customerIdsForList = customersByReservationIds
        ? [...new Set(mapped.map((r) => r.customerId).filter((id) => id && String(id).trim()))]
        : []

      const [pricingMap, toursById, toursByOverlap, optionsPresenceMap] = await Promise.all([
        fetchPricingMap(resIds),
        fetchToursMap(tourIds),
        fetchToursOverlappingReservationIds(resIds),
        fetchReservationOptionsPresenceMap(resIds),
        customersByReservationIds ? loadCustomersByIds(customerIdsForList) : Promise.resolve(),
      ])
      setReservations(mapped)
      setReservationPricingMap(pricingMap)
      setReservationOptionsPresenceByReservationId(optionsPresenceMap)
      setToursMap(mergeTourMaps(toursById, toursByOverlap))
      if (opts?.listProgress) {
        setLoadingProgress({
          current: opts.listProgress.current,
          total: opts.listProgress.total ?? opts.listProgress.current,
        })
      } else {
        setLoadingProgress({ current: mapped.length, total: mapped.length })
      }
    } catch (e) {
      console.warn('replaceReservationsFromQueryResult:', e)
      setReservations([])
    } finally {
      if (!quiet) {
        setReservationsLoading(false)
        setReservationsAggregateReady(true)
      }
    }
  }

  /**
   * 서버 목록 쿼리 추가 분(주간 뷰 백그라운드 청크). 기존 예약·맵과 id 기준 병합.
   */
  const mergeMoreReservationsFromQueryResult = async (
    raw: Record<string, unknown>[],
    opts?: QueryResultListOpts
  ) => {
    if (raw.length === 0) return
    try {
      const productIds = [...new Set(raw.map((r) => r.product_id as string).filter(Boolean))]
      const tourDates = raw.map((r) => r.tour_date).filter(Boolean) as string[]
      const productsBatch =
        productIds.length > 0
          ? (await throttledSupabaseRequest(() =>
              supabase.from('products').select('id, sub_category').in('id', productIds)
            )).data || []
          : []
      const productMap = new Map((productsBatch as { id: string; sub_category?: string }[]).map((p) => [p.id, p.sub_category || '']))
      const maniaIds = productIds.filter((id) => {
        const sc = productMap.get(id)
        return sc === 'Mania Tour' || sc === 'Mania Service'
      })
      const toursExistence =
        maniaIds.length === 0 || tourDates.length === 0
          ? []
          : (await supabase
              .from('tours')
              .select('product_id, tour_date')
              .in('product_id', maniaIds)
              .in('tour_date', tourDates)).data || []
      const tourMap = new Map(
        (toursExistence as { product_id: string; tour_date: string }[]).map((t) => [`${t.product_id}-${t.tour_date}`, true])
      )
      const restMapped = mapRawToReservation(raw, productMap, tourMap)
      const restResIds = restMapped.map((r) => r.id)
      const restTourIds = [...new Set(restMapped.map((r) => r.tourId).filter((id) => id && id.trim() && id !== 'null' && id !== 'undefined'))]
      const customerIdsForList = customersByReservationIds
        ? [...new Set(restMapped.map((r) => r.customerId).filter((id) => id && String(id).trim()))]
        : []

      const [restPricingMap, restToursById, restToursByOverlap, restOptionsPresenceMap] = await Promise.all([
        fetchPricingMap(restResIds),
        fetchToursMap(restTourIds),
        fetchToursOverlappingReservationIds(restResIds),
        fetchReservationOptionsPresenceMap(restResIds),
        customersByReservationIds ? loadCustomersByIds(customerIdsForList) : Promise.resolve(),
      ])

      setReservations((prev) => {
        const ids = new Set(prev.map((r) => r.id))
        const extra = restMapped.filter((r) => !ids.has(r.id))
        return extra.length === 0 ? prev : [...prev, ...extra]
      })
      setReservationPricingMap((prev) => new Map([...prev, ...restPricingMap]))
      setReservationOptionsPresenceByReservationId((prev) => new Map([...prev, ...restOptionsPresenceMap]))
      setToursMap((prev) => mergeTourMaps(prev, restToursById, restToursByOverlap))
      if (opts?.listProgress) {
        setLoadingProgress({
          current: opts.listProgress.current,
          total: opts.listProgress.total ?? opts.listProgress.current,
        })
      }
    } catch (e) {
      console.warn('mergeMoreReservationsFromQueryResult:', e)
    }
  }

  /**
   * 예약 관리 목록 쿼리 raw 행 → Reservation + pricing/tours 맵 (메인 `reservations` 상태는 건드리지 않음).
   * 운영 큐(처리 필요 / Follow up) 전량 로드에 사용.
   */
  const hydrateAdminListRawRows = useCallback(
    async (raw: Record<string, unknown>[]): Promise<AdminListHydratedSnapshot> => {
      if (raw.length === 0) {
        return {
          reservations: [],
          pricingMap: new Map(),
          reservationOptionsPresenceByReservationId: new Map(),
          toursMap: new Map(),
        }
      }
      const productIds = [...new Set(raw.map((r) => r.product_id as string).filter(Boolean))]
      const tourDates = raw.map((r) => r.tour_date).filter(Boolean) as string[]
      const productsBatch =
        productIds.length > 0
          ? (await throttledSupabaseRequest(() =>
              supabase.from('products').select('id, sub_category').in('id', productIds)
            )).data || []
          : []
      const productMap = new Map(
        (productsBatch as { id: string; sub_category?: string }[]).map((p) => [p.id, p.sub_category || ''])
      )
      const maniaIds = productIds.filter((id) => {
        const sc = productMap.get(id)
        return sc === 'Mania Tour' || sc === 'Mania Service'
      })
      const toursExistence =
        maniaIds.length === 0 || tourDates.length === 0
          ? []
          : (await supabase
              .from('tours')
              .select('product_id, tour_date')
              .in('product_id', maniaIds)
              .in('tour_date', tourDates)).data || []
      const tourMap = new Map(
        (toursExistence as { product_id: string; tour_date: string }[]).map((t) => [
          `${t.product_id}-${t.tour_date}`,
          true,
        ])
      )
      const mapped = mapRawToReservation(raw, productMap, tourMap)
      const resIds = mapped.map((r) => r.id)
      const tourIds = [
        ...new Set(
          mapped.map((r) => r.tourId).filter((id) => id && id.trim() && id !== 'null' && id !== 'undefined')
        ),
      ]
      const customerIdsForList = customersByReservationIds
        ? [...new Set(mapped.map((r) => r.customerId).filter((id) => id && String(id).trim()))]
        : []

      const [pricingMap, toursById, toursByOverlap, optionsPresenceMap] = await Promise.all([
        fetchPricingMap(resIds),
        fetchToursMap(tourIds),
        fetchToursOverlappingReservationIds(resIds),
        fetchReservationOptionsPresenceMap(resIds),
        customersByReservationIds ? loadCustomersByIds(customerIdsForList) : Promise.resolve(),
      ])

      return {
        reservations: mapped,
        pricingMap,
        reservationOptionsPresenceByReservationId: optionsPresenceMap,
        toursMap: mergeTourMaps(toursById, toursByOverlap),
      }
    },
    // fetchPricingMap 등은 렌더마다 새 참조 — 고객 로드 모드만 의존성으로 둔다.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 내부 Supabase·맵 로직은 마운트 단위로 안정적
    [customersByReservationIds]
  )

  // 예약 데이터만 별도로 로드
  useEffect(() => {
    if (!disableReservationsAutoLoad) {
      fetchReservations()
    }
  }, [disableReservationsAutoLoad])

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
    reservationPricingMap,
    reservationOptionsPresenceByReservationId,
    toursMap,
    loading,
    loadingProgress,
    reservationsAggregateReady,
    
    // 리프레시 함수들
    refreshReservations: fetchReservations,
    replaceReservationsFromQueryResult,
    mergeMoreReservationsFromQueryResult,
    hydrateAdminListRawRows,
    refreshReservationPricingForIds,
    refreshReservationOptionsPresenceForIds,
    refreshCustomers: customersByReservationIds ? refreshCustomersByIds : refetchCustomers,
    mergeCustomers: customersByReservationIds ? mergeCustomers : undefined,
    refreshProducts: refetchProducts,
    refreshChannels: refetchChannels,
    refreshProductOptions: refetchProductOptions,
    refreshOptionChoices: refetchOptionChoices,
    refreshOptions: refetchOptions,
    refreshPickupHotels: refetchPickupHotels,
    refreshCoupons: refetchCoupons,
    refreshAll: () => {
      if (customersByReservationIds) {
        void refreshCustomersByIds()
      } else {
        refetchCustomers()
      }
      refetchProducts()
      refetchChannels()
      refetchProductOptions()
      refetchOptionChoices()
      refetchOptions()
      refetchPickupHotels()
      refetchCoupons()
      if (!disableReservationsAutoLoad) {
        fetchReservations()
      }
    }
  }
}
