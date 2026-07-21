import { contentFallbackOrder, isSiteLocale, SITE_LOCALES, type SiteLocale } from '@/lib/siteLocales'
import type { FaqContentI18n, FaqI18nSource } from '@/lib/productFaqLocales'
import {
  getFaqExactText,
  getFaqLocalizedText,
  legacyFaqColumnsFromI18n,
  mergeFaqI18n,
} from '@/lib/productFaqLocales'

/** Fields that can be shared via detail_content_library */
export const REUSABLE_DETAIL_KINDS = [
  // 운영 안내
  'pickup_drop_info',
  'luggage_info',
  'tour_operation_info',
  'preparation_info',
  'small_group_info',
  'companion_recruitment_info',
  'notice_info',
  // 정책
  'important_notes',
  'cancellation_policy',
  'private_tour_info',
  'chat_announcement',
] as const

export type ReusableDetailKind = (typeof REUSABLE_DETAIL_KINDS)[number]

export function isReusableDetailKind(value: string): value is ReusableDetailKind {
  return (REUSABLE_DETAIL_KINDS as readonly string[]).includes(value)
}

export const REUSABLE_OPERATION_KINDS = [
  'pickup_drop_info',
  'luggage_info',
  'tour_operation_info',
  'preparation_info',
  'small_group_info',
  'companion_recruitment_info',
  'notice_info',
] as const satisfies readonly ReusableDetailKind[]

export const REUSABLE_POLICY_KINDS = [
  'important_notes',
  'cancellation_policy',
  'private_tour_info',
  'chat_announcement',
] as const satisfies readonly ReusableDetailKind[]

export const REUSABLE_DETAIL_KIND_LABELS: Record<ReusableDetailKind, string> = {
  pickup_drop_info: '픽업·드롭',
  luggage_info: '짐·수화물',
  tour_operation_info: '투어 운영 안내',
  preparation_info: '준비물·복장',
  small_group_info: '소그룹 안내',
  companion_recruitment_info: '동행 모집 안내',
  notice_info: '유의사항',
  important_notes: 'IMPORTANT NOTES',
  cancellation_policy: '취소·환불 정책',
  private_tour_info: '단독투어 안내',
  chat_announcement: '채팅 공지',
}

export type DetailContentI18n = {
  body?: Partial<Record<SiteLocale, string>>
}

export type FaqLibraryItem = {
  id: string
  name: string
  question: string
  answer: string
  question_en?: string | null
  answer_en?: string | null
  content_i18n?: FaqContentI18n | null
  is_active: boolean
  created_at?: string | null
  updated_at?: string | null
}

export type ProductFaqLinkRow = {
  id: string
  product_id: string
  faq_id: string
  order_index: number
  is_active: boolean
  faq_library?: FaqLibraryItem | FaqLibraryItem[] | null
}

export type AttachedProductFaq = FaqLibraryItem & {
  link_id: string
  product_id: string
  order_index: number
  link_is_active: boolean
}

export type DetailContentLibraryItem = {
  id: string
  kind: ReusableDetailKind
  name: string
  body: string
  body_en?: string | null
  content_i18n?: DetailContentI18n | null
  is_active: boolean
  created_at?: string | null
  updated_at?: string | null
}

export type ProductDetailContentLink = {
  id: string
  product_id: string
  kind: ReusableDetailKind
  library_id: string
  detail_content_library?: DetailContentLibraryItem | DetailContentLibraryItem[] | null
}

