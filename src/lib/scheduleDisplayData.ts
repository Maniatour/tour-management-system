import dayjs from 'dayjs'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import { normalizeReservationIds, normalizeTourDateKey } from '@/utils/tourUtils'
import { filterTicketBookingsExcludedFromMainUi } from '@/lib/ticketBookingSoftDelete'
import {
  buildDisplayOtaSaleStatusForYmdRange,
  getScheduleDisplayFetchDateRange,
} from '@/lib/scheduleDisplayCalendarMeta'
import type { OtaSaleStatus } from '@/lib/otaPriceInventory'
import {
  buildOfficeScheduleStaffByDate,
  type OfficeScheduleDayStaffChip,
  type OfficeScheduleOffDayRow,
  type OfficeScheduleSlotRow,
  type OfficeScheduleStaffMember,
} from '@/lib/officeScheduleDayStaff'
import {
  fetchScheduleDisplayViaRpc,
  mapRpcDateNotesToRecord,
  type ScheduleDisplayRpcChoiceRow,
} from '@/lib/scheduleDisplayRpc'

const TOURS_PAGE_SIZE = 1000

/** RPC·jsonb 경유 시 reservation_ids 문자열 등 비정규 형식 보정 */
export function normalizeScheduleDisplayTours<T extends { tour_date?: unknown; reservation_ids?: unknown }>(
  tours: T[],
): T[] {
  return tours.map((tour) => {
    const tourDate = normalizeTourDateKey(tour.tour_date)
    return {
      ...tour,
      ...(tourDate ? { tour_date: tourDate } : {}),
      reservation_ids: normalizeReservationIds(tour.reservation_ids),
    }
  })
}

export function normalizeScheduleDisplayReservations<T extends { tour_date?: unknown }>(
  reservations: T[],
): T[] {
  return reservations.map((reservation) => {
    const tourDate = normalizeTourDateKey(reservation.tour_date)
    return {
      ...reservation,
      ...(tourDate ? { tour_date: tourDate } : {}),
    }
  })
}

/** 그리드·달력·OTA 집계에 필요한 예약 컬럼만 (폼 편집 시 단건 재조회) */
export const SCHEDULE_DISPLAY_RESERVATION_SELECT =
  'id, tour_date, product_id, total_people, status, customer_id, choices'

/**
 * 관리자 스케줄뷰 — 그리드·상품 셀 모달에 필요한 예약 컬럼
 * (예약 폼 열 때는 id로 단건 `select('*')` 재조회)
 */
export const SCHEDULE_ADMIN_RESERVATION_SELECT =
  'id, tour_date, product_id, total_people, status, customer_id, choices, is_private_tour, created_at, pickup_hotel, tour_id'

/** 스케줄 디스플레이·관리자 스케줄뷰 공통 투어 조회 컬럼 (편집·배정에 필요한 필드) */
export const SCHEDULE_DISPLAY_TOUR_SELECT =
  'id, tour_date, tour_status, tour_guide_id, assistant_id, tour_car_id, product_id, reservation_ids, team_type, is_private_tour, max_participants, tour_start_datetime, operator_id, products(name)'

/** 미배정 투어 카드 — 상품 inner join */
export const SCHEDULE_ADMIN_UNASSIGNED_TOUR_SELECT =
  'id, tour_date, tour_status, tour_guide_id, assistant_id, tour_car_id, product_id, reservation_ids, team_type, is_private_tour, max_participants, tour_start_datetime, operator_id, products!inner(name)'

export type ScheduleDisplayTicketBookingRow = {
  id: string
  tour_id: string | null
  status: string | null
  ea: number | null
  company?: string
  category?: string | null
  time?: string
  check_in_date?: string
  booking_status?: string | null
  vendor_status?: string | null
  change_status?: string | null
  payment_status?: string | null
  refund_status?: string | null
  operation_status?: string | null
  deletion_requested_at?: string | null
}

export type ScheduleDisplayScheduleVehicle = {
  id: string
  label: string
  vehicle_category: string | null
  rental_start_date: string | null
  rental_end_date: string | null
  engine_oil_change_cycle: number | null
  recent_engine_oil_change_mileage: number | null
  recent_engine_oil_change_date: string | null
  current_mileage: number | null
}

export type ScheduleDisplayReservationChoice = {
  reservation_id: string
  choiceKey: string
  quantity: number
}

