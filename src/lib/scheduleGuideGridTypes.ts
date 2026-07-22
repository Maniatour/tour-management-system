export type ScheduleGuideDailyData = {
  totalPeople: number
  assignedPeople: number
  tours: number
  productColors: { [productId: string]: string }
  role: string | null
  guideInitials: string | null
  isMultiDay: boolean
  multiDayDays: number
  extendsToNextMonth?: boolean
}

export type ScheduleGuideScheduleRow = {
  team_member_name: string
  position: string
  dailyData: { [date: string]: ScheduleGuideDailyData }
  totalPeople: number
  totalAssignedPeople: number
  totalTours: number
}

export type ScheduleMonthDayCell = {
  date: number
  dayOfWeek: string
  dateString: string
  isEdgePadding?: boolean
}

export type ScheduleGuideDayTotal = {
  assignedPeople: number
}

export type ScheduleGuideVsProductMismatch = {
  byDate: Record<string, boolean>
  month: boolean
}

export type ScheduleGuideVehicleColors = {
  vehicleIdToColor: Map<string, string>
}
