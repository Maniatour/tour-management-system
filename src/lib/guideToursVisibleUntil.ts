import type { SupabaseClient } from '@supabase/supabase-js'
import dayjs from 'dayjs'
import { todayInLasVegas } from '@/lib/dailyReport/dateUtils'

/** shared_settings 키: 가이드 페이지에 이 날짜(포함)까지만 투어 표시 */
export const GUIDE_TOURS_VISIBLE_UNTIL_SETTING_KEY = 'guide_tours_visible_until'

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/

/** DB 저장 형태: 날짜 + 라스베이거스 기준 마지막 자동 연장일 */
export type GuideToursVisibleUntilSetting = {
  date: string
  lastAdvancedOn: string
}

/** YYYY-MM-DD만 허용. 그 외는 null */
export function normalizeGuideToursVisibleUntil(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === 'string') {
    const trimmed = value.trim().slice(0, 10)
    return YMD_RE.test(trimmed) ? trimmed : null
  }
  if (typeof value === 'object' && value !== null && 'date' in value) {
    return normalizeGuideToursVisibleUntil((value as { date?: unknown }).date)
  }
  return null
}

export function parseGuideToursVisibleUntilSetting(
  value: unknown,
): GuideToursVisibleUntilSetting | null {
  const date = normalizeGuideToursVisibleUntil(value)
  if (!date) return null

  let lastAdvancedOn: string | null = null
  if (typeof value === 'object' && value !== null && 'lastAdvancedOn' in value) {
    const raw = (value as { lastAdvancedOn?: unknown }).lastAdvancedOn
    if (typeof raw === 'string' && YMD_RE.test(raw.trim().slice(0, 10))) {
      lastAdvancedOn = raw.trim().slice(0, 10)
    }
  }

  return {
    date,
    // 레거시(문자열만) 또는 필드 없음 → 당일로 간주해 즉시 연장하지 않음
    lastAdvancedOn: lastAdvancedOn || todayInLasVegas(),
  }
}

/** 관리자가 마감일을 수동 지정할 때 저장 페이로드 */
export function buildGuideToursVisibleUntilSetting(
  date: string,
  lastAdvancedOn: string = todayInLasVegas(),
): GuideToursVisibleUntilSetting {
  return { date, lastAdvancedOn }
}

/**
 * 라스베이거스 달력 기준으로 lastAdvancedOn 이후 지난 일수만큼 date를 앞으로 민다.
 * (자정이 여러 번 지나도 cron이 밀리면 한꺼번에 보정)
 */
export function advanceGuideToursVisibleUntilSetting(
  current: GuideToursVisibleUntilSetting,
  todayLV: string = todayInLasVegas(),
): { setting: GuideToursVisibleUntilSetting; daysAdvanced: number } {
  const last = current.lastAdvancedOn
  const days = dayjs(todayLV).diff(dayjs(last), 'day')
  if (!Number.isFinite(days) || days <= 0) {
    return {
      setting: { date: current.date, lastAdvancedOn: last || todayLV },
      daysAdvanced: 0,
    }
  }

  return {
    setting: {
      date: dayjs(current.date).add(days, 'day').format('YYYY-MM-DD'),
      lastAdvancedOn: todayLV,
    },
    daysAdvanced: days,
  }
}

/**
 * 가이드에게 투어를 보여줄지 여부.
 * visibleUntil이 없으면 제한 없음.
 * 있으면 tour_date <= visibleUntil 인 경우만 표시 (마감일 당일 포함).
 */
export function isTourDateVisibleToGuide(
  tourDate: string | null | undefined,
  visibleUntil: string | null | undefined,
): boolean {
  if (!visibleUntil) return true
  const date = (tourDate || '').toString().trim().slice(0, 10)
  if (!YMD_RE.test(date)) return true
  return date <= visibleUntil
}

