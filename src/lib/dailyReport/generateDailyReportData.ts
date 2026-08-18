import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import {
  lasVegasDateRangeBounds,
  tomorrowInLasVegas,
  isSingleDayReport,
  toLasVegasDateKey,
  LV_TZ,
  todayInLasVegas,
} from '@/lib/dailyReport/dateUtils'
import { buildTourFinancialSummary } from '@/lib/dailyReport/buildTourFinancials'
import { buildFinancialReport } from '@/lib/dailyReport/buildFinancialReport'
import { fetchReservationStatusTransitionsByTimeRange } from '@/lib/reservationStatusEventsFetch'
import { statusFromReservationAuditJson } from '@/lib/reservationStatusAudit'
import {
  fetchCancellationFollowUpMeta,
  isRebookingReservationByReasonMap,
} from '@/lib/reservationCancellationReason'
import { isQueuePanelLinkedOpTodo, todoMatrixDedupeKey } from '@/lib/opTodoQueuePanelFilter'
import {
  buildCustomerInfoReviewActivityItems,
  isCustomerInfoReviewTodoTitle,
} from '@/lib/dailyReport/todoActivityDetails'
import {
  buildDailyReportActivityHistory,
} from '@/lib/dailyReport/buildActivityHistory'
import { fetchAdminRegCancelYtdWeekdayAvg } from '@/lib/adminRegCancelYtdWeekdayAvg'
import { resolveProductInternalName } from '@/utils/reservationUtils'
import { isTourCancelled } from '@/utils/tourStatusUtils'
import type {
  DailyReportBreakdownRow,
  DailyReportCountGuests,
  DailyReportData,
  DailyReportTodoActivityItem,
  DailyReportTodoMatrixRow,
  DailyReportTodoMatrixStatus,
  DailyReportTodoStaffColumn,
  DailyReportYtdWeekdayNetAvg,
} from '@/lib/dailyReport/types'
import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'

dayjs.extend(utc)
dayjs.extend(timezone)

type ReservationRow = {
  id: string
  status: string | null
  total_people: number | null
  created_at: string | null
  tour_date: string
  archive: boolean
  product_id: string | null
  channel_id: string | null
}

type TourRow = {
  id: string
  tour_date: string
  tour_status: string | null
  assignment_status: string | null
  tour_guide_id: string | null
  assistant_id: string | null
  tour_car_id: string | null
  reservation_ids: string[] | null
  tour_start_datetime: string | null
  product_id: string | null
  guide_fee: number | null
  assistant_fee: number | null
  products: {
    internal_name_ko: string | null
    internal_name_en: string | null
    name: string | null
    name_ko: string | null
    name_en: string | null
  } | null
}

type TeamRow = {
  email: string
  name_ko: string | null
  nick_name: string | null
  display_name: string | null
}

type VehicleRow = {
  id: string
  vehicle_number: string | null
  nick: string | null
}

type OpTodoRow = {
  id: string
  title: string
  department: string
  completed: boolean
  completed_at: string | null
  on_hold: boolean
  assigned_to: string | null
  created_by: string
  action_type?: string | null
}

type TodoClickRow = {
  todo_id: string
  user_email: string
  action: string
  timestamp: string | null
}

function isCancelledStatus(status: string | null | undefined): boolean {
  const s = (status ?? '').toLowerCase().trim()
  if (!s) return false
  return (
    s === 'cancelled' ||
    s === 'canceled' ||
    s === 'deleted' ||
    s === 'no_show' ||
    s === 'date_changed' ||
    s.includes('cancel')
  )
}

function productNameFromMap(productId: string | null, productMap: Map<string, string>): string {
  if (!productId) return '상품 미지정'
  return productMap.get(productId) ?? '상품 미지정'
}

function dailyReportProductName(
  product:
    | {
        name?: string | null
        name_ko?: string | null
        name_en?: string | null
      }
    | null
    | undefined,
  fallback?: string | null
): string {
  return resolveProductInternalName(product, fallback) || '상품 미지정'
}

function channelNameFromMap(channelId: string | null, channelMap: Map<string, string>): string {
  if (!channelId) return '채널 미지정'
  return channelMap.get(channelId) ?? '채널 미지정'
}

