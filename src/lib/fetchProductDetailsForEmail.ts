import type { SupabaseClient } from '@supabase/supabase-js'

/** 이메일 미리보기·발송에서 편집 가능한 product_details_multilingual 컬럼 */
export const PRODUCT_DETAIL_EMAIL_EDITABLE_FIELDS = [
  'slogan1',
  'description',
  'greeting',
  'included',
  'not_included',
  'pickup_drop_info',
  'cancellation_policy',
  'luggage_info',
  'tour_operation_info',
  'preparation_info',
  'small_group_info',
  'notice_info',
  'private_tour_info',
  'companion_recruitment_info',
  'important_notes',
] as const

export type ProductDetailEmailEditableField =
  (typeof PRODUCT_DETAIL_EMAIL_EDITABLE_FIELDS)[number]

/** 관리자 UI·모달 제목용 (한국어) */
export const PRODUCT_DETAIL_FIELD_LABELS_KO: Record<
  ProductDetailEmailEditableField,
  string
> = {
  slogan1: '슬로건',
  description: '상품 설명',
  greeting: '인사말',
  included: '포함 사항',
  not_included: '불포함 사항',
  pickup_drop_info: '만남 장소',
  cancellation_policy: '취소 정책',
  luggage_info: '수하물 정보',
  tour_operation_info: '투어 운영 정보',
  preparation_info: '준비 사항',
  small_group_info: '소규모 그룹 정보',
  notice_info: '안내 사항',
  private_tour_info: '프라이빗 투어 정보',
  companion_recruitment_info: '동행모집 안내',
  important_notes: '중요 안내',
}

export const PRODUCT_DETAIL_FIELD_LABELS_EN: Record<
  ProductDetailEmailEditableField,
  string
> = {
  slogan1: 'Tagline',
  description: 'Description',
  greeting: 'Greeting',
  included: 'Included',
  not_included: 'Not included',
  pickup_drop_info: 'Meeting point',
  cancellation_policy: 'Cancellation policy',
  luggage_info: 'Luggage',
  tour_operation_info: 'Tour operation',
  preparation_info: 'Preparation',
  small_group_info: 'Small group',
  notice_info: 'Notice',
  private_tour_info: 'Private tour',
  companion_recruitment_info: 'Companion recruitment',
  important_notes: 'Important notes',
}

/** 고객 노출 편집기·이메일 섹션 제목 placeholder (ProductDetailsTab defaultSectionTitles 와 동일 톤) */
export const PRODUCT_DETAIL_FIELD_DEFAULT_SECTION_TITLES: Record<
  ProductDetailEmailEditableField,
  string
> = {
  slogan1: '🧭 Slogan',
  description: '📝 Description',
  greeting: '👋 인사말',
  included: '✔ Included',
  not_included: '✘ Not Included',
  pickup_drop_info: '🚐 Pickup / Drop-off',
  luggage_info: '🧳 Luggage Info',
  tour_operation_info: '🚌 Tour Operation Info',
  preparation_info: '🎒 What to Bring',
  small_group_info: '👥 Small Group Info',
  notice_info: '💵 Payment Notice',
  private_tour_info: '🔒 Private Tour Info',
  cancellation_policy: '📋 Cancellation Policy',
  companion_recruitment_info: '🤝 동행모집 안내',
  important_notes: '⚠️ IMPORTANT NOTES',
}

export function isProductDetailEmailEditableField(
  s: string
): s is ProductDetailEmailEditableField {
  return (PRODUCT_DETAIL_EMAIL_EDITABLE_FIELDS as readonly string[]).includes(s)
}

/**
 * product_details_multilingual.section_titles 값을 Record<string, string>으로 정규화.
 * (JSON 문자열로 저장·전달된 경우, 또는 비문자 값이 섞인 경우 대비 — 이메일 섹션 제목 표시용)
 */
export function parseSectionTitlesMap(raw: unknown): Record<string, string> {
  let obj: Record<string, unknown> | null = null
  if (raw == null) return {}
  if (typeof raw === 'string') {
    const t = raw.trim()
    if (!t) return {}
    try {
      const p = JSON.parse(t) as unknown
      if (p && typeof p === 'object' && !Array.isArray(p)) {
        obj = p as Record<string, unknown>
      }
    } catch {
      return {}
    }
  } else if (typeof raw === 'object' && !Array.isArray(raw)) {
    obj = raw as Record<string, unknown>
  }
  if (!obj) return {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue
    if (typeof v === 'string') {
      const s = v.trim()
      if (s) out[k] = s
    } else if (typeof v === 'number' || typeof v === 'boolean') {
      const s = String(v).trim()
      if (s) out[k] = s
    }
  }
  return out
}

/** product_details_multilingual.channel_id 조회·저장용 (자사 채널 UUID → SELF_GROUP) */
export async function resolveProductDetailsChannelId(
  supabase: SupabaseClient,
  channelId: string | null | undefined,
  channelsLookupClient?: SupabaseClient
): Promise<string | null> {
  if (channelId == null || String(channelId).trim() === '') return null
  const u = String(channelId).trim()
  const upper = u.toUpperCase()
  if (upper === 'SELF' || upper === 'SELF_GROUP') return 'SELF_GROUP'
  const lookup = channelsLookupClient ?? supabase
  const { data: ch } = await lookup
    .from('channels')
    .select('type')
    .eq('id', u)
    .maybeSingle()
  if (!ch) return u
  const t = (ch as { type?: string }).type
  if (t === 'self' || t === 'SELF') return 'SELF_GROUP'
  return u
}

