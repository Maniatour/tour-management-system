import type { CustomerPageZone } from '@/lib/customerPageZones'
import type { BasicFieldKey, DetailFieldKey } from '@/lib/customerPageZoneEditMap'
import { BASIC_FIELD_LABELS, DETAIL_FIELD_LABELS } from '@/lib/customerPageZoneEditMap'
import { getCustomerPageBindingsCache } from '@/lib/customerPageBindingPersistence'

/** product_details_multilingual 컬럼 또는 products 테이블 컬럼 */
export type DetailBindingKey = DetailFieldKey | `product:${BasicFieldKey}`

export type DetailFieldSlotDef = {
  slotId: DetailFieldKey
  label: string
  options: DetailBindingKey[]
  defaultOption: DetailBindingKey
  /** 고객 페이지 표시 토글 — 상세정보 테이블 필드에만 해당 */
  supportsVisibility: boolean
}

export type BasicFieldSlotDef = {
  slotId: string
  label: string
  options: BasicFieldKey[]
  defaultOption: BasicFieldKey
}

/** 입력 슬롯 — 같은 UI 위치에서 연결 가능한 DB 컬럼 후보 */
export const BASIC_FIELD_SLOT_DEFS: Record<string, BasicFieldSlotDef> = {
  productNameKo: {
    slotId: 'productNameKo',
    label: '상품명 (한국어)',
    options: ['customerNameKo', 'internalNameKo'],
    defaultOption: 'customerNameKo',
  },
  productNameEn: {
    slotId: 'productNameEn',
    label: '상품명 (English)',
    options: ['customerNameEn', 'internalNameEn'],
    defaultOption: 'customerNameEn',
  },
  summaryKo: {
    slotId: 'summaryKo',
    label: '짧은 설명 (한국어)',
    options: ['summaryKo', 'description'],
    defaultOption: 'summaryKo',
  },
  summaryEn: {
    slotId: 'summaryEn',
    label: '짧은 설명 (English)',
    options: ['summaryEn', 'description'],
    defaultOption: 'summaryEn',
  },
  departureCityKo: {
    slotId: 'departureCityKo',
    label: '출발 도시 (한국어)',
    options: ['departureCityKo', 'departureCity'],
    defaultOption: 'departureCityKo',
  },
  departureCityEn: {
    slotId: 'departureCityEn',
    label: '출발 도시 (English)',
    options: ['departureCityEn', 'departureCity'],
    defaultOption: 'departureCityEn',
  },
  arrivalCityKo: {
    slotId: 'arrivalCityKo',
    label: '도착 도시 (한국어)',
    options: ['arrivalCityKo', 'arrivalCity'],
    defaultOption: 'arrivalCityKo',
  },
  arrivalCityEn: {
    slotId: 'arrivalCityEn',
    label: '도착 도시 (English)',
    options: ['arrivalCityEn', 'arrivalCity'],
    defaultOption: 'arrivalCityEn',
  },
  departureCountryKo: {
    slotId: 'departureCountryKo',
    label: '출발 국가 (한국어)',
    options: ['departureCountryKo', 'departureCountry'],
    defaultOption: 'departureCountryKo',
  },
  departureCountryEn: {
    slotId: 'departureCountryEn',
    label: '출발 국가 (English)',
    options: ['departureCountryEn', 'departureCountry'],
    defaultOption: 'departureCountryEn',
  },
  arrivalCountryKo: {
    slotId: 'arrivalCountryKo',
    label: '도착 국가 (한국어)',
    options: ['arrivalCountryKo', 'arrivalCountry'],
    defaultOption: 'arrivalCountryKo',
  },
  arrivalCountryEn: {
    slotId: 'arrivalCountryEn',
    label: '도착 국가 (English)',
    options: ['arrivalCountryEn', 'arrivalCountry'],
    defaultOption: 'arrivalCountryEn',
  },
}

const FIELD_TO_SLOT: Partial<Record<BasicFieldKey, string>> = {
  customerNameKo: 'productNameKo',
  internalNameKo: 'productNameKo',
  customerNameEn: 'productNameEn',
  internalNameEn: 'productNameEn',
  summaryKo: 'summaryKo',
  summaryEn: 'summaryEn',
  departureCityKo: 'departureCityKo',
  departureCity: 'departureCityKo',
  departureCityEn: 'departureCityEn',
  arrivalCityKo: 'arrivalCityKo',
  arrivalCity: 'arrivalCityKo',
  arrivalCityEn: 'arrivalCityEn',
  departureCountryKo: 'departureCountryKo',
  departureCountry: 'departureCountryKo',
  departureCountryEn: 'departureCountryEn',
  arrivalCountryKo: 'arrivalCountryKo',
  arrivalCountry: 'arrivalCountryKo',
  arrivalCountryEn: 'arrivalCountryEn',
}

