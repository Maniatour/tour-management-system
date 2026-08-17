import type { VehicleOilMaintenanceSummary } from '@/lib/scheduleVehicleOilMaintenance'
import type { ScheduleMonthDayCell } from '@/lib/scheduleGuideGridTypes'

export type ScheduleVehicleRow = {
  id: string
  label: string
  colorClass: string
  rental_start_date?: string | null | undefined
  rental_end_date?: string | null | undefined
  vehicle_category?: string | null | undefined
  vin?: string | null | undefined
  vehicle_type?: string | null | undefined
  rental_reserved_by?: string | null | undefined
  rental_reserved_by_name?: string | null | undefined
  rental_booking_price?: number | null | undefined
  daily_rate?: number | null | undefined
  rental_reservation_url?: string | null | undefined
  rental_agreement_file_url?: string | null | undefined
  rental_receipt_url?: string | null | undefined
  rental_pickup_time?: string | null | undefined
  rental_return_time?: string | null | undefined
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
