import type { SupabaseClient } from '@supabase/supabase-js'
import { findRoundedGroupHotel, type PickupHotel } from '@/utils/pickupHotelUtils'

export type PickupGroupMode = 'representative' | 'requested'

export type PickupGroupPresetRow = {
  id: string
  name_ko: string
  name_en: string | null
  group_count: number
  sort_order: number
  is_active: boolean | null
}

export type PickupGroupPresetRepRow = {
  id: string
  preset_id: string
  group_index: number
  representative_hotel_id: string | null
}

export type PickupGroupPresetWithReps = PickupGroupPresetRow & {
  representatives: PickupGroupPresetRepRow[]
}

export type PickupResolveContext = {
  /** 레거시: 프리셋 없이 전 그룹 대표 픽업 */
  useRepresentativePickup?: boolean
  preset?: PickupGroupPresetWithReps | null
  groupModeOverrides?: Record<string, PickupGroupMode>
  /** 투어별 그룹 대표 호텔 (프리셋·자동 추론보다 우선) */
  groupRepresentativeOverrides?: Record<string, string>
}

export function normalizeGroupModeOverrides(
  raw: unknown
): Record<string, PickupGroupMode> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, PickupGroupMode> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value === 'representative' || value === 'requested') {
      out[String(key)] = value
    }
  }
  return out
}

export function normalizeGroupRepresentativeOverrides(
  raw: unknown
): Record<string, string> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'string' && value.trim()) {
      out[String(key)] = value.trim()
    }
  }
  return out
}

export function getMainGroupFromHotelId(
  hotelId: string | null | undefined,
  pickupHotels: PickupHotel[]
): number | null {
  if (!hotelId) return null
  const hotel = pickupHotels.find((h) => h.id === hotelId)
  if (hotel?.group_number == null) return null
  return Math.floor(hotel.group_number)
}

export function getRepresentativeHotelIdFromPreset(
  mainGroup: number,
  preset: PickupGroupPresetWithReps | null | undefined
): string | null {
  if (!preset) return null
  const row = preset.representatives.find((r) => r.group_index === mainGroup)
  return row?.representative_hotel_id ?? null
}

export function getPickupModeForGroup(
  mainGroup: number,
  context: PickupResolveContext
): PickupGroupMode {
  const override = context.groupModeOverrides?.[String(mainGroup)]
  if (override) return override

  if (context.preset) {
    if (mainGroup < 1 || mainGroup > context.preset.group_count) {
      return 'requested'
    }
    return 'representative'
  }

  if (context.useRepresentativePickup) {
    return 'representative'
  }

  return 'requested'
}

export function buildPickupResolveContextFromTour(
  tour: {
    use_representative_pickup?: boolean | null
    pickup_group_preset_id?: string | null
    pickup_group_mode_overrides?: unknown
    pickup_group_representative_overrides?: unknown
  },
  preset?: PickupGroupPresetWithReps | null
): PickupResolveContext {
  const presetId = tour.pickup_group_preset_id ?? null
  return {
    useRepresentativePickup: tour.use_representative_pickup === true,
    preset: presetId && preset?.id === presetId ? preset : presetId ? preset ?? null : null,
    groupModeOverrides: normalizeGroupModeOverrides(tour.pickup_group_mode_overrides),
    groupRepresentativeOverrides: normalizeGroupRepresentativeOverrides(
      tour.pickup_group_representative_overrides
    ),
  }
}

export function resolvePickupContext(
  input: PickupResolveContext | boolean | undefined
): PickupResolveContext {
  if (typeof input === 'boolean') {
    return { useRepresentativePickup: input }
  }
  return input ?? {}
}

export function getEffectivePickupHotelId(
  requestedHotelId: string | null | undefined,
  pickupHotels: PickupHotel[],
  contextInput?: PickupResolveContext | boolean
): string | null {
  if (!requestedHotelId) return null

  const context = resolvePickupContext(contextInput)
  const requestedHotel = pickupHotels.find((h) => h.id === requestedHotelId)
  const mainGroup = getMainGroupFromHotelId(requestedHotelId, pickupHotels)

  const mode =
    mainGroup != null
      ? getPickupModeForGroup(mainGroup, context)
      : context.preset || context.useRepresentativePickup
        ? 'representative'
        : 'requested'

  if (mode === 'requested') {
    return requestedHotelId
  }

  if (mainGroup != null) {
    const tourRep = context.groupRepresentativeOverrides?.[String(mainGroup)]
    if (tourRep) return tourRep
  }

  if (mainGroup != null && context.preset) {
    const fromPreset = getRepresentativeHotelIdFromPreset(mainGroup, context.preset)
    if (fromPreset) return fromPreset
    if (mainGroup > context.preset.group_count) {
      return requestedHotelId
    }
  }

  if (!requestedHotel?.group_number) {
    return requestedHotelId
  }

  const representative = findRoundedGroupHotel(requestedHotel.group_number, pickupHotels)
  return representative?.id ?? requestedHotelId
}

export function formatPickupHotelDisplayLine(
  hotelId: string | null | undefined,
  pickupHotels: Array<{ id: string; hotel: string; pick_up_location?: string | null }>
): string | null {
  if (!hotelId) return null
  const hotel = pickupHotels.find((h) => h.id === hotelId)
  if (!hotel) return null
  const parts = [hotel.hotel, hotel.pick_up_location].filter(Boolean)
  return parts.length > 0 ? parts.join(' | ') : null
}

