import React from 'react'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import AdminAuthGuard from '@/components/auth/AdminAuthGuard'
import AdminChrome from '@/components/admin/AdminChrome'
import { AudioPlayerProvider } from '@/contexts/AudioPlayerContext'
import { GmailReservationImportSyncProvider } from '@/contexts/GmailReservationImportSyncContext'

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
            <AdminChrome locale={locale}>{children}</AdminChrome>
          </GmailReservationImportSyncProvider>
        </AdminAuthGuard>
      </AudioPlayerProvider>
    </NextIntlClientProvider>
  )
}
