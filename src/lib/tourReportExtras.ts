import { todayInLasVegas, toLasVegasDateKey, tomorrowInLasVegas } from '@/lib/dailyReport/dateUtils'

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

export function isEnglishTourReportLocale(locale: string): boolean {
  return locale === 'en' || locale.startsWith('en')
}

export function tourReportText(locale: string, ko: string, en: string): string {
  return isEnglishTourReportLocale(locale) ? en : ko
}

export const TOUR_REPORT_WEATHER_OPTIONS = [
  { value: 'sunny', icon: '☀️', ko: '맑음', en: 'Sunny' },
  { value: 'cloudy', icon: '☁️', ko: '흐림', en: 'Cloudy' },
  { value: 'rainy', icon: '🌧️', ko: '비', en: 'Rainy' },
  { value: 'snowy', icon: '❄️', ko: '눈', en: 'Snowy' },
  { value: 'windy', icon: '💨', ko: '바람', en: 'Windy' },
  { value: 'foggy', icon: '🌫️', ko: '안개', en: 'Foggy' },
] as const

export const TOUR_REPORT_MOOD_OPTIONS = [
  { value: 'excellent', icon: '😊', ko: '가장 좋음', en: 'Excellent', aliases: ['매우 좋음'] },
  { value: 'good', icon: '🙂', ko: '전반적 만족', en: 'Good', aliases: ['좋음'] },
  { value: 'average', icon: '😐', ko: '보통', en: 'Average' },
  { value: 'poor', icon: '😞', ko: '매우 불만', en: 'Poor', aliases: ['나쁨'] },
  { value: 'terrible', icon: '😢', ko: '가이드 불만', en: 'Terrible', aliases: ['매우 나쁨'] },
] as const

export const TOUR_REPORT_RATING_OPTIONS = [
  { value: 'excellent', icon: '⭐⭐⭐', ko: '우수', en: 'Excellent', aliases: ['매우 좋음'] },
  { value: 'good', icon: '⭐⭐', ko: '좋음', en: 'Good' },
  { value: 'average', icon: '⭐', ko: '보통', en: 'Average' },
  { value: 'poor', icon: '👎', ko: '나쁨', en: 'Poor' },
] as const

export const TOUR_REPORT_INCIDENT_OPTIONS = [
  { ko: '교통 지연', en: 'Traffic Delay' },
  { ko: '날씨 문제', en: 'Weather Issue' },
  { ko: '차량 고장', en: 'Vehicle Breakdown' },
  { ko: '건강 문제', en: 'Health Issue' },
  { ko: '사고', en: 'Accident' },
  { ko: '예약 오류', en: 'Booking Error' },
  { ko: '가이드 지연', en: 'Guide Delay' },
  { ko: '고객 불만', en: 'Customer Complaint' },
  { ko: '기타', en: 'Other' },
] as const

export const TOUR_REPORT_LOST_DAMAGE_OPTIONS = [
  { ko: '분실물 없음', en: 'No Lost Items' },
  { ko: '가방 분실', en: 'Bag Lost' },
  { ko: '휴대폰 분실', en: 'Phone Lost' },
  { ko: '카메라 분실', en: 'Camera Lost' },
  { ko: '차량 손상', en: 'Vehicle Damage' },
  { ko: '시설 손상', en: 'Facility Damage' },
  { ko: '기타 손상', en: 'Other Damage' },
] as const

type CodedLabelOption = {
  value: string
  icon: string
  ko: string
  en: string
  aliases?: readonly string[]
}

function findCodedLabelOption(
  options: readonly CodedLabelOption[],
  value: string
): CodedLabelOption | undefined {
  const needle = value.trim()
  if (!needle) return undefined
  const lower = needle.toLowerCase()
  return options.find(
    (option) =>
      option.value === lower ||
      option.ko === needle ||
      option.en.toLowerCase() === lower ||
      option.aliases?.some((alias) => alias === needle || alias.toLowerCase() === lower)
  )
}

export function displayWeatherOption(
  value: string | null | undefined,
  locale: string
): { icon: string; label: string } | null {
  const raw = String(value || '').trim()
  if (!raw) return null
  const option = findCodedLabelOption(TOUR_REPORT_WEATHER_OPTIONS, raw)
  if (!option) return { icon: '', label: raw }
  return {
    icon: option.icon,
    label: tourReportText(locale, option.ko, option.en),
  }
}

export function displayMoodOption(
  value: string | null | undefined,
  locale: string
): { icon: string; label: string } | null {
  const raw = String(value || '').trim()
  if (!raw) return null
  const option = findCodedLabelOption(TOUR_REPORT_MOOD_OPTIONS, raw)
  if (!option) return { icon: '', label: raw }
  return {
    icon: option.icon,
    label: tourReportText(locale, option.ko, option.en),
  }
}

export function displayRatingOption(
  value: string | null | undefined,
  locale: string
): { icon: string; label: string } | null {
  const raw = String(value || '').trim()
  if (!raw) return null
  const option = findCodedLabelOption(TOUR_REPORT_RATING_OPTIONS, raw)
  if (!option) return { icon: '', label: raw }
  return {
    icon: option.icon,
    label: tourReportText(locale, option.ko, option.en),
  }
}

function displayStoredBilingualValue(
  options: readonly { ko: string; en: string }[],
  value: string,
  locale: string
): string {
  const option = options.find((item) => item.ko === value || item.en === value)
  if (!option) return value
  return tourReportText(locale, option.ko, option.en)
}

export function displayIncidentLabel(value: string, locale: string): string {
  return displayStoredBilingualValue(TOUR_REPORT_INCIDENT_OPTIONS, value, locale)
}

export function displayLostDamageLabel(value: string, locale: string): string {
  return displayStoredBilingualValue(TOUR_REPORT_LOST_DAMAGE_OPTIONS, value, locale)
}

export function displayVehicleConditionLabel(value: string, locale: string): string {
  const opt = VEHICLE_CONDITION_OPTIONS.find(
    (o) => o.value === value || o.ko === value || o.en === value
  )
  if (!opt) return value
  return tourReportText(locale, opt.ko, opt.en)
}

export function displaySkipReasonLabel(value: string, locale: string): string {
  const opt = SKIP_REASON_OPTIONS.find(
    (o) => o.value === value || o.ko === value || o.en === value
  )
  if (!opt) return value
  return tourReportText(locale, opt.ko, opt.en)
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

/** 투어일 + 다음날(라스베이거스)까지 수정 가능. 날짜를 파싱못하면 막지 않음. */
export function isTourReportEditWindowClosed(tourDate: string | null | undefined): boolean {
  const key = toLasVegasDateKey(tourDate)
  if (!key) return false
  return todayInLasVegas() > tomorrowInLasVegas(key)
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
  return tourReportText(locale, TOUR_REPORT_NO_LOST_KO, TOUR_REPORT_NO_LOST_EN)
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
