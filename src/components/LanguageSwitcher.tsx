'use client'

import { useLocale } from 'next-intl'
import { usePathname } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import ReactCountryFlag from 'react-country-flag'

const LanguageSwitcher = () => {
  const locale = useLocale()
  const pathname = usePathname()

  const handleLanguageToggle = () => {
    const newLocale = locale === 'ko' ? 'en' : 'ko'
    const newPath = pathname.replace(`/${locale}`, `/${newLocale}`)
    window.location.href = newPath
  }

  return (
    <button
      onClick={handleLanguageToggle}
      className="flex items-center space-x-1 text-gray-600 hover:text-gray-900 transition-colors p-1 rounded-md hover:bg-gray-100"
      title={`Switch to ${locale === 'ko' ? 'English' : '한국어'}`}
    >
      <ReactCountryFlag 
        countryCode={locale === 'ko' ? 'KR' : 'US'} 
        svg 
        style={{ width: '20px', height: '15px' }}
      />
      <ChevronDown className="w-4 h-4" />
    </button>
  )
}

export default LanguageSwitcher