export function filterToursByGuideVisibleUntil<T extends { tour_date?: string | null }>(
  tours: T[],
  visibleUntil: string | null | undefined,
): T[] {
  if (!visibleUntil) return tours
  return tours.filter((t) => isTourDateVisibleToGuide(t.tour_date, visibleUntil))
}

/** 스케줄 그리드: 해당 일이 가이드 공개 마감일인지 */
export function isGuideVisibleUntilCutoffDay(
  dateString: string,
  visibleUntil: string | null | undefined,
): boolean {
  if (!visibleUntil) return false
  return dateString === visibleUntil
}

/** 마감일 열 오른쪽 빨간 세로선 */
export const GUIDE_VISIBLE_UNTIL_CUTOFF_LINE_CLASS =
  'relative after:absolute after:right-0 after:top-0 after:bottom-0 after:w-[3px] after:bg-red-600 after:z-[5] after:pointer-events-none'

export async function fetchGuideToursVisibleUntil(
  supabase: SupabaseClient,
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('shared_settings')
      .select('setting_value')
      .eq('setting_key', GUIDE_TOURS_VISIBLE_UNTIL_SETTING_KEY)
      .maybeSingle()

    if (error) {
      console.warn('guide_tours_visible_until load failed:', error.message)
      return null
    }
    return normalizeGuideToursVisibleUntil(data?.setting_value)
  } catch (e) {
    console.warn('guide_tours_visible_until load error:', e)
    return null
  }
}

/**
 * 서비스 롤로 마감일을 라스베이거스 자정(날짜 변경)만큼 자동 연장.
 * 설정이 없으면 no-op.
 */
export async function advanceGuideToursVisibleUntilInDb(
  supabase: SupabaseClient,
  updatedBy?: string | null,
): Promise<{
  skipped: boolean
  reason?: string
  previousDate?: string | null
  nextDate?: string | null
  daysAdvanced?: number
  todayLV?: string
}> {
  const todayLV = todayInLasVegas()

  const { data, error } = await supabase
    .from('shared_settings')
    .select('setting_value')
    .eq('setting_key', GUIDE_TOURS_VISIBLE_UNTIL_SETTING_KEY)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  if (!data?.setting_value) {
    return { skipped: true, reason: 'not_set', todayLV }
  }

  const parsed = parseGuideToursVisibleUntilSetting(data.setting_value)
  if (!parsed) {
    return { skipped: true, reason: 'invalid', todayLV }
  }

  // 레거시 문자열만 있던 경우: lastAdvancedOn을 오늘로 채워 저장만 하고 당일 연장은 하지 않음
  const wasLegacyString = typeof data.setting_value === 'string'
  const { setting, daysAdvanced } = advanceGuideToursVisibleUntilSetting(parsed, todayLV)

  const needsWrite =
    wasLegacyString ||
    daysAdvanced > 0 ||
    setting.lastAdvancedOn !==
      (typeof data.setting_value === 'object' &&
      data.setting_value !== null &&
      'lastAdvancedOn' in data.setting_value
        ? String((data.setting_value as { lastAdvancedOn?: unknown }).lastAdvancedOn || '')
        : '')

  if (!needsWrite) {
    return {
      skipped: true,
      reason: 'already_advanced_today',
      previousDate: parsed.date,
      nextDate: parsed.date,
      daysAdvanced: 0,
      todayLV,
    }
  }

  const payload: {
    setting_key: string
    setting_value: GuideToursVisibleUntilSetting
    updated_by?: string
  } = {
    setting_key: GUIDE_TOURS_VISIBLE_UNTIL_SETTING_KEY,
    setting_value: setting,
  }
  if (updatedBy) payload.updated_by = updatedBy

  const { error: upsertError } = await supabase.from('shared_settings').upsert(payload, {
    onConflict: 'setting_key',
  })

  if (upsertError) {
    throw new Error(upsertError.message)
  }

  return {
    skipped: false,
    previousDate: parsed.date,
    nextDate: setting.date,
    daysAdvanced,
    todayLV,
  }
}
