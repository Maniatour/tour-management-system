import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { VehicleRepairReportItem } from '@/lib/vehicle-repair-report'

export const dynamic = 'force-dynamic'

const ENDED_STATUS = new Set(['폐차', '사용 종료'])

const MS_PER_DAY = 86_400_000
/** 평균 월 길이(율리우스) — 개월·연환산에 사용 */
const DAYS_PER_MONTH = 30.4375

function monthsInPeriod(start: Date, end: Date): number {
  if (end <= start) return 0
  return (end.getTime() - start.getTime()) / MS_PER_DAY / DAYS_PER_MONTH
}

/** 캘린더 일 단위 비교(타임존 누락 방지) */
function toYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 자사 차량: 회사 지출(company_expenses) 첫 `submit_on`~마지막 `submit_on`으로 기간, 금액은 해당 차량 지출 합. km·연환산은 그 기간 기준(주행은 차량 주행거리). */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: vehicleRows, error: vError } = await supabase
      .from('vehicles')
      .select('id, vehicle_number, vehicle_type, current_mileage, mileage_at_purchase, status, vehicle_category')
      .or('vehicle_category.is.null,vehicle_category.eq.company')

    if (vError) {
      console.error('repair-cost-report vehicles:', vError)
      return NextResponse.json({ error: '차량을 불러오지 못했습니다.' }, { status: 500 })
    }
    if (!vehicleRows || vehicleRows.length === 0) {
      return NextResponse.json({ data: [] as VehicleRepairReportItem[], summary: { total_repair: 0, vehicle_count: 0 } })
    }

    const ids = vehicleRows.map((v) => v.id)
    const { data: expenseRows, error: eError } = await supabase
      .from('company_expenses')
      .select('vehicle_id, amount, submit_on')
      .in('vehicle_id', ids)

    if (eError) {
      console.error('repair-cost-report company_expenses:', eError)
      return NextResponse.json({ error: '회사 지출을 불러오지 못했습니다.' }, { status: 500 })
    }

    type Agg = { total: number; minMs: number; maxMs: number }
    const byVehicle = new Map<string, Agg>()
    for (const row of expenseRows || []) {
      if (row.vehicle_id == null) continue
      if (row.submit_on == null) continue
      const t = new Date(row.submit_on).getTime()
      if (Number.isNaN(t)) continue
      const amt = row.amount != null ? parseFloat(String(row.amount)) : 0
      if (!Number.isFinite(amt)) continue
      if (!byVehicle.has(row.vehicle_id)) {
        byVehicle.set(row.vehicle_id, { total: 0, minMs: t, maxMs: t })
      }
      const a = byVehicle.get(row.vehicle_id)!
      a.total += amt
      a.minMs = Math.min(a.minMs, t)
      a.maxMs = Math.max(a.maxMs, t)
    }

    const vMap = new Map(vehicleRows.map((v) => [v.id, v]))
    const items: VehicleRepairReportItem[] = []
    let totalRepair = 0

    for (const [vehicleId, agg] of byVehicle) {
      const v = vMap.get(vehicleId)
      if (!v) continue
      const start = new Date(agg.minMs)
      const end = new Date(agg.maxMs)
      const monthsHeld = monthsInPeriod(start, end)
      const odometerStart = v.mileage_at_purchase != null ? Number(v.mileage_at_purchase) : null
      const odometerEnd = v.current_mileage != null ? Number(v.current_mileage) : null
      const distance = Math.max(0, (odometerEnd ?? 0) - (odometerStart ?? 0))

      const total = agg.total
      const monthsForRate = Math.max(monthsHeld, 1 / 12)
      const annualized = (total * 12) / monthsForRate
      const perKm = distance > 0 ? total / distance : null

      totalRepair += total

      items.push({
        vehicle_id: v.id,
        vehicle_number: v.vehicle_number,
        vehicle_type: v.vehicle_type,
        period_start: toYmd(start),
        period_end: toYmd(end),
        months_held: monthsHeld,
        odometer_start: odometerStart,
        odometer_end: odometerEnd,
        distance,
        total_repair: Math.round(total * 100) / 100,
        annualized_repair: Math.round(annualized * 100) / 100,
        repair_per_km: perKm != null ? Math.round(perKm * 100) / 100 : null,
        is_active: !ENDED_STATUS.has(v.status)
      })
    }

    items.sort((a, b) => b.total_repair - a.total_repair)

    return NextResponse.json({
      data: items,
      summary: {
        total_repair: Math.round(totalRepair * 100) / 100,
        vehicle_count: items.length
      }
    })
  } catch (e) {
    console.error('repair-cost-report:', e)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
