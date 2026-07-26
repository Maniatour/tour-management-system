import {
  newSopId,
  prefillSortOrders,
  type SopCategory,
  type SopChecklistItem,
  type SopDocument,
  type SopSection,
} from '@/types/sopStructure'

export const PRODUCT_CODE_MANUAL_SLUG = 'system-admin-product-code-manual'

export type ProductCodeSegmentGroup =
  | 'company'
  | 'tourType'
  | 'departure'
  | 'destination'
  | 'arrival'
  | 'duration'
  | 'variant'
  | 'special'

export type ProductCodeSegment = {
  code: string
  labelKo: string
  labelEn: string
  group: ProductCodeSegmentGroup
  descriptionKo?: string
  descriptionEn?: string
}

/** 빌더에서 조합 가능한 그룹 (목적지는 여러 개 연결 가능) */
export const PRODUCT_CODE_BUILDER_GROUPS: ProductCodeSegmentGroup[] = [
  'company',
  'tourType',
  'departure',
  'destination',
  'arrival',
  'duration',
  'variant',
  'special',
]

/** 목적지 그룹 — 코드 빌더에서 여러 개를 이어 붙일 수 있음 */
export const PRODUCT_CODE_MULTI_SEGMENT_GROUP: ProductCodeSegmentGroup = 'destination'

export const DEFAULT_PRODUCT_CODE_SEGMENTS: ProductCodeSegment[] = [
  { code: 'M', labelKo: 'Mania Tour', labelEn: 'Mania Tour', group: 'company', descriptionKo: '회사 접두사', descriptionEn: 'Company prefix' },
  { code: 'S', labelKo: 'Scenic', labelEn: 'Scenic', group: 'company' },
  { code: 'P', labelKo: 'Papillon', labelEn: 'Papillon', group: 'company' },
  { code: 'V', labelKo: 'Maverick', labelEn: 'Maverick', group: 'company' },
  { code: 'D', labelKo: 'Day Tour', labelEn: 'Day Tour', group: 'tourType', descriptionKo: '당일 투어', descriptionEn: 'Same-day tour' },
  { code: 'N', labelKo: 'Night / Multi-day', labelEn: 'Night / Multi-day', group: 'tourType', descriptionKo: '숙박·야간 투어', descriptionEn: 'Overnight or night tour' },
  { code: 'SND', labelKo: 'Sending', labelEn: 'Sending', group: 'tourType', descriptionKo: '픽업·샌딩 서비스', descriptionEn: 'Pickup / sending service' },
  { code: 'LV', labelKo: 'Las Vegas', labelEn: 'Las Vegas', group: 'departure' },
  { code: 'LAX', labelKo: 'Los Angeles', labelEn: 'Los Angeles', group: 'departure' },
  { code: 'SLC', labelKo: 'Salt Lake City', labelEn: 'Salt Lake City', group: 'departure' },
  { code: 'GC', labelKo: 'Grand Canyon', labelEn: 'Grand Canyon', group: 'destination' },
  { code: 'GS', labelKo: 'Grand Canyon South', labelEn: 'Grand Canyon South', group: 'destination' },
  { code: 'GW', labelKo: 'Grand Canyon West', labelEn: 'Grand Canyon West', group: 'destination' },
  { code: 'GCSUNRISE', labelKo: 'GC Sunrise', labelEn: 'GC Sunrise', group: 'destination', descriptionKo: '그랜드캐년 일출', descriptionEn: 'Grand Canyon sunrise' },
  { code: 'GCSOUTH', labelKo: 'GC South Rim', labelEn: 'GC South Rim', group: 'destination' },
  { code: 'AC', labelKo: 'Antelope Canyon', labelEn: 'Antelope Canyon', group: 'destination' },
  { code: 'HB', labelKo: 'Horseshoe Bend', labelEn: 'Horseshoe Bend', group: 'destination' },
  { code: 'ZB', labelKo: 'Zion & Bryce', labelEn: 'Zion & Bryce', group: 'destination' },
  { code: 'BC', labelKo: 'Bryce Canyon', labelEn: 'Bryce Canyon', group: 'destination' },
  { code: 'LV', labelKo: 'Las Vegas', labelEn: 'Las Vegas', group: 'arrival' },
  { code: '1D', labelKo: '1 Day', labelEn: '1 Day', group: 'duration', descriptionKo: '당일 왕복', descriptionEn: 'Same-day return' },
  { code: '1N', labelKo: '1 Night', labelEn: '1 Night', group: 'duration', descriptionKo: '1박 2일', descriptionEn: '2 days / 1 night' },
  { code: '2N', labelKo: '2 Nights', labelEn: '2 Nights', group: 'duration', descriptionKo: '2박 3일', descriptionEn: '3 days / 2 nights' },
  { code: '3N', labelKo: '3 Nights', labelEn: '3 Nights', group: 'duration', descriptionKo: '3박 4일', descriptionEn: '4 days / 3 nights' },
  { code: 'SUNRISE', labelKo: 'Sunrise', labelEn: 'Sunrise', group: 'variant' },
  { code: 'SUNSET', labelKo: 'Sunset', labelEn: 'Sunset', group: 'variant' },
  { code: 'HELICOPTER', labelKo: 'Helicopter', labelEn: 'Helicopter', group: 'variant', descriptionKo: '헬기 옵션', descriptionEn: 'Helicopter option' },
  { code: 'PRIVATE', labelKo: 'Private', labelEn: 'Private', group: 'variant' },
  { code: 'GUIDE', labelKo: 'Guide Only', labelEn: 'Guide Only', group: 'special' },
  { code: 'CUSTOM', labelKo: 'Custom', labelEn: 'Custom', group: 'special' },
  { code: 'PICKUP', labelKo: 'Pickup', labelEn: 'Pickup', group: 'special' },
  { code: 'SENDING', labelKo: 'Sending', labelEn: 'Sending', group: 'special' },
]

