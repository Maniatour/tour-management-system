'use client'

import React, { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import AdminSidebarAndHeader from '@/components/AdminSidebarAndHeader'
import AdminPwaInstallFab from '@/components/admin/AdminPwaInstallFab'
import AdminTodoRoot from '@/components/admin/todo/AdminTodoRoot'
import AdminWorkRoot from '@/components/admin/work/AdminWorkRoot'
import { StaffSiteAlertPopupLayer } from '@/components/admin/staff-site-alert/StaffSiteAlertPopupLayer'
import { useAuth } from '@/contexts/AuthContext'
import { TeamBoardManualProvider } from '@/contexts/TeamBoardManualContext'
import OpsModuleRouteGuard from '@/components/admin/OpsModuleRouteGuard'
import MobileFooter from '@/components/MobileFooter'
import GlobalAudioPlayer from '@/components/GlobalAudioPlayer'
import AdminPageTitle from '@/components/admin/AdminPageTitle'
import { SiteAccessMatrixPatchProvider } from '@/contexts/SiteAccessMatrixPatchContext'

type AdminChromeProps = {
  locale: string
  children: React.ReactNode
}

/** 대시보드 사이드바·헤더 없이 전체 화면만 쓰는 admin 경로 */
function isAdminBareChromePath(pathname: string | null): boolean {
  if (!pathname) return false
  return pathname.includes('/admin/schedule-display')
}

export default function AdminChrome({ locale, children }: AdminChromeProps) {
  const pathname = usePathname()
  const bareChrome = isAdminBareChromePath(pathname)
  const { authUser } = useAuth()

  // 가이드와 동일: 부모 padded main에 중첩돼도 풀블리드가 되도록 html 클래스 부여
  useEffect(() => {
    const root = document.documentElement
    root.classList.add('is-admin-route')
    return () => {
      root.classList.remove('is-admin-route')
    }
  }, [])

  if (bareChrome) {
    return (
      <SiteAccessMatrixPatchProvider>
        <OpsModuleRouteGuard>
          <div className="admin-shell min-h-screen w-full bg-background px-0">
            {children}
          </div>
        </OpsModuleRouteGuard>
      </SiteAccessMatrixPatchProvider>
    )
  }

  return (
    <SiteAccessMatrixPatchProvider>
      <AdminPageTitle locale={locale} />
      <TeamBoardManualProvider locale={locale}>
        <div className="admin-shell min-h-screen w-full min-w-0 max-w-full overflow-x-clip px-0">
          <AdminSidebarAndHeader locale={locale}>
            <OpsModuleRouteGuard>{children}</OpsModuleRouteGuard>
          </AdminSidebarAndHeader>
          <AdminPwaInstallFab locale={locale} />
          <AdminTodoRoot locale={locale} />
          <AdminWorkRoot locale={locale} />
          <StaffSiteAlertPopupLayer userEmail={authUser?.email} locale={locale} />
          <MobileFooter locale={locale} />
          <GlobalAudioPlayer />
        </div>
      </TeamBoardManualProvider>
    </SiteAccessMatrixPatchProvider>
  )
}
