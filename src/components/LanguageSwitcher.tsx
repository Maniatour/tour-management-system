'use client'

import { useLocale } from 'next-intl'
import { useRouter, usePathname } from 'next/navigation'
import { Globe } from 'lucide-react'

const LanguageSwitcher = () => {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()

  const handleLanguageToggle = () => {
    const newLocale = locale === 'ko' ? 'en' : 'ko'
    const newPath = pathname.replace(`/${locale}`, `/${newLocale}`)
    router.push(newPath)
  }

  const getLanguageDisplay = () => {
    return locale === 'ko' ? '한국어' : 'English'
  }

  const getLanguageFlag = () => {
    return locale === 'ko' ? '🇰🇷' : '🇺🇸'
  }

  return (
    <div className="flex items-center space-x-3">
      <Globe size={16} className="text-gray-600" />
      <span className="text-sm font-medium text-gray-700">
        {getLanguageDisplay()}
      </span>
      <button
        onClick={handleLanguageToggle}
        className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200 transition-colors hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        title={`Switch to ${locale === 'ko' ? 'English' : '한국어'}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
          locale === 'ko' ? 'translate-x-1' : 'translate-x-6'
        }`} />
      </button>
    </div>
  )
}

export default LanguageSwitcher
