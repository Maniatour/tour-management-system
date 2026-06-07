import dayjs from 'dayjs'
import { isTourStatusForVehicleScheduleDayCount } from '@/utils/tourStatusUtils'
import { parseVehicleMaintenanceSubcategories } from '@/lib/vehicleMaintenanceStandardCategory'

export type VehicleMaintenanceOilRecord = {
  vehicle_id: string | null
  maintenance_date: string
  mileage: number | null
  subcategory: string | null
}

export type LatestEngineOilChange = {
  date: string
  mileage: number | null
}

const ENGINE_OIL_SUBCATEGORY_KEYS = new Set(['engine_oil', 'oil_change'])

/** 정비목록 작업 구분: 엔진오일(엔진 오일) 교환 여부 */
export function isEngineOilMaintenanceRecord(subcategory: string | null | undefined): boolean {
  const subs = parseVehicleMaintenanceSubcategories(subcategory)
  if (subs.some((key) => ENGINE_OIL_SUBCATEGORY_KEYS.has(key))) return true
  const raw = (subcategory || '').replace(/\s+/g, '').toLowerCase()
  if (!raw) return false
  return raw.includes('engine_oil') || raw.includes('oil_change') || /엔진오?일/.test(raw)
}

function compareEngineOilRecordRecency(a: VehicleMaintenanceOilRecord, b: VehicleMaintenanceOilRecord): number {
  const dateCmp = String(b.maintenance_date).localeCompare(String(a.maintenance_date))
  if (dateCmp !== 0) return dateCmp
  return (b.mileage ?? 0) - (a.mileage ?? 0)
}

/** 차량별 최근 엔진오일 교환 (정비목록 vehicle_maintenance 기준) */
export function pickLatestEngineOilByVehicle(
  records: VehicleMaintenanceOilRecord[],
): Map<string, LatestEngineOilChange> {
  const byVehicle = new Map<string, LatestEngineOilChange>()
  const oilRecords = records.filter(
    (r) => r.vehicle_id && isEngineOilMaintenanceRecord(r.subcategory),
  )
  const grouped = new Map<string, VehicleMaintenanceOilRecord[]>()
  for (const row of oilRecords) {
    const vid = String(row.vehicle_id).trim()
    const list = grouped.get(vid) ?? []
    list.push(row)
    grouped.set(vid, list)
  }
  for (const [vehicleId, rows] of grouped) {
    const latest = [...rows].sort(compareEngineOilRecordRecency)[0]
    if (!latest) continue
    const date = String(latest.maintenance_date).substring(0, 10)
    if (!date) continue
    byVehicle.set(vehicleId, {
      date,
      mileage: latest.mileage != null && latest.mileage > 0 ? latest.mileage : null,
    })
  }
  return byVehicle
}

export type ScheduleVehicleOilMeta = {
  id: string
  vehicle_category?: string | null
  engine_oil_change_cycle?: number | null
  recent_engine_oil_change_mileage?: number | null
  recent_engine_oil_change_date?: string | null
}

export type ScheduleTourForOil = {
  id: string
  tour_date: string
  tour_status?: string | null
  tour_car_id?: string | null
  product_id?: string | null
  products?: { name?: string | null } | null
}

export type VehicleOilMaintenanceSummary = {
  recentOilChangeMileage: number | null
  recentOilChangeDate: string | null
  oilChangeCycle: number
  toursSinceOilChange: number
  estimatedMilesSinceOilChange: number
  milesUntilDue: number | null
  isOverdue: boolean
  maintenanceGapDates: Set<string>
}

const DEFAULT_OIL_CYCLE = 10000
const DEFAULT_DAY_TOUR_MILES = 700

/** 상품 ID 기준 멀티데이 일수 (ScheduleView.getMultiDayTourDays 와 동일) */
export function getMultiDayTourDays(productId: string): number {
  const multiDayPatterns: Record<string, number> = {
    MNGC1N: 2,
    MNM1: 2,
    MNGC2N: 3,
    MNGC3N: 4,
  }
  if (multiDayPatterns[productId]) return multiDayPatterns[productId]
  if (productId.startsWith('MNGC1N') || productId.startsWith('MNM1')) return 2
  if (productId.startsWith('MNGC2N')) return 3
  if (productId.startsWith('MNGC3N')) return 4
  return 1
}

