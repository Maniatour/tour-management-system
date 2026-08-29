import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import { REVIEW_SOURCE_WEBSITE, websiteLocationPlaceholder } from '@/lib/reviewSources'

export const WRITE_REVIEW_MIN_WORDS = 20
export const WRITE_REVIEW_MAX_PHOTOS = 6
export const WRITE_REVIEW_MAX_PHOTO_BYTES = 8 * 1024 * 1024

const PRODUCT_ID_RE = /^[a-zA-Z0-9_-]{1,128}$/
const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']

export const COMPANION_TYPES = ['business', 'couples', 'family', 'friends', 'solo'] as const
export type CompanionType = (typeof COMPANION_TYPES)[number]

export const BOOKED_WITH_OPTIONS = [
  'mania-tour',
  'viator',
  'getyourguide',
  'tripadvisor',
  'klook',
  'kkday',
  'tripcom',
  'other',
] as const
export type BookedWithOption = (typeof BOOKED_WITH_OPTIONS)[number]

export type SubRatingValue = number | 'na' | null

export type CustomerReviewSubmitInput = {
  productId: string
  locale: string
  authorName: string
  rating: number
  ratingValue: SubRatingValue
  ratingGuide: SubRatingValue
  ratingPickup: SubRatingValue
  visitedMonth: string
  companionType: CompanionType | null
  bookedWith: BookedWithOption | null
  title: string
  content: string
  certified: boolean
  honeypot: string
  photos: File[]
  clientIp: string | null
}

export type CustomerReviewSubmitResult =
  | { ok: true; pending: true }
  | { ok: false; status: number; message: string }

export function countReviewWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length
}

function isCompanionType(value: string): value is CompanionType {
  return (COMPANION_TYPES as readonly string[]).includes(value)
}

function isBookedWithOption(value: string): value is BookedWithOption {
  return (BOOKED_WITH_OPTIONS as readonly string[]).includes(value)
}

function parseSubRating(value: unknown): SubRatingValue {
  if (value === 'na' || value === 'N/A') return 'na'
  if (value == null || value === '') return null
  const n = typeof value === 'number' ? value : Number.parseInt(String(value), 10)
  if (!Number.isFinite(n) || n < 1 || n > 5) return null
  return n
}

function isVisitedMonth(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
}

function hashClientIp(ip: string | null): string | null {
  if (!ip) return null
  return createHash('sha256').update(ip).digest('hex').slice(0, 32)
}

function extFromType(mime: string): string {
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  if (mime === 'image/gif') return 'gif'
  return 'jpg'
}

export function parseCustomerReviewFormData(formData: FormData, clientIp: string | null): CustomerReviewSubmitInput {
  const photos = formData
    .getAll('photos')
    .filter((item): item is File => item instanceof File && item.size > 0)

  const companionRaw = String(formData.get('companionType') || '').trim()
  const bookedRaw = String(formData.get('bookedWith') || '').trim()

  return {
    productId: String(formData.get('productId') || '').trim(),
    locale: String(formData.get('locale') || 'en').trim() || 'en',
    authorName: String(formData.get('authorName') || '').trim(),
    rating: Number.parseInt(String(formData.get('rating') || ''), 10),
    ratingValue: parseSubRating(formData.get('ratingValue')),
    ratingGuide: parseSubRating(formData.get('ratingGuide')),
    ratingPickup: parseSubRating(formData.get('ratingPickup')),
    visitedMonth: String(formData.get('visitedMonth') || '').trim(),
    companionType: isCompanionType(companionRaw) ? companionRaw : null,
    bookedWith: isBookedWithOption(bookedRaw) ? bookedRaw : null,
    title: String(formData.get('title') || '').trim(),
    content: String(formData.get('content') || '').trim(),
    certified: String(formData.get('certified') || '') === 'true',
    honeypot: String(formData.get('companyWebsite') || '').trim(),
    photos,
    clientIp,
  }
}

