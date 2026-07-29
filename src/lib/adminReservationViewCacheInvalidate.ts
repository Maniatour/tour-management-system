/**
 * 예약 관리 뷰 sessionStorage 스냅샷 무효화 (생성/수정/취소 후).
 */

import { invalidateAdminReservationPricingMemory } from '@/lib/adminReservationPricingMemoryCache'
import { invalidateAdminReservationOptionsPresenceMemory } from '@/lib/adminReservationOptionsPresenceMemoryCache'
import { invalidateAdminReservationChoicesMemory } from '@/lib/adminReservationChoicesMemoryCache'

const VIEW_CACHE_PREFIXES = [
  'admin-reservation-list-page\u001f',
  'admin-reservation-card-week\u001f',
  'admin-reservation-calendar\u001f',
  'admin-reservation-stats-core\u001f',
  'admin-reservation-op-queue\u001f',
  'ytd-weekday-avg\u001f',
  'week-daily-reg\u001f',
]

export function invalidateAdminReservationViewCaches(opts?: {
  clearPricingMemory?: boolean
}): void {
  if (typeof sessionStorage !== 'undefined') {
    const toRemove: string[] = []
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i)
      if (!key) continue
      if (VIEW_CACHE_PREFIXES.some((p) => key.startsWith(p))) {
        toRemove.push(key)
      }
    }
    for (const key of toRemove) {
      try {
        sessionStorage.removeItem(key)
      } catch {
        /* ignore */
      }
    }
  }
  if (opts?.clearPricingMemory !== false) {
    invalidateAdminReservationPricingMemory()
    invalidateAdminReservationOptionsPresenceMemory()
    invalidateAdminReservationChoicesMemory()
  }
}