function countGuests(rows: ReservationRow[]): DailyReportCountGuests {
  return {
    count: rows.length,
    guests: rows.reduce((s, r) => s + (r.total_people ?? 0), 0),
  }
}

function buildBreakdown(
  newRows: ReservationRow[],
  cancelledRows: ReservationRow[],
  keyFn: (r: ReservationRow) => { id: string; name: string }
): DailyReportBreakdownRow[] {
  const map = new Map<string, DailyReportBreakdownRow>()

  const ensure = (id: string, name: string) => {
    if (!map.has(id)) {
      map.set(id, {
        id,
        name,
        count: 0,
        guests: 0,
        newCount: 0,
        newGuests: 0,
        cancelledCount: 0,
        cancelledGuests: 0,
        netCount: 0,
        netGuests: 0,
      })
    }
    return map.get(id)!
  }

  for (const r of newRows) {
    const { id, name } = keyFn(r)
    const row = ensure(id, name)
    row.newCount += 1
    row.newGuests += r.total_people ?? 0
  }

  for (const r of cancelledRows) {
    const { id, name } = keyFn(r)
    const row = ensure(id, name)
    row.cancelledCount += 1
    row.cancelledGuests += r.total_people ?? 0
  }

  for (const row of map.values()) {
    row.netCount = row.newCount - row.cancelledCount
    row.netGuests = row.newGuests - row.cancelledGuests
    row.count = row.netCount
    row.guests = row.netGuests
  }

  return Array.from(map.values()).sort((a, b) => b.newCount - a.newCount)
}

function vehicleLabel(v: VehicleRow | undefined): string | null {
  if (!v) return null
  return v.nick?.trim() || v.vehicle_number?.trim() || null
}

function memberName(m: TeamRow | undefined): string | null {
  if (!m) return null
  return m.nick_name?.trim() || m.name_ko?.trim() || m.display_name?.trim() || m.email || null
}

/** COMMON 부서 todo도 사무실 업무로 표시 */
function normalizeTodoDepartment(dept: string): string {
  const d = (dept ?? '').trim().toLowerCase()
  if (d === 'common') return 'office'
  return dept || 'office'
}

/** YYYY-MM-DD → 요일 인덱스 (0=일 … 6=토), 달력 날짜 기준 */
function weekdayIndexFromYmd(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number)
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return 0
  return new Date(y, m - 1, d, 12, 0, 0, 0).getDay()
}

/**
 * 예약관리 통계 최근 7일 그래프와 동일:
 * 올해(비교일 연도) 1/1 ~ 어제 순예약 요일별 일평균.
 */
async function fetchYtdWeekdayNetAvgForReport(
  client: SupabaseClient<Database>,
  operatorId: string,
  compareDate: string
): Promise<DailyReportYtdWeekdayNetAvg | null> {
  const year = parseInt(compareDate.slice(0, 4), 10)
  if (!Number.isFinite(year)) return null

  const todayLv = todayInLasVegas()
  const yesterdayLv = dayjs.tz(todayLv, LV_TZ).subtract(1, 'day').format('YYYY-MM-DD')
  /** 예약관리 7일 차트와 동일: 올해 1/1 ~ 어제 */
  const throughYmd = yesterdayLv
  const weekdayIndex = weekdayIndexFromYmd(compareDate)

  if (throughYmd < `${year}-01-01`) {
    return {
      weekdayIndex,
      compareDate,
      throughYmd,
      avgNetPeople: 0,
      avgNetBookings: 0,
    }
  }

  const { data: buckets, error } = await fetchAdminRegCancelYtdWeekdayAvg(client, {
    selectedStatus: 'all',
    selectedChannel: 'all',
    dateRange: { start: '', end: '' },
    customerIdFromUrl: null,
    debouncedSearchTerm: '',
    operatorId,
    year,
    throughYmd,
    timeZone: LV_TZ,
  })

  if (error) {
    console.error('daily-report ytd weekday avg:', error)
    return null
  }

  return {
    weekdayIndex,
    compareDate,
    throughYmd,
    avgNetPeople: buckets.people[weekdayIndex] ?? 0,
    avgNetBookings: buckets.bookings[weekdayIndex] ?? 0,
  }
}

