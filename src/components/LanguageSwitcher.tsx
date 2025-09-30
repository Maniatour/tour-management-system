'use client'

import { useLocale } from 'next-intl'
import { usePathname, useRouter } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import ReactCountryFlag from 'react-country-flag'
import { useAuth } from '@/contexts/AuthContext'

const LanguageSwitcher = () => {
  const locale = useLocale()
  const pathname = usePathname()
  const router = useRouter()
  const { isSimulating, simulatedUser } = useAuth()

  const handleLanguageToggle = () => {
    const newLocale = locale === 'ko' ? 'en' : 'ko'
    
    // 현재 경로에서 언어 부분을 제거
    const pathWithoutLocale = pathname.replace(`/${locale}`, '') || '/'
    const newPath = `/${newLocale}${pathWithoutLocale}`
    
    // 시뮬레이션 상태 보존
    let simulationData = null
    if (isSimulating && simulatedUser) {
      simulationData = {
        email: simulatedUser.email,
        name_ko: simulatedUser.name_ko,
        position: simulatedUser.position,
        role: simulatedUser.role
      }
    }
    
    // 언어 관련 상태만 정리 (시뮬레이션 상태는 보존)
    localStorage.removeItem('locale')
    localStorage.removeItem('preferred-locale')
    
    // 시뮬레이션 상태 복원
    if (simulationData) {
      localStorage.setItem('positionSimulation', JSON.stringify(simulationData))
    }
    
    // 새로운 언어 설정 (쿠키만 설정)
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000; SameSite=Lax`
    
    // 디버깅을 위한 로그
    console.log('Language change:', { from: locale, to: newLocale, path: newPath })
    
    // Next.js 라우터를 사용하여 언어 변경 (한 번만 새로고침)
    router.push(newPath)
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