function trimOrEmpty(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

export function getDetailContentI18nMap(item: {
  body?: string | null
  body_en?: string | null
  content_i18n?: DetailContentI18n | null
}): Partial<Record<SiteLocale, string>> {
  const fromJson = { ...((item.content_i18n?.body || {}) as Partial<Record<SiteLocale, string>>) }
  const ko = fromJson.ko || trimOrEmpty(item.body)
  const en = fromJson.en || trimOrEmpty(item.body_en)
  if (ko) fromJson.ko = ko
  else delete fromJson.ko
  if (en) fromJson.en = en
  else delete fromJson.en
  return fromJson
}

export function getDetailContentLocalizedText(
  item: {
    body?: string | null
    body_en?: string | null
    content_i18n?: DetailContentI18n | null
  },
  locale: string
): string {
  const preferred = isSiteLocale(locale) ? locale : 'en'
  const map = getDetailContentI18nMap(item)
  for (const code of contentFallbackOrder(preferred)) {
    const value = map[code]?.trim()
    if (value) return value
  }
  return ''
}

export function getDetailContentExactText(
  item: {
    body?: string | null
    body_en?: string | null
    content_i18n?: DetailContentI18n | null
  },
  locale: string
): string {
  const preferred = isSiteLocale(locale) ? locale : 'en'
  return getDetailContentI18nMap(item)[preferred]?.trim() || ''
}

export function mergeDetailContentI18n(
  existing: DetailContentI18n | null | undefined,
  locale: string,
  body: string
): DetailContentI18n {
  const preferred = isSiteLocale(locale) ? locale : 'en'
  const next: DetailContentI18n = {
    body: { ...(existing?.body || {}) },
  }
  const trimmed = body.trim()
  if (trimmed) next.body![preferred] = trimmed
  else delete next.body![preferred]
  return next
}

/** Dual-write ko/en columns for detail content library */
export function detailContentLegacyColumns(
  locale: string,
  body: string,
  existing?: { body?: string | null; body_en?: string | null }
): { body?: string; body_en?: string | null } {
  if (locale === 'ko') return { body }
  if (locale === 'en') return { body_en: body }
  const out: { body?: string; body_en?: string | null } = {}
  if (existing?.body != null) out.body = existing.body
  if (existing?.body_en !== undefined) out.body_en = existing.body_en
  return out
}

export function mapAttachedFaqFromLink(row: ProductFaqLinkRow): AttachedProductFaq | null {
  const faq = unwrapOne(row.faq_library)
  if (!faq?.id) return null
  return {
    ...faq,
    link_id: row.id,
    product_id: row.product_id,
    order_index: Number(row.order_index ?? 0),
    link_is_active: row.is_active !== false,
    is_active: faq.is_active !== false,
  }
}

export function attachedFaqAsI18nSource(faq: AttachedProductFaq | FaqLibraryItem): FaqI18nSource {
  const source: FaqI18nSource = {
    question: faq.question,
    answer: faq.answer,
  }
  if (faq.question_en !== undefined) source.question_en = faq.question_en
  if (faq.answer_en !== undefined) source.answer_en = faq.answer_en
  if (faq.content_i18n !== undefined) source.content_i18n = faq.content_i18n
  return source
}

export { getFaqLocalizedText, mergeFaqI18n }

/** Locales that have at least question or answer text in a FAQ library item. */
export function getFaqFilledLocales(faq: FaqI18nSource): SiteLocale[] {
  return SITE_LOCALES.map((item) => item.code).filter(
    (code) =>
      !!getFaqExactText(faq, 'question', code) || !!getFaqExactText(faq, 'answer', code)
  )
}

/** Locales that have body text in a detail content library item. */
export function getDetailContentFilledLocales(item: {
  body?: string | null
  body_en?: string | null
  content_i18n?: DetailContentI18n | null
}): SiteLocale[] {
  return SITE_LOCALES.map((entry) => entry.code).filter(
    (code) => !!getDetailContentExactText(item, code)
  )
}

export function buildFaqLibraryPayload(input: {
  name: string
  questionByLocale: Partial<Record<SiteLocale, string>>
  answerByLocale: Partial<Record<SiteLocale, string>>
  is_active?: boolean
}): {
  name: string
  question: string
  answer: string
  question_en: string | null
  answer_en: string | null
  content_i18n: FaqContentI18n
  is_active: boolean
} {
  const content_i18n: FaqContentI18n = { question: {}, answer: {} }
  for (const entry of SITE_LOCALES) {
    const q = input.questionByLocale[entry.code]?.trim()
    const a = input.answerByLocale[entry.code]?.trim()
    if (q) content_i18n.question![entry.code] = q
    if (a) content_i18n.answer![entry.code] = a
  }
  const legacy = legacyFaqColumnsFromI18n(content_i18n)
  return {
    name: input.name.trim() || legacy.question.slice(0, 120) || 'FAQ',
    ...legacy,
    content_i18n,
    is_active: input.is_active !== false,
  }
}

export function buildDetailLibraryPayload(input: {
  kind: ReusableDetailKind
  name: string
  bodyByLocale: Partial<Record<SiteLocale, string>>
  is_active?: boolean
}): {
  kind: ReusableDetailKind
  name: string
  body: string
  body_en: string | null
  content_i18n: DetailContentI18n
  is_active: boolean
} {
  const content_i18n: DetailContentI18n = { body: {} }
  for (const entry of SITE_LOCALES) {
    const text = input.bodyByLocale[entry.code]?.trim()
    if (text) content_i18n.body![entry.code] = text
  }
  const ko = content_i18n.body?.ko?.trim() || ''
  const en = content_i18n.body?.en?.trim() || null
  return {
    kind: input.kind,
    name: input.name.trim() || REUSABLE_DETAIL_KIND_LABELS[input.kind],
    body: ko || en || '',
    body_en: en,
    content_i18n,
    is_active: input.is_active !== false,
  }
}

export function faqDraftFromLibraryItem(item: FaqLibraryItem): {
  name: string
  questionByLocale: Partial<Record<SiteLocale, string>>
  answerByLocale: Partial<Record<SiteLocale, string>>
} {
  const questionByLocale: Partial<Record<SiteLocale, string>> = {}
  const answerByLocale: Partial<Record<SiteLocale, string>> = {}
  for (const entry of SITE_LOCALES) {
    const q = getFaqExactText(item, 'question', entry.code)
    const a = getFaqExactText(item, 'answer', entry.code)
    if (q) questionByLocale[entry.code] = q
    if (a) answerByLocale[entry.code] = a
  }
  return {
    name: item.name || '',
    questionByLocale,
    answerByLocale,
  }
}

export function detailDraftFromLibraryItem(item: DetailContentLibraryItem): {
  name: string
  kind: ReusableDetailKind
  bodyByLocale: Partial<Record<SiteLocale, string>>
} {
  const bodyByLocale: Partial<Record<SiteLocale, string>> = {}
  for (const entry of SITE_LOCALES) {
    const text = getDetailContentExactText(item, entry.code)
    if (text) bodyByLocale[entry.code] = text
  }
  return {
    name: item.name || '',
    kind: item.kind,
    bodyByLocale,
  }
}

export type SupabaseLike = {
  from: (table: string) => any
}

export async function fetchProductAttachedFaqs(
  client: SupabaseLike,
  productId: string,
  opts?: { includeInactive?: boolean }
): Promise<AttachedProductFaq[]> {
  let query = client
    .from('product_faq_links')
    .select(
      `
      id,
      product_id,
      faq_id,
      order_index,
      is_active,
      faq_library (
        id,
        name,
        question,
        answer,
        question_en,
        answer_en,
        content_i18n,
        is_active,
        created_at,
        updated_at
      )
    `
    )
    .eq('product_id', productId)
    .order('order_index', { ascending: true })

  if (!opts?.includeInactive) {
    query = query.eq('is_active', true)
  }

  const { data, error } = await query
  if (error) throw error

  return ((data || []) as ProductFaqLinkRow[])
    .map(mapAttachedFaqFromLink)
    .filter((row): row is AttachedProductFaq => {
      if (!row) return false
      if (opts?.includeInactive) return true
      return row.is_active !== false
    })
}

export async function fetchFaqLibrary(
  client: SupabaseLike,
  opts?: { activeOnly?: boolean; search?: string }
): Promise<FaqLibraryItem[]> {
  let query = client
    .from('faq_library')
    .select('*')
    .order('updated_at', { ascending: false })

  if (opts?.activeOnly !== false) {
    query = query.eq('is_active', true)
  }

  const { data, error } = await query
  if (error) throw error

  let rows = (data || []) as FaqLibraryItem[]
  const search = opts?.search?.trim().toLowerCase()
  if (search) {
    rows = rows.filter((row) => {
      const hay = `${row.name} ${row.question} ${row.answer}`.toLowerCase()
      return hay.includes(search)
    })
  }
  return rows
}

export async function fetchDetailContentLibrary(
  client: SupabaseLike,
  opts?: { kind?: ReusableDetailKind; activeOnly?: boolean; search?: string }
): Promise<DetailContentLibraryItem[]> {
  let query = client
    .from('detail_content_library')
    .select('*')
    .order('updated_at', { ascending: false })

  if (opts?.kind) query = query.eq('kind', opts.kind)
  if (opts?.activeOnly !== false) query = query.eq('is_active', true)

  const { data, error } = await query
  if (error) throw error

  let rows = (data || []) as DetailContentLibraryItem[]
  const search = opts?.search?.trim().toLowerCase()
  if (search) {
    rows = rows.filter((row) => {
      const hay = `${row.name} ${row.body}`.toLowerCase()
      return hay.includes(search)
    })
  }
  return rows
}

export async function fetchProductDetailContentLinks(
  client: SupabaseLike,
  productId: string
): Promise<ProductDetailContentLink[]> {
  const { data, error } = await client
    .from('product_detail_content_links')
    .select(
      `
      id,
      product_id,
      kind,
      library_id,
      detail_content_library (
        id,
        kind,
        name,
        body,
        body_en,
        content_i18n,
        is_active
      )
    `
    )
    .eq('product_id', productId)

  if (error) throw error
  return (data || []) as ProductDetailContentLink[]
}

export async function upsertProductDetailContentLink(
  client: SupabaseLike,
  productId: string,
  kind: ReusableDetailKind,
  libraryId: string | null
): Promise<void> {
  if (!libraryId) {
    const { error } = await client
      .from('product_detail_content_links')
      .delete()
      .eq('product_id', productId)
      .eq('kind', kind)
    if (error) throw error
    return
  }

  const { error } = await client.from('product_detail_content_links').upsert(
    {
      product_id: productId,
      kind,
      library_id: libraryId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'product_id,kind' }
  )
  if (error) throw error
}

/** Overlay linked library bodies onto product details for the given locale */
export function applyDetailContentLibraryOverlay<T extends Record<string, unknown>>(
  details: T | null,
  links: ProductDetailContentLink[],
  locale: string
): T | null {
  if (!details) return details
  const next = { ...details }
  for (const link of links) {
    const item = unwrapOne(link.detail_content_library)
    if (!item || item.is_active === false) continue
    if (!isReusableDetailKind(link.kind)) continue
    const text = getDetailContentLocalizedText(item, locale)
    if (text) {
      ;(next as Record<string, unknown>)[link.kind] = text
    }
  }
  return next
}

export function linksToLibraryIdMap(
  links: ProductDetailContentLink[]
): Partial<Record<ReusableDetailKind, string>> {
  const map: Partial<Record<ReusableDetailKind, string>> = {}
  for (const link of links) {
    if (isReusableDetailKind(link.kind) && link.library_id) {
      map[link.kind] = link.library_id
    }
  }
  return map
}
