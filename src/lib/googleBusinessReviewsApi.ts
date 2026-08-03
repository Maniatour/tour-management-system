export type GoogleBusinessReviewApiRow = {
  reviewId: string
  reviewer?: {
    displayName?: string
    profilePhotoUrl?: string
    isAnonymous?: boolean
  }
  starRating?: string
  comment?: string
  createTime?: string
  updateTime?: string
  reviewReply?: {
    comment?: string
    updateTime?: string
  }
}

export type GoogleBusinessReviewsPageResult = {
  reviews: GoogleBusinessReviewApiRow[]
  nextPageToken: string | null
  totalReviewCount: number | null
  averageRating: number | null
}

const STAR_RATING_MAP: Record<string, number> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
}

export function mapGoogleStarRating(starRating: string | undefined): number | null {
  if (!starRating) return null
  return STAR_RATING_MAP[starRating] ?? null
}

/**
 * Lists one page of reviews for a GBP location.
 * @see https://developers.google.com/my-business/reference/rest/v4/accounts.locations.reviews/list
 */
export async function fetchGoogleBusinessReviewsPage(input: {
  accessToken: string
  locationName: string
  pageToken?: string | null
  pageSize?: number
}): Promise<GoogleBusinessReviewsPageResult> {
  const locationName = input.locationName.trim()
  if (!locationName.includes('/locations/')) {
    throw new Error('invalid_location_name')
  }

  const pageSize = Math.min(Math.max(input.pageSize ?? 50, 1), 50)
  const url = new URL(`https://mybusiness.googleapis.com/v4/${locationName}/reviews`)
  url.searchParams.set('pageSize', String(pageSize))
  if (input.pageToken) {
    url.searchParams.set('pageToken', input.pageToken)
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${input.accessToken}` },
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`reviews_list_failed:${res.status}:${body.slice(0, 300)}`)
  }

  const payload = (await res.json()) as {
    reviews?: GoogleBusinessReviewApiRow[]
    nextPageToken?: string
    totalReviewCount?: number
    averageRating?: number
  }

  return {
    reviews: payload.reviews ?? [],
    nextPageToken: payload.nextPageToken ?? null,
    totalReviewCount:
      typeof payload.totalReviewCount === 'number' ? payload.totalReviewCount : null,
    averageRating:
      typeof payload.averageRating === 'number' ? payload.averageRating : null,
  }
}