/** 투어 상품명·ID 기준 예상 주행거리 (mi) */
export function estimateTourMileage(productName: string, productId?: string | null): number {
  const pid = (productId || '').trim()
  const name = (productName || '').trim()
  const nameLower = name.toLowerCase()

  if (pid.startsWith('MNGC3N')) return 1450
  if (pid.startsWith('MNGC2N')) return 1250
  if (pid.startsWith('MNM1')) return 900
  if (pid.startsWith('MNGC1N')) return 850

  if (/3박\s*4일|3박4일/.test(name)) return 1450
  if (/2박\s*3일|2박3일/.test(name)) return 1250
  if (/모뉴.*1박|1박.*모뉴/i.test(name)) return 900
  if (/1박\s*2일|1박2일/.test(name)) return 850
  if (/데이\s*투어|day tour/i.test(nameLower)) return 250
  if (/불의\s*계곡|fire canyon/i.test(nameLower)) return 120
  if (/데스\s*밸리|death valley/i.test(nameLower)) return 380
  if (/사우스\s*림|south rim/i.test(nameLower)) return 570
  if (/앤텔롭.*홀슈|antelope.*horseshoe/i.test(nameLower)) return 570
  if (/밤도깨비|midnight/i.test(nameLower)) return 700
  if (/당일/.test(name)) return 700

  return DEFAULT_DAY_TOUR_MILES
}

export function getTourProductName(tour: ScheduleTourForOil): string {
  return (
    (tour.products?.name && String(tour.products.name).trim()) ||
    (tour.product_id && String(tour.product_id).trim()) ||
    ''
  )
}

export function getTourEndDateString(tour: ScheduleTourForOil): string {
  const pid = (tour.product_id || '').trim()
  const days = getMultiDayTourDays(pid)
  if (days <= 1) return tour.tour_date
  return dayjs(tour.tour_date).add(days - 1, 'day').format('YYYY-MM-DD')
}

function isCompanyVehicle(vehicle: ScheduleVehicleOilMeta): boolean {
  return (vehicle.vehicle_category || 'company').toString().toLowerCase() !== 'rental'
}

function enumerateDatesInclusive(start: string, end: string): string[] {
  const out: string[] = []
  let cur = dayjs(start)
  const last = dayjs(end)
  if (!cur.isValid() || !last.isValid() || cur.isAfter(last, 'day')) return out
  while (!cur.isAfter(last, 'day')) {
    out.push(cur.format('YYYY-MM-DD'))
    cur = cur.add(1, 'day')
  }
  return out
}

function addGapDates(gapSet: Set<string>, fromDate: string, toDate: string) {
  for (const ds of enumerateDatesInclusive(fromDate, toDate)) {
    gapSet.add(ds)
  }
}