/** @deprecated use DEFAULT_PRODUCT_CODE_SEGMENTS */
export const PRODUCT_CODE_SEGMENTS = DEFAULT_PRODUCT_CODE_SEGMENTS

export const PRODUCT_CODE_GROUP_LABELS: Record<
  ProductCodeSegmentGroup,
  { ko: string; en: string }
> = {
  company: { ko: '회사', en: 'Company' },
  tourType: { ko: '투어 유형', en: 'Tour type' },
  departure: { ko: '출발지', en: 'Departure' },
  destination: { ko: '목적지', en: 'Destination' },
  arrival: { ko: '도착지', en: 'Arrival' },
  duration: { ko: '기간', en: 'Duration' },
  variant: { ko: '옵션·특징', en: 'Variant' },
  special: { ko: '특수 서비스', en: 'Special' },
}

export const PRODUCT_CODE_EXAMPLES = [
  { code: 'MDGC1D', meaningKo: 'Mania · Day · Grand Canyon · 1일', meaningEn: 'Mania · Day · Grand Canyon · 1 day' },
  { code: 'MDGCSUNRISE', meaningKo: 'Mania · Day · GC 일출', meaningEn: 'Mania · Day · GC Sunrise' },
  { code: 'MNGC1N', meaningKo: 'Mania · Night · Grand Canyon · 1박', meaningEn: 'Mania · Night · GC · 1 night' },
  { code: 'MNGC2N', meaningKo: 'Mania · Night · Grand Canyon · 2박', meaningEn: 'Mania · Night · GC · 2 nights' },
  { code: 'MDZB', meaningKo: 'Mania · Day · Zion & Bryce', meaningEn: 'Mania · Day · Zion & Bryce' },
  { code: 'MDGCSOUTH', meaningKo: 'Mania · Day · GC South Rim', meaningEn: 'Mania · Day · GC South Rim' },
  { code: 'MSGUIDE', meaningKo: 'Mania · Sending · Guide', meaningEn: 'Mania · Sending · Guide' },
  { code: 'MNCUSTOM', meaningKo: 'Mania · Night · Custom', meaningEn: 'Mania · Night · Custom' },
]


