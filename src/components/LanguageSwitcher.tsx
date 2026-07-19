'use client'

import { useLocale, useTranslations } from 'next-intl'
import { usePathname, useRouter } from 'next/navigation'
import LocaleDropdown, { type LocaleDropdownProps } from '@/components/LocaleDropdown'
import { useAuth } from '@/contexts/AuthContext'
import { withSimulationBackendMeta } from '@/lib/simulationBackend'
import {
  normalizeSiteLocale,
  replacePathLocale,
  type SiteLocale,
} from '@/lib/siteLocales'

type LanguageSwitcherProps = {
  variant?: LocaleDropdownProps['variant']
  className?: string
  showCloseButton?: boolean
}

const LanguageSwitcher = ({
  variant = 'ghost',
  className,
  showCloseButton = false,
}: LanguageSwitcherProps) => {
  const t = useTranslations('common')
  const locale = normalizeSiteLocale(useLocale())
  const pathname = usePathname()
  const router = useRouter()
  const { isSimulating, simulatedUser } = useAuth()

  const handleLanguageChange = (newLocale: SiteLocale) => {
    if (newLocale === locale) return

    const newPath = replacePathLocale(pathname, newLocale)

    let simulationData: Record<string, unknown> | null = null
    if (isSimulating && simulatedUser) {
      simulationData = withSimulationBackendMeta({
        email: simulatedUser.email,
        name_ko: simulatedUser.name_ko,
        name_en: simulatedUser.name_en,
        position: simulatedUser.position,
        role: simulatedUser.role,
      })

      localStorage.setItem('positionSimulation', JSON.stringify(simulationData))
      document.cookie = `simulation_active=true; path=/; max-age=3600; SameSite=Lax`
      document.cookie = `simulation_user=${encodeURIComponent(JSON.stringify(simulationData))}; path=/; max-age=3600; SameSite=Lax`
      sessionStorage.setItem('positionSimulation', JSON.stringify(simulationData))
    }

    localStorage.removeItem('locale')
    localStorage.removeItem('preferred-locale')
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000; SameSite=Lax`

    if (simulationData) {
      const saveSimulationData = () => {
        localStorage.setItem('positionSimulation', JSON.stringify(simulationData))
        sessionStorage.setItem('positionSimulation', JSON.stringify(simulationData))
        document.cookie = `simulation_active=true; path=/; max-age=3600; SameSite=Lax`
        document.cookie = `simulation_user=${encodeURIComponent(JSON.stringify(simulationData))}; path=/; max-age=3600; SameSite=Lax`
      }

      saveSimulationData()
      setTimeout(saveSimulationData, 50)
      setTimeout(() => {
        saveSimulationData()
        router.push(newPath)
      }, 100)
    } else {
      router.push(newPath)
    }
  }

  return (
    <LocaleDropdown
      value={locale}
      onChange={handleLanguageChange}
      variant={variant}
      {...(className ? { className } : {})}
      showCloseButton={showCloseButton}
      ariaLabel={t('language')}
    />
  )
}

export default LanguageSwitcher
