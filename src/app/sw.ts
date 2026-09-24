import { defaultCache } from '@serwist/next/worker'
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist'
import { disableNavigationPreload, Serwist } from 'serwist'
import { GUIDE_SHELL_CACHE, guideShellCacheUrl, isGuideAppPathname } from '../lib/guideAppShell'

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: ServiceWorkerGlobalScope

const STAFF_APP_PATH =
  /^\/(ko|en|ja|zh-CN|zh-TW|es|fr|de)\/(admin|dashboard|guide)(\/|$)/

/** 관리자·대시보드. 가이드는 오프라인 셸 캐시를 쓰므로 여기서 제외한다. */
function isStaffAppPath(url: URL): boolean {
  return STAFF_APP_PATH.test(url.pathname) && !isGuideAppPathname(url.pathname)
}

function guideShellKind(request: Request): 'skip' | 'html' | 'rsc' {
  if (request.headers.get('Next-Router-Prefetch') === '1') return 'skip'
  if (request.headers.get('RSC') === '1') return 'rsc'
  return 'html'
}

/**
 * 가이드 화면은 온라인이면 최신 HTML을 받고, 연결이 없으면 마지막으로 연 화면을 연다.
 * 사진·나레이션 데이터는 IndexedDB에 있고, 이 캐시는 그 화면을 다시 그리는 껍데기만 담당한다.
 */
async function handleGuideAppShell(options: {
  request: Request
  event?: ExtendableEvent
}): Promise<Response> {
  const kind = guideShellKind(options.request)
  const cache = await caches.open(GUIDE_SHELL_CACHE)
  const cacheKey = new Request(guideShellCacheUrl(options.request.url, kind === 'rsc' ? 'rsc' : 'html'))

  const response = await handleNetworkOnlySafe(options)
  const contentType = response.headers.get('content-type') || ''
  const matchesKind =
    kind === 'html'
      ? contentType.includes('text/html')
      : kind === 'rsc'
        ? contentType.includes('text/x-component')
        : false

  if (kind !== 'skip' && options.request.method === 'GET' && response.ok && matchesKind) {
    try {
      // 리다이렉트를 따라간 응답은 Cache API에 그대로 넣을 수 없다.
      const forCache = response.redirected
        ? new Response(response.clone().body, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
          })
        : response.clone()
      await cache.put(cacheKey, forCache)
    } catch {
      // 용량 초과·불투명 응답은 네트워크 응답만 반환
    }
    return response
  }

  if (response.status === 504 && kind !== 'skip') {
    const cached = await cache.match(cacheKey)
    if (cached) return cached
    if (options.request.mode === 'navigate' || options.request.destination === 'document') {
      const offline = await caches.match('/~offline')
      if (offline) return offline
    }
  }

  return response
}

function isPublicSharePath(url: URL): boolean {
  return (
    url.pathname.startsWith('/chat/') ||
    url.pathname.startsWith('/photos/') ||
    url.pathname.startsWith('/waiver/')
  )
}

function cloneNavigateResponse(response: Response): Response {
  if (!response.redirected) return response
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  })
}

/**
 * Strategy(NetworkOnly/NetworkFirst)를 거치지 않고 fetch만 사용.
 * NetworkOnly.handle()은 실패 시 done 프라미스가 Uncaught no-response를 남길 수 있음.
 * 리다이렉트된 navigate 응답은 Chrome SW 제약으로 재구성.
 *
 * 과거 SW가 navigation preload를 켠 채로 남아 있으면 Chrome이 preload 요청을 시작하는데,
 * 여기서 preloadResponse를 기다리지 않으면 콘솔 경고가 난다.
 */
async function handleNetworkOnlySafe(options: {
  request: Request
  event?: ExtendableEvent
}): Promise<Response> {
  try {
    if (
      options.request.mode === 'navigate' &&
      options.event instanceof FetchEvent &&
      'preloadResponse' in options.event
    ) {
      try {
        const preload = (await options.event.preloadResponse) as Response | undefined
        if (preload) return cloneNavigateResponse(preload)
      } catch {
        // preload 실패 시 일반 fetch로 계속
      }
    }

    const response = await fetch(options.request)
    if (options.request.mode === 'navigate') {
      return cloneNavigateResponse(response)
    }
    return response
  } catch {
    return new Response('', {
      status: 504,
      statusText: 'Gateway Timeout',
      headers: { 'Cache-Control': 'no-store' },
    })
  }
}

// Serwist는 navigationPreload:false 일 때 enable만 생략하고, 이전 SW가 켠 preload는 끄지 않음
disableNavigationPreload()

// Push 알림 (기존 public/sw.js 동작 유지)
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {}
  const title = data.title || '새 메시지'
  const options = {
    body: data.body || '새로운 채팅 메시지가 도착했습니다',
    icon: data.icon || '/images/logo.png',
    badge: data.badge || '/images/logo.png',
    tag: data.tag || 'chat-message',
    data: data.data || {},
    requireInteraction: false,
    ...(Array.isArray(data.actions) && data.actions.length > 0 ? { actions: data.actions } : {}),
  }

  event.waitUntil(self.registration.showNotification(title, options as NotificationOptions))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const urlToOpen = (event.notification.data as { url?: string } | undefined)?.url || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i]
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus()
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen)
      }
      return undefined
    }),
  )
})

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST ?? [],
  skipWaiting: true,
  clientsClaim: true,
  // 켜지 않음. 과거 등록분 해제는 상단 disableNavigationPreload()가 activate에서 처리
  navigationPreload: false,
  // 공개 투어 채팅(/chat/[code])·사진·면책 서명·직원 앱은 런타임 캐시(NetworkFirst)와 맞지 않음
  // → 네트워크만 사용하고 실패 시에도 promise reject 금지
  runtimeCaching: [
    {
      matcher({ url }) {
        return url.pathname.startsWith('/api/')
      },
      handler: handleNetworkOnlySafe,
    },
    {
      matcher({ url, request }) {
        if (!isPublicSharePath(url)) return false
        return request.mode === 'navigate' || request.destination === 'document'
      },
      handler: handleNetworkOnlySafe,
    },
    {
      matcher({ url, sameOrigin, request }) {
        return sameOrigin && request.method === 'GET' && isGuideAppPathname(url.pathname)
      },
      handler: handleGuideAppShell,
    },
    {
      matcher({ url, sameOrigin }) {
        return sameOrigin && isStaffAppPath(url)
      },
      handler: handleNetworkOnlySafe,
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: '/~offline',
        matcher({ request }) {
          return request.destination === 'document'
        },
      },
    ],
  },
})

serwist.addEventListeners()
