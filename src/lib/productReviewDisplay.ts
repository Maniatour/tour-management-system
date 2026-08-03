import type { ProductReviewItem } from '@/components/product/ProductDetailReviewsSection'

export type PublicProductReviewRow = {
  id: string
  reservation_id: string
  rating: number
  content: string
  platform: string
  created_at: string | null
}

export function toPublicGuestName(raw: string | null | undefined): string {
  const trimmed = raw?.trim()
  if (!trimmed) return 'Guest'

  const parts = trimmed.split(/\s+/).filter(Boolean)
  if (parts.length <= 1) return parts[0] ?? 'Guest'

  const first = parts[0]!
  const lastInitial = parts[parts.length - 1]?.[0]
  return lastInitial ? `${first} ${lastInitial}.` : first
}

export function formatReviewPlatformLabel(platform: string): string {
  const normalized = platform.trim()
  if (!normalized) return ''

  const known: Record<string, string> = {
    google: 'Google',
    tripadvisor: 'TripAdvisor',
    viator: 'Viator',
    getyourguide: 'GetYourGuide',
    klook: 'Klook',
    kkday: 'KKday',
    facebook: 'Facebook',
    instagram: 'Instagram',
    maniatour: 'Mania Tour',
  }

  const key = normalized.toLowerCase().replace(/[\s_-]+/g, '')
  if (known[key]) return known[key]!

  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

export function formatReviewDate(
  iso: string | null | undefined,
  locale: string
): string | undefined {
  if (!iso) return undefined

  try {
    return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'ko-KR', {
      year: 'numeric',
      month: 'short',
    }).format(new Date(iso))
  } catch {
    return undefined
  }
}

export function mapReviewRowsToProductItems(
  rows: PublicProductReviewRow[],
  guestNamesByReservation: Map<string, string>,
  locale: string
): ProductReviewItem[] {
  return rows
    .filter((row) => row.content.trim().length > 0)
    .map((row) => {
      const name = toPublicGuestName(guestNamesByReservation.get(row.reservation_id))
      const platformLabel = formatReviewPlatformLabel(row.platform)
      const date = formatReviewDate(row.created_at, locale)

      return {
        name,
        ...(platformLabel ? { country: platformLabel } : {}),
        rating: row.rating,
        quote: row.content.trim(),
        ...(date ? { date } : {}),
      }
    })
}

export function computeAverageRating(rows: PublicProductReviewRow[]): number | null {
  if (!rows.length) return null
  const sum = rows.reduce((acc, row) => acc + row.rating, 0)
  return sum / rows.length
}

export type PublicGoogleReviewRow = {
  id: string
  author_name: string | null
  author_photo_url: string | null
  rating: number | null
  comment: string | null
  review_created_at: string | null
}

export function mapGoogleReviewsToProductItems(
  rows: PublicGoogleReviewRow[],
  locale: string
): ProductReviewItem[] {
  return rows
    .filter((row) => typeof row.comment === 'string' && row.comment.trim().length > 0)
    .map((row) => {
      const date = formatReviewDate(row.review_created_at, locale)
      return {
        name: toPublicGuestName(row.author_name),
        country: 'Google',
        rating: row.rating ?? 5,
        quote: row.comment!.trim(),
        ...(date ? { date } : {}),
        source: 'google' as const,
        ...(row.author_photo_url ? { avatarUrl: row.author_photo_url } : {}),
      }
    })
}

export function computeAverageRatingFromNumbers(ratings: number[]): number | null {
  if (!ratings.length) return null
  return ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
}