export function normalizeProductCode(code: string | null | undefined): string {
  return String(code ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
}

export function buildProductCodeFromParts(parts: string[]): string {
  return parts.map((p) => normalizeProductCode(p)).filter(Boolean).join('')
}

export type ProductCodeBuilderRow = {
  id: string
  group: ProductCodeSegmentGroup
  code: string
}

export function newProductCodeBuilderRowId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `pcbr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function createProductCodeBuilderRow(
  group: ProductCodeSegmentGroup,
  code: string
): ProductCodeBuilderRow {
  return {
    id: newProductCodeBuilderRowId(),
    group,
    code: normalizeProductCode(code),
  }
}

export function builderRowsToCode(rows: ProductCodeBuilderRow[]): string {
  return buildProductCodeFromParts(rows.map((row) => row.code))
}

export function moveBuilderRow(
  rows: ProductCodeBuilderRow[],
  rowId: string,
  direction: -1 | 1
): ProductCodeBuilderRow[] {
  const index = rows.findIndex((row) => row.id === rowId)
  const target = index + direction
  if (index < 0 || target < 0 || target >= rows.length) return rows
  const next = [...rows]
  const [moved] = next.splice(index, 1)
  next.splice(target, 0, moved!)
  return next
}

export function getSegmentsByGroup(
  group: ProductCodeSegmentGroup,
  allSegments: ProductCodeSegment[] = DEFAULT_PRODUCT_CODE_SEGMENTS
): ProductCodeSegment[] {
  return allSegments.filter((s) => s.group === group)
}

export type ProductCodeDecodePart = {
  code: string
  labelKo: string
  labelEn: string
  known: boolean
  group?: ProductCodeSegmentGroup
}

function buildSegmentLookup(allSegments: ProductCodeSegment[]): Map<string, ProductCodeSegment> {
  const map = new Map<string, ProductCodeSegment>()
  for (const seg of allSegments) {
    map.set(seg.code.toUpperCase(), seg)
  }
  return map
}

/** 긴 세그먼트 우선 매칭으로 코드를 해석합니다. */
export function decodeProductCode(
  code: string | null | undefined,
  allSegments: ProductCodeSegment[] = DEFAULT_PRODUCT_CODE_SEGMENTS
): ProductCodeDecodePart[] {
  const normalized = normalizeProductCode(code)
  if (!normalized) return []

  const sortedCodes = [...allSegments]
    .map((s) => s.code.toUpperCase())
    .sort((a, b) => b.length - a.length)

  const lookup = buildSegmentLookup(allSegments)
  const parts: ProductCodeDecodePart[] = []
  let remaining = normalized

  while (remaining.length > 0) {
    const match = sortedCodes.find((c) => remaining.startsWith(c))
    if (match) {
      const seg = lookup.get(match)!
      parts.push({
        code: match,
        labelKo: seg.labelKo,
        labelEn: seg.labelEn,
        known: true,
        group: seg.group,
      })
      remaining = remaining.slice(match.length)
    } else {
      const next = remaining[0]!
      parts.push({
        code: next,
        labelKo: `미등록 (${next})`,
        labelEn: `Unknown (${next})`,
        known: false,
      })
      remaining = remaining.slice(1)
    }
  }

  return parts
}

export function decodeToBuilderRows(
  code: string | null | undefined,
  allSegments: ProductCodeSegment[] = DEFAULT_PRODUCT_CODE_SEGMENTS
): ProductCodeBuilderRow[] {
  return decodeProductCode(code, allSegments).map((part) =>
    createProductCodeBuilderRow(part.group ?? 'variant', part.code)
  )
}

export type ProductCodeValidation = {
  valid: boolean
  normalized: string
  errorKo?: string
  errorEn?: string
  duplicateProductId?: string
  duplicateProductName?: string
}

export function validateProductCode(
  code: string | null | undefined,
  existing: Array<{ id: string; product_code?: string | null; name?: string | null; name_ko?: string | null }>,
  currentProductId?: string
): ProductCodeValidation {
  const normalized = normalizeProductCode(code)

  if (!normalized) {
    return {
      valid: false,
      normalized: '',
      errorKo: '상품 코드를 입력해 주세요.',
      errorEn: 'Enter a product code.',
    }
  }

  if (normalized.length < 3) {
    return {
      valid: false,
      normalized,
      errorKo: '상품 코드는 최소 3자 이상이어야 합니다.',
      errorEn: 'Product code must be at least 3 characters.',
    }
  }

  if (!/^[A-Z][A-Z0-9]+$/.test(normalized)) {
    return {
      valid: false,
      normalized,
      errorKo: '영문 대문자와 숫자만 사용할 수 있습니다. 첫 글자는 영문이어야 합니다.',
      errorEn: 'Use uppercase letters and numbers only. First character must be a letter.',
    }
  }

  const duplicate = existing.find(
    (p) =>
      p.id !== currentProductId &&
      normalizeProductCode(p.product_code) === normalized
  )

  if (duplicate) {
    const name = duplicate.name_ko || duplicate.name || duplicate.id
    return {
      valid: false,
      normalized,
      duplicateProductId: duplicate.id,
      duplicateProductName: name ?? undefined,
      errorKo: `이미 사용 중인 코드입니다. (${name})`,
      errorEn: `This code is already in use. (${name})`,
    }
  }

  return { valid: true, normalized }
}

type SuggestSource = {
  name?: string | null
  name_ko?: string | null
  name_en?: string | null
  category?: string | null
  sub_category?: string | null
  tags?: string[] | null
  duration?: string | null
}

type SuggestPartsByGroup = Partial<Record<ProductCodeSegmentGroup, string[]>>

/** 빌더 설정(저장된 드롭다운 항목) — 자동 제안 시 코드 매핑에 사용 */
export type ProductCodeSuggestSegmentRef = {
  code: string
  labelKo: string
  labelEn: string
  enabled: boolean
  sortOrder: number
  descriptionKo?: string
  descriptionEn?: string
}

export type ProductCodeSuggestConfigRef = {
  segmentsByGroup: Partial<Record<ProductCodeSegmentGroup, ProductCodeSuggestSegmentRef[]>>
}

function segmentHaystack(seg: ProductCodeSuggestSegmentRef): string {
  return [seg.code, seg.labelKo, seg.labelEn, seg.descriptionKo, seg.descriptionEn]
    .filter(Boolean)
    .join(' ')
}

function enabledSegmentsForGroup(
  config: ProductCodeSuggestConfigRef | undefined,
  group: ProductCodeSegmentGroup
): ProductCodeSuggestSegmentRef[] {
  if (!config) return []
  return [...(config.segmentsByGroup[group] ?? [])]
    .filter((s) => s.enabled && String(s.code ?? '').trim())
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

const SEGMENT_LABEL_HINTS: Partial<
  Record<ProductCodeSegmentGroup, Partial<Record<string, RegExp>>>
> = {
  tourType: {
    D: /day|당일|데이|same\s*day/i,
    N: /night|숙박|멀티|overnight|multi/i,
    SND: /sending|샌딩|pickup|픽업|가이드만|guide only/i,
  },
  duration: {
    '1D': /1\s*day|당일|1일|same\s*day/i,
    '1N': /1\s*night|1박/i,
    '2N': /2\s*night|2박/i,
    '3N': /3\s*night|3박/i,
  },
}

function resolveCodeInGroup(
  group: ProductCodeSegmentGroup,
  candidateCodes: string[],
  config: ProductCodeSuggestConfigRef | undefined
): string | null {
  const enabled = enabledSegmentsForGroup(config, group)
  if (enabled.length === 0) return candidateCodes[0] ?? null

  for (const candidate of candidateCodes) {
    const upper = candidate.toUpperCase()
    const exact = enabled.find((s) => s.code.toUpperCase() === upper)
    if (exact) return exact.code
  }

  const hints = SEGMENT_LABEL_HINTS[group]
  if (hints) {
    for (const candidate of candidateCodes) {
      const re = hints[candidate.toUpperCase()]
      if (!re) continue
      const byLabel = enabled.find((s) => re.test(segmentHaystack(s)))
      if (byLabel) return byLabel.code
    }
  }

  return enabled[0]?.code ?? candidateCodes[0] ?? null
}

function resolveTourTypeCode(
  intent: 'day' | 'night' | 'sending',
  config: ProductCodeSuggestConfigRef | undefined
): string {
  const legacy: Record<typeof intent, string[]> = {
    day: ['D'],
    night: ['N'],
    sending: ['SND'],
  }
  const resolved = resolveCodeInGroup('tourType', legacy[intent], config)
  return resolved ?? legacy[intent][0]!
}

function applyConfigToSuggestParts(
  byGroup: SuggestPartsByGroup,
  config: ProductCodeSuggestConfigRef | undefined
): SuggestPartsByGroup {
  if (!config) return byGroup

  const out: SuggestPartsByGroup = {}

  for (const group of PRODUCT_CODE_BUILDER_GROUPS) {
    const codes = byGroup[group]
    if (!codes?.length) continue

    if (group === 'tourType') {
      const raw = codes[0]?.toUpperCase()
      let intent: 'day' | 'night' | 'sending' = 'day'
      if (raw === 'SND') intent = 'sending'
      else if (raw === 'N') intent = 'night'
      out.tourType = [resolveTourTypeCode(intent, config)]
      continue
    }

    const resolved = codes
      .map((code) => resolveCodeInGroup(group, [code], config))
      .filter((code): code is string => Boolean(code))
    if (resolved.length > 0) out[group] = resolved
  }

  return out
}

/** groupOrder 의 각 그룹마다 최소 1개 조각 — 매칭 없으면 설정 목록 맨 위(활성) 항목 */
function fillSuggestPartsForAllGroups(
  byGroup: SuggestPartsByGroup,
  groupOrder: ProductCodeSegmentGroup[],
  config: ProductCodeSuggestConfigRef | undefined
): SuggestPartsByGroup {
  if (!config) return byGroup

  const out: SuggestPartsByGroup = { ...byGroup }

  for (const group of groupOrder) {
    if (out[group]?.length) continue

    const enabled = enabledSegmentsForGroup(config, group)
    const first = enabled[0]?.code
    if (first) out[group] = [first]
  }

  return out
}

function detectSuggestPartsByGroup(product: SuggestSource): SuggestPartsByGroup {
  const text = [
    product.name_ko,
    product.name,
    product.name_en,
    product.category,
    product.sub_category,
    ...(product.tags ?? []),
    product.duration,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  const byGroup: SuggestPartsByGroup = {
    company: ['M'],
  }

  const isNight =
    /숙박|1박|2박|3박|night|overnight|multi.?day|멀티|multi/i.test(text) ||
    /\b1n\b|\b2n\b|\b3n\b/i.test(text)
  const isSending = /샌딩|sending|픽업만|pickup only|가이드만|guide only/i.test(text)

  if (isSending) {
    byGroup.tourType = ['SND']
  } else {
    byGroup.tourType = [isNight ? 'N' : 'D']
  }

  if (/일출|sunrise/i.test(text)) {
    byGroup.destination = ['GCSUNRISE']
  } else if (/south|남림|사우스/i.test(text)) {
    byGroup.destination = ['GCSOUTH']
  } else if (/west|웨스트/i.test(text)) {
    byGroup.destination = ['GW']
  } else if (/그랜드\s*캐년|그랜드캐니언|grand\s*canyon|\bgc\b|캐년/i.test(text)) {
    byGroup.destination = ['GC']
  } else if (/앤텔롭|antelope/i.test(text)) {
    byGroup.destination = ['AC']
  } else if (/홀슈|horseshoe/i.test(text)) {
    byGroup.destination = ['HB']
  } else if (/zion|bryce|자이언|브라이스/i.test(text)) {
    byGroup.destination = ['ZB']
  } else if (/las vegas|라스\s*베가스|\blv\b/i.test(text)) {
    byGroup.destination = ['LV']
  }

  if (!byGroup.departure?.length) {
    if (/lax|los angeles|로스앤젤레스|로스앤/i.test(text)) {
      byGroup.departure = ['LAX']
    } else if (/salt lake|솔트\s*레이크|\bslc\b/i.test(text)) {
      byGroup.departure = ['SLC']
    } else if (byGroup.destination?.length || byGroup.company?.includes('M')) {
      byGroup.departure = ['LV']
    }
  }

  const duration: string[] = []
  if (/3박|3\s*night|\b3n\b/i.test(text)) {
    duration.push('3N')
  } else if (/2박|2\s*night|\b2n\b/i.test(text)) {
    duration.push('2N')
  } else if (/1박|1\s*night|\b1n\b/i.test(text)) {
    duration.push('1N')
  } else if (isNight && !byGroup.destination?.includes('GCSUNRISE')) {
    // night tour without explicit duration — skip 1D
  } else if (!isSending && !byGroup.destination?.includes('GCSUNRISE')) {
    if (/당일|1일|day tour|same.?day|\b1d\b/i.test(text)) {
      duration.push('1D')
    } else if (!isNight) {
      duration.push('1D')
    }
  }
  if (duration.length > 0) byGroup.duration = duration

  const variant: string[] = []
  if (/custom|맞춤|프라이빗|private/i.test(text)) {
    variant.push(/private/i.test(text) ? 'PRIVATE' : 'CUSTOM')
  }
  if (/헬기|helicopter|heli/i.test(text)) {
    variant.push('HELICOPTER')
  }
  if (variant.length > 0) byGroup.variant = variant

  if (/가이드|guide/i.test(text) && isSending) {
    byGroup.special = ['GUIDE']
  }

  return byGroup
}

function partsByGroupToBuilderRows(
  byGroup: SuggestPartsByGroup,
  groupOrder: ProductCodeSegmentGroup[]
): ProductCodeBuilderRow[] {
  const rows: ProductCodeBuilderRow[] = []
  for (const group of groupOrder) {
    for (const code of byGroup[group] ?? []) {
      if (code) rows.push(createProductCodeBuilderRow(group, code))
    }
  }
  return rows
}

/** 자동 제안 조각을 설정 그룹 순서대로 빌더 행으로 변환 (decode 왕복 없음) */
export function suggestProductCodeBuilderRows(
  product: SuggestSource,
  groupOrder: ProductCodeSegmentGroup[] = PRODUCT_CODE_BUILDER_GROUPS,
  config?: ProductCodeSuggestConfigRef
): ProductCodeBuilderRow[] {
  const raw = detectSuggestPartsByGroup(product)
  const resolved = applyConfigToSuggestParts(raw, config)
  const byGroup = fillSuggestPartsForAllGroups(resolved, groupOrder, config)
  return partsByGroupToBuilderRows(byGroup, groupOrder)
}

/** 상품명·태그·기간 힌트로 코드 초안을 제안합니다. groupOrder 로 조각 결합 순서를 맞춥니다. */
export function suggestProductCodeFromProduct(
  product: SuggestSource,
  groupOrder: ProductCodeSegmentGroup[] = PRODUCT_CODE_BUILDER_GROUPS,
  config?: ProductCodeSuggestConfigRef
): string {
  return builderRowsToCode(suggestProductCodeBuilderRows(product, groupOrder, config))
}

function checks(items: Array<{ ko: string; en: string }>): SopChecklistItem[] {
  const ids = items.map(() => newSopId())
  return items.map((it, i) => ({
    id: ids[i]!,
    title_ko: it.ko,
    title_en: it.en,
    sort_order: i,
    parent_id: null,
  }))
}

function cat(
  title_ko: string,
  title_en: string,
  content_ko: string,
  content_en: string,
  sort_order: number,
  checklist?: SopChecklistItem[]
): SopCategory {
  return {
    id: newSopId(),
    title_ko,
    title_en,
    content_ko,
    content_en,
    sort_order,
    ...(checklist?.length ? { checklist_items: checklist } : {}),
  }
}

function sec(title_ko: string, title_en: string, sort_order: number, categories: SopCategory[]): SopSection {
  return { id: newSopId(), title_ko, title_en, sort_order, categories }
}

const SEGMENT_TABLE_KO = DEFAULT_PRODUCT_CODE_SEGMENTS.map(
  (s) => `| **${s.code}** | ${PRODUCT_CODE_GROUP_LABELS[s.group].ko} | ${s.labelKo}${s.descriptionKo ? ` — ${s.descriptionKo}` : ''} |`
).join('\n')

const SEGMENT_TABLE_EN = DEFAULT_PRODUCT_CODE_SEGMENTS.map(
  (s) => `| **${s.code}** | ${PRODUCT_CODE_GROUP_LABELS[s.group].en} | ${s.labelEn}${s.descriptionEn ? ` — ${s.descriptionEn}` : ''} |`
).join('\n')

const EXAMPLE_TABLE_KO = PRODUCT_CODE_EXAMPLES.map((e) => `| \`${e.code}\` | ${e.meaningKo} |`).join('\n')
const EXAMPLE_TABLE_EN = PRODUCT_CODE_EXAMPLES.map((e) => `| \`${e.code}\` | ${e.meaningEn} |`).join('\n')

