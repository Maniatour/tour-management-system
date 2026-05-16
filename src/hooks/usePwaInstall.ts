'use client'

import { useCallback, useEffect, useRef } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type PwaInstallLanguage = 'ko' | 'en'

function ensureManifestLink() {
  if (typeof document === 'undefined') return
  let manifestLink = document.querySelector('link[rel="manifest"]')
  if (!manifestLink) {
    manifestLink = document.createElement('link')
    manifestLink.setAttribute('rel', 'manifest')
    manifestLink.setAttribute('href', '/manifest.json')
    document.head.appendChild(manifestLink)
  }
}

async function ensureServiceWorkerRegistered() {
  if (typeof window === 'undefined' || process.env.NODE_ENV !== 'production') return
  if (!('serviceWorker' in navigator)) return
  try {
    const registration = await navigator.serviceWorker.getRegistration()
    if (!registration) {
      await navigator.serviceWorker.register('/sw.js', { scope: '/' })
      await new Promise((r) => setTimeout(r, 1000))
    }
  } catch {
    /* ignore */
  }
}

function manualInstallAlerts(language: PwaInstallLanguage) {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
  const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent)
  const isAndroid = /Android/.test(navigator.userAgent)
  const isChrome = /Chrome/.test(navigator.userAgent)

  if (isIOS && isSafari) {
    alert(
      language === 'ko'
        ? 'Safari에서 공유 버튼(⬆️)을 누르고 "홈 화면에 추가"를 선택하세요.'
        : 'Tap the Share button (⬆️) in Safari and select "Add to Home Screen".',
    )
  } else if (isAndroid && isChrome) {
    alert(
      language === 'ko'
        ? 'Chrome 메뉴(⋮)를 열고 "홈 화면에 추가" 또는 "앱 설치"를 선택하세요.'
        : 'Open Chrome menu (⋮) and select "Add to Home Screen" or "Install App".',
    )
  } else {
    alert(
      language === 'ko'
        ? '브라우저 메뉴(⋮ 또는 ⚙️)를 열고 다음 옵션을 찾아주세요:\n\n• "홈 화면에 추가"\n• "앱 설치"\n• "Add to Home Screen"\n• "Install App"\n\n또는 주소창 오른쪽의 설치 아이콘을 클릭하세요.'
        : 'Open your browser menu (⋮ or ⚙️) and look for:\n\n• "Add to Home Screen"\n• "Install App"\n\nOr click the install icon on the right side of the address bar.',
    )
  }
}

/**
 * PWA 설치(또는 수동 안내). deferredPrompt는 ref로 보관해 클릭 시점의 최신 값을 사용합니다.
 */
export function usePwaInstall(options: {
  language: PwaInstallLanguage
  /** 수락 시 localStorage `pwa_install_url`에 저장할 경로 (보통 pathname) */
  getSavePathOnAccept: () => string
  /** 마운트 시 SW 등록 (채팅·관리자 등 설치 유도 화면) */
  registerServiceWorkerOnMount?: boolean
}) {
  const { language, getSavePathOnAccept, registerServiceWorkerOnMount = true } = options
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    if (registerServiceWorkerOnMount && process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      void navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => registration.update())
        .catch(() => {})
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      deferredPromptRef.current = e as BeforeInstallPromptEvent
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    ensureManifestLink()

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [registerServiceWorkerOnMount])

  const installOrGuide = useCallback(async () => {
    await ensureServiceWorkerRegistered()

    ensureManifestLink()
    await new Promise((r) => setTimeout(r, 300))

    const dp = deferredPromptRef.current
    if (!dp) {
      manualInstallAlerts(language)
      return
    }

    try {
      await dp.prompt()
      const { outcome } = await dp.userChoice
      deferredPromptRef.current = null

      if (outcome === 'accepted') {
        const path = getSavePathOnAccept()
        if (path.startsWith('/')) {
          localStorage.setItem('pwa_install_url', path)
        }
        alert(language === 'ko' ? '홈 화면에 추가되었습니다!' : 'Added to home screen!')
      }
    } catch {
      deferredPromptRef.current = null
      alert(
        language === 'ko'
          ? '설치 프롬프트를 표시할 수 없습니다. 브라우저 메뉴에서 직접 설치해주세요.'
          : 'Cannot show install prompt. Please install from your browser menu.',
      )
    }
  }, [getSavePathOnAccept, language])

  return { installOrGuide }
}
