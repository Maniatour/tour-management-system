import type { SupabaseClient } from '@supabase/supabase-js'
import {
  DEFAULT_PRODUCT_CODE_SEGMENTS,
  PRODUCT_CODE_BUILDER_GROUPS,
  type ProductCodeSegment,
  type ProductCodeSegmentGroup,
} from '@/lib/productCodeSystem'

export const PRODUCT_CODE_BUILDER_CONFIG_VERSION = 2 as const

const LEGACY_DESTINATION_GROUPS = ['destination1', 'destination2'] as const

export type ProductCodeBuilderSegmentStored = {
  id: string
  code: string
  labelKo: string
  labelEn: string
  descriptionKo?: string
  descriptionEn?: string
  enabled: boolean
  sortOrder: number
}

export type ProductCodeBuilderConfigStored = {
  version: typeof PRODUCT_CODE_BUILDER_CONFIG_VERSION
  /** 빌더·설정 UI에 표시되는 그룹 순서 (회사 → 투어유형 → …) */
  groupOrder: ProductCodeSegmentGroup[]
  segmentsByGroup: Record<ProductCodeSegmentGroup, ProductCodeBuilderSegmentStored[]>
  updatedAt?: string
}

export function normalizeBuilderGroupOrder(raw: unknown): ProductCodeSegmentGroup[] {
  const defaultOrder = [...PRODUCT_CODE_BUILDER_GROUPS]
  if (!Array.isArray(raw)) return defaultOrder

  const seen = new Set<ProductCodeSegmentGroup>()
  const order: ProductCodeSegmentGroup[] = []
  for (const item of raw) {
    if (typeof item !== 'string') continue
    const group = item as ProductCodeSegmentGroup
    if (!PRODUCT_CODE_BUILDER_GROUPS.includes(group) || seen.has(group)) continue
    seen.add(group)
    order.push(group)
  }

  for (const group of defaultOrder) {
    if (!seen.has(group)) order.push(group)
  }
  return order
}

export function getBuilderGroupOrder(config: ProductCodeBuilderConfigStored): ProductCodeSegmentGroup[] {
  return normalizeBuilderGroupOrder(config.groupOrder)
}

export function moveBuilderGroupOrder(
  order: ProductCodeSegmentGroup[],
  group: ProductCodeSegmentGroup,
  direction: -1 | 1
): ProductCodeSegmentGroup[] {
  const index = order.indexOf(group)
  const target = index + direction
  if (index < 0 || target < 0 || target >= order.length) return order
  const next = [...order]
  const [moved] = next.splice(index, 1)
  next.splice(target, 0, moved!)
  return next
}

export function productCodeBuilderConfigKey(operatorId: string): string {
  return `product_code_builder_config:${operatorId}`
}

