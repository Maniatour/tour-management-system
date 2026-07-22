import type { VehicleOilMaintenanceSummary } from '@/lib/scheduleVehicleOilMaintenance'
import type { ScheduleMonthDayCell } from '@/lib/scheduleGuideGridTypes'

export type ScheduleVehicleRow = {
  id: string
  label: string
  colorClass: string
  rental_start_date?: string | null | undefined
  rental_end_date?: string | null | undefined
  vehicle_category?: string | null | undefined
}

export type ScheduleVehicleDayData = {
  count: number
  guideNames: string[]
  assistantNames: string[]
  driverNames: string[]
  productColorClass: string
}

export type ScheduleVehicleScheduleRow = {
  daily: Record<string, ScheduleVehicleDayData>
  totalDays: number
  hasAnyDayAssignment: boolean
}

export type ScheduleVehicleGridMonthDay = ScheduleMonthDayCell

export type { VehicleOilMaintenanceSummary }