const STORAGE_PREFIX = 'cp-field-bindings:'
const DETAIL_STORAGE_PREFIX = 'cp-detail-bindings:'

export const BASIC_TEXT_FIELD_KEYS: BasicFieldKey[] = [
  'customerNameKo',
  'customerNameEn',
  'internalNameKo',
  'internalNameEn',
  'summaryKo',
  'summaryEn',
  'description',
  'departureCity',
  'arrivalCity',
  'departureCountry',
  'arrivalCountry',
  'departureCityKo',
  'departureCityEn',
  'arrivalCityKo',
  'arrivalCityEn',
  'departureCountryKo',
  'departureCountryEn',
  'arrivalCountryKo',
  'arrivalCountryEn',
  'groupSize',
]

export const BASIC_NUMBER_FIELD_KEYS: BasicFieldKey[] = [
  'duration',
  'maxParticipants',
  'adultBasePrice',
  'childBasePrice',
  'infantBasePrice',
  'adultAge',
  'childAgeMin',
  'childAgeMax',
  'infantAge',
]

export const BASIC_ARRAY_FIELD_KEYS: BasicFieldKey[] = [
  'tags',
  'languages',
  'transportationMethods',
]

export const ALL_BASIC_FIELD_KEYS: BasicFieldKey[] = [
  ...BASIC_TEXT_FIELD_KEYS,
  ...BASIC_NUMBER_FIELD_KEYS,
  ...BASIC_ARRAY_FIELD_KEYS,
]

function basicFieldKind(field: BasicFieldKey): 'text' | 'number' | 'array' {
  if (BASIC_NUMBER_FIELD_KEYS.includes(field)) return 'number'
  if (BASIC_ARRAY_FIELD_KEYS.includes(field)) return 'array'
  return 'text'
}

function expandBasicBindingOptions(
  defaultOption: BasicFieldKey,
  preset: BasicFieldKey[]
): BasicFieldKey[] {
  const kind = basicFieldKind(defaultOption)
  const pool =
    kind === 'number'
      ? BASIC_NUMBER_FIELD_KEYS
      : kind === 'array'
        ? BASIC_ARRAY_FIELD_KEYS
        : BASIC_TEXT_FIELD_KEYS
  return [...new Set([...preset, defaultOption, ...pool])]
}

function expandDetailBindingOptions(field: DetailFieldKey): DetailBindingKey[] {
  const preset = DETAIL_FIELD_BINDING_OPTIONS[field] ?? [field]
  const productOptions = BASIC_TEXT_FIELD_KEYS.map(
    (key) => `product:${key}` as DetailBindingKey
  )
  const detailOptions = (Object.keys(DETAIL_FIELD_LABELS) as DetailFieldKey[]).map(
    (key) => key as DetailBindingKey
  )
  return [...new Set<DetailBindingKey>([...preset, ...detailOptions, ...productOptions])]
}

/** 상세정보 필드 ↔ products 테이블 대체 컬럼 */
const DETAIL_FIELD_BINDING_OPTIONS: Partial<Record<DetailFieldKey, DetailBindingKey[]>> = {
  description: ['description', 'product:description', 'product:summaryKo', 'product:summaryEn'],
  greeting: ['greeting', 'product:summaryKo', 'product:summaryEn'],
  included: ['included', 'product:description'],
  not_included: ['not_included', 'product:description'],
}

export function resolveEditSlotsForBasicFields(basicFields: BasicFieldKey[]): BasicFieldSlotDef[] {
  const uniqueSlotIds = [...new Set(basicFields.map((f) => FIELD_TO_SLOT[f] ?? f))]

  return uniqueSlotIds.map((slotId) => {
    const def = BASIC_FIELD_SLOT_DEFS[slotId]
    if (def) {
      return {
        ...def,
        options: expandBasicBindingOptions(def.defaultOption, def.options),
      }
    }
    const key = slotId as BasicFieldKey
    return {
      slotId,
      label: BASIC_FIELD_LABELS[key] ?? slotId,
      options: expandBasicBindingOptions(key, [key]),
      defaultOption: key,
    }
  })
}

