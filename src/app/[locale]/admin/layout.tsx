import React from 'react'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import AdminSidebarAndHeader from '@/components/AdminSidebarAndHeader'
import MobileFooter from '@/components/MobileFooter'

interface AdminLayoutProps {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export default async function AdminLayout({ children, params }: AdminLayoutProps) {
  const { locale } = await params
  const messages = await getMessages()

  return (
    <NextIntlClientProvider messages={messages}>
      <div className="min-h-screen bg-gray-50">
        <AdminSidebarAndHeader locale={locale}>
          {children}
        </AdminSidebarAndHeader>
        <MobileFooter locale={locale} />
      </div>
    </NextIntlClientProvider>
  )
}
