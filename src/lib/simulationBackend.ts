/** 브라우저에 저장된 시뮬레이션이 현재 Supabase 프로젝트와 일치하는지 판별할 때 사용 */

export const SIMULATION_END_BLOCK_MS = 60 * 60 * 1000

export const LAST_SUPABASE_URL_STORAGE_KEY = 'tms-supabase-url'

/** localStorage/sessionStorage JSON에만 붙이고 React state에는 넣지 않음 */
export const SIMULATION_BACKEND_META_FIELD = '_simulationBackendUrl' as const

export function getPublicSupabaseUrl(): string {
  return typeof process !== 'undefined' && process.env.NEXT_PUBLIC_SUPABASE_URL
    ? process.env.NEXT_PUBLIC_SUPABASE_URL
    : ''
}

export function isSimulationRecentlyEnded(now = Date.now()): boolean {
  if (typeof window === 'undefined') return false

  const endTimes: Array<string | null | undefined> = [
    localStorage.getItem('simulationEndTime'),
    sessionStorage.getItem('simulationEndTime'),
  ]

  const endCookie = document.cookie
    .split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith('simulation_end_time='))
  if (endCookie) {
    endTimes.push(endCookie.split('=')[1])
  }

  return endTimes.some((raw) => {
    if (!raw) return false
    const endTime = parseInt(raw, 10)
    return !isNaN(endTime) && now - endTime < SIMULATION_END_BLOCK_MS
  })
}

export function markSimulationEnded(): void {
  if (typeof window === 'undefined') return
  const endTime = Date.now()
  localStorage.setItem('simulationEndTime', endTime.toString())
  sessionStorage.setItem('simulationEndTime', endTime.toString())
  document.cookie = `simulation_end_time=${endTime}; path=/; max-age=86400; SameSite=Lax`
}

export function clearSimulationActiveStorage(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem('positionSimulation')
    sessionStorage.removeItem('positionSimulation')
    localStorage.removeItem('simulation_active')
    sessionStorage.removeItem('simulation_active')
    const cookiePaths = ['/', '/ko', '/en']
    for (const path of cookiePaths) {
      document.cookie = `simulation_active=; path=${path}; expires=Thu, 01 Jan 1970 00:00:00 GMT`
      document.cookie = `simulation_user=; path=${path}; expires=Thu, 01 Jan 1970 00:00:00 GMT`
    }
  } catch {
    /* ignore */
  }
}

export function clearSimulationBrowserStorage(): void {
  if (typeof window === 'undefined') return
  try {
    clearSimulationActiveStorage()
    localStorage.removeItem('simulationEndTime')
    sessionStorage.removeItem('simulationEndTime')
    const cookiePaths = ['/', '/ko', '/en']
    for (const path of cookiePaths) {
      document.cookie = `simulation_end_time=; path=${path}; expires=Thu, 01 Jan 1970 00:00:00 GMT`
    }
  } catch {
    /* ignore */
  }
}

/** 앱이 가리키는 Supabase URL이 바뀌었으면 이전 시뮬레이션 스냅샷을 제거 */
export function syncSimulationStorageWithCurrentBackend(): void {
  if (typeof window === 'undefined') return
  const current = getPublicSupabaseUrl()
  const last = localStorage.getItem(LAST_SUPABASE_URL_STORAGE_KEY)
  if (last && current && last !== current) {
    clearSimulationBrowserStorage()
  }
  if (current) {
    localStorage.setItem(LAST_SUPABASE_URL_STORAGE_KEY, current)
  }
}

export function withSimulationBackendMeta(payload: object): Record<string, unknown> {
  return {
    ...(payload as Record<string, unknown>),
    [SIMULATION_BACKEND_META_FIELD]: getPublicSupabaseUrl(),
  }
}

export function readSimulationBackendMeta(raw: Record<string, unknown>): string | undefined {
  const v = raw[SIMULATION_BACKEND_META_FIELD]
  return typeof v === 'string' ? v : undefined
}

export function stripSimulationBackendMeta(raw: Record<string, unknown>): Record<string, unknown> {
  const { [SIMULATION_BACKEND_META_FIELD]: _, ...rest } = raw
  return rest
}
