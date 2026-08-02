import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { lasVegasDateRangeBounds, tomorrowInLasVegas, isSingleDayReport } from '@/lib/dailyReport/dateUtils'
import { buildTourFinancialSummary } from '@/lib/dailyReport/buildTourFinancials'
import { buildFinancialReport } from '@/lib/dailyReport/buildFinancialReport'
import type {
  DailyReportBreakdownRow,
  DailyReportCountGuests,
  DailyReportData,
} from '@/lib/dailyReport/types'

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
  products: { name: string | null; name_ko: string | null; name_en: string | null } | null
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
}

type TodoClickRow = {
  todo_id: string
  user_email: string
  action: string
  timestamp: string | null
}

function isCancelledStatus(status: string | null | undefined): boolean {
  const s = (status ?? '').toLowerCase()
  return s.includes('cancel') || s === 'canceled' || s === 'cancelled'
}

function productNameFromMap(productId: string | null, productMap: Map<string, string>): string {
  if (!productId) return '상품 미지정'
  return productMap.get(productId) ?? '상품 미지정'
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
    statusEventsRes,
    todayToursRes,
    tomorrowToursRes,
    opTodosRes,
    todoLogsRes,
    teamRes,
    vehiclesRes,
  ] = await Promise.all([
    client
      .from('reservations')
      .select('id, status, total_people, created_at, tour_date, archive')
      .eq('operator_id', operatorId)
      .eq('archive', false)
      .gte('tour_date', reportDate)
      .lte('tour_date', endDate),
    client
      .from('reservation_status_events')
      .select('id, reservation_id, from_status, to_status, occurred_at')
      .gte('occurred_at', start)
      .lte('occurred_at', end),
    client
      .from('tours')
      .select(
        'id, tour_date, tour_status, assignment_status, tour_guide_id, assistant_id, tour_car_id, reservation_ids, tour_start_datetime, product_id, guide_fee, assistant_fee, products(name, name_ko, name_en)'
      )
      .eq('operator_id', operatorId)
      .gte('tour_date', reportDate)
      .lte('tour_date', endDate),
    singleDay
      ? client
          .from('tours')
          .select(
            'id, tour_date, tour_status, assignment_status, tour_guide_id, assistant_id, tour_car_id, reservation_ids, tour_start_datetime, products(name, name_ko, name_en)'
          )
          .eq('operator_id', operatorId)
          .eq('tour_date', tomorrowDate)
      : Promise.resolve({ data: [], error: null }),
    client
      .from('op_todos')
      .select('id, title, department, completed, completed_at, on_hold, assigned_to, created_by')
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
  ])

  const newReservations = (newReservationsRes.data ?? []) as ReservationRow[]
  const tourDateReservations = (tourDateReservationsRes.data ?? []) as ReservationRow[]
  const statusEvents = (statusEventsRes.data ?? []).filter((e) => isCancelledStatus(e.to_status))

  const cancelledReservationIds = [...new Set(statusEvents.map((e) => e.reservation_id))]

  let cancelledReservations: ReservationRow[] = []
  if (cancelledReservationIds.length > 0) {
    const { data } = await client
      .from('reservations')
      .select('id, status, total_people, created_at, tour_date, archive, product_id, channel_id')
      .eq('operator_id', operatorId)
      .in('id', cancelledReservationIds)
    cancelledReservations = (data ?? []) as ReservationRow[]
  }

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
    const { data: products } = await client
      .from('products')
      .select('id, name, name_ko, name_en')
      .in('id', productIds)
    for (const p of products ?? []) {
      productMap.set(p.id, p.name_ko?.trim() || p.name_en?.trim() || p.name?.trim() || '상품 미지정')
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
  const tomorrowTours = (tomorrowToursRes.data ?? []) as TourRow[]
  const opTodos = (opTodosRes.data ?? []) as OpTodoRow[]
  const todoLogs = (todoLogsRes.data ?? []) as TodoClickRow[]

  const teamByEmail = new Map<string, TeamRow>()
  for (const m of (teamRes.data ?? []) as TeamRow[]) {
    if (m.email) teamByEmail.set(m.email, m)
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

  const tourHighlights: string[] = []
  if (todayTours.length > 0) {
    tourHighlights.push(
      `투어 ${todayTours.length}건 · 순이익 ${tourFinancials.totals.netProfit.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`
    )
  }

  const completerByTodo = new Map<string, string>()
  for (const log of todoLogs) {
    completerByTodo.set(log.todo_id, log.user_email)
  }

  const todosCompletedToday = opTodos.filter(
    (t) =>
      t.completed &&
      t.completed_at &&
      t.completed_at >= start &&
      t.completed_at <= end
  )
  const todosPending = opTodos.filter((t) => !t.completed && !t.on_hold)
  const todosOnHold = opTodos.filter((t) => !t.completed && t.on_hold)

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

  const tomorrowTourRows = tomorrowTours.map((t) => {
    const guideName = memberNameFn(t.tour_guide_id)
    const assistantName = memberNameFn(t.assistant_id)
    const vehicle = vehicleLabel(vehicleById.get(t.tour_car_id ?? ''))
    const reservationCount = t.reservation_ids?.length ?? 0
    const isFullyAssigned = Boolean(t.tour_guide_id && t.tour_car_id)

    return {
      id: t.id,
      productName:
        t.products?.name_ko?.trim() ||
        t.products?.name_en?.trim() ||
        t.products?.name?.trim() ||
        '상품 미지정',
      tourStatus: t.tour_status,
      assignmentStatus: t.assignment_status,
      guideName,
      assistantName,
      vehicleLabel: vehicle,
      guestCount: reservationCount,
      reservationCount,
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
      completedCount: todosCompletedToday.length,
      pendingCount: todosPending.length,
      onHoldCount: todosOnHold.length,
      byUser: Array.from(userActivityMap.values()).sort(
        (a, b) => b.completed.length - a.completed.length
      ),
      notes: options?.preserveNotes?.todoNotes ?? '',
    },
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
