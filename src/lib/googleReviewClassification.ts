import { supabaseAdmin } from '@/lib/supabase'
import { resolveOperatorId } from '@/lib/operators/scopeQuery'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'

const DESTINATION_KEYWORDS = [
  'grand canyon',
  'antelope canyon',
  'upper antelope',
  'lower antelope',
  'horseshoe bend',
  'zion',
  'bryce',
  'valley of fire',
  'hoover dam',
  'lake mead',
  'death valley',
  'monument valley',
  'page',
  'las vegas',
  'red rock',
  'seven magic mountains',
]

export type ProductKeywordProfile = {
  productId: string
  keywords: string[]
  isGoblinTour?: boolean
}

export type GuideNameProfile = {
  email: string
  aliases: string[]
  role: 'guide' | 'assistant'
}

const GUIDE_POSITION_PATTERN = /guide|가이드|assistant|어시스턴트/i

const GOBLIN_TOUR_NAME_PATTERN = /밤도깨비|midnight\s*goblin|goblin\s*tour/i

const STOP_WORDS = new Set([
  'tour',
  'tours',
  'day',
  'trip',
  'the',
  'and',
  'from',
  'with',
  'las',
  'vegas',
  'usa',
  'nevada',
  'arizona',
  'utah',
])

function isGoblinTourName(...parts: Array<string | null | undefined>): boolean {
  return parts.some((part) => part && GOBLIN_TOUR_NAME_PATTERN.test(part))
}

function buildGuideAliases(row: {
  name_ko?: string | null
  name_en?: string | null
  nick_name?: string | null
}): string[] {
  const aliases = new Set<string>()

  for (const raw of [row.nick_name, row.name_ko, row.name_en]) {
    const value = raw?.trim()
    if (!value) continue

    aliases.add(normalizeText(value))

    if (/^[a-zA-Z]/.test(value)) {
      const firstName = value.split(/\s+/)[0]?.trim()
      if (firstName && firstName.length >= 3) {
        aliases.add(normalizeText(firstName))
      }
    }
  }

  return [...aliases].filter((alias) => alias.length >= 2)
}

export function findMentionedGuides(
  reviewText: string,
  guides: GuideNameProfile[]
): GuideNameProfile[] {
  const normalizedReview = normalizeText(reviewText)
  if (!normalizedReview || !guides.length) return []

  return guides.filter((guide) =>
    guide.aliases.some((alias) => reviewTextMentionsAlias(normalizedReview, alias))
  )
}

export function countDistinctGuideMentions(
  reviewText: string,
  guides: GuideNameProfile[]
): number {
  const normalizedReview = normalizeText(reviewText)
  if (!normalizedReview || !guides.length) return 0

  let mentions = 0
  for (const guide of guides) {
    const mentioned = guide.aliases.some((alias) => reviewTextMentionsAlias(normalizedReview, alias))
    if (mentioned) mentions += 1
  }

  return mentions
}

function reviewTextMentionsAlias(normalizedReview: string, alias: string): boolean {
  if (!alias || alias.length < 2) return false

  if (normalizedReview.includes(alias)) {
    if (/[\u3131-\uD79D]/u.test(alias)) {
      return true
    }

    if (alias.includes(' ')) {
      return true
    }

    const wordPattern = new RegExp(`(?:^|\\s)${escapeRegExp(alias)}(?:\\s|$)`, 'u')
    return wordPattern.test(normalizedReview)
  }

  return false
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function resolveGoblinTourProductId(
  reviewText: string,
  profiles: ProductKeywordProfile[]
): string | null {
  const goblinProfiles = profiles.filter((profile) => profile.isGoblinTour)
  if (!goblinProfiles.length) return null
  if (goblinProfiles.length === 1) return goblinProfiles[0].productId

  const best = classifyReviewText(reviewText, goblinProfiles, 0.1)
  if (best) return best.productId

  const sunriseProfile = goblinProfiles.find((profile) =>
    profile.keywords.some(
      (keyword) => keyword.includes('sunrise') || keyword.includes('일출') || keyword.includes('grand canyon')
    )
  )
  return sunriseProfile?.productId ?? goblinProfiles[0].productId
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenizeForKeywords(value: string): string[] {
  const normalized = normalizeText(value)
  if (!normalized) return []

  const phrases: string[] = []
  for (const phrase of DESTINATION_KEYWORDS) {
    if (normalized.includes(phrase)) {
      phrases.push(phrase)
    }
  }

  const words = normalized
    .split(' ')
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word))

  return [...new Set([...phrases, ...words])]
}