export type ScheduleDisplayDataPayload = {
  products: unknown[]
  teamMembers: Database['public']['Tables']['team']['Row'][]
  tours: unknown[]
  reservations: unknown[]
  customers: Pick<Database['public']['Tables']['customers']['Row'], 'id' | 'language' | 'name'>[]
  reservationChoices: ScheduleDisplayReservationChoice[]
  ticketBookings: ScheduleDisplayTicketBookingRow[]
  tourHotelBookings: Array<{
    id: string
    tour_id: string | null
    status: string | null
    rooms: number | null
    hotel?: string
    check_in_date?: string
  }>
  offSchedules: Array<{
    team_email: string
    off_date: string
    reason: string
    status: string
  }>
  dateNotes: Record<string, { note: string; created_by?: string }>
  scheduleVehicles: ScheduleDisplayScheduleVehicle[]
  /** prefetch 구간 전체 OTA 판매 상태 — 달력 주 이동 시 클라이언트 필터 */
  otaSaleStatusByKey: Record<string, OtaSaleStatus>
  /** prefetch 구간 오피스 근무자 — 달력 주 이동 시 클라이언트 필터 */
  officeStaffByDate: Record<string, OfficeScheduleDayStaffChip[]>
}

type ScheduleGridVehicleRow = {
  id: string
  vehicle_number?: string | null
  nick?: string | null
  vehicle_category?: string | null
  status?: string | null
  rental_start_date?: string | null
  rental_end_date?: string | null
  engine_oil_change_cycle?: number | null
  recent_engine_oil_change_mileage?: number | null
  current_mileage?: number | null
}

export type ScheduleGridFetchParams = {
  operatorId: string
  rangeStart: string
  rangeEnd: string
  gridNoteStart: string
  gridNoteEnd: string
  monthStart: string
  monthEnd: string
  /** RPC 실패 폴백 쿼리용 — RPC 성공 시 관리자 필드 포함 응답 */
  reservationSelect?: 'display' | 'admin'
}

export type ScheduleGridCorePayload = {
  products: unknown[]
  teamMembers: Database['public']['Tables']['team']['Row'][]
  tours: unknown[]
  reservations: unknown[]
  customers: Pick<Database['public']['Tables']['customers']['Row'], 'id' | 'language' | 'name'>[]
  reservationChoices: ScheduleDisplayReservationChoice[]
  ticketBookings: ScheduleDisplayTicketBookingRow[]
  tourHotelBookings: ScheduleDisplayDataPayload['tourHotelBookings']
  offSchedules: ScheduleDisplayDataPayload['offSchedules']
  dateNotes: Record<string, { note: string; created_by?: string }>
  vehiclesRaw: ScheduleGridVehicleRow[]
  sortedVehiclesForMonth: ScheduleGridVehicleRow[]
}

const SCHEDULE_GRID_VEHICLE_SELECT_DISPLAY =
  'id, vehicle_number, nick, vehicle_category, status, rental_start_date, rental_end_date'

const SCHEDULE_GRID_VEHICLE_SELECT_ADMIN =
  'id, vehicle_number, nick, vehicle_category, status, rental_start_date, rental_end_date, engine_oil_change_cycle, recent_engine_oil_change_mileage, current_mileage'

export function buildScheduleVehiclesForDisplayGrid(
  vehicles: ScheduleGridVehicleRow[],
): ScheduleDisplayScheduleVehicle[] {
  return vehicles.map((v) => ({
    id: v.id,
    label: ((v.nick && v.nick.trim()) || v.vehicle_number || v.id).toString().trim() || v.id,
    vehicle_category: v.vehicle_category ?? null,
    rental_start_date: v.rental_start_date ?? null,
    rental_end_date: v.rental_end_date ?? null,
    engine_oil_change_cycle: null,
    recent_engine_oil_change_mileage: null,
    recent_engine_oil_change_date: null,
    current_mileage: null,
  }))
}

