'use client'

import React from 'react'
import AdminSidebarAndHeader from '@/components/AdminSidebarAndHeader'
import MobileFooter from '@/components/MobileFooter'
import GlobalAudioPlayer from '@/components/GlobalAudioPlayer'
import { SiteAccessMatrixPatchProvider } from '@/contexts/SiteAccessMatrixPatchContext'

type AdminChromeProps = {
  locale: string
  children: React.ReactNode
}

export default function AdminChrome({ locale, children }: AdminChromeProps) {
  return (
    <SiteAccessMatrixPatchProvider>
      <div className="min-h-screen bg-gray-50">
        <AdminSidebarAndHeader locale={locale}>{children}</AdminSidebarAndHeader>
        <MobileFooter locale={locale} />
        <GlobalAudioPlayer />
      </div>
    </SiteAccessMatrixPatchProvider>
  )
}