function newSegmentId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `pcs-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function segmentToStored(seg: ProductCodeSegment, sortOrder: number): ProductCodeBuilderSegmentStored {
  return {
    id: newSegmentId(),
    code: seg.code,
    labelKo: seg.labelKo,
    labelEn: seg.labelEn,
    ...(seg.descriptionKo ? { descriptionKo: seg.descriptionKo } : {}),
    ...(seg.descriptionEn ? { descriptionEn: seg.descriptionEn } : {}),
    enabled: true,
    sortOrder,
  }
}

export function createDefaultProductCodeBuilderConfig(): ProductCodeBuilderConfigStored {
  const segmentsByGroup = {} as Record<ProductCodeSegmentGroup, ProductCodeBuilderSegmentStored[]>
  for (const group of PRODUCT_CODE_BUILDER_GROUPS) {
    const items = DEFAULT_PRODUCT_CODE_SEGMENTS.filter((s) => s.group === group)
    segmentsByGroup[group] = items.map((seg, i) => segmentToStored(seg, i))
  }
  return {
    version: PRODUCT_CODE_BUILDER_CONFIG_VERSION,
    groupOrder: [...PRODUCT_CODE_BUILDER_GROUPS],
    segmentsByGroup,
    updatedAt: new Date().toISOString(),
  }
}

function normalizeStoredSegment(raw: unknown, fallbackSort: number): ProductCodeBuilderSegmentStored | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const id = typeof o.id === 'string' && o.id.trim() ? o.id.trim() : newSegmentId()
  const code = String(o.code ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
  const labelKo = typeof o.labelKo === 'string' ? o.labelKo.trim() : ''
  const labelEn = typeof o.labelEn === 'string' ? o.labelEn.trim() : labelKo
  const enabled = o.enabled !== false
  const sortOrder = typeof o.sortOrder === 'number' && Number.isFinite(o.sortOrder) ? o.sortOrder : fallbackSort
  if (!code || !labelKo) return null
  return {
    id,
    code,
    labelKo,
    labelEn: labelEn || labelKo,
    ...(typeof o.descriptionKo === 'string' && o.descriptionKo.trim()
      ? { descriptionKo: o.descriptionKo.trim() }
      : {}),
    ...(typeof o.descriptionEn === 'string' && o.descriptionEn.trim()
      ? { descriptionEn: o.descriptionEn.trim() }
      : {}),
    enabled,
    sortOrder,
  }
}

function mergeLegacyDestinationGroups(
  segmentsByGroup: Record<ProductCodeSegmentGroup, ProductCodeBuilderSegmentStored[]>,
  raw: Record<string, unknown>
): void {
  const destination = [...(segmentsByGroup.destination ?? [])]
  const existingCodes = new Set(destination.map((item) => item.code.toUpperCase()))

  for (const legacyGroup of LEGACY_DESTINATION_GROUPS) {
    const list = raw[legacyGroup]
    if (!Array.isArray(list)) continue
    for (const item of list) {
      const parsed = normalizeStoredSegment(item, destination.length)
      if (!parsed) continue
      if (existingCodes.has(parsed.code.toUpperCase())) continue
      destination.push({ ...parsed, sortOrder: destination.length })
      existingCodes.add(parsed.code.toUpperCase())
    }
  }

  segmentsByGroup.destination = destination.map((item, i) => ({ ...item, sortOrder: i }))
}

export function parseProductCodeBuilderConfig(raw: unknown): ProductCodeBuilderConfigStored {
  const defaults = createDefaultProductCodeBuilderConfig()
  if (!raw || typeof raw !== 'object') return defaults

  const o = raw as Record<string, unknown>
  const segmentsByGroup = { ...defaults.segmentsByGroup }

  if (o.segmentsByGroup && typeof o.segmentsByGroup === 'object') {
    const stored = o.segmentsByGroup as Record<string, unknown>
    for (const group of PRODUCT_CODE_BUILDER_GROUPS) {
      const list = stored[group]
      if (!Array.isArray(list)) continue
      const parsed = list
        .map((item, i) => normalizeStoredSegment(item, i))
        .filter((item): item is ProductCodeBuilderSegmentStored => item != null)
        .sort((a, b) => a.sortOrder - b.sortOrder)
      if (parsed.length > 0) {
        segmentsByGroup[group] = parsed.map((item, i) => ({ ...item, sortOrder: i }))
      }
    }
    mergeLegacyDestinationGroups(segmentsByGroup, stored)
  }

  return {
    version: PRODUCT_CODE_BUILDER_CONFIG_VERSION,
    groupOrder: normalizeBuilderGroupOrder(o.groupOrder),
    segmentsByGroup,
    ...(typeof o.updatedAt === 'string' ? { updatedAt: o.updatedAt } : {}),
  }
}

export function storedSegmentsToRuntime(
  stored: ProductCodeBuilderSegmentStored[],
  group: ProductCodeSegmentGroup
): ProductCodeSegment[] {
  return stored
    .filter((s) => s.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((s) => ({
      code: s.code,
      labelKo: s.labelKo,
      labelEn: s.labelEn,
      group,
      ...(s.descriptionKo ? { descriptionKo: s.descriptionKo } : {}),
      ...(s.descriptionEn ? { descriptionEn: s.descriptionEn } : {}),
    }))
}

export function flattenConfigSegments(config: ProductCodeBuilderConfigStored): ProductCodeSegment[] {
  return getBuilderGroupOrder(config).flatMap((group) =>
    storedSegmentsToRuntime(config.segmentsByGroup[group] ?? [], group)
  )
}

export function getSegmentsByGroupFromConfig(
  config: ProductCodeBuilderConfigStored,
  group: ProductCodeSegmentGroup
): ProductCodeSegment[] {
  return storedSegmentsToRuntime(config.segmentsByGroup[group] ?? [], group)
}

export async function fetchProductCodeBuilderConfig(
  supabase: SupabaseClient,
  operatorId: string
): Promise<ProductCodeBuilderConfigStored> {
  const key = productCodeBuilderConfigKey(operatorId)
  const { data, error } = await supabase
    .from('shared_settings')
    .select('setting_value')
    .eq('setting_key', key)
    .maybeSingle()

  if (error) {
    console.error('product code builder config fetch error:', error)
    return createDefaultProductCodeBuilderConfig()
  }

  if (!data?.setting_value) return createDefaultProductCodeBuilderConfig()
  return parseProductCodeBuilderConfig(data.setting_value)
}

export async function saveProductCodeBuilderConfig(
  supabase: SupabaseClient,
  operatorId: string,
  config: ProductCodeBuilderConfigStored
): Promise<{ error: string | null }> {
  const key = productCodeBuilderConfigKey(operatorId)
  const payload: ProductCodeBuilderConfigStored = {
    ...config,
    version: PRODUCT_CODE_BUILDER_CONFIG_VERSION,
    updatedAt: new Date().toISOString(),
  }

  const { error } = await supabase.from('shared_settings').upsert(
    {
      setting_key: key,
      setting_value: payload as unknown as Record<string, unknown>,
    },
    { onConflict: 'setting_key' }
  )

  return { error: error?.message ?? null }
}

export function createEmptyBuilderSegment(group: ProductCodeSegmentGroup): ProductCodeBuilderSegmentStored {
  const sortOrder = 0
  return {
    id: newSegmentId(),
    code: '',
    labelKo: '',
    labelEn: '',
    enabled: true,
    sortOrder,
    ...(group === 'company' ? { descriptionKo: '회사 접두사', descriptionEn: 'Company prefix' } : {}),
  }
}

export function validateBuilderSegmentInput(
  segment: Pick<ProductCodeBuilderSegmentStored, 'code' | 'labelKo'>,
  siblings: ProductCodeBuilderSegmentStored[],
  currentId?: string
): { valid: boolean; errorKo?: string; errorEn?: string } {
  const code = String(segment.code ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
  const labelKo = segment.labelKo.trim()

  if (!code) {
    return { valid: false, errorKo: '코드를 입력해 주세요.', errorEn: 'Enter a code.' }
  }
  if (!labelKo) {
    return { valid: false, errorKo: '한국어 이름을 입력해 주세요.', errorEn: 'Enter a Korean label.' }
  }
  if (!/^[A-Z][A-Z0-9]*$/.test(code)) {
    return {
      valid: false,
      errorKo: '코드는 영문 대문자로 시작하고, 영문·숫자만 사용할 수 있습니다.',
      errorEn: 'Code must start with a letter and use uppercase letters and numbers only.',
    }
  }

  const duplicate = siblings.find((s) => s.id !== currentId && s.code.toUpperCase() === code)
  if (duplicate) {
    return {
      valid: false,
      errorKo: `같은 그룹에 "${code}" 코드가 이미 있습니다.`,
      errorEn: `Code "${code}" already exists in this group.`,
    }
  }

  return { valid: true }
}
