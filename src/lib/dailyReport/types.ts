export type DailyReportCountGuests = {
  count: number
  guests: number
}

export type DailyReportBreakdownRow = DailyReportCountGuests & {
  id: string
  name: string
  newCount: number
  newGuests: number
  cancelledCount: number
  cancelledGuests: number
  netCount: number
  netGuests: number
}

export type DailyReportReservationSummary = {
  newRegistrations: DailyReportCountGuests
  cancellationsToday: DailyReportCountGuests
  netReservations: DailyReportCountGuests
  tourDateToday: number
  totalGuestsToday: number
  pendingFollowUp: number
  byProduct: DailyReportBreakdownRow[]
  byChannel: DailyReportBreakdownRow[]
  highlights: string[]
  notes: string
}

export type DailyReportExpenseCategory = {
  category: string
  amount: number
}

export type DailyReportTourFinancial = {
  id: string
  productName: string
  tourStatus: string | null
  guideName: string | null
  guestCount: number
  reservationCount: number
  totalPayment: number
  /** 채널 수수료 합계 (총매출 산출 시 차감) */
  channelCommission: number
  balanceOutstanding: number
  cashDeposit: number
  totalIncome: number
  totalExpenses: number
  netProfit: number
  expensesByCategory: DailyReportExpenseCategory[]
}

export type DailyReportTourSummary = {
  toursToday: number
  completed: number
  inProgress: number
  unassigned: number
  totalGuests: number
  totals: {
    totalPayment: number
    channelCommission: number
    balanceOutstanding: number
    cashDeposit: number
    totalIncome: number
    totalExpenses: number
    netProfit: number
    expensesByCategory: DailyReportExpenseCategory[]
  }
  tours: DailyReportTourFinancial[]
  highlights: string[]
  notes: string
}

export type DailyReportTodoUserActivity = {
  userEmail: string
  userName: string | null
  completed: Array<{ id: string; title: string; completedAt: string | null }>
  pending: Array<{ id: string; title: string }>
  onHold: Array<{ id: string; title: string }>
}

export type DailyReportTodoSummary = {
  completedCount: number
  pendingCount: number
  onHoldCount: number
  byUser: DailyReportTodoUserActivity[]
  notes: string
}

export type DailyReportTomorrowTour = {
  id: string
  productName: string
  tourStatus: string | null
  assignmentStatus: string | null
  guideName: string | null
  assistantName: string | null
  vehicleLabel: string | null
  guestCount: number
  reservationCount: number
  isFullyAssigned: boolean
  tourStart: string | null
}

export type DailyReportTomorrowSchedule = {
  date: string
  tours: DailyReportTomorrowTour[]
  unassignedCount: number
  totalTours: number
  totalGuests: number
  notes: string
}

export type DailyReportFinancialItem = {
  id: string
  label: string
  detail?: string | null
  amount: number
  paymentMethod?: string | null
}

export type DailyReportFinancialCategory = {
  key: 'tour' | 'reservation' | 'booking' | 'company' | 'cash_expense' | 'cash'
  title: string
  items: DailyReportFinancialItem[]
  total: number
}

export type DailyReportFinancialReport = {
  categories: DailyReportFinancialCategory[]
  cashOnHand: number
  cashInflowToday: number
  cashOutflowToday: number
  netCashFlowToday: number
}

export type DailyReportData = {
  reportDate: string
  /** 종료일 — 시작일과 같으면 일일 보고, 다르면 기간 보고 */
  reportEndDate?: string
  tomorrowDate: string
  generatedAt: string
  operatorId: string
  submittedByName?: string | null
  submittedByEmail?: string | null
  reservationSummary: DailyReportReservationSummary
  tourSummary: DailyReportTourSummary
  financialReport: DailyReportFinancialReport
  todoSummary: DailyReportTodoSummary
  tomorrowSchedule: DailyReportTomorrowSchedule
  additionalNotes: string
}

export type OfficeDailyReportRow = {
  id: string
  report_date: string
  operator_id: string
  submitted_by: string | null
  submitted_by_email: string | null
  submitted_by_name: string | null
  submitted_at: string | null
  status: 'draft' | 'submitted'
  report_data: DailyReportData
  editor_notes: string | null
  pdf_storage_path: string | null
  pdf_url: string | null
  email_sent_at: string | null
  email_sent_to: string[] | null
  created_at: string
  updated_at: string
}

/** 여행사 Daily Report 권장 항목 (UI 안내용) */
export const DAILY_REPORT_TRAVEL_AGENCY_RECOMMENDATIONS = [
  '당일 신규·취소·순예약 (건수·인원)',
  '채널별·상품별 예약 실적',
  '투어별 수익·지출·순이익 및 일일 합계',
  '현금 입금·미수금(잔액) 현황',
  '내일 투어 배차·가이드·차량 배정 상태',
  '픽업 알림·고객정보 검수·OTA 마감 등 TODO 완료 내역',
  '컴플레인·특이사항·현장 이슈 메모',
  '날씨·도로·입장권 이슈 등 운영 리스크',
  '파트너·가이드·차량 긴급 연락 필요 건',
] as const