async function mergeReferencedProducts(
  supabase: SupabaseClient,
  operatorId: string,
  baseProducts: unknown[],
  reservationRows: Array<{ product_id?: string | null }>,
  tourRows: Array<{ product_id?: string | null }>,
): Promise<unknown[]> {
  const baseProductIdSet = new Set(
    baseProducts.map((p) => String((p as { id?: string }).id || '')),
  )
  const missingReferencedProductIds = [
    ...new Set(
      [...reservationRows, ...tourRows]
        .map((r) => String(r.product_id || '').trim())
        .filter((id) => id && !baseProductIdSet.has(id)),
    ),
  ]
  if (missingReferencedProductIds.length === 0) return baseProducts

  const { data: extraProductsData } = await fromUntypedTable(supabase, 'products')
    .select('*')
    .eq('operator_id', operatorId)
    .in('id', missingReferencedProductIds)
  const extraProducts = (extraProductsData || []) as unknown[]
  if (extraProducts.length === 0) return baseProducts

  return baseProducts.concat(
    extraProducts.filter((p) => !baseProductIdSet.has(String((p as { id?: string }).id || ''))),
  )
}

function attachVehicleNumbersToTours(
  toursData: unknown[],
  allVehiclesData: ScheduleGridVehicleRow[],
): unknown[] {
  const vehicleMap = new Map<string, string | null>(
    (allVehiclesData || []).map((v) => [
      v.id,
      (v.nick && v.nick.trim()) || v.vehicle_number || null,
    ]),
  )
  return normalizeScheduleDisplayTours(
    (toursData as Array<{ tour_car_id?: string | null; reservation_ids?: unknown }>).map((t) => ({
      ...t,
      vehicle_number: t.tour_car_id ? (vehicleMap.get(String(t.tour_car_id).trim()) ?? null) : null,
    })),
  )
}