function buildProductProfiles(
  rows: Array<{
    id: string
    name?: string | null
    name_ko?: string | null
    name_en?: string | null
    customer_name_ko?: string | null
    customer_name_en?: string | null
    category?: string | null
    sub_category?: string | null
    tags?: string[] | null
  }>
): ProductKeywordProfile[] {
  return rows.map((row) => {
    const parts = [
      row.name,
      row.name_ko,
      row.name_en,
      row.customer_name_ko,
      row.customer_name_en,
      row.category,
      row.sub_category,
      ...(row.tags ?? []),
    ].filter((part): part is string => Boolean(part?.trim()))

    const keywords = [...new Set(parts.flatMap((part) => tokenizeForKeywords(part)))]
    return {
      productId: row.id,
      keywords,
      isGoblinTour: isGoblinTourName(
        row.name,
        row.name_ko,
        row.name_en,
        row.customer_name_ko,
        row.customer_name_en
      ),
    }
  })
}

export function scoreReviewAgainstProduct(
  reviewText: string,
  profile: ProductKeywordProfile
): number {
  if (!profile.keywords.length) return 0
  const normalizedReview = normalizeText(reviewText)
  if (!normalizedReview) return 0

  let matches = 0
  for (const keyword of profile.keywords) {
    if (keyword.includes(' ')) {
      if (normalizedReview.includes(keyword)) matches += 1
    } else if (normalizedReview.split(' ').includes(keyword)) {
      matches += 1
    } else if (normalizedReview.includes(keyword)) {
      matches += 1
    }
  }

  return matches / profile.keywords.length
}

export async function loadProductKeywordProfiles(
  operatorId?: string | null
): Promise<ProductKeywordProfile[]> {
  if (!supabaseAdmin) return []

  const { data, error } = await supabaseAdmin
    .from('products')
    .select(
      'id, name, name_ko, name_en, customer_name_ko, customer_name_en, category, sub_category, tags'
    )
    .eq('operator_id', resolveOperatorId(operatorId))
    .eq('status', 'active')

  if (error || !data) {
    console.error('[googleReviewClassification] products load failed', error?.message)
    return []
  }

  return buildProductProfiles(data)
}

export async function loadGuideNameProfiles(): Promise<GuideNameProfile[]> {
  if (!supabaseAdmin) return []

  const { data, error } = await supabaseAdmin
    .from('team')
    .select('email, name_ko, name_en, nick_name, position, is_active, status')
    .eq('is_active', true)
    .eq('status', 'active')

  if (error || !data) {
    console.error('[googleReviewClassification] team load failed', error?.message)
    return []
  }

  return (data as Array<{
    email: string
    name_ko?: string | null
    name_en?: string | null
    nick_name?: string | null
    position?: string | null
  }>)
    .filter((row) => GUIDE_POSITION_PATTERN.test(row.position ?? ''))
    .map((row) => ({
      email: row.email,
      aliases: buildGuideAliases(row),
      role: /assistant|어시스턴트/i.test(row.position ?? '') ? ('assistant' as const) : ('guide' as const),
    }))
    .filter((row) => row.aliases.length > 0)
}

export function classifyReviewText(
  reviewText: string,
  profiles: ProductKeywordProfile[],
  threshold = 0.35
): { productId: string; confidence: number } | null {
  let best: { productId: string; confidence: number } | null = null

  for (const profile of profiles) {
    const confidence = scoreReviewAgainstProduct(reviewText, profile)
    if (!best || confidence > best.confidence) {
      best = { productId: profile.productId, confidence }
    }
  }

  if (!best || best.confidence < threshold) return null
  return best
}

