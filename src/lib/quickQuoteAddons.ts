export type QuickAddonId =
  | 'nonResident'
  | 'passPurchase'
  | 'gcHelicopter'
  | 'gcAircraft'
  | 'mvJeep'

export const QUICK_ADDON_IDS: QuickAddonId[] = [
  'nonResident',
  'passPurchase',
  'gcHelicopter',
  'gcAircraft',
  'mvJeep',
]

export const QUICK_ADDON_DEFAULT_RATES: Record<QuickAddonId, number> = {
  nonResident: 100,
  passPurchase: 250,
  gcHelicopter: 250,
  gcAircraft: 200,
  mvJeep: 90,
}

/** 인원 수에 맞춰 기본 수량을 잡을지 (패스 구매는 보통 1장) */
export const QUICK_ADDON_FOLLOWS_PARTICIPANTS: Record<QuickAddonId, boolean> = {
  nonResident: true,
  passPurchase: false,
  gcHelicopter: true,
  gcAircraft: true,
  mvJeep: true,
}

export const QUICK_ADDON_I18N_KEYS = {
  nonResident: 'quickAddonNonResident',
  passPurchase: 'quickAddonPassPurchase',
  gcHelicopter: 'quickAddonGcHelicopter',
  gcAircraft: 'quickAddonGcAircraft',
  mvJeep: 'quickAddonMvJeep',
} as const

export const QUICK_ADDON_RATES_STORAGE_KEY = 'tourCostCalculator.quickAddonRates'

export function defaultAddonQty(id: QuickAddonId, participantCount: number): number {
  if (QUICK_ADDON_FOLLOWS_PARTICIPANTS[id]) return Math.max(1, participantCount)
  return 1
}

export function calcQuickAddonLine(qty: number, rate: number): number {
  return Math.max(0, qty) * Math.max(0, rate)
}

export function loadQuickAddonRates(): Record<QuickAddonId, number> {
  const rates = { ...QUICK_ADDON_DEFAULT_RATES }
  if (typeof window === 'undefined') return rates
  try {
    const raw = window.localStorage.getItem(QUICK_ADDON_RATES_STORAGE_KEY)
    if (!raw) return rates
    const parsed = JSON.parse(raw) as Partial<Record<QuickAddonId, number>>
    for (const id of QUICK_ADDON_IDS) {
      const value = parsed[id]
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
        rates[id] = value
      }
    }
  } catch {
    return rates
  }
  return rates
}

export function persistQuickAddonRates(rates: Record<QuickAddonId, number>): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(QUICK_ADDON_RATES_STORAGE_KEY, JSON.stringify(rates))
}