/** 디스플레이·관리자 스케줄 그리드 공통 코어 데이터 (RPC 1회 → 실패 시 병렬 폴백) */
export async function fetchScheduleGridCoreData(
  supabase: SupabaseClient,
  params: ScheduleGridFetchParams,
): Promise<ScheduleGridCorePayload> {
  const {
    operatorId,
    rangeStart,
    rangeEnd,
    gridNoteStart,
    gridNoteEnd,
    monthStart,
    monthEnd,
    reservationSelect = 'admin',
  } = params

  const reservationSelectSql =
    reservationSelect === 'display'
      ? SCHEDULE_DISPLAY_RESERVATION_SELECT
      : SCHEDULE_ADMIN_RESERVATION_SELECT
  const vehicleSelectSql =
    reservationSelect === 'display'
      ? SCHEDULE_GRID_VEHICLE_SELECT_DISPLAY
      : SCHEDULE_GRID_VEHICLE_SELECT_ADMIN

  const rpcPayload = await fetchScheduleDisplayViaRpc(supabase, {
    operatorId,
    rangeStart,
    rangeEnd,
    gridNoteStart,
    gridNoteEnd,
  })

  let productsData: unknown[] | null | undefined
  let teamData: Database['public']['Tables']['team']['Row'][] | null | undefined
  let toursData: unknown[]
  let reservationsData: unknown[] | null | undefined
  let allVehiclesData: ScheduleGridVehicleRow[] | null | undefined
  let ticketBookingsData: ScheduleDisplayTicketBookingRow[] | null | undefined
  let tourHotelBookingsData: ScheduleDisplayDataPayload['tourHotelBookings'] | null | undefined
  let offSchedulesData: ScheduleDisplayDataPayload['offSchedules'] | null | undefined
  let dateNotesData:
    | Array<{ note_date: string; note: string | null; created_by?: string | null }>
    | null
    | undefined
  let rpcReservationChoices: ScheduleDisplayRpcChoiceRow[] | null = null
  let rpcCustomers:
    | Pick<Database['public']['Tables']['customers']['Row'], 'id' | 'language' | 'name'>[]
    | null = null
  let rpcDateNotesMap: Record<string, { note: string; created_by?: string }> | null = null

  if (rpcPayload) {
    productsData = rpcPayload.products
    teamData = rpcPayload.teamMembers
    toursData = rpcPayload.tours
    reservationsData = rpcPayload.reservations
    allVehiclesData = rpcPayload.vehicles as ScheduleGridVehicleRow[]
    ticketBookingsData = rpcPayload.ticketBookings
    tourHotelBookingsData = rpcPayload.tourHotelBookings
    offSchedulesData = rpcPayload.offSchedules
    dateNotesData = rpcPayload.dateNotes
    rpcReservationChoices = rpcPayload.reservationChoices ?? []
    rpcCustomers = rpcPayload.customers
    rpcDateNotesMap = mapRpcDateNotesToRecord(rpcPayload.dateNotes)
  } else {
    const [
      { data: productsQueryData },
      { data: teamQueryData },
      toursQueryData,
      { data: reservationsQueryData },
      { data: vehiclesQueryData },
      { data: ticketBookingsQueryData },
      { data: tourHotelBookingsQueryData },
      { data: offSchedulesQueryData },
      { data: dateNotesQueryData },
    ] = await Promise.all([
      fromUntypedTable(supabase, 'products')
        .select('*')
        .eq('operator_id', operatorId)
        .in('sub_category', ['Mania Tour', 'Mania Service'])
        .order('name'),
      supabase.from('team').select('*').eq('is_active', true).order('name_ko'),
      fetchToursInRange(supabase, operatorId, rangeStart, rangeEnd),
      fromUntypedTable(supabase, 'reservations')
        .select(reservationSelectSql)
        .eq('operator_id', operatorId)
        .gte('tour_date', rangeStart)
        .lte('tour_date', rangeEnd),
      fromUntypedTable(supabase, 'vehicles').select(vehicleSelectSql).eq('operator_id', operatorId),
      fromUntypedTable(supabase, 'ticket_bookings')
        .select(
          'id, tour_id, status, ea, company, category, time, check_in_date, booking_status, vendor_status, change_status, payment_status, refund_status, operation_status, deletion_requested_at',
        )
        .gte('check_in_date', rangeStart)
        .lte('check_in_date', rangeEnd),
      fromUntypedTable(supabase, 'tour_hotel_bookings')
        .select('id, tour_id, status, rooms, hotel, check_in_date')
        .gte('check_in_date', rangeStart)
        .lte('check_in_date', rangeEnd),
      fromUntypedTable(supabase, 'off_schedules')
        .select('team_email, off_date, reason, status')
        .in('status', ['pending', 'approved'])
        .gte('off_date', gridNoteStart)
        .lte('off_date', gridNoteEnd),
      fromUntypedTable(supabase, 'date_notes')
        .select('note_date, note, created_by')
        .gte('note_date', gridNoteStart)
        .lte('note_date', gridNoteEnd),
    ])

    productsData = productsQueryData
    teamData = teamQueryData as Database['public']['Tables']['team']['Row'][] | null
    toursData = toursQueryData
    reservationsData = reservationsQueryData
    allVehiclesData = (vehiclesQueryData || []) as unknown as ScheduleGridVehicleRow[]
    ticketBookingsData = (ticketBookingsQueryData || []) as ScheduleDisplayTicketBookingRow[]
    tourHotelBookingsData = (tourHotelBookingsQueryData ||
      []) as ScheduleDisplayDataPayload['tourHotelBookings']
    offSchedulesData = (offSchedulesQueryData || []) as ScheduleDisplayDataPayload['offSchedules']
    dateNotesData = dateNotesQueryData as Array<{
      note_date: string
      note: string | null
      created_by?: string | null
    }> | null
  }

  const vehiclesRaw = (allVehiclesData || []) as ScheduleGridVehicleRow[]
  const sortedVehiclesForMonth = sortVehiclesForGrid(
    filterVehiclesForMonth(vehiclesRaw, monthStart, monthEnd),
  )
  const toursWithVehicles = attachVehicleNumbersToTours(toursData, vehiclesRaw)

  const reservationRows = (reservationsData || []) as Array<{ product_id?: string | null }>
  const tourRows = toursData as Array<{ product_id?: string | null }>
  const mergedProducts = await mergeReferencedProducts(
    supabase,
    operatorId,
    (productsData || []) as unknown[],
    reservationRows,
    tourRows,
  )

  const reservationsList = (reservationsData || []) as Array<{ id: string; choices?: string | null }>
  const normalizedReservations = normalizeScheduleDisplayReservations(
    (reservationsData || []) as Array<{ tour_date?: unknown }>,
  )

  const [reservationChoices, customersData] = await Promise.all([
    buildReservationChoices(supabase, reservationsList, rpcReservationChoices),
    rpcCustomers
      ? Promise.resolve(rpcCustomers)
      : (async () => {
          const rows = (reservationsData || []) as Array<{ customer_id?: string | null }>
          const customerIds = [
            ...new Set(
              rows
                .map((r) => r.customer_id)
                .filter((id: string | null | undefined): id is string => Boolean(id)),
            ),
          ]
          if (customerIds.length === 0) return []
          const { data } = await supabase.from('customers').select('id, language, name').in('id', customerIds)
          return (data || []) as Pick<
            Database['public']['Tables']['customers']['Row'],
            'id' | 'language' | 'name'
          >[]
        })(),
  ])

  const notesMap =
    rpcDateNotesMap ??
    (() => {
      const map: Record<string, { note: string; created_by?: string }> = {}
      if (dateNotesData) {
        for (const item of dateNotesData) {
          map[item.note_date] = {
            note: item.note || '',
            ...(item.created_by ? { created_by: item.created_by } : {}),
          }
        }
      }
      return map
    })()

  return {
    products: mergedProducts,
    teamMembers: (teamData || []) as Database['public']['Tables']['team']['Row'][],
    tours: toursWithVehicles,
    reservations: normalizedReservations,
    customers: customersData,
    reservationChoices,
    ticketBookings: filterTicketBookingsExcludedFromMainUi(
      (ticketBookingsData || []) as ScheduleDisplayTicketBookingRow[],
    ),
    tourHotelBookings: (tourHotelBookingsData || []) as ScheduleDisplayDataPayload['tourHotelBookings'],
    offSchedules: (offSchedulesData || []) as ScheduleDisplayDataPayload['offSchedules'],
    dateNotes: notesMap,
    vehiclesRaw,
    sortedVehiclesForMonth,
  }
}

