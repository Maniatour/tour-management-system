export type GoogleBusinessConnectionStatus = {
  connected: boolean
  connectedEmail: string | null
  googleAccountName: string | null
  googleAccountDisplayName: string | null
  googleLocationName: string | null
  googleLocationTitle: string | null
  updatedAt: string | null
  lastSyncedAt: string | null
  lastImportReviewCount: number | null
}

export type GoogleReviewStats = {
  total: number
  pending: number
  approved: number
  rejected: number
  hidden: number
  unclassified: number
}

/** Per-source tab badge: review count + average star rating */
export type GoogleReviewSourceTabSummary = {
  total: number
  avgRating: number | null
}

/** Admin review list sort — imported_at = 최신 입력순 */
export type AdminGoogleReviewListSort = 'imported_at' | 'review_created_at'

export type AdminGoogleReviewListItem = {
  id: string
  googleReviewId: string
  reviewSource: string
  authorName: string | null
  authorPhotoUrl: string | null
  rating: number | null
  comment: string | null
  reviewReply: string | null
  reviewCreatedAt: string | null
  importStatus: string
  classificationMethod: string | null
  classificationConfidence: number | null
  productId: string | null
  productName: string | null
  importedAt: string
  excludeStaffRating: boolean
  tourId: string | null
  tourDate: string | null
  tourProductName: string | null
  tourMatchMethod: string | null
  staff: Array<{
    staffEmail: string
    staffName: string | null
    staffRole: 'guide' | 'assistant'
    matchMethod: string | null
  }>
}

export type GoogleReviewStaffStat = {
  staffEmail: string
  staffName: string
  staffIsActive: boolean
  firstReviewDate: string | null
  lastReviewDate: string | null
  reviewCount: number
  avgRating: number | null
  fiveStarCount: number
  fourStarCount: number
  threeStarCount: number
  twoStarCount: number
  oneStarCount: number
  totalTourGuests: number
  reservationGroupCount: number
  tourDepartureCount: number
}

/** 월별 집계 기준: 등록일(고객이 리뷰를 남긴 날) 또는 투어 출발일 */
export type GoogleReviewStaffMonthBy = 'review_date' | 'tour_date'

export type GoogleReviewStaffMonthlyCell = {
  month: number
  reviewCount: number
  avgRating: number | null
  fiveStarCount: number
  fourStarCount: number
  threeStarCount: number
  twoStarCount: number
  oneStarCount: number
  totalTourGuests: number
  reservationGroupCount: number
  guestReviewRatePercent: number | null
  groupReviewRatePercent: number | null
}

export type GoogleReviewStaffMonthlyStat = {
  staffEmail: string
  staffName: string
  staffIsActive: boolean
  months: GoogleReviewStaffMonthlyCell[]
}

export type GoogleReviewStaffStatReviewItem = {
  id: string
  authorName: string | null
  rating: number | null
  comment: string | null
  reviewCreatedAt: string | null
  importedAt: string
  reviewSource: string
  tourDate: string | null
  productName: string | null
}

export type GoogleBusinessAccountItem = {
  name: string
  accountName: string
  type: string | null
  verificationState: string | null
}

export type GoogleBusinessLocationItem = {
  name: string
  title: string
  storefrontAddress: string | null
}

export type GoogleBusinessOAuthStatePayload = {
  n: string
  locale: string
  redirect: string
  operatorId: string
}
