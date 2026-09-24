import { guideOfflineShellPaths } from '@/lib/guideAppShell'

let shellTask: Promise<void> | null = null
let shellLocale: string | null = null

async function waitForServiceWorkerControl(): Promise<void> {
  if (navigator.serviceWorker.controller) return
  await new Promise<void>((resolve) => {
    const timer = window.setTimeout(resolve, 4000)
    navigator.serviceWorker.addEventListener(
      'controllerchange',
      () => {
        window.clearTimeout(timer)
        resolve()
      },
      { once: true },
    )
  })
}

/**
 * 프로덕션에서만 서비스워커를 등록하고, 가이드 홈·자료 화면 HTML을 기기에 남긴다.
 * 개발 서버는 서비스워커를 끄므로 여기서도 등록하지 않는다.
 */
export function registerGuideAppShell(locale: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (process.env.NODE_ENV !== 'production') return Promise.resolve()
  if (!('serviceWorker' in navigator)) return Promise.resolve()
  if (shellTask && shellLocale === locale) return shellTask

  shellLocale = locale
  shellTask = (async () => {
    await navigator.serviceWorker.register('/sw.js', { scope: '/' })
    await navigator.serviceWorker.ready
    await waitForServiceWorkerControl()
    if (!navigator.onLine || !navigator.serviceWorker.controller) return

    await Promise.all(
      guideOfflineShellPaths(locale).map((path) =>
        fetch(path, {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'reload',
          headers: { Accept: 'text/html' },
        }).catch(() => undefined),
      ),
    )
  })().catch((error) => {
    shellTask = null
    console.warn('[guide shell] register failed', error)
  })

  return shellTask
}