async function uploadReviewPhotos(
  operatorId: string,
  reviewExternalId: string,
  photos: File[]
): Promise<string[]> {
  if (!supabaseAdmin || photos.length === 0) return []

  const urls: string[] = []
  const limited = photos.slice(0, WRITE_REVIEW_MAX_PHOTOS)

  for (const photo of limited) {
    if (!ALLOWED_PHOTO_TYPES.includes(photo.type)) continue
    if (photo.size > WRITE_REVIEW_MAX_PHOTO_BYTES) continue

    const ext = extFromType(photo.type)
    const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${ext}`
    const path = `customer-reviews/${operatorId}/${reviewExternalId}/${fileName}`

    const { data, error } = await supabaseAdmin.storage.from('images').upload(path, photo, {
      cacheControl: '3600',
      upsert: false,
      contentType: photo.type,
    })

    if (error || !data?.path) {
      console.error('[customer-reviews] photo upload failed', error)
      continue
    }

    const {
      data: { publicUrl },
    } = supabaseAdmin.storage.from('images').getPublicUrl(data.path)
    if (publicUrl) urls.push(publicUrl)
  }

  return urls
}

export async function submitCustomerProductReview(
  operatorId: string,
  input: CustomerReviewSubmitInput
): Promise<CustomerReviewSubmitResult> {
  if (input.honeypot) {
    return { ok: true, pending: true }
  }

  if (!supabaseAdmin) {
    return { ok: false, status: 503, message: 'Service unavailable' }
  }

  if (!PRODUCT_ID_RE.test(input.productId)) {
    return { ok: false, status: 400, message: 'Invalid product' }
  }

  if (!Number.isFinite(input.rating) || input.rating < 1 || input.rating > 5) {
    return { ok: false, status: 400, message: 'Rating required' }
  }

  if (input.authorName.length < 2 || input.authorName.length > 80) {
    return { ok: false, status: 400, message: 'Name required' }
  }

  if (!isVisitedMonth(input.visitedMonth)) {
    return { ok: false, status: 400, message: 'Visit month required' }
  }

  if (!input.certified) {
    return { ok: false, status: 400, message: 'Certification required' }
  }

  if (countReviewWords(input.content) < WRITE_REVIEW_MIN_WORDS) {
    return { ok: false, status: 400, message: 'Review too short' }
  }

  if (input.title.length > 120) {
    return { ok: false, status: 400, message: 'Title too long' }
  }

  const { data: product, error: productError } = await supabaseAdmin
    .from('products')
    .select('id')
    .eq('id', input.productId)
    .eq('operator_id', operatorId)
    .eq('status', 'active')
    .eq('is_published', true)
    .maybeSingle()

  if (productError || !product) {
    return { ok: false, status: 404, message: 'Product not found' }
  }

  const ipHash = hashClientIp(input.clientIp)
  if (ipHash) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count: recentCount } = await fromUntypedTable(supabaseAdmin, 'google_reviews')
      .select('id', { count: 'exact', head: true })
      .eq('operator_id', operatorId)
      .eq('review_source', REVIEW_SOURCE_WEBSITE)
      .gte('imported_at', since)
      .contains('raw_payload', { ipHash })

    if ((recentCount ?? 0) >= 5) {
      return { ok: false, status: 429, message: 'Too many reviews' }
    }
  }

  const now = new Date().toISOString()
  const externalId = `website:${crypto.randomUUID()}`
  const photoUrls = await uploadReviewPhotos(operatorId, externalId, input.photos)
  const comment = [input.title.trim(), input.content.trim()].filter(Boolean).join('\n\n')

  const payload = {
    operator_id: operatorId,
    google_review_id: externalId,
    review_source: REVIEW_SOURCE_WEBSITE,
    google_location_name: websiteLocationPlaceholder(),
    author_name: input.authorName,
    rating: input.rating,
    comment,
    review_created_at: now,
    import_status: 'pending',
    classification_method: 'customer_form',
    classified_at: now,
    raw_payload: {
      source: REVIEW_SOURCE_WEBSITE,
      productId: input.productId,
      locale: input.locale,
      title: input.title,
      visitedMonth: input.visitedMonth,
      companionType: input.companionType,
      bookedWith: input.bookedWith,
      ratingValue: input.ratingValue,
      ratingGuide: input.ratingGuide,
      ratingPickup: input.ratingPickup,
      photoUrls,
      ipHash,
    },
    imported_at: now,
    updated_at: now,
  }

  const { data: inserted, error: insertError } = await fromUntypedTable(supabaseAdmin, 'google_reviews')
    .insert(payload as never)
    .select('id')
    .maybeSingle()

  if (insertError || !inserted) {
    console.error('[customer-reviews] insert failed', insertError)
    return { ok: false, status: 500, message: 'Save failed' }
  }

  const reviewId = (inserted as { id: string }).id
  const { error: mappingError } = await fromUntypedTable(supabaseAdmin, 'review_products').insert({
    operator_id: operatorId,
    google_review_id: reviewId,
    product_id: input.productId,
    is_primary: true,
    match_method: 'customer_form',
    match_confidence: 1,
  } as never)

  if (mappingError) {
    console.error('[customer-reviews] product mapping failed', mappingError)
  }

  return { ok: true, pending: true }
}
