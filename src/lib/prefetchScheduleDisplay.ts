import { supabase } from '@/lib/supabase'
import type { ScheduleDisplayDataPayload } from '@/lib/scheduleDisplayData'
import {
  getScheduleDisplayCacheKey,
  isScheduleDisplayCacheFresh,
  writeScheduleDisplayCache,
} from '@/lib/scheduleDisplayCache'

let inflightPrefetchKey: string | null = null

/** ScheduleView dynamic chunk — API 로딩과 병렬 다운로드 */
export function preloadScheduleViewChunk(): void {
  if (typeof window === 'undefined') return
  void import('@/components/schedule/ScheduleViewDisplay')
  void import('@/components/schedule/ScheduleDisplayAsidePanel')
  void import('@/components/schedule/ScheduleDisplayToolbar')
  void import('@/components/schedule/ScheduleProductGrid')
  void import('@/components/schedule/ScheduleProductGridRow')
  void import('@/components/schedule/ScheduleGuideGrid')
  void import('@/components/schedule/ScheduleGuideGridRow')
  void import('@/components/schedule/ScheduleMessageConfirmModals')
  void import('@/hooks/useScheduleViewData')
  void import('@/components/schedule/ScheduleVehicleGrid')
}

async function fetchScheduleDisplayFromApi(
  operatorId: string,
  displayDayCount: number,
): Promise<ScheduleDisplayDataPayload> {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token

  const params = new URLSearchParams({
    displayDayCount: String(Math.max(displayDayCount, 1)),
    operatorId,
  })

  const response = await fetch(`/api/admin/schedule-display?${params.toString()}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: 'no-store',
  })

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error || `HTTP ${response.status}`)
  }

  return (await response.json()) as ScheduleDisplayDataPayload
}

/** 투어 관리 등에서 hover 시 스케줄 디스플레이 데이터·JS 번들 미리 로드 */
export async function prefetchScheduleDisplayData(
  operatorId: string,
  displayDayCount = 15,
): Promise<void> {
  preloadScheduleViewChunk()

  const key = getScheduleDisplayCacheKey(operatorId, displayDayCount)
  if (isScheduleDisplayCacheFresh(key)) return
  if (inflightPrefetchKey === key) return

  inflightPrefetchKey = key
  try {
    const payload = await fetchScheduleDisplayFromApi(operatorId, displayDayCount)
    writeScheduleDisplayCache(key, payload)
  } catch (error) {
    console.warn('prefetchScheduleDisplayData failed:', error)
  } finally {
    if (inflightPrefetchKey === key) inflightPrefetchKey = null
  }
}

export { fetchScheduleDisplayFromApi }
