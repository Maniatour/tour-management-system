'use client'

import React from 'react'
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

  if (bareChrome) {
    return (
      <SiteAccessMatrixPatchProvider>
        <OpsModuleRouteGuard>
          <div className="min-h-screen bg-background">{children}</div>
        </OpsModuleRouteGuard>
      </SiteAccessMatrixPatchProvider>
    )
  }

  return (
    <SiteAccessMatrixPatchProvider>
      <AdminPageTitle locale={locale} />
      <TeamBoardManualProvider locale={locale}>
        <div className="min-h-screen">
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
