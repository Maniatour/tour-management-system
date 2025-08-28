'use client'

import { useTranslations, useLocale } from 'next-intl'
import { usePathname } from 'next/navigation'
import LanguageSwitcher from './LanguageSwitcher'

const Navigation = () => {
  const t = useTranslations('common')
  const pathname = usePathname()
  const locale = useLocale()
  
  // Admin 페이지에서는 네비게이션을 숨김
  if (pathname.startsWith(`/${locale}/admin`)) {
    return null
  }

  return (
    <nav className="bg-white shadow-lg border-b relative z-50">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* 로고 및 제목 */}
          <div className="flex items-center space-x-4">
            <h1 className="text-lg md:text-xl font-bold text-gray-800">
              {t('systemTitle')}
            </h1>
          </div>
          
          {/* 우측 영역 (언어 전환) */}
          <div className="flex items-center space-x-2">
            <LanguageSwitcher />
          </div>
        </div>
      </div>
    </nav>
  )
}

export default Navigation
