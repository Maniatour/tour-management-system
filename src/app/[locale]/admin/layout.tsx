import React from 'react'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import AdminSidebarAndHeader from '@/components/AdminSidebarAndHeader'
import MobileFooter from '@/components/MobileFooter'
import AdminAuthGuard from '@/components/auth/AdminAuthGuard'
import { AudioPlayerProvider } from '@/contexts/AudioPlayerContext'
import GlobalAudioPlayer from '@/components/GlobalAudioPlayer'

interface AdminLayoutProps {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export default async function AdminLayout({ children, params }: AdminLayoutProps) {
  const { locale } = await params
  const messages = await getMessages({ locale })

  return (
    <NextIntlClientProvider messages={messages} locale={locale}>
      <AudioPlayerProvider>
        <AdminAuthGuard locale={locale}>
          <div className="min-h-screen bg-gray-50">
            <AdminSidebarAndHeader locale={locale}>
              {children}
            </AdminSidebarAndHeader>
            <MobileFooter locale={locale} />
            
            {/* 전역 오디오 플레이어 */}
            <GlobalAudioPlayer />
          </div>
        </AdminAuthGuard>
      </AudioPlayerProvider>
    </NextIntlClientProvider>
  )
}
