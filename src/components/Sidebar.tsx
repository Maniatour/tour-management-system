'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import {
  Home,
  Calendar,
  Package,
  ChevronLeft,
  ChevronRight,
  UserCheck,
} from 'lucide-react'
import { isLegalPagePath } from '@/lib/customerSiteRoutes'

const SIDEBAR_COLLAPSED_KEY = 'tms-sidebar-collapsed'

const Sidebar = () => {
  const pathname = usePathname()
  const locale = useLocale()
  const t = useTranslations('common')
  const [isCollapsed, setIsCollapsed] = useState(false)

  useEffect(() => {
    try {
      setIsCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1')
    } catch {
      /* ignore */
    }
  }, [])
  
  // Admin, Guide, Customer, Photos 페이지에서는 사이드바를 숨김
  if (pathname.startsWith(`/${locale}/admin`) || 
      pathname.startsWith(`/${locale}/guide`) ||
      pathname.startsWith(`/${locale}/dashboard`) ||
      pathname.startsWith(`/${locale}/products`) ||
      pathname.startsWith(`/${locale}/off-schedule`) ||
      pathname.startsWith(`/${locale}/photos/`) ||
      pathname.startsWith(`/${locale}/reservation-check`) ||
      pathname.startsWith(`/${locale}/resident-check`) ||
      pathname.startsWith(`/${locale}/travel-guide`) ||
      isLegalPagePath(pathname) ||
      pathname === `/${locale}` ||
      pathname === `/${locale}/`) {
    return null
  }

  const navItems = [
    { href: `/${locale}`, label: t('home'), icon: Home },
    { href: `/${locale}/products`, label: t('tourProducts'), icon: Package },
    { href: `/${locale}/reservation-check`, label: t('reservationCheck'), icon: Calendar },
    { href: `/${locale}/dashboard`, label: t('dashboard'), icon: UserCheck },
  ]

  const toggleSidebar = () => {
    setIsCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }

  return (
    <div
      className={`sticky top-[var(--header-height,4rem)] hidden h-[calc(100vh-var(--header-height,4rem))] shrink-0 flex-col border-r bg-white shadow-lg transition-[width] duration-300 lg:flex ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* 사이드바 헤더 */}
      <div
        className={`flex items-center border-b p-4 ${
          isCollapsed ? 'justify-center' : 'justify-between gap-2'
        }`}
      >
        {!isCollapsed && (
          <h2 className="truncate text-lg font-semibold text-gray-800">
            {t('menu')}
          </h2>
        )}
        <button
          type="button"
          onClick={toggleSidebar}
          className="shrink-0 rounded-lg p-2 transition-colors hover:bg-gray-100"
          aria-expanded={!isCollapsed}
          aria-label={isCollapsed ? t('expandMenu') : t('collapseMenu')}
          title={isCollapsed ? t('expandMenu') : t('collapseMenu')}
        >
          {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>

      {/* 메뉴 항목들 */}
      <nav className="min-h-0 flex-1 overflow-y-auto p-2">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  title={isCollapsed ? item.label : undefined}
                  className={`flex items-center rounded-lg px-3 py-2 transition-colors ${
                    isCollapsed ? 'justify-center' : 'space-x-3'
                  } ${
                    isActive
                      ? 'border border-border bg-primary/10 text-primary'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <Icon size={20} className="shrink-0" />
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
        <div className="border-t bg-gray-50 p-4">
          <div className="text-center text-xs text-gray-500">
            {t('sidebarFooter')}
          </div>
        </div>
      )}
    </div>
  )
}

export default Sidebar
