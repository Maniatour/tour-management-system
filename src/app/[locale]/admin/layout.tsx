import React from 'react'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import AdminSidebarAndHeader from '@/components/AdminSidebarAndHeader'
import MobileFooter from '@/components/MobileFooter'
import AdminAuthGuard from '@/components/auth/AdminAuthGuard'
import { AudioPlayerProvider } from '@/contexts/AudioPlayerContext'
import { GmailReservationImportSyncProvider } from '@/contexts/GmailReservationImportSyncContext'
import GlobalAudioPlayer from '@/components/GlobalAudioPlayer'

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
      <AudioPlayerProvider>
        <AdminAuthGuard locale={locale}>
          <GmailReservationImportSyncProvider>
            <div className="min-h-screen bg-gray-50">
              <AdminSidebarAndHeader locale={locale}>
                {children}
              </AdminSidebarAndHeader>
              <MobileFooter locale={locale} />

              <GlobalAudioPlayer />
            </div>
          </GmailReservationImportSyncProvider>
        </AdminAuthGuard>
      </AudioPlayerProvider>
    </NextIntlClientProvider>
  )
}
