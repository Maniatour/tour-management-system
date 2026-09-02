import { todayInLasVegas } from '@/lib/dailyReport/dateUtils'

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

/** 투어 리포트 필수 안내 시작일 (라스베이거스). 이 날짜 이전 미작성은 안내하지 않음. */
export const TOUR_REPORT_REQUIRED_FROM = '2026-09-01'

/** 필수 시작일부터 오늘까지. 시작일 이전이면 null. */
export function tourReportRequiredDateRange(): { from: string; to: string } | null {
  const to = todayInLasVegas()
  if (to < TOUR_REPORT_REQUIRED_FROM) return null
  return { from: TOUR_REPORT_REQUIRED_FROM, to }
}

/** 손글씨 PNG(data URL) 또는 업로드된 이미지 URL. 예전 텍스트 이름 서명과 구분. */
export function isTourReportSignatureImage(value: string | null | undefined): boolean {
  if (!value) return false
  const v = value.trim()
  return v.startsWith('data:image/') || /^https?:\/\//i.test(v)
}

export const TOUR_REPORT_NO_LOST_KO = '분실물 없음'
export const TOUR_REPORT_NO_LOST_EN = 'No Lost Items'

export function tourReportNoLostItemsLabel(locale: string): string {
  return locale === 'en' ? TOUR_REPORT_NO_LOST_EN : TOUR_REPORT_NO_LOST_KO
}

export function isTourReportNoLostItemsValue(value: string): boolean {
  return value === TOUR_REPORT_NO_LOST_KO || value === TOUR_REPORT_NO_LOST_EN
}

export type TourReportIssueSignals = {
  incidents_delays_health?: string[] | null
  lost_items_damage?: string[] | null
  vehicle_condition_tags?: string[] | null
  issue_photo_urls?: unknown
  skipped_stops?: unknown
  overall_mood?: string | null
  guest_comments?: string | null
  handoff_note?: string | null
  suggestions_followup?: string | null
  comments?: string | null
}

/** 사고·차량 이상·분실·스킵·사진·메모가 있으면 상세 작성 모드로 연다. */
export function inferTourReportHasIssues(data: TourReportIssueSignals | null | undefined): boolean {
  if (!data) return false
  if ((data.incidents_delays_health ?? []).some((item) => String(item).trim())) return true
  if ((data.lost_items_damage ?? []).some((item) => item && !isTourReportNoLostItemsValue(item))) {
    return true
  }
  if ((data.vehicle_condition_tags ?? []).some((tag) => tag && tag !== 'ok')) return true
  if (parseIssuePhotoUrls(data.issue_photo_urls).length > 0) return true
  if (Object.keys(parseSkippedStops(data.skipped_stops)).length > 0) return true
  if (data.overall_mood === 'poor' || data.overall_mood === 'terrible') return true
  if (data.guest_comments?.trim()) return true
  if (data.handoff_note?.trim()) return true
  if (data.suggestions_followup?.trim()) return true
  if (data.comments?.trim()) return true
  return false
}
