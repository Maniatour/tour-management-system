/**
 * 차량 정비 주기 프리셋
 * - standard: 카탈로그 default_mileage_interval 그대로
 * - tour_highway_severe: 장거리 하이웨이 투어 (~700mi/일) — 주기 단축
 * - city_mixed: 시내·혼합 주행 — 표준 대비 약간 단축
 */

export const MAINTENANCE_DUTY_PRESET_IDS = [
  'standard',
  'tour_highway_severe',
  'city_mixed',
] as const

export type MaintenanceDutyPresetId = (typeof MAINTENANCE_DUTY_PRESET_IDS)[number]

export type MaintenanceDutyPresetMeta = {
  id: MaintenanceDutyPresetId
  labelKo: string
  labelEn: string
  descriptionKo: string
  descriptionEn: string
  dueSoonMiles: number
  /** 카탈로그에 명시 override 없을 때 standard 마일 주기에 곱할 값 */
  mileageFallbackMultiplier: number
  monthFallbackMultiplier: number
}

export const MAINTENANCE_DUTY_PRESETS: Record<MaintenanceDutyPresetId, MaintenanceDutyPresetMeta> = {
  standard: {
    id: 'standard',
    labelKo: '일반 (카탈로그 기본)',
    labelEn: 'Standard (catalog default)',
    descriptionKo: '제조사·카탈로그 기본 마일리지 주기',
    descriptionEn: 'Manufacturer / catalog default intervals',
    dueSoonMiles: 500,
    mileageFallbackMultiplier: 1,
    monthFallbackMultiplier: 1,
  },
  tour_highway_severe: {
    id: 'tour_highway_severe',
    labelKo: '투어 하이웨이 심한 조건',
    labelEn: 'Tour highway (severe duty)',
    descriptionKo: '일 700mi급 장거리 하이웨이 투어 — 정비 주기 단축',
    descriptionEn: '~700 mi/day highway tours — shortened service intervals',
    dueSoonMiles: 700,
    mileageFallbackMultiplier: 0.6,
    monthFallbackMultiplier: 0.7,
  },
  city_mixed: {
    id: 'city_mixed',
    labelKo: '시내·혼합',
    labelEn: 'City / mixed',
    descriptionKo: '시내·혼합 주행 — 표준보다 약간 짧은 주기',
    descriptionEn: 'City and mixed driving — slightly shorter than standard',
    dueSoonMiles: 400,
    mileageFallbackMultiplier: 0.85,
    monthFallbackMultiplier: 0.85,
  },
}

/** 투어 하이웨이 심한 조건 — 항목별 마일 주기 override (mi) */
const TOUR_HIGHWAY_MILEAGE_OVERRIDES: Record<string, number> = {
  engine_oil: 5000,
  oil_filter: 5000,
  tire_rotation: 4000,
  tire_balance: 8000,
  tread_depth_inspection: 4000,
  multi_point_inspection: 4000,
  pre_trip_inspection: 2000,
  brake_pad: 18000,
  brake_rotors: 35000,
  brake_fluid_flush: 20000,
  air_filter: 12000,
  cabin_filter: 12000,
  fuel_filter: 20000,
  coolant_flush: 40000,
  transmission_fluid: 40000,
  transmission_filter: 30000,
  differential_fluid: 40000,
  serpentine_belt_set: 40000,
  belt_tensioner: 40000,
  idler_pulley: 40000,
  def_fluid_service: 10000,
  dpf_regeneration_check: 10000,
  turbo_play_check: 20000,
  injector_balance: 40000,
  compression_test: 35000,
  alignment: 8000,
  windshield_wiper: 8000,
  battery: 40000,
  auxiliary_battery: 40000,
  glow_plug: 60000,
  turbocharger_service: 40000,
  turbo_resonator_replacement: 50000,
  rear_drum_brake: 20000,
  air_tank_drain: 3000,
  air_brake_lining_inspection: 15000,
  brake_lining_thickness: 15000,
  fluid_leak_inspection: 4000,
  steering_play_inspection: 8000,
  suspension_play_inspection: 8000,
}

/** 시내·혼합 — 주요 항목만 약간 단축 */
const CITY_MIXED_MILEAGE_OVERRIDES: Record<string, number> = {
  engine_oil: 7000,
  brake_pad: 22000,
  tire_rotation: 5000,
}

function presetMileageOverrides(
  preset: MaintenanceDutyPresetId
): Record<string, number> | null {
  if (preset === 'tour_highway_severe') return TOUR_HIGHWAY_MILEAGE_OVERRIDES
  if (preset === 'city_mixed') return CITY_MIXED_MILEAGE_OVERRIDES
  return null
}

export function normalizeMaintenanceDutyPreset(
  value: string | null | undefined
): MaintenanceDutyPresetId {
  const v = (value ?? '').trim() as MaintenanceDutyPresetId
  if (MAINTENANCE_DUTY_PRESET_IDS.includes(v)) return v
  return 'standard'
}

export function maintenanceDutyPresetMeta(
  preset: string | null | undefined
): MaintenanceDutyPresetMeta {
  return MAINTENANCE_DUTY_PRESETS[normalizeMaintenanceDutyPreset(preset)]
}

export function resolvePresetMileageInterval(params: {
  catalogCode: string
  catalogDefaultMileage: number | null
  preset: string | null | undefined
}): number | null {
  const presetId = normalizeMaintenanceDutyPreset(params.preset)
  if (presetId === 'standard') return params.catalogDefaultMileage

  const meta = MAINTENANCE_DUTY_PRESETS[presetId]
  const overrides = presetMileageOverrides(presetId)
  const explicit = overrides?.[params.catalogCode]
  if (explicit != null && explicit > 0) return explicit

  if (params.catalogDefaultMileage == null || params.catalogDefaultMileage <= 0) {
    return null
  }

  return Math.max(500, Math.round(params.catalogDefaultMileage * meta.mileageFallbackMultiplier))
}

export function resolvePresetMonthInterval(params: {
  catalogDefaultMonths: number | null
  preset: string | null | undefined
}): number | null {
  const presetId = normalizeMaintenanceDutyPreset(params.preset)
  if (presetId === 'standard') return params.catalogDefaultMonths
  if (params.catalogDefaultMonths == null || params.catalogDefaultMonths <= 0) return null
  const meta = MAINTENANCE_DUTY_PRESETS[presetId]
  return Math.max(1, Math.round(params.catalogDefaultMonths * meta.monthFallbackMultiplier))
}

/** 프리셋 선택 시 권장 엔진오일 주기 (mi) */
export function suggestedEngineOilCycleForPreset(
  preset: string | null | undefined,
  fuelType?: string | null
): number | null {
  const presetId = normalizeMaintenanceDutyPreset(preset)
  const isGasoline = (fuelType ?? '').trim().toLowerCase() === 'gasoline'
  if (presetId === 'tour_highway_severe') return isGasoline ? 7500 : 5000
  if (presetId === 'city_mixed') return isGasoline ? 8000 : 7000
  return null
}

export function dueSoonMilesForPreset(preset: string | null | undefined): number {
  return maintenanceDutyPresetMeta(preset).dueSoonMiles
}