export function classifyReviewWithGuides(
  reviewText: string,
  profiles: ProductKeywordProfile[],
  guides: GuideNameProfile[],
  threshold = 0.35
): { productId: string; confidence: number; method: 'keyword' | 'guide_names' } | null {
  const guideMentions = countDistinctGuideMentions(reviewText, guides)
  if (guideMentions >= 2) {
    const goblinProductId = resolveGoblinTourProductId(reviewText, profiles)
    if (goblinProductId) {
      return {
        productId: goblinProductId,
        confidence: 0.92,
        method: 'guide_names',
      }
    }
  }

  const keywordMatch = classifyReviewText(reviewText, profiles, threshold)
  if (!keywordMatch) return null

  return {
    ...keywordMatch,
    method: 'keyword',
  }
}

type ReviewRow = {
  id: string
  comment: string | null
}

export async function classifyUnmappedGoogleReviews(input: {
  operatorId: string
  reviewIds?: string[]
  classifiedBy?: string
  limit?: number
}): Promise<{ classified: number; skipped: number }> {
  if (!supabaseAdmin) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required')
  }

  const profiles = await loadProductKeywordProfiles(input.operatorId)
  if (!profiles.length) {
    return { classified: 0, skipped: 0 }
  }

  const guides = await loadGuideNameProfiles()

  let query = fromUntypedTable(supabaseAdmin, 'google_reviews')
    .select('id, comment')
    .eq('operator_id', resolveOperatorId(input.operatorId))
    .not('comment', 'is', null)
    .order('imported_at', { ascending: false })
    .limit(input.limit ?? 200)

  if (input.reviewIds?.length) {
    query = query.in('id', input.reviewIds)
  }

  const { data: reviews, error } = await query
  if (error) {
    throw new Error(error.message)
  }

  const reviewRows = (reviews ?? []) as ReviewRow[]
  if (!reviewRows.length) {
    return { classified: 0, skipped: 0 }
  }

  const reviewIds = reviewRows.map((row) => row.id)
  const { data: existingMappings } = await fromUntypedTable(supabaseAdmin, 'review_products')
    .select('google_review_id')
    .in('google_review_id', reviewIds)
    .eq('is_primary', true)

  const mappedIds = new Set(
    ((existingMappings ?? []) as Array<{ google_review_id: string }>).map(
      (row) => row.google_review_id
    )
  )

  let classified = 0
  let skipped = 0
  const now = new Date().toISOString()

  for (const review of reviewRows) {
    if (mappedIds.has(review.id)) {
      skipped += 1
      continue
    }

    const text = review.comment?.trim() ?? ''
    if (!text) {
      skipped += 1
      continue
    }

    const match = classifyReviewWithGuides(text, profiles, guides)
    if (!match) {
      skipped += 1
      continue
    }

    const { error: mappingError } = await fromUntypedTable(supabaseAdmin, 'review_products').upsert(
      {
        operator_id: resolveOperatorId(input.operatorId),
        google_review_id: review.id,
        product_id: match.productId,
        is_primary: true,
        match_method: match.method,
        match_confidence: match.confidence,
        created_by_email: input.classifiedBy ?? 'system',
      } as never,
      { onConflict: 'google_review_id,product_id' }
    )

    if (mappingError) {
      console.error('[googleReviewClassification] mapping upsert failed', mappingError.message)
      skipped += 1
      continue
    }

    await fromUntypedTable(supabaseAdmin, 'google_reviews')
      .update({
        classification_method: match.method,
        classification_confidence: match.confidence,
        classified_at: now,
        classified_by: input.classifiedBy ?? 'system',
        updated_at: now,
      } as never)
      .eq('id', review.id)

    classified += 1
  }

  return { classified, skipped }
}