export const productCodeManualDocument: SopDocument = prefillSortOrders({
  title_ko: '상품 코드 작성 가이드',
  title_en: 'Product Code Guide',
  sections: [
    sec('핵심 원칙', 'Core rules', 0, [
      cat(
        '왜 상품 코드가 필요한가',
        'Why product codes matter',
        `상품 코드는 **내부 식별자**입니다. 예약·이메일 파싱·거주자 구분 UI·SOP 체크리스트 등에서 상품을 빠르게 구분합니다.

**규칙**
- 영문 **대문자** + 숫자만 (하이픈·공백 없음)
- **중복 금지** — 저장 전 시스템이 검사합니다
- 코드만 봐도 **회사 · 유형 · 목적지 · 기간**을 유추할 수 있게 작성
- 새 투어는 **빌더**로 조합 후, 기존 코드와 겹치지 않는지 확인`,
        `Product codes are **internal identifiers** used in reservations, email parsing, resident-status UI, and SOP checklists.

**Rules**
- Uppercase letters and numbers only (no hyphens or spaces)
- **No duplicates** — validated before save
- Code should imply **company · type · destination · duration**
- Use the **builder** for new tours, then verify uniqueness`,
        0,
        checks([
          { ko: 'M(회사)로 시작하는지 확인', en: 'Starts with M (company)' },
          { ko: '당일/숙박(D/N)이 맞는지 확인', en: 'Day vs night (D/N) is correct' },
          { ko: '목적지 약어가 맞는지 확인', en: 'Destination abbreviations are correct' },
          { ko: '기존 코드와 중복되지 않는지 확인', en: 'No duplicate of existing codes' },
        ])
      ),
    ]),
    sec('코드 조각 (세그먼트)', 'Code segments', 1, [
      cat(
        '세그먼트 표',
        'Segment reference',
        `| 코드 | 구분 | 의미 |
|------|------|------|
${SEGMENT_TABLE_KO}`,
        `| Code | Group | Meaning |
|------|-------|---------|
${SEGMENT_TABLE_EN}`,
        0
      ),
      cat(
        '조합 순서 (권장)',
        'Recommended order',
        `**기본 9자 (1+1+2+3+2)**

1. **회사** (1자) — M, S, P, V …
2. **투어 유형** (1자) — D, N, T …
3. **출발지** (2자) — LV, LAX …
4. **목적지** (3자) — GCT, GCS, ZCN … (빌더에서 순서·코드 관리)
5. **기간** (2자) — 1D, 1N, 2N, 3N …

**옵션** (필요 시 뒤에 추가): 도착지 · 특수 서비스 · 옵션·특징

예: \`M\` + \`T\` + \`LV\` + \`GCT\` + \`1N\` → **MLVGCT1N** (9자)`,
        `**Base 9 characters (1+1+2+3+2)**

1. **Company** (1) — M, S, P, V …
2. **Tour type** (1) — D, N, T …
3. **Departure** (2) — LV, LAX …
4. **Destination** (3) — GCT, GCS, ZCN … (manage in builder)
5. **Duration** (2) — 1D, 1N, 2N, 3N …

**Optional** (append when needed): Arrival · Special · Variant

Example: \`M\` + \`T\` + \`LV\` + \`GCT\` + \`1N\` → **MLVGCT1N** (9 chars)`,
        1
      ),
    ]),
    sec('실제 예시', 'Examples', 2, [
      cat(
        '등록된 예시 코드',
        'Registered examples',
        `| 코드 | 해석 |
|------|------|
${EXAMPLE_TABLE_KO}`,
        `| Code | Meaning |
|------|---------|
${EXAMPLE_TABLE_EN}`,
        0
      ),
    ]),
  ],
})

export const productCodeManualTitles = {
  ko: '상품 코드 메뉴얼',
  en: 'Product Code Manual',
}