/** 그룹의 대표 픽업 호텔 ID (프리셋 → group_number 기준 fallback) */
export function getGroupRepresentativeHotelId(
  mainGroup: number,
  pickupHotels: PickupHotel[],
  context: PickupResolveContext,
  sampleRequestedHotelId?: string | null
): string | null {
  const tourRep = context.groupRepresentativeOverrides?.[String(mainGroup)]
  if (tourRep) return tourRep

  if (context.preset) {
    const fromPreset = getRepresentativeHotelIdFromPreset(mainGroup, context.preset)
    if (fromPreset) return fromPreset
    if (mainGroup > context.preset.group_count) return null
  }

  if (sampleRequestedHotelId) {
    const requested = pickupHotels.find((h) => h.id === sampleRequestedHotelId)
    if (requested?.group_number != null) {
      const rep = findRoundedGroupHotel(requested.group_number, pickupHotels)
      if (rep) return rep.id
    }
  }

  const inGroup = pickupHotels.filter(
    (h) => h.group_number != null && Math.floor(h.group_number) === mainGroup
  )
  if (inGroup.length > 0) {
    const minGn = Math.min(...inGroup.map((h) => h.group_number!))
    const rep = findRoundedGroupHotel(minGn, pickupHotels)
    if (rep) return rep.id
  }

  return null
}

export function isPickupRedirected(
  requestedHotelId: string | null | undefined,
  pickupHotels: PickupHotel[],
  contextInput?: PickupResolveContext | boolean
): boolean {
  if (!requestedHotelId) return false
  const effectiveId = getEffectivePickupHotelId(requestedHotelId, pickupHotels, contextInput)
  return !!effectiveId && effectiveId !== requestedHotelId
}

export async function fetchActivePickupGroupPresets(
  db: SupabaseClient
): Promise<PickupGroupPresetRow[]> {
  const { data, error } = await db
    .from('pickup_group_presets')
    .select('id, name_ko, name_en, group_count, sort_order, is_active')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name_ko', { ascending: true })

  if (error) {
    console.error('[fetchActivePickupGroupPresets]', error)
    return []
  }
  return (data ?? []) as PickupGroupPresetRow[]
}

export async function fetchPickupGroupPresetWithReps(
  db: SupabaseClient,
  presetId: string
): Promise<PickupGroupPresetWithReps | null> {
  const { data: preset, error: presetError } = await db
    .from('pickup_group_presets')
    .select('id, name_ko, name_en, group_count, sort_order, is_active')
    .eq('id', presetId)
    .maybeSingle()

  if (presetError || !preset) {
    if (presetError) console.error('[fetchPickupGroupPresetWithReps]', presetError)
    return null
  }

  const { data: reps, error: repsError } = await db
    .from('pickup_group_preset_representatives')
    .select('id, preset_id, group_index, representative_hotel_id')
    .eq('preset_id', presetId)
    .order('group_index', { ascending: true })

  if (repsError) {
    console.error('[fetchPickupGroupPresetWithReps reps]', repsError)
    return null
  }

  return {
    ...(preset as PickupGroupPresetRow),
    representatives: (reps ?? []) as PickupGroupPresetRepRow[],
  }
}

export function presetDisplayName(
  preset: PickupGroupPresetRow,
  locale: string
): string {
  if (locale === 'en' && preset.name_en) return preset.name_en
  return preset.name_ko
}

/** 현재 pickup_hotels 정수 group_number 대표 호텔로 프리셋 대표 슬롯 채우기 */
export function inferRepresentativesFromHotels(
  groupCount: number,
  hotels: PickupHotel[]
): Record<number, string | null> {
  const result: Record<number, string | null> = {}
  for (let i = 1; i <= groupCount; i++) {
    const rep = hotels.find(
      (h) =>
        h.group_number != null &&
        Number.isInteger(h.group_number) &&
        h.group_number === i &&
        h.is_active !== false
    )
    result[i] = rep?.id ?? null
  }
  return result
}

export async function fetchPickupHotelsCatalog(db: SupabaseClient): Promise<PickupHotel[]> {
  const { data } = await db
    .from('pickup_hotels')
    .select('*')
    .eq('use_for_pickup', true)
    .or('is_active.is.null,is_active.eq.true')
  return (data ?? []) as PickupHotel[]
}

export async function loadPickupResolveContextForTour(
  db: SupabaseClient,
  tour: {
    use_representative_pickup?: boolean | null
    pickup_group_preset_id?: string | null
    pickup_group_mode_overrides?: unknown
    pickup_group_representative_overrides?: unknown
  }
): Promise<{ context: PickupResolveContext; hotelsCatalog: PickupHotel[] }> {
  let preset: PickupGroupPresetWithReps | null = null
  if (tour.pickup_group_preset_id) {
    preset = await fetchPickupGroupPresetWithReps(db, tour.pickup_group_preset_id)
  }
  const needsCatalog =
    !!tour.pickup_group_preset_id || tour.use_representative_pickup === true
  const hotelsCatalog = needsCatalog ? await fetchPickupHotelsCatalog(db) : []
  return {
    context: buildPickupResolveContextFromTour(tour, preset),
    hotelsCatalog,
  }
}