/** customer_page_visibility JSON: 해당 필드가 명시적으로 false일 때만 고객 페이지에서 숨김 */
export function parseCustomerPageVisibilityJson(
  raw: unknown
): Record<string, unknown> | null {
  if (raw == null) return null
  if (typeof raw === 'string') {
    const t = raw.trim()
    if (!t) return null
    try {
      const p = JSON.parse(t) as unknown
      if (p && typeof p === 'object' && !Array.isArray(p)) {
        return p as Record<string, unknown>
      }
    } catch {
      return null
    }
    return null
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>
  }
  return null
}

/** customer_page_visibility: field explicitly false (or "false") hides section on customer product page. */
export function isProductDetailVisibleOnCustomerPage(
  visibility: unknown,
  field: string
): boolean {
  const obj = parseCustomerPageVisibilityJson(visibility)
  if (!obj) return true
  const v = obj[field]
  if (v === false) return false
  if (v === 'false' || v === 0) return false
  return true
}

/**
 * Merge visibility like ProductDetailsTab (only false keys). Avoids spreading
 * odd-typed values from DB into JSON and keeps the payload PostgREST-safe.
 */
export function mergeCustomerPageVisibilityField(
  raw: unknown,
  field: ProductDetailEmailEditableField,
  customerPageVisible: boolean
): Record<string, false> {
  const parsed = parseCustomerPageVisibilityJson(raw)
  const out: Record<string, false> = {}
  if (parsed) {
    for (const [k, v] of Object.entries(parsed)) {
      if (k === '__proto__') continue
      if (v === false || v === 'false' || v === 0) {
        out[k] = false
      }
    }
  }
  if (customerPageVisible) {
    delete out[field]
  } else {
    out[field] = false
  }
  return out
}

/**
 * Strip lone UTF-16 surrogates so PostgREST accepts the JSON body (PGRST102).
 */
export function sanitizeProductDetailHtmlForStorage(html: string): string {
  return html.replace(
    /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g,
    ''
  )
}

export function pickProductDetailFieldValues(
  row: Record<string, unknown> | null | undefined
): Record<ProductDetailEmailEditableField, string> {
  const out = {} as Record<ProductDetailEmailEditableField, string>
  for (const f of PRODUCT_DETAIL_EMAIL_EDITABLE_FIELDS) {
    const v = row?.[f]
    out[f] = typeof v === 'string' ? v : v == null ? '' : String(v)
  }
  return out
}

/**
 * 예약의 상품/채널/언어/variant에 맞는 product_details_multilingual 행을 찾습니다.
 * variant 일치 우선, 없으면 default variant로 동일 채널(또는 공통) 재시도 후 공통 행으로 폴백합니다.
 */
export async function fetchProductDetailsForReservationEmail(
  supabase: SupabaseClient,
  opts: {
    productId: string
    languageCode: string
    channelId: string | null | undefined
    variantKey: string | null | undefined
    /** For channels.type lookup; use supabaseAdmin when main client is anon. */
    channelsLookupClient?: SupabaseClient
  }
): Promise<Record<string, unknown> | null> {
  const { productId, languageCode, channelId, variantKey, channelsLookupClient } =
    opts
  const vkPrimary = (variantKey && String(variantKey).trim()) || 'default'

  const resolvedChannelId = await resolveProductDetailsChannelId(
    supabase,
    channelId,
    channelsLookupClient
  )

  const tryFetch = async (ch: string | null, vk: string) => {
    let q = supabase
      .from('product_details_multilingual')
      .select('*')
      .eq('product_id', productId)
      .eq('language_code', languageCode)
      .eq('variant_key', vk)
    if (ch != null && ch !== '') {
      q = q.eq('channel_id', ch)
    } else {
      q = q.is('channel_id', null)
    }
    const { data, error } = await q.maybeSingle()
    if (error && (error as { code?: string }).code !== 'PGRST116') {
      console.error('[fetchProductDetailsForReservationEmail]', error)
    }
    return (data as Record<string, unknown> | null) ?? null
  }

  if (resolvedChannelId) {
    let row = await tryFetch(resolvedChannelId, vkPrimary)
    if (!row && vkPrimary !== 'default') {
      row = await tryFetch(resolvedChannelId, 'default')
    }
    // 채널 전용 행이 없으면 공통(channel_id NULL) 행으로 폴백
    if (!row) {
      row = await tryFetch(null, vkPrimary)
      if (!row && vkPrimary !== 'default') {
        row = await tryFetch(null, 'default')
      }
    }
    return row
  }

  let row = await tryFetch(null, vkPrimary)
  if (!row && vkPrimary !== 'default') {
    row = await tryFetch(null, 'default')
  }
  return row
}
