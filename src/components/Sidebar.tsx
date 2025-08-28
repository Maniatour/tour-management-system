'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { 
  Home, 
  Calendar, 
  Users, 
  Map, 
  Package, 
  Settings, 
  FileText,
  ChevronLeft,
  ChevronRight,
  Globe,
  UserCheck
} from 'lucide-react'

const Sidebar = () => {
  const pathname = usePathname()
  const locale = useLocale()
  const t = useTranslations('common')
  const [isCollapsed, setIsCollapsed] = useState(false)
  
  // Admin 페이지에서는 사이드바를 숨김
  if (pathname.startsWith(`/${locale}/admin`)) {
    return null
  }

  const navItems = [
    { href: `/${locale}`, label: t('home'), icon: Home },
    { href: `/${locale}/schedule`, label: t('schedule'), icon: Calendar },
    { href: `/${locale}/customers`, label: t('customers'), icon: Users },
    { href: `/${locale}/reservations`, label: t('reservations'), icon: Calendar },
    { href: `/${locale}/tours`, label: t('tours'), icon: Map },
    { href: `/${locale}/channels`, label: t('channels'), icon: Globe },
    { href: `/${locale}/products`, label: t('products'), icon: Package },
    { href: `/${locale}/options`, label: t('options'), icon: Settings },
    { href: `/${locale}/employees`, label: t('employees'), icon: UserCheck },
    { href: `/${locale}/courses`, label: t('courses'), icon: FileText },
  ]

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed)
  }

  return (
    <div className={`bg-white shadow-lg border-r transition-all duration-300 ${
      isCollapsed ? 'w-16' : 'w-64'
    }`}>
      {/* 사이드바 헤더 */}
      <div className="flex items-center justify-between p-4 border-b">
        {!isCollapsed && (
          <h2 className="text-lg font-semibold text-gray-800">
            {t('menu')}
          </h2>
        )}
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label={isCollapsed ? t('expandMenu') : t('collapseMenu')}
        >
          {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>

      {/* 메뉴 항목들 */}
      <nav className="p-2">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-blue-100 text-blue-700 border border-blue-200'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <Icon size={20} />
                  {!isCollapsed && (
                    <span className="font-medium">{item.label}</span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* 사이드바 푸터 */}
      {!isCollapsed && (
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-gray-50">
          <div className="text-xs text-gray-500 text-center">
            {t('sidebarFooter')}
          </div>
        </div>
      )}
    </div>
  )
}

export default Sidebar
