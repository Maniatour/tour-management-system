const DEV_SW_CLEANUP_LOCK_KEY = 'tms-dev-sw-cleanup-lock'
const DEV_SW_CLEANUP_LOCK_MS = 3000

function isStalePrecacheCacheName(name: string): boolean {
  return /workbox|serwist|precache/i.test(name)
}

/**
 * next dev: 이전 production 빌드의 SW·프리캐시만 제거한다.
 * SW/캐시가 없으면 아무 것도 하지 않아 다른 탭의 청크·HMR 연결을 건드리지 않는다.
 */
export async function cleanupDevServiceWorkerIfStale(): Promise<void> {
  if (typeof window === 'undefined' || process.env.NODE_ENV !== 'development') return

  let registrations: readonly ServiceWorkerRegistration[] = []
  let staleCacheNames: string[] = []

  if ('serviceWorker' in navigator) {
    try {
      registrations = await navigator.serviceWorker.getRegistrations()
    } catch {
      /* ignore */
    }
  }

  if (typeof caches !== 'undefined') {
    try {
      const keys = await caches.keys()
      staleCacheNames = keys.filter(isStalePrecacheCacheName)
    } catch {
      /* ignore */
    }
  }

  if (registrations.length === 0 && staleCacheNames.length === 0) return

  try {
    const lockRaw = localStorage.getItem(DEV_SW_CLEANUP_LOCK_KEY)
    const lockTs = lockRaw ? Number(lockRaw) : 0
    if (lockTs && Date.now() - lockTs < DEV_SW_CLEANUP_LOCK_MS) return
    localStorage.setItem(DEV_SW_CLEANUP_LOCK_KEY, String(Date.now()))
  } catch {
    /* ignore */
  }

  try {
    if (registrations.length > 0) {
      await Promise.all(registrations.map((r) => r.unregister()))
    }
    if (staleCacheNames.length > 0) {
      await Promise.all(staleCacheNames.map((k) => caches.delete(k)))
    }
  } catch {
    /* ignore */
  } finally {
    try {
      localStorage.removeItem(DEV_SW_CLEANUP_LOCK_KEY)
    } catch {
      /* ignore */
    }
  }
}
