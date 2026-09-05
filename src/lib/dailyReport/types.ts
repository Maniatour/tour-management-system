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

export type DailyReportTourReportStaffRole = 'guide' | 'assistant' | 'other'

export type DailyReportTourReportStaff = {
  name: string
  role: DailyReportTourReportStaffRole
  submitted: boolean
}

export type DailyReportTourReportSkippedStop = {
  reason: string
  note: string
}

export type DailyReportTourReportEntry = {
  id: string
  staffName: string
  role: DailyReportTourReportStaffRole
  submittedOn: string | null
  weather: string | null
  overallMood: string | null
  customerCount: number | null
  bookedCustomerCount: number | null
  hasIssues: boolean
  incidents: string[]
  lostItems: string[]
  vehicleTags: string[]
  vehicleNote: string | null
  skippedStops: DailyReportTourReportSkippedStop[]
  guestComments: string | null
  handoffNote: string | null
  comments: string | null
  suggestions: string | null
  narrationSkipTitleKo: string | null
  narrationSkipTitleEn: string | null
  narrationSkipDetail: string | null
  photoCount: number
}

export type DailyReportTourReportTour = {
  tourId: string
  tourDate: string
  productName: string
  staff: DailyReportTourReportStaff[]
  missingNames: string[]
  allSubmitted: boolean
  reports: DailyReportTourReportEntry[]
}

export type DailyReportTourReportSummary = {
  assignedTourCount: number
  completeTourCount: number
  missingTourCount: number
  submittedReportCount: number
  issueReportCount: number
  tours: DailyReportTourReportTour[]
  highlights: string[]
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

/** 어코디언: 필드 단위 변경 한 줄 */
export type DailyReportTodoActivityChange = {
  field: string
  fieldLabel: string
  before: string
  after: string
}

/** 어코디언: 고객(대상)별 변경 내역 */
export type DailyReportTodoActivityItem = {
  at: string | null
  actorEmail: string | null
  actorName: string | null
  /** 고객명 등 대상 */
  subject: string
  changes: DailyReportTodoActivityChange[]
}

export type DailyReportTodoMatrixRow = {
  id: string
  title: string
  status: DailyReportTodoMatrixStatus
  /** 고정 패널(큐) 연동 여부 — false면 상태 N/A */
  hasQueue: boolean
  /** 완료 처리한 직원 이메일 (소문자) */
  completedByEmails: string[]
  completedByNames: string[]
  /** 직원별 완료 시각 (이메일 소문자 → ISO) */
  completedAtByEmail: Record<string, string | null>
  assignedToEmail: string | null
  assignedToName: string | null
  completedAt: string | null
  department: string | null
  /** 행 펼침 시 표시할 업무 상세(예: 고객 정보 변경) */
  activityItems: DailyReportTodoActivityItem[]
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

/** 기간 보고용 직원 활동 한 줄 */
export type DailyReportActivityActionKind = 'add' | 'edit' | 'delete'

export type DailyReportActivityHistoryItem = {
  id: string
  at: string
  actorEmail: string | null
  actorName: string | null
  category: string
  actionLabel: string
  /** 추가 / 수정 / 삭제 — UI에서 아이콘으로 표시 */
  actionKind: DailyReportActivityActionKind
  /** 예: [예약] - 고객명, 8/19/26 밤도깨비 2인 */
  summary: string
  /** 예: 투어 연결됨, 대기 > 취소 (액션 아이콘은 actionKind로 별도 표시) */
  badges?: string[]
}

export type DailyReportActivityHistoryGroup = {
  actorEmail: string | null
  actorName: string
  items: DailyReportActivityHistoryItem[]
}

export type DailyReportActivityHistory = {
  groups: DailyReportActivityHistoryGroup[]
  items: DailyReportActivityHistoryItem[]
  totalCount: number
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
  /** 해당일(기간) 투어 리포트 제출 현황·현장 요약 */
  tourReportSummary?: DailyReportTourReportSummary
  financialReport: DailyReportFinancialReport
  todoSummary: DailyReportTodoSummary
  /** 직원 활동 히스토리 (단일일·기간 공통) */
  activityHistory: DailyReportActivityHistory
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
  '당일 투어 리포트 제출 현황 및 현장 이슈 요약',
  '투어별 수익·지출·순이익 및 일일 합계',
  '현금 입금·미수금(잔액) 현황',
  '내일 투어 배차·가이드·차량 배정 상태',
  '픽업 알림·고객정보 검수·OTA 마감 등 TODO 완료 내역',
  '컴플레인·특이사항·현장 이슈 메모',
  '날씨·도로·입장권 이슈 등 운영 리스크',
  '파트너·가이드·차량 긴급 연락 필요 건',
] as const