type VehicleRow = ScheduleGridVehicleRow

function isVehicleCancelledStatus(s: string | null | undefined): boolean {
  if (!s) return false
  const lower = String(s).toLowerCase().trim()
  return lower === 'cancelled' || lower === '취소됨' || lower.includes('취소') || lower.includes('cancel')
}

function isVehicleInactiveStatus(s: string | null | undefined): boolean {
  if (!s) return false
  const lower = String(s).toLowerCase().trim()
  return lower === 'inactive' || lower.includes('inactive') || lower.includes('비활성')
}

function filterVehiclesForMonth(
  vehicles: VehicleRow[],
  monthStart: string,
  monthEnd: string,
): VehicleRow[] {
  return vehicles.filter((v) => {
    if (isVehicleCancelledStatus(v.status)) return false
    if (isVehicleInactiveStatus(v.status)) return false
    const isRental = (v.vehicle_category || '').toString().toLowerCase() === 'rental'
    if (!isRental) return true
    const start = (v.rental_start_date || '').toString().trim().substring(0, 10)
    const end = (v.rental_end_date || '').toString().trim().substring(0, 10)
    if (!start || !end) return false
    return start <= monthEnd && end >= monthStart
  })
}

function sortVehiclesForGrid(vehicles: VehicleRow[]): VehicleRow[] {
  return [...vehicles].sort((a, b) => {
    const aRental = (a.vehicle_category || '').toString().toLowerCase() === 'rental' ? 1 : 0
    const bRental = (b.vehicle_category || '').toString().toLowerCase() === 'rental' ? 1 : 0
    if (aRental !== bRental) return aRental - bRental
    const aLabel = (a.nick && a.nick.trim()) || a.vehicle_number || a.id
    const bLabel = (b.nick && b.nick.trim()) || b.vehicle_number || b.id
    return String(aLabel).localeCompare(String(bLabel))
  })
}

async function fetchToursInRange(
  supabase: SupabaseClient,
  operatorId: string,
  startDate: string,
  endDate: string,
  select = SCHEDULE_DISPLAY_TOUR_SELECT,
): Promise<unknown[]> {
  let toursData: unknown[] = []
  for (let from = 0; ; from += TOURS_PAGE_SIZE) {
    const { data: batch, error } = await fromUntypedTable(supabase, 'tours')
      .select(select)
      .eq('operator_id', operatorId)
      .gte('tour_date', startDate)
      .lte('tour_date', endDate)
      .order('tour_date', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + TOURS_PAGE_SIZE - 1)
    if (error) {
      console.error('schedule display: tours fetch failed', error)
      break
    }
    const b = batch || []
    toursData = toursData.concat(b)
    if (b.length < TOURS_PAGE_SIZE) break
  }
  return toursData
}

function isUuid(s: string | null | undefined): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test((s || '').trim())
}

