import { defaultCache } from '@serwist/next/worker'
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist'
import { disableNavigationPreload, Serwist } from 'serwist'

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: ServiceWorkerGlobalScope

const STAFF_APP_PATH =
  /^\/(ko|en|ja|zh-CN|zh-TW|es|fr|de)\/(admin|dashboard|guide)(\/|$)/

/** 직원·관리 화면 (HTML·RSC·프리페치 포함). defaultCache NetworkFirst가 캐시 미스+네트워크 실패 시 no-response를 throw함 */
function isStaffAppPath(url: URL): boolean {
  return STAFF_APP_PATH.test(url.pathname)
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
  // 공개 투어 채팅(/chat/[code])·직원 앱은 런타임 캐시(NetworkFirst)와 맞지 않음
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
        if (!url.pathname.startsWith('/chat/')) return false
        return request.mode === 'navigate' || request.destination === 'document'
      },
      handler: handleNetworkOnlySafe,
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