export async function generateDailyReportData(
  client: SupabaseClient<Database>,
  operatorId: string,
  reportDate: string,
  options?: {
    endDate?: string
    submittedByName?: string | null
    submittedByEmail?: string | null
    preserveNotes?: Partial<Pick<DailyReportData, 'additionalNotes'>> & {
      reservationNotes?: string
      tourNotes?: string
      todoNotes?: string
      tomorrowNotes?: string
    }
  }
): Promise<DailyReportData> {
  const endDate = options?.endDate ?? reportDate
  const singleDay = isSingleDayReport(reportDate, endDate)
  const tomorrowDate = tomorrowInLasVegas(singleDay ? reportDate : endDate)
  const { start, end } = lasVegasDateRangeBounds(reportDate, endDate)

  const newReservationsRes = await client
      .from('reservations')
      .select('id, status, total_people, created_at, tour_date, archive, product_id, channel_id')
      .eq('operator_id', operatorId)
      .eq('archive', false)
      .gte('created_at', start)
      .lte('created_at', end)

  const [
    tourDateReservationsRes,
    todayToursRes,
    tomorrowToursRes,
    opTodosRes,
    todoLogsRes,
    teamRes,
    vehiclesRes,
    attendanceRes,
    ytdWeekdayNetAvg,
  ] = await Promise.all([
    client
      .from('reservations')
      .select('id, status, total_people, created_at, tour_date, archive')
      .eq('operator_id', operatorId)
      .eq('archive', false)
      .gte('tour_date', reportDate)
      .lte('tour_date', endDate),
    client
      .from('tours')
      .select(
        'id, tour_date, tour_status, assignment_status, tour_guide_id, assistant_id, tour_car_id, reservation_ids, tour_start_datetime, product_id, guide_fee, assistant_fee, products(internal_name_ko, internal_name_en, name, name_ko, name_en)'
      )
      .eq('operator_id', operatorId)
      .gte('tour_date', reportDate)
      .lte('tour_date', endDate),
    singleDay
      ? client
          .from('tours')
          .select(
            'id, tour_date, tour_status, assignment_status, tour_guide_id, assistant_id, tour_car_id, reservation_ids, tour_start_datetime, products(internal_name_ko, internal_name_en, name, name_ko, name_en)'
          )
          .eq('operator_id', operatorId)
          .eq('tour_date', tomorrowDate)
      : Promise.resolve({ data: [], error: null }),
    client
      .from('op_todos')
      .select('id, title, department, completed, completed_at, on_hold, assigned_to, created_by, action_type')
      .order('title', { ascending: true })
      .limit(500),
    client
      .from('todo_click_logs')
      .select('todo_id, user_email, action, timestamp')
      .eq('action', 'completed')
      .gte('timestamp', start)
      .lte('timestamp', end),
    client.from('team').select('email, name_ko, nick_name, display_name'),
    client.from('vehicles').select('id, vehicle_number, nick'),
    client
      .from('attendance_records')
      .select('employee_email, date, check_in_time, check_out_time')
      .gte('date', reportDate)
      .lte('date', endDate)
      .not('check_in_time', 'is', null),
    fetchYtdWeekdayNetAvgForReport(client, operatorId, singleDay ? reportDate : endDate),
  ])

  const newReservations = (newReservationsRes.data ?? []) as ReservationRow[]
  const tourDateReservations = (tourDateReservationsRes.data ?? []) as ReservationRow[]
  const attendanceRows = (attendanceRes.data ?? []) as Array<{
    employee_email: string | null
    date: string | null
    check_in_time: string | null
    check_out_time: string | null
  }>

  /** 당일(기간) 상태→취소 전환: events 페이지네이션 + audit_logs 보완 */
  const cancelledIdSet = new Set<string>()
  const { rows: statusTransitionRows, error: statusTransitionError } =
    await fetchReservationStatusTransitionsByTimeRange(client, {
      rangeStartIso: start,
      rangeEndIso: end,
      includeAuditLogs: true,
    })
  if (statusTransitionError) {
    console.error('daily-report reservation status transitions:', statusTransitionError)
  }
  for (const row of statusTransitionRows) {
    const to = statusFromReservationAuditJson(row.new_values)
    if (!isCancelledStatus(to)) continue
    const ymd = toLasVegasDateKey(row.created_at)
    if (!ymd || ymd < reportDate || ymd > endDate) continue
    const id = String(row.record_id ?? '').trim()
    if (id) cancelledIdSet.add(id)
  }

  /** events/audit 누락 시: 당일 updated_at + 현재 취소 상태 폴백 */
  const { data: updatedCancelledRows, error: updatedCancelError } = await client
    .from('reservations')
    .select('id, status, total_people, created_at, tour_date, archive, product_id, channel_id, updated_at')
    .eq('operator_id', operatorId)
    .eq('archive', false)
    .gte('updated_at', start)
    .lte('updated_at', end)
  if (updatedCancelError) {
    console.error('daily-report cancelled fallback query:', updatedCancelError)
  }
  for (const row of updatedCancelledRows ?? []) {
    if (!isCancelledStatus(row.status)) continue
    const id = String(row.id ?? '').trim()
    if (id) cancelledIdSet.add(id)
  }

  const cancelledReservationIds = [...cancelledIdSet]

  const cancelledById = new Map<string, ReservationRow>()
  for (const row of updatedCancelledRows ?? []) {
    if (!isCancelledStatus(row.status)) continue
    const id = String(row.id ?? '').trim()
    if (!id) continue
    cancelledById.set(id, row as ReservationRow)
  }

  const missingCancelIds = cancelledReservationIds.filter((id) => !cancelledById.has(id))
  const CANCEL_ID_CHUNK = 100
  for (let i = 0; i < missingCancelIds.length; i += CANCEL_ID_CHUNK) {
    const chunk = missingCancelIds.slice(i, i + CANCEL_ID_CHUNK)
    const { data } = await client
      .from('reservations')
      .select('id, status, total_people, created_at, tour_date, archive, product_id, channel_id')
      .eq('operator_id', operatorId)
      .in('id', chunk)
    for (const row of (data ?? []) as ReservationRow[]) {
      cancelledById.set(row.id, row)
    }
  }

  const cancelledReservationsRaw = [...cancelledById.values()]

  const cancellationMeta = await fetchCancellationFollowUpMeta(
    cancelledReservationsRaw.map((r) => r.id),
    client
  )
  const cancellationReasonById = new Map<string, string>()
  for (const [id, meta] of cancellationMeta) {
    if (meta.reason) cancellationReasonById.set(id, meta.reason)
  }

  /** 취소 사유가 재예약인 건은 당일 취소·순예약에서 제외 */
  const cancelledReservations = cancelledReservationsRaw.filter(
    (r) => !isRebookingReservationByReasonMap(r.id, cancellationReasonById)
  )

  const productIds = [
    ...new Set(
      [...newReservations, ...cancelledReservations]
        .map((r) => r.product_id)
        .filter((id): id is string => Boolean(id))
    ),
  ]
  const channelIds = [
    ...new Set(
      [...newReservations, ...cancelledReservations]
        .map((r) => r.channel_id)
        .filter((id): id is string => Boolean(id))
    ),
  ]

  const productMap = new Map<string, string>()
  if (productIds.length) {
    const { data: products, error: productsError } = await client
      .from('products')
      .select('id, name, name_ko, name_en, product_code')
      .in('id', productIds)
    if (productsError) {
      console.error('daily-report products lookup:', productsError)
    }
    for (const p of products ?? []) {
      productMap.set(p.id, dailyReportProductName(p, p.product_code))
    }
  }

  const channelMap = new Map<string, string>()
  if (channelIds.length) {
    const { data: channels } = await client.from('channels').select('id, name').in('id', channelIds)
    for (const c of channels ?? []) {
      channelMap.set(c.id, c.name?.trim() || '채널 미지정')
    }
  }

  const byProduct = buildBreakdown(newReservations, cancelledReservations, (r) => ({
    id: r.product_id ?? 'unknown',
    name: productNameFromMap(r.product_id, productMap),
  }))

  const byChannel = buildBreakdown(newReservations, cancelledReservations, (r) => ({
    id: r.channel_id ?? 'unknown',
    name: channelNameFromMap(r.channel_id, channelMap),
  }))

  const newStats = countGuests(newReservations)
  const cancelStats = countGuests(cancelledReservations)
  const netStats: DailyReportCountGuests = {
    count: newStats.count - cancelStats.count,
    guests: newStats.guests - cancelStats.guests,
  }

  const todayTours = (todayToursRes.data ?? []) as TourRow[]
  const tomorrowTours = ((tomorrowToursRes.data ?? []) as TourRow[]).filter(
    (t) => !isTourCancelled(t.tour_status)
  )
  const opTodos = (opTodosRes.data ?? []) as OpTodoRow[]
  const todoLogs = (todoLogsRes.data ?? []) as TodoClickRow[]

  const teamByEmail = new Map<string, TeamRow>()
  for (const m of (teamRes.data ?? []) as TeamRow[]) {
    if (m.email) {
      teamByEmail.set(m.email, m)
      teamByEmail.set(m.email.trim().toLowerCase(), m)
    }
  }

  const vehicleById = new Map<string, VehicleRow>()
  for (const v of (vehiclesRes.data ?? []) as VehicleRow[]) {
    vehicleById.set(v.id, v)
  }

  const memberNameFn = (email: string | null | undefined) =>
    memberName(email ? teamByEmail.get(email) : undefined)

  const tourFinancials = await buildTourFinancialSummary(client, todayTours, memberNameFn)
  const financialReport = await buildFinancialReport(
    client,
    operatorId,
    reportDate,
    endDate,
    todayTours,
    tourFinancials.tours
  )

  const pendingFollowUp = tourDateReservations.filter(
    (r) => !isCancelledStatus(r.status) && (r.status ?? '').toLowerCase().includes('pending')
  ).length

  const totalGuestsToday = tourDateReservations
    .filter((r) => !isCancelledStatus(r.status))
    .reduce((sum, r) => sum + (r.total_people ?? 0), 0)

  const reservationHighlights: string[] = []
  if (newStats.count > 0) {
    reservationHighlights.push(`신규 ${newStats.count}건 / ${newStats.guests}명`)
  }
  if (cancelStats.count > 0) {
    reservationHighlights.push(
      `${singleDay ? '당일' : '기간'} 취소 ${cancelStats.count}건 / ${cancelStats.guests}명`
    )
  }
  reservationHighlights.push(`순예약 ${netStats.count}건 / ${netStats.guests}명`)
  if (ytdWeekdayNetAvg) {
    const avgPeople = Math.round(ytdWeekdayNetAvg.avgNetPeople)
    const delta = netStats.guests - avgPeople
    const deltaLabel = delta > 0 ? `+${delta}` : String(delta)
    reservationHighlights.push(
      singleDay
        ? `요일 일평균 ${avgPeople}명 · 오늘 ${netStats.guests}명 (${deltaLabel})`
        : `요일 일평균 ${avgPeople}명 · 기간 순예약 ${netStats.guests}명`
    )
  }

  const tourHighlights: string[] = []
  if (todayTours.length > 0) {
    tourHighlights.push(
      `투어 ${todayTours.length}건 · 순이익 ${tourFinancials.totals.netProfit.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`
    )
  }

  const completerByTodo = new Map<string, string>()
  const completersByTodo = new Map<string, Set<string>>()
  /** todoId → email → 완료 시각(ISO). 동일 유저는 가장 이른 completed 로그 시각 사용 */
  const completedAtByTodoEmail = new Map<string, Map<string, string>>()
  for (const log of todoLogs) {
    const email = (log.user_email || '').trim().toLowerCase()
    if (!email) continue
    completerByTodo.set(log.todo_id, log.user_email)
    const set = completersByTodo.get(log.todo_id) ?? new Set<string>()
    set.add(email)
    completersByTodo.set(log.todo_id, set)
    const at = log.timestamp
    if (at) {
      const byEmail = completedAtByTodoEmail.get(log.todo_id) ?? new Map<string, string>()
      const prev = byEmail.get(email)
      if (!prev || at < prev) byEmail.set(email, at)
      completedAtByTodoEmail.set(log.todo_id, byEmail)
    }
  }

  /** 전체 Todo (고정 패널 연동 포함) — 출근 직원 매트릭스 */
  const isCompletedToday = (t: OpTodoRow) =>
    Boolean(
      t.completed && t.completed_at && t.completed_at >= start && t.completed_at <= end
    )

  const resolveTodoStatus = (t: OpTodoRow): DailyReportTodoMatrixStatus => {
    if (!isQueuePanelLinkedOpTodo(t)) return 'na'
    if (t.completed) return 'completed'
    if (t.on_hold) return 'on_hold'
    return 'pending'
  }

  const todosCompletedToday = opTodos.filter((t) => isCompletedToday(t) && isQueuePanelLinkedOpTodo(t))
  const todosPending = opTodos.filter(
    (t) => !t.completed && !t.on_hold && isQueuePanelLinkedOpTodo(t)
  )
  const todosOnHold = opTodos.filter(
    (t) => !t.completed && t.on_hold && isQueuePanelLinkedOpTodo(t)
  )

  const userActivityMap = new Map<
    string,
    {
      userEmail: string
      userName: string | null
      completed: Array<{ id: string; title: string; completedAt: string | null }>
      pending: Array<{ id: string; title: string }>
      onHold: Array<{ id: string; title: string }>
    }
  >()

  const ensureUser = (email: string) => {
    const key = email.trim().toLowerCase()
    if (!userActivityMap.has(key)) {
      userActivityMap.set(key, {
        userEmail: email,
        userName: memberName(teamByEmail.get(email)),
        completed: [],
        pending: [],
        onHold: [],
      })
    }
    return userActivityMap.get(key)!
  }

  for (const t of todosCompletedToday) {
    const email = completerByTodo.get(t.id) || t.assigned_to || t.created_by
    ensureUser(email).completed.push({
      id: t.id,
      title: t.title,
      completedAt: t.completed_at,
    })
  }

  for (const t of todosPending) {
    void normalizeTodoDepartment(t.department)
    const email = t.assigned_to || t.created_by
    ensureUser(email).pending.push({ id: t.id, title: t.title })
  }

  for (const t of todosOnHold) {
    const email = t.assigned_to || t.created_by
    ensureUser(email).onHold.push({ id: t.id, title: t.title })
  }

  const checkedInEmails = new Set<string>()
  for (const row of attendanceRows) {
    const email = (row.employee_email || '').trim().toLowerCase()
    if (!email) continue
    const ymd =
      toLasVegasDateKey(row.check_in_time) ||
      (row.date && /^\d{4}-\d{2}-\d{2}/.test(row.date) ? row.date.slice(0, 10) : null)
    if (!ymd || ymd < reportDate || ymd > endDate) continue
    checkedInEmails.add(email)
  }

  const staffNameForEmail = (email: string | null | undefined) => {
    if (!email) return null
    const team = teamByEmail.get(email.trim().toLowerCase())
    return (
      team?.nick_name?.trim() ||
      team?.name_ko?.trim() ||
      team?.display_name?.trim() ||
      email.split('@')[0] ||
      email
    )
  }

  const staffColumns: DailyReportTodoStaffColumn[] = [...checkedInEmails]
    .map((email) => ({
      email,
      name: staffNameForEmail(email) || email,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'))

  const collectCompleterEmails = (t: OpTodoRow): string[] => {
    const emails = new Set(completersByTodo.get(t.id) ?? [])
    if (emails.size === 0 && t.completed) {
      const fallback = (completerByTodo.get(t.id) || t.assigned_to || t.created_by || '')
        .trim()
        .toLowerCase()
      if (fallback) emails.add(fallback)
    }
    return [...emails]
  }

  const collectCompletedAtByEmail = (t: OpTodoRow, emails: string[]): Record<string, string | null> => {
    const fromLogs = completedAtByTodoEmail.get(t.id)
    const out: Record<string, string | null> = {}
    for (const email of emails) {
      out[email] = fromLogs?.get(email) ?? (t.completed ? t.completed_at : null)
    }
    return out
  }

  const mergeCompletedAtByEmail = (
    a: Record<string, string | null>,
    b: Record<string, string | null>
  ): Record<string, string | null> => {
    const out: Record<string, string | null> = { ...a }
    for (const [email, at] of Object.entries(b)) {
      const prev = out[email]
      if (!prev) out[email] = at
      else if (at && at < prev) out[email] = at
    }
    return out
  }

  const customerInfoActivityItems = await buildCustomerInfoReviewActivityItems(client, {
    rangeStartIso: start,
    rangeEndIso: end,
    staffNameForEmail,
    locale: 'ko',
  })

  const activityHistory = await buildDailyReportActivityHistory(client, {
    startYmd: reportDate,
    endYmd: endDate,
    rangeStartIso: start,
    rangeEndIso: end,
    staffNameForEmail,
    locale: 'ko',
  })

  const toMatrixRow = (t: OpTodoRow): DailyReportTodoMatrixRow => {
    const status = resolveTodoStatus(t)
    const completedByEmails = collectCompleterEmails(t)
    const assigned = (t.assigned_to || '').trim().toLowerCase() || null
    const activityItems: DailyReportTodoActivityItem[] = isCustomerInfoReviewTodoTitle(t.title)
      ? customerInfoActivityItems
      : []
    return {
      id: t.id,
      title: t.title,
      status,
      hasQueue: isQueuePanelLinkedOpTodo(t),
      completedByEmails,
      completedByNames: completedByEmails
        .map((e) => staffNameForEmail(e) || e)
        .filter(Boolean),
      completedAtByEmail: collectCompletedAtByEmail(t, completedByEmails),
      assignedToEmail: assigned,
      assignedToName: assigned ? staffNameForEmail(assigned) : null,
      completedAt: t.completed_at,
      department: t.department || null,
      activityItems,
    }
  }

  /** 동일 제목 중복 병합 (예: 가이드와 스케줄 컨펌 2건) */
  const statusRank: Record<DailyReportTodoMatrixStatus, number> = {
    completed: 0,
    on_hold: 1,
    na: 2,
    pending: 3,
  }
  const dedupedByTitle = new Map<string, DailyReportTodoMatrixRow>()
  for (const t of opTodos) {
    const hasQueue = isQueuePanelLinkedOpTodo(t)
    // 과거 완료된 큐 패널은 당일 보고에서 제외 (당일 완료·미완료·비큐만 표시)
    if (t.completed && hasQueue && !isCompletedToday(t)) continue

    const row = toMatrixRow(t)
    const key = todoMatrixDedupeKey(row.title)
    const existing = dedupedByTitle.get(key)
    if (!existing) {
      dedupedByTitle.set(key, row)
      continue
    }
    const preferNew = statusRank[row.status] < statusRank[existing.status]
    const base = preferNew ? row : existing
    const other = preferNew ? existing : row
    const mergedEmails = [...new Set([...base.completedByEmails, ...other.completedByEmails])]
    const mergedActivity =
      base.activityItems.length >= other.activityItems.length ? base.activityItems : other.activityItems
    dedupedByTitle.set(key, {
      ...base,
      completedByEmails: mergedEmails,
      completedByNames: mergedEmails.map((e) => staffNameForEmail(e) || e),
      completedAtByEmail: mergeCompletedAtByEmail(base.completedAtByEmail, other.completedAtByEmail),
      completedAt: base.completedAt || other.completedAt,
      assignedToEmail: base.assignedToEmail || other.assignedToEmail,
      assignedToName: base.assignedToName || other.assignedToName,
      activityItems: mergedActivity,
    })
  }

  // 완료 → 보류 → N/A → 미처리(하단)
  const matrixRows: DailyReportTodoMatrixRow[] = [...dedupedByTitle.values()].sort(
    (a, b) => statusRank[a.status] - statusRank[b.status] || a.title.localeCompare(b.title, 'ko')
  )

  const completedCount = matrixRows.filter((r) => r.status === 'completed').length
  const pendingCount = matrixRows.filter((r) => r.status === 'pending').length
  const onHoldCount = matrixRows.filter((r) => r.status === 'on_hold').length

  const tomorrowReservationIds = [
    ...new Set(tomorrowTours.flatMap((t) => (Array.isArray(t.reservation_ids) ? t.reservation_ids : []))),
  ].filter(Boolean)

  type TomorrowReservationRow = {
    id: string
    status: string | null
    total_people: number | null
    archive: boolean
  }
  const tomorrowReservationById = new Map<string, TomorrowReservationRow>()
  const TOMORROW_RES_BATCH = 150
  for (let i = 0; i < tomorrowReservationIds.length; i += TOMORROW_RES_BATCH) {
    const chunk = tomorrowReservationIds.slice(i, i + TOMORROW_RES_BATCH)
    const { data } = await client
      .from('reservations')
      .select('id, status, total_people, archive')
      .in('id', chunk)
    for (const row of (data ?? []) as TomorrowReservationRow[]) {
      tomorrowReservationById.set(row.id, row)
    }
  }

  const isActiveTomorrowReservation = (id: string) => {
    const row = tomorrowReservationById.get(id)
    if (!row) return false
    if (row.archive) return false
    if (isCancelledStatus(row.status)) return false
    return true
  }

  const tomorrowTourRows = tomorrowTours.map((t) => {
    const guideName = memberNameFn(t.tour_guide_id)
    const assistantName = memberNameFn(t.assistant_id)
    const vehicle = vehicleLabel(vehicleById.get(t.tour_car_id ?? ''))
    const activeResIds = (t.reservation_ids ?? []).filter(isActiveTomorrowReservation)
    const guestCount = activeResIds.reduce(
      (sum, id) => sum + (tomorrowReservationById.get(id)?.total_people ?? 0),
      0
    )
    const isFullyAssigned = Boolean(t.tour_guide_id && t.tour_car_id)

    return {
      id: t.id,
      productName: dailyReportProductName(t.products),
      tourStatus: t.tour_status,
      assignmentStatus: t.assignment_status,
      guideName,
      assistantName,
      vehicleLabel: vehicle,
      guestCount,
      reservationCount: activeResIds.length,
      isFullyAssigned,
      tourStart: t.tour_start_datetime,
    }
  })

  return {
    reportDate,
    ...(singleDay ? {} : { reportEndDate: endDate }),
    tomorrowDate,
    generatedAt: new Date().toISOString(),
    operatorId,
    submittedByName: options?.submittedByName ?? null,
    submittedByEmail: options?.submittedByEmail ?? null,
    reservationSummary: {
      newRegistrations: newStats,
      cancellationsToday: cancelStats,
      netReservations: netStats,
      tourDateToday: tourDateReservations.filter((r) => !isCancelledStatus(r.status)).length,
      totalGuestsToday,
      pendingFollowUp,
      byProduct,
      byChannel,
      ytdWeekdayNetAvg,
      highlights: reservationHighlights,
      notes: options?.preserveNotes?.reservationNotes ?? '',
    },
    tourSummary: {
      toursToday: todayTours.length,
      completed: tourFinancials.completed,
      inProgress: tourFinancials.inProgress,
      unassigned: tourFinancials.unassigned,
      totalGuests: tourFinancials.totalGuests,
      totals: tourFinancials.totals,
      tours: tourFinancials.tours,
      highlights: tourHighlights,
      notes: options?.preserveNotes?.tourNotes ?? '',
    },
    financialReport,
    todoSummary: {
      completedCount,
      pendingCount,
      onHoldCount,
      staffColumns,
      matrixRows,
      byUser: Array.from(userActivityMap.values()).sort(
        (a, b) => b.completed.length - a.completed.length
      ),
      notes: options?.preserveNotes?.todoNotes ?? '',
    },
    activityHistory,
    tomorrowSchedule: {
      date: tomorrowDate,
      tours: tomorrowTourRows,
      unassignedCount: tomorrowTourRows.filter((t) => !t.isFullyAssigned).length,
      totalTours: tomorrowTourRows.length,
      totalGuests: tomorrowTourRows.reduce((sum, t) => sum + t.guestCount, 0),
      notes: options?.preserveNotes?.tomorrowNotes ?? '',
    },
    additionalNotes: options?.preserveNotes?.additionalNotes ?? '',
  }
}