function choiceLabelToKey(
  nameKo: string | null | undefined,
  nameEn: string | null | undefined,
  optionKey: string | null | undefined,
): string {
  const label = (nameKo || nameEn || (optionKey && !isUuid(optionKey) ? optionKey : '') || '')
    .toString()
    .trim()
  const labelLower = label.toLowerCase()
  const labelKo = label
  if (labelLower.includes('antelope x canyon') || /엑스\s*앤텔롭|엑스\s*앤틸롭|엑스\s*엔텔롭/.test(labelKo))
    return 'X'
  if (labelLower.includes('lower antelope canyon') || /로어\s*앤텔롭|로어\s*앤틸롭|로어\s*엔텔롭/.test(labelKo))
    return 'L'
  if (labelLower.includes('upper antelope canyon') || /어퍼\s*앤텔롭|어퍼\s*앤틸롭|어퍼\s*엔텔롭/.test(labelKo))
    return 'U'
  if (labelLower.includes('antelope x') || labelLower.includes(' x ')) return 'X'
  if (labelLower.includes('lower')) return 'L'
  if (labelLower.includes('upper')) return 'U'
  return '_other'
}

function safeJsonParse(val: string | object | null | undefined, fallback: unknown = null): unknown {
  if (val == null) return fallback
  if (typeof val === 'object') return val
  try {
    return JSON.parse(String(val))
  } catch {
    return fallback
  }
}

async function buildReservationChoices(
  supabase: SupabaseClient,
  reservationsData: Array<{ id: string; choices?: string | null }>,
  prefetchedRows?: ScheduleDisplayRpcChoiceRow[] | null,
): Promise<ScheduleDisplayReservationChoice[]> {
  const reservationIds = reservationsData.map((r) => r.id).filter(Boolean)
  let choicesFlat: ScheduleDisplayReservationChoice[] = []

  if (prefetchedRows != null) {
    choicesFlat = prefetchedRows
      .filter((row) => Boolean(row.reservation_id))
      .map((row) => ({
        reservation_id: row.reservation_id,
        choiceKey: choiceLabelToKey(
          row.option_name_ko ?? null,
          row.option_name ?? null,
          row.option_key ?? null,
        ),
        quantity: Number(row.quantity) || 1,
      }))
  } else if (reservationIds.length > 0) {
    const BATCH = 100
    for (let i = 0; i < reservationIds.length; i += BATCH) {
      const batchIds = reservationIds.slice(i, i + BATCH)
      const { data: rcData } = await supabase
        .from('reservation_choices')
        .select('reservation_id, quantity, choice_options!inner(option_key, option_name_ko, option_name)')
        .in('reservation_id', batchIds)
      if (rcData?.length) {
        choicesFlat = choicesFlat.concat(
          (rcData as Array<{
            reservation_id: string | null
            quantity?: number | null
            choice_options?: {
              option_key?: string | null
              option_name_ko?: string | null
              option_name?: string | null
            } | null
          }>)
            .filter((row) => Boolean(row.reservation_id))
            .map((row) => {
              const opt = row.choice_options
              const choiceKey = choiceLabelToKey(
                opt?.option_name_ko ?? null,
                opt?.option_name ?? null,
                opt?.option_key ?? null,
              )
              return {
                reservation_id: row.reservation_id as string,
                choiceKey,
                quantity: Number(row.quantity) || 1,
              }
            }),
        )
      }
    }
  }

  const hasTableChoices = new Set(choicesFlat.map((c) => c.reservation_id))
  for (const r of reservationsData) {
    if (hasTableChoices.has(r.id) || !r.choices) continue
    try {
      const choicesObj = safeJsonParse(r.choices) as Record<string, unknown> | null
      if (!choicesObj || !Array.isArray(choicesObj.required)) continue
      for (const item of choicesObj.required as Array<Record<string, unknown>>) {
        const qty = Number((item as { quantity?: number }).quantity) || 1
        if (item.option_id && item.choice_id) {
          const key = choiceLabelToKey(
            item.option_name_ko as string | null,
            item.option_name as string | null,
            item.option_key as string | null,
          )
          choicesFlat.push({ reservation_id: r.id, choiceKey: key, quantity: qty })
        } else if (Array.isArray(item.options)) {
          for (const opt of item.options as Array<Record<string, unknown>>) {
            if (opt.selected || opt.is_default) {
              const key = choiceLabelToKey(
                opt.name_ko as string | null,
                opt.name as string | null,
                null,
              )
              choicesFlat.push({ reservation_id: r.id, choiceKey: key, quantity: qty })
            }
          }
        }
      }
    } catch {
      /* ignore */
    }
  }

  return choicesFlat
}

