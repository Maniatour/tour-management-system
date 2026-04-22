export type VehicleRepairReportItem = {
  vehicle_id: string
  vehicle_number: string
  vehicle_type: string
  period_start: string
  period_end: string
  months_held: number
  odometer_start: number | null
  odometer_end: number | null
  distance: number
  total_repair: number
  annualized_repair: number
  repair_per_km: number | null
  is_active: boolean
}

export type VehicleRepairReportResponse = {
  data: VehicleRepairReportItem[]
  summary: { total_repair: number; vehicle_count: number }
}