export function loadZoneFieldBindings(
  zone: CustomerPageZone,
  slots: BasicFieldSlotDef[]
): Record<string, BasicFieldKey> {
  const fromServer = getCustomerPageBindingsCache()[zone]?.basic
  if (fromServer) {
    return normalizeBindings(slots, fromServer)
  }

  if (typeof window === 'undefined') {
    return defaultBindings(slots)
  }

  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${zone}`)
    if (!raw) return defaultBindings(slots)
    const parsed = JSON.parse(raw) as Record<string, BasicFieldKey>
    return normalizeBindings(slots, parsed)
  } catch {
    return defaultBindings(slots)
  }
}

export function saveZoneFieldBindings(
  zone: CustomerPageZone,
  bindings: Record<string, BasicFieldKey>
): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(`${STORAGE_PREFIX}${zone}`, JSON.stringify(bindings))
}

function defaultBindings(slots: BasicFieldSlotDef[]): Record<string, BasicFieldKey> {
  const out: Record<string, BasicFieldKey> = {}
  for (const slot of slots) {
    out[slot.slotId] = slot.defaultOption
  }
  return out
}

function normalizeBindings(
  slots: BasicFieldSlotDef[],
  stored: Record<string, BasicFieldKey>
): Record<string, BasicFieldKey> {
  const out = defaultBindings(slots)
  for (const slot of slots) {
    const candidate = stored[slot.slotId]
    if (!candidate) continue
    if (slot.options.includes(candidate)) {
      out[slot.slotId] = candidate
    } else if (ALL_BASIC_FIELD_KEYS.includes(candidate)) {
      out[slot.slotId] = candidate
    }
  }
  return out
}

export function bindingLabel(field: BasicFieldKey): string {
  return BASIC_FIELD_LABELS[field] ?? field
}

/** 카드·목록 바인딩 — locale에 맞는 Ko/En 필드로 변환 */
const KO_TO_EN_BASIC_FIELD: Partial<Record<BasicFieldKey, BasicFieldKey>> = {
  customerNameKo: 'customerNameEn',
  internalNameKo: 'internalNameEn',
  summaryKo: 'summaryEn',
  departureCityKo: 'departureCityEn',
  arrivalCityKo: 'arrivalCityEn',
  departureCountryKo: 'departureCountryEn',
  arrivalCountryKo: 'arrivalCountryEn',
}

const EN_TO_KO_BASIC_FIELD = Object.fromEntries(
  Object.entries(KO_TO_EN_BASIC_FIELD).map(([ko, en]) => [en, ko])
) as Partial<Record<BasicFieldKey, BasicFieldKey>>

export function resolveLocaleBasicField(field: BasicFieldKey, locale: string): BasicFieldKey {
  if (locale === 'en') {
    return KO_TO_EN_BASIC_FIELD[field] ?? field
  }
  return EN_TO_KO_BASIC_FIELD[field] ?? field
}

export function dbColumnForBasicField(field: BasicFieldKey): string {
  const map: Record<BasicFieldKey, string> = {
    customerNameKo: 'customer_name_ko',
    customerNameEn: 'customer_name_en',
    internalNameKo: 'name',
    internalNameEn: 'name_en',
    summaryKo: 'summary_ko',
    summaryEn: 'summary_en',
    description: 'description',
    tags: 'tags',
    departureCity: 'departure_city',
    arrivalCity: 'arrival_city',
    departureCountry: 'departure_country',
    arrivalCountry: 'arrival_country',
    departureCityKo: 'departure_city_ko',
    departureCityEn: 'departure_city_en',
    arrivalCityKo: 'arrival_city_ko',
    arrivalCityEn: 'arrival_city_en',
    departureCountryKo: 'departure_country_ko',
    departureCountryEn: 'departure_country_en',
    arrivalCountryKo: 'arrival_country_ko',
    arrivalCountryEn: 'arrival_country_en',
    duration: 'duration',
    maxParticipants: 'max_participants',
    groupSize: 'group_size',
    languages: 'languages',
    transportationMethods: 'transportation_methods',
    adultBasePrice: 'adult_base_price',
    childBasePrice: 'child_base_price',
    infantBasePrice: 'infant_base_price',
    adultAge: 'adult_age',
    childAgeMin: 'child_age_min',
    childAgeMax: 'child_age_max',
    infantAge: 'infant_age',
  }
  return map[field]
}

export function readBasicFieldValue(
  row: Record<string, unknown>,
  field: BasicFieldKey
): string | string[] {
  const col = dbColumnForBasicField(field)
  const raw = row[col]

  if (field === 'tags' || field === 'languages' || field === 'transportationMethods') {
    return Array.isArray(raw) ? (raw as string[]) : []
  }
  if (field === 'duration') {
    const dur = String(raw ?? '')
    const match = dur.match(/^(\d+)/)
    return match ? match[1] : dur
  }
  if (field === 'groupSize') {
    return raw != null ? String(raw) : ''
  }
  return raw != null ? String(raw) : ''
}

export type BasicSlotValues = Record<string, string | string[]>

export function slotValuesToDbUpdate(
  slots: BasicFieldSlotDef[],
  bindings: Record<string, BasicFieldKey>,
  values: BasicSlotValues
): Record<string, unknown> {
  const form: Partial<Record<BasicFieldKey, string | string[]>> = {}

  for (const slot of slots) {
    const boundField = bindings[slot.slotId] ?? slot.defaultOption
    form[boundField] = values[slot.slotId]
  }

  const update: Record<string, unknown> = {}

  for (const [field, val] of Object.entries(form) as [BasicFieldKey, string | string[]][]) {
    const col = dbColumnForBasicField(field)
    if (field === 'tags' || field === 'languages' || field === 'transportationMethods') {
      update[col] = Array.isArray(val) ? val : []
    } else if (field === 'duration') {
      update[col] = val != null && val !== '' ? `${val}:00:00` : null
    } else if (
      field === 'maxParticipants' ||
      field === 'adultAge' ||
      field === 'childAgeMin' ||
      field === 'childAgeMax' ||
      field === 'infantAge'
    ) {
      update[col] = val != null && val !== '' ? Number(val) : null
    } else if (
      field === 'adultBasePrice' ||
      field === 'childBasePrice' ||
      field === 'infantBasePrice'
    ) {
      update[col] = val != null && val !== '' ? Number(val) : 0
      if (field === 'adultBasePrice') {
        update.base_price = val != null && val !== '' ? Number(val) : 0
      }
    } else if (field === 'groupSize') {
      update[col] = val != null && val !== '' ? String(val) : null
    } else {
      update[col] = typeof val === 'string' && val.trim() !== '' ? val.trim() : null
    }
  }

  if (update.departure_city_ko != null) update.departure_city = update.departure_city_ko
  if (update.arrival_city_ko != null) update.arrival_city = update.arrival_city_ko
  if (update.departure_country_ko != null) update.departure_country = update.departure_country_ko
  if (update.arrival_country_ko != null) update.arrival_country = update.arrival_country_ko

  return update
}

export function buildSlotValuesFromRow(
  slots: BasicFieldSlotDef[],
  bindings: Record<string, BasicFieldKey>,
  row: Record<string, unknown>
): BasicSlotValues {
  const out: BasicSlotValues = {}
  for (const slot of slots) {
    const boundField = bindings[slot.slotId] ?? slot.defaultOption
    out[slot.slotId] = readBasicFieldValue(row, boundField)
  }
  return out
}

export function serializeSlotEditState(
  bindings: Record<string, BasicFieldKey>,
  values: BasicSlotValues
): string {
  return JSON.stringify({ bindings, values })
}

export function resolveEditSlotsForDetailFields(
  detailFields: DetailFieldKey[]
): DetailFieldSlotDef[] {
  return detailFields.map((field) => {
    const options = expandDetailBindingOptions(field)
    return {
      slotId: field,
      label: DETAIL_FIELD_LABELS[field] ?? field,
      options,
      defaultOption: field,
      supportsVisibility: true,
    }
  })
}

export function loadZoneDetailFieldBindings(
  zone: CustomerPageZone,
  slots: DetailFieldSlotDef[]
): Record<string, DetailBindingKey> {
  const fromServer = getCustomerPageBindingsCache()[zone]?.detail
  if (fromServer) {
    return normalizeDetailBindings(slots, fromServer)
  }

  if (typeof window === 'undefined') {
    return defaultDetailBindings(slots)
  }

  try {
    const raw = window.localStorage.getItem(`${DETAIL_STORAGE_PREFIX}${zone}`)
    if (!raw) return defaultDetailBindings(slots)
    const parsed = JSON.parse(raw) as Record<string, DetailBindingKey>
    return normalizeDetailBindings(slots, parsed)
  } catch {
    return defaultDetailBindings(slots)
  }
}

export function saveZoneDetailFieldBindings(
  zone: CustomerPageZone,
  bindings: Record<string, DetailBindingKey>
): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(`${DETAIL_STORAGE_PREFIX}${zone}`, JSON.stringify(bindings))
}

function defaultDetailBindings(slots: DetailFieldSlotDef[]): Record<string, DetailBindingKey> {
  const out: Record<string, DetailBindingKey> = {}
  for (const slot of slots) {
    out[slot.slotId] = slot.defaultOption
  }
  return out
}

function normalizeDetailBindings(
  slots: DetailFieldSlotDef[],
  stored: Record<string, DetailBindingKey>
): Record<string, DetailBindingKey> {
  const out = defaultDetailBindings(slots)
  for (const slot of slots) {
    const candidate = stored[slot.slotId]
    if (!candidate) continue
    if (slot.options.includes(candidate)) {
      out[slot.slotId] = candidate
    } else if (
      !candidate.startsWith('product:') ||
      ALL_BASIC_FIELD_KEYS.includes(candidate.slice(8) as BasicFieldKey)
    ) {
      out[slot.slotId] = candidate
    }
  }
  return out
}

export function detailBindingLabel(key: DetailBindingKey): string {
  if (key.startsWith('product:')) {
    const field = key.slice(8) as BasicFieldKey
    return `products.${dbColumnForBasicField(field)} (${BASIC_FIELD_LABELS[field] ?? field})`
  }
  return `상세정보.${key} (${DETAIL_FIELD_LABELS[key as DetailFieldKey] ?? key})`
}

export function isDetailTableBinding(binding: DetailBindingKey): binding is DetailFieldKey {
  return !binding.startsWith('product:')
}

export function readDetailBoundValue(
  binding: DetailBindingKey,
  detailRow: Record<string, unknown>,
  productRow: Record<string, unknown>
): string {
  if (binding.startsWith('product:')) {
    const field = binding.slice(8) as BasicFieldKey
    const raw = readBasicFieldValue(productRow, field)
    return Array.isArray(raw) ? raw.join(', ') : String(raw ?? '')
  }
  return detailRow[binding] != null ? String(detailRow[binding]) : ''
}

export type DetailSlotValues = Record<string, string>

export function buildDetailSlotValuesFromRows(
  slots: DetailFieldSlotDef[],
  bindings: Record<string, DetailBindingKey>,
  detailRow: Record<string, unknown>,
  productRow: Record<string, unknown>
): DetailSlotValues {
  const out: DetailSlotValues = {}
  for (const slot of slots) {
    const bound = bindings[slot.slotId] ?? slot.defaultOption
    out[slot.slotId] = readDetailBoundValue(bound, detailRow, productRow)
  }
  return out
}

export function detailSlotValuesToDbUpdates(
  slots: DetailFieldSlotDef[],
  bindings: Record<string, DetailBindingKey>,
  values: DetailSlotValues
): {
  productUpdate: Record<string, unknown>
  detailFieldUpdates: Partial<Record<DetailFieldKey, string>>
} {
  const detailFieldUpdates: Partial<Record<DetailFieldKey, string>> = {}

  for (const slot of slots) {
    const bound = bindings[slot.slotId] ?? slot.defaultOption
    const val = values[slot.slotId] ?? ''
    if (!bound.startsWith('product:')) {
      detailFieldUpdates[bound as DetailFieldKey] = val
    }
  }

  const productSlots = slots.filter((s) => {
    const bound = bindings[s.slotId] ?? s.defaultOption
    return bound.startsWith('product:')
  })
  const basicSlots: BasicFieldSlotDef[] = productSlots.map((s) => {
    const bound = bindings[s.slotId] ?? s.defaultOption
    const field = bound.slice(8) as BasicFieldKey
    return {
      slotId: s.slotId,
      label: s.label,
      options: [field],
      defaultOption: field,
    }
  })
  const basicBindings: Record<string, BasicFieldKey> = {}
  for (const slot of productSlots) {
    const bound = bindings[slot.slotId] ?? slot.defaultOption
    basicBindings[slot.slotId] = bound.slice(8) as BasicFieldKey
  }

  const productUpdate =
    basicSlots.length > 0
      ? slotValuesToDbUpdate(basicSlots, basicBindings, values as BasicSlotValues)
      : {}

  return { productUpdate, detailFieldUpdates }
}

export function serializeDetailSlotEditState(
  bindings: Record<string, DetailBindingKey>,
  values: DetailSlotValues,
  visibility: Partial<Record<DetailFieldKey, boolean>>
): string {
  return JSON.stringify({ bindings, values, visibility })
}
