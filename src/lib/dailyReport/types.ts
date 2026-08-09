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

/** 예약관리 통계 최근7일 그래프와 동일: 올해 1/1~어제 요일별 순예약 일평균 */
export type DailyReportYtdWeekdayNetAvg = {
  /** 0=일 … 6=토 (로컬/LV 달력 요일) */
  weekdayIndex: number
  /** 비교 기준일 (단일은 보고일, 기간은 종료일) */
  compareDate: string
  /** 평균 산출 구간 종료일 (보통 어제) */
  throughYmd: string
  avgNetPeople: number
  avgNetBookings: number
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
  /** 예약관리 통계 7일 차트 YTD 요일 순예약 일평균 */
  ytdWeekdayNetAvg?: DailyReportYtdWeekdayNetAvg | null
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
  assistantName: string | null
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

export type DailyReportTodoStaffColumn = {
  email: string
  name: string
}

export type DailyReportTodoMatrixStatus = 'completed' | 'pending' | 'on_hold' | 'na'

export type DailyReportTodoMatrixRow = {
  id: string
  title: string
  status: DailyReportTodoMatrixStatus
  /** 고정 패널(큐) 연동 여부 — false면 상태 N/A */
  hasQueue: boolean
  /** 완료 처리한 직원 이메일 (소문자) */
  completedByEmails: string[]
  completedByNames: string[]
  assignedToEmail: string | null
  assignedToName: string | null
  completedAt: string | null
  department: string | null
}

export type DailyReportTodoSummary = {
  completedCount: number
  pendingCount: number
  onHoldCount: number
  /** 큐(고정 패널) 연동 Todo 포함 매트릭스 */
  staffColumns: DailyReportTodoStaffColumn[]
  matrixRows: DailyReportTodoMatrixRow[]
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
  /** 부킹 수량 (입장권 EA / 호텔 rooms) */
  ea?: number | null
  /** 부킹 개당 가격 */
  unitPrice?: number | null
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
