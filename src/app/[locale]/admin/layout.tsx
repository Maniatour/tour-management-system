import React from 'react'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import AdminSidebarAndHeader from '@/components/AdminSidebarAndHeader'
import MobileFooter from '@/components/MobileFooter'
import AdminAuthGuard from '@/components/auth/AdminAuthGuard'
import { AudioPlayerProvider } from '@/contexts/AudioPlayerContext'
import GlobalAudioPlayer from '@/components/GlobalAudioPlayer'
import { AuthProviderBoundary } from '@/contexts/AuthContext'

interface AdminLayoutProps {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export default async function AdminLayout({ children, params }: AdminLayoutProps) {
  const { locale } = await params
  let messages: Awaited<ReturnType<typeof getMessages>>
  try {
    messages = await getMessages({ locale })
  } catch (error) {
    console.error('AdminLayout: Failed to load messages:', error)
    messages = {}
  }

  return (
    <NextIntlClientProvider messages={messages} locale={locale}>
      {/* AdminAuthGuard(useAuth): 루트 Provider가 이 트리에 닿지 않을 때만 추가 Provider 삽입 */}
      <AuthProviderBoundary>
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
      </AuthProviderBoundary>
    </NextIntlClientProvider>
  )
}
