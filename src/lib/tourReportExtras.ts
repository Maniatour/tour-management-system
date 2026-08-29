export type SkippedStopEntry = {
  reason: string
  note: string
}

export type SkippedStopsMap = Record<string, SkippedStopEntry>

export const VEHICLE_CONDITION_OPTIONS = [
  { value: 'ok', ko: '이상 없음', en: 'No issues' },
  { value: 'needs_wash', ko: '세차 필요', en: 'Needs wash' },
  { value: 'low_fuel', ko: '연료 부족', en: 'Low fuel' },
  { value: 'warning_light', ko: '경고등', en: 'Warning light' },
  { value: 'exterior_damage', ko: '외관 손상', en: 'Exterior damage' },
  { value: 'interior_issue', ko: '실내 이상', en: 'Interior issue' },
  { value: 'ac_issue', ko: '에어컨/히터', en: 'AC / heater' },
  { value: 'tire_issue', ko: '타이어', en: 'Tire' },
  { value: 'other', ko: '기타', en: 'Other' },
] as const

export const SKIP_REASON_OPTIONS = [
  { value: 'weather', ko: '날씨', en: 'Weather' },
  { value: 'road_closed', ko: '도로 폐쇄', en: 'Road closed' },
  { value: 'time', ko: '시간 부족', en: 'Not enough time' },
  { value: 'guest', ko: '고객 컨디션', en: 'Guest condition' },
  { value: 'closed', ko: '운영 중단', en: 'Closed' },
  { value: 'traffic', ko: '교통 지연', en: 'Traffic' },
  { value: 'other', ko: '기타', en: 'Other' },
] as const

export function displayVehicleConditionLabel(value: string, locale: string): string {
  const opt = VEHICLE_CONDITION_OPTIONS.find((o) => o.value === value)
  if (!opt) return value
  return locale === 'en' ? opt.en : opt.ko
}

export function displaySkipReasonLabel(value: string, locale: string): string {
  const opt = SKIP_REASON_OPTIONS.find((o) => o.value === value)
  if (!opt) return value
  return locale === 'en' ? opt.en : opt.ko
}

export function parseSkippedStops(raw: unknown): SkippedStopsMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: SkippedStopsMap = {}
  for (const [id, entry] of Object.entries(raw as Record<string, unknown>)) {
    const key = String(id).trim()
    if (!key) continue
    if (typeof entry === 'string') {
      const note = entry.trim()
      if (note) out[key] = { reason: 'other', note }
      continue
    }
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue
    const rec = entry as { reason?: unknown; note?: unknown }
    out[key] = {
      reason: String(rec.reason ?? '').trim(),
      note: String(rec.note ?? '').trim(),
    }
  }
  return out
}

export function skippedStopsToSubstitutionNotes(
  skipped: SkippedStopsMap,
  locale: string
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [id, entry] of Object.entries(skipped)) {
    const reason = entry.reason ? displaySkipReasonLabel(entry.reason, locale) : ''
    const note = entry.note.trim()
    const text = [reason, note].filter(Boolean).join(' — ')
    if (text) out[id] = text
  }
  return out
}

export function parseIssuePhotoUrls(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.map((u) => String(u).trim()).filter((u) => u.startsWith('http'))
}
