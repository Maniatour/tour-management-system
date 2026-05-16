'use client'

import React, { useMemo } from 'react'
import { Download } from 'lucide-react'
import { usePwaInstall } from '@/hooks/usePwaInstall'

type AdminPwaInstallFabProps = {
  locale: string
}

/**
 * 모바일 관리자(lg 미만)에서만 표시. 홈 화면 추가 / 앱 설치 유도.
 */
export default function AdminPwaInstallFab({ locale }: AdminPwaInstallFabProps) {
  const language = locale === 'ko' ? 'ko' : 'en'

  const getSavePathOnAccept = useMemo(
    () => () => (typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}` : '/'),
    [],
  )

  const { installOrGuide } = usePwaInstall({
    language,
    getSavePathOnAccept,
    registerServiceWorkerOnMount: true,
  })

  const [isClient, setIsClient] = React.useState(false)
  const [isStandalone, setIsStandalone] = React.useState(false)

  React.useEffect(() => {
    setIsClient(true)
    setIsStandalone(window.matchMedia('(display-mode: standalone)').matches)
  }, [])

  if (!isClient || isStandalone) return null

  return (
    <div
      className="lg:hidden fixed right-3 z-[60] flex flex-col items-end gap-1"
      style={{ bottom: 'calc(var(--footer-height) + env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
    >
      <button
        type="button"
        onClick={() => void installOrGuide()}
        className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-800 shadow-md hover:bg-gray-50 active:bg-gray-100"
        aria-label={language === 'ko' ? '앱 설치 또는 홈 화면에 추가' : 'Install app or add to home screen'}
      >
        <Download size={16} className="text-blue-600 shrink-0" />
        <span>{language === 'ko' ? '앱 설치' : 'Install'}</span>
      </button>
    </div>
  )
}
