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
  reviewCount: number
  avgRating: number | null
  fiveStarCount: number
  fourStarCount: number
  threeStarCount: number
  twoStarCount: number
  oneStarCount: number
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
