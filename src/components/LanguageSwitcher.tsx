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
    
    // 시뮬레이션 상태 보존 (더 안전한 방법)
    let simulationData = null
    if (isSimulating && simulatedUser) {
      simulationData = {
        email: simulatedUser.email,
        name_ko: simulatedUser.name_ko,
        name_en: simulatedUser.name_en,
        position: simulatedUser.position,
        role: simulatedUser.role
      }
      console.log('LanguageSwitcher: Preserving simulation data:', simulationData)
      
      // 시뮬레이션 상태를 먼저 저장 (페이지 이동 전에 확실히 저장)
      localStorage.setItem('positionSimulation', JSON.stringify(simulationData))
      console.log('LanguageSwitcher: Simulation data saved to localStorage')
      
      // 추가 안전장치: 쿠키에도 시뮬레이션 정보 저장
      document.cookie = `simulation_active=true; path=/; max-age=3600; SameSite=Lax`
      document.cookie = `simulation_user=${encodeURIComponent(JSON.stringify(simulationData))}; path=/; max-age=3600; SameSite=Lax`
    }
    
    // 언어 관련 상태만 정리 (시뮬레이션 상태는 보존)
    localStorage.removeItem('locale')
    localStorage.removeItem('preferred-locale')
    
    // 새로운 언어 설정 (쿠키만 설정)
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000; SameSite=Lax`
    
    // 디버깅을 위한 로그
    console.log('Language change:', { 
      from: locale, 
      to: newLocale, 
      path: newPath,
      isSimulating,
      simulationData: !!simulationData
    })
    
    // 페이지 이동 전에 시뮬레이션 상태가 저장되었는지 확인
    const savedSimulation = localStorage.getItem('positionSimulation')
    if (simulationData && savedSimulation) {
      console.log('LanguageSwitcher: Simulation data confirmed saved before navigation')
    }
    
    // 시뮬레이션 중일 때는 window.location.href를 사용하여 완전한 페이지 이동
    // 이렇게 하면 시뮬레이션 상태가 더 확실하게 보존됨
    if (simulationData) {
      console.log('LanguageSwitcher: Using window.location.href for simulation safety')
      window.location.href = newPath
    } else {
      // 일반 사용자는 Next.js 라우터 사용
      router.push(newPath)
    }
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
