/** 같은 브라우저의 다른 창·탭, 같은 페이지의 다른 훅 인스턴스에 출퇴근 상태 변경을 알림 */

export const ATTENDANCE_CHANGED_EVENT = 'tms-attendance-changed'
export const ATTENDANCE_TAB_CHANNEL_NAME = 'tms-attendance-tab'
export const ATTENDANCE_CHANGED_STORAGE_KEY = 'tms-attendance-changed-at'

let channelSingleton: BroadcastChannel | null = null

function getAttendanceTabChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return null
  if (!channelSingleton) {
    channelSingleton = new BroadcastChannel(ATTENDANCE_TAB_CHANNEL_NAME)
  }
  return channelSingleton
}

export function dispatchAttendanceChanged(): void {
  if (typeof window === 'undefined') return

  window.dispatchEvent(new CustomEvent(ATTENDANCE_CHANGED_EVENT))

  try {
    localStorage.setItem(ATTENDANCE_CHANGED_STORAGE_KEY, String(Date.now()))
  } catch {
    // private mode 등
  }

  try {
    getAttendanceTabChannel()?.postMessage({ type: 'changed', at: Date.now() })
  } catch {
    // BroadcastChannel 미지원·차단
  }
}

export function subscribeAttendanceChanged(onChanged: () => void): () => void {
  if (typeof window === 'undefined') return () => {}

  const onCustom = () => onChanged()
  const onStorage = (event: StorageEvent) => {
    if (event.key === ATTENDANCE_CHANGED_STORAGE_KEY) onChanged()
  }
  const onMessage = () => onChanged()

  window.addEventListener(ATTENDANCE_CHANGED_EVENT, onCustom)
  window.addEventListener('storage', onStorage)
  const channel = getAttendanceTabChannel()
  channel?.addEventListener('message', onMessage)

  return () => {
    window.removeEventListener(ATTENDANCE_CHANGED_EVENT, onCustom)
    window.removeEventListener('storage', onStorage)
    channel?.removeEventListener('message', onMessage)
  }
}