async function fetchOfficeStaffByDateRange(
  supabase: SupabaseClient,
  rangeStart: string,
  rangeEndInclusive: string,
): Promise<Record<string, OfficeScheduleDayStaffChip[]>> {
  const [teamRes, slotsRes, offDaysRes] = await Promise.all([
    supabase
      .from('team')
      .select('email, name_en, display_name, nick_name, name_ko, position')
      .eq('is_active', true)
      .or('position.ilike.op,position.ilike.office manager'),
    fromUntypedTable(supabase, 'office_schedule_slots')
      .select('employee_email, schedule_date, hour_slot')
      .gte('schedule_date', rangeStart)
      .lte('schedule_date', rangeEndInclusive),
    fromUntypedTable(supabase, 'office_schedule_off_days')
      .select('employee_email, schedule_date')
      .gte('schedule_date', rangeStart)
      .lte('schedule_date', rangeEndInclusive),
  ])

  if (teamRes.error) throw teamRes.error
  if (slotsRes.error) throw slotsRes.error
  if (offDaysRes.error) throw offDaysRes.error

  const staff = ((teamRes.data || []) as OfficeScheduleStaffMember[]).map((row) => ({
    email: row.email,
    display_name: row.display_name ?? null,
    name_en: row.name_en ?? null,
    nick_name: row.nick_name ?? null,
    name_ko: row.name_ko ?? null,
  }))

  return buildOfficeScheduleStaffByDate(
    staff,
    (slotsRes.data || []) as OfficeScheduleSlotRow[],
    (offDaysRes.data || []) as OfficeScheduleOffDayRow[],
  )
}

/** 스케줄 디스플레이 페이지용 데이터 — 서버 API·클라이언트 훅 공통 */
export async function fetchScheduleDisplayData(
  supabase: SupabaseClient,
  operatorId: string,
  displayDayCount: number,
): Promise<ScheduleDisplayDataPayload> {
  const { start: startDate, end: endDate } = getScheduleDisplayFetchDateRange(displayDayCount)
  const rangeEndInclusive = dayjs(endDate).subtract(1, 'day').format('YYYY-MM-DD')
  const monthStart = dayjs().startOf('day').format('YYYY-MM-DD')
  const monthEnd = dayjs()
    .startOf('day')
    .add(Math.max(displayDayCount, 1) - 1, 'day')
    .format('YYYY-MM-DD')
  const gridNoteStart = dayjs().startOf('day').subtract(1, 'day').format('YYYY-MM-DD')
  const gridNoteEnd = dayjs(monthEnd).add(1, 'day').format('YYYY-MM-DD')

  const core = await fetchScheduleGridCoreData(supabase, {
    operatorId,
    rangeStart: startDate,
    rangeEnd: endDate,
    gridNoteStart,
    gridNoteEnd,
    monthStart,
    monthEnd,
    reservationSelect: 'display',
  })

  const scheduleVehicles = buildScheduleVehiclesForDisplayGrid(core.sortedVehiclesForMonth)

  const tourProductIds = [
    ...new Set(
      (core.tours as Array<{ product_id?: string | null }>)
        .map((t) => String(t.product_id || '').trim())
        .filter(Boolean),
    ),
  ]

  const [otaSaleStatusByKey, officeStaffByDate] = await Promise.all([
    buildDisplayOtaSaleStatusForYmdRange(supabase, {
      rangeStart: startDate,
      rangeEndInclusive,
      tours: core.tours as unknown as Parameters<typeof buildDisplayOtaSaleStatusForYmdRange>[1]['tours'],
      reservations: core.reservations as unknown as Parameters<
        typeof buildDisplayOtaSaleStatusForYmdRange
      >[1]['reservations'],
      productIds: tourProductIds,
    }),
    fetchOfficeStaffByDateRange(supabase, startDate, rangeEndInclusive),
  ])

  return {
    products: core.products,
    teamMembers: core.teamMembers,
    tours: core.tours,
    reservations: core.reservations,
    customers: core.customers,
    reservationChoices: core.reservationChoices,
    ticketBookings: core.ticketBookings,
    tourHotelBookings: core.tourHotelBookings,
    offSchedules: core.offSchedules,
    dateNotes: core.dateNotes,
    scheduleVehicles,
    otaSaleStatusByKey,
    officeStaffByDate,
  }
}