/** 회사 차량: 엔진오일 교체 이후 투어·주행 추정 및 배차 공백일 정비 필요 표시 */
export function computeVehicleOilMaintenanceSummary(params: {
  vehicle: ScheduleVehicleOilMeta
  tours: ScheduleTourForOil[]
  /** 그리드에 표시되는 날짜(패딩 포함) — 공백 뱃지는 이 범위와 교집합만 */
  visibleDateStrings?: string[]
}): VehicleOilMaintenanceSummary | null {
  const { vehicle, tours, visibleDateStrings } = params
  if (!isCompanyVehicle(vehicle)) return null

  const oilChangeCycle = vehicle.engine_oil_change_cycle ?? DEFAULT_OIL_CYCLE
  const recentOilChangeMileage =
    vehicle.recent_engine_oil_change_mileage != null && vehicle.recent_engine_oil_change_mileage > 0
      ? vehicle.recent_engine_oil_change_mileage
      : null
  const recentOilChangeDate = vehicle.recent_engine_oil_change_date?.substring(0, 10) ?? null

  const vehicleId = vehicle.id
  const vehicleTours = tours
    .filter(
      (t) =>
        t.tour_car_id &&
        String(t.tour_car_id).trim() === vehicleId &&
        isTourStatusForVehicleScheduleDayCount(t.tour_status) &&
        t.tour_date,
    )
    .sort((a, b) => {
      const dateCmp = a.tour_date.localeCompare(b.tour_date)
      if (dateCmp !== 0) return dateCmp
      return String(a.id).localeCompare(String(b.id))
    })

  const toursAfterOilChange = recentOilChangeDate
    ? vehicleTours.filter((t) => !dayjs(t.tour_date).isBefore(dayjs(recentOilChangeDate), 'day'))
    : vehicleTours

  let estimatedMilesSinceOilChange = 0
  for (const tour of toursAfterOilChange) {
    estimatedMilesSinceOilChange += estimateTourMileage(getTourProductName(tour), tour.product_id)
  }

  const isOverdue =
    recentOilChangeMileage != null &&
    recentOilChangeMileage > 0 &&
    estimatedMilesSinceOilChange >= oilChangeCycle

  const milesUntilDue =
    recentOilChangeMileage != null && recentOilChangeMileage > 0
      ? oilChangeCycle - estimatedMilesSinceOilChange
      : null

  const maintenanceGapDates = new Set<string>()
  let cumulativeMiles = 0
  let overdueGapStart: string | null = null

  for (let i = 0; i < vehicleTours.length; i++) {
    const tour = vehicleTours[i]
    if (recentOilChangeDate && dayjs(tour.tour_date).isBefore(dayjs(recentOilChangeDate), 'day')) {
      continue
    }

    if (overdueGapStart) {
      const gapEnd = dayjs(tour.tour_date).subtract(1, 'day').format('YYYY-MM-DD')
      if (!dayjs(gapEnd).isBefore(dayjs(overdueGapStart), 'day')) {
        addGapDates(maintenanceGapDates, overdueGapStart, gapEnd)
      }
      overdueGapStart = null
    }

    cumulativeMiles += estimateTourMileage(getTourProductName(tour), tour.product_id)

    if (recentOilChangeMileage != null && recentOilChangeMileage > 0 && cumulativeMiles >= oilChangeCycle) {
      const tourEnd = getTourEndDateString(tour)
      overdueGapStart = dayjs(tourEnd).add(1, 'day').format('YYYY-MM-DD')
    }
  }

  if (overdueGapStart && visibleDateStrings?.length) {
    const lastVisible = visibleDateStrings[visibleDateStrings.length - 1]
    if (!dayjs(lastVisible).isBefore(dayjs(overdueGapStart), 'day')) {
      addGapDates(maintenanceGapDates, overdueGapStart, lastVisible)
    }
  }

  const visibleSet =
    visibleDateStrings && visibleDateStrings.length > 0 ? new Set(visibleDateStrings) : null
  const scopedGapDates = visibleSet
    ? new Set([...maintenanceGapDates].filter((d) => visibleSet.has(d)))
    : maintenanceGapDates

  return {
    recentOilChangeMileage,
    recentOilChangeDate,
    oilChangeCycle,
    toursSinceOilChange: toursAfterOilChange.length,
    estimatedMilesSinceOilChange,
    milesUntilDue,
    isOverdue,
    maintenanceGapDates: scopedGapDates,
  }
}

export function buildVehicleOilTooltipLines(
  summary: VehicleOilMaintenanceSummary,
  crewLines: string[],
): string {
  const lines: string[] = [...crewLines]
  if (summary.recentOilChangeMileage != null && summary.recentOilChangeMileage > 0) {
    const datePart = summary.recentOilChangeDate ? ` (${summary.recentOilChangeDate})` : ''
    lines.push(`최근 엔진오일: ${summary.recentOilChangeMileage.toLocaleString()} mi${datePart}`)
  } else {
    lines.push('최근 엔진오일: 기록 없음')
  }
  lines.push(
    `교체 후: ${summary.toursSinceOilChange}회 투어 · ~${summary.estimatedMilesSinceOilChange.toLocaleString()} mi 운행`,
  )
  lines.push(`교체 주기: ${summary.oilChangeCycle.toLocaleString()} mi`)
  if (summary.isOverdue) {
    lines.push('⚠ 엔진오일 교체 필요 (예상 주행거리 초과)')
  } else if (summary.milesUntilDue != null) {
    lines.push(`남은 여유: ~${Math.max(0, summary.milesUntilDue).toLocaleString()} mi`)
  }
  return lines.join('\n')
}
