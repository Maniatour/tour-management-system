import React from 'react'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { notFound } from 'next/navigation'
import AdminAuthBoundary from '@/components/auth/AdminAuthBoundary'
import AdminAuthGuard from '@/components/auth/AdminAuthGuard'
import AdminChrome from '@/components/admin/AdminChrome'
import ReservationPricingAuditNotificationListener from '@/components/admin/ReservationPricingAuditNotificationListener'
import { AudioPlayerProvider } from '@/contexts/AudioPlayerContext'
import { GmailReservationImportSyncProvider } from '@/contexts/GmailReservationImportSyncContext'
import { isSiteLocale } from '@/lib/siteLocales'

interface AdminLayoutProps {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export default async function AdminLayout({ children, params }: AdminLayoutProps) {
  const { locale: localeParam } = await params
  if (!isSiteLocale(localeParam)) {
    notFound()
  }
  const locale = localeParam
  let messages: Awaited<ReturnType<typeof getMessages>>
  try {
    messages = await getMessages({ locale })
  } catch (error) {
    console.error('AdminLayout: Failed to load messages:', error)
    messages = {}
  }

  return (
    <NextIntlClientProvider messages={messages} locale={locale}>
      <AdminAuthBoundary>
        <AudioPlayerProvider>
          <AdminAuthGuard locale={locale}>
          <GmailReservationImportSyncProvider>
            <AdminChrome locale={locale}>
              {children}
              <ReservationPricingAuditNotificationListener locale={locale} />
            </AdminChrome>
          </GmailReservationImportSyncProvider>
          </AdminAuthGuard>
        </AudioPlayerProvider>
      </AdminAuthBoundary>
    </NextIntlClientProvider>
  )
}
