'use client'

import { useEffect, useState } from 'react'
import { Smartphone } from 'lucide-react'
import { AdminSmsManagementModal } from '@/components/admin/sms/AdminSmsManagementModal'
import { prefetchAdminSmsCategorySettings } from '@/hooks/useAdminSmsCategorySettings'
import { prefetchAdminSmsLocaleTemplate } from '@/lib/adminSmsLocaleTemplateClientCache'
import { prefetchMessengerContactSettings } from '@/lib/messengerContactSettingsClientCache'

type Props = {
  locale: string
  className?: string
}

function prefetchSmsManagementData() {
  prefetchAdminSmsCategorySettings()
  prefetchAdminSmsLocaleTemplate('pre_tour_contact', 'ko')
  prefetchMessengerContactSettings()
}

export function AdminSmsManagementHeaderButton({ locale, className }: Props) {
  const [open, setOpen] = useState(false)
  const isKo = locale.startsWith('ko')

  useEffect(() => {
    prefetchSmsManagementData()
  }, [])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        onMouseEnter={prefetchSmsManagementData}
        onFocus={prefetchSmsManagementData}
        className={
          className ||
          'inline-flex h-9 w-9 items-center justify-center rounded-lg bg-violet-600 text-white transition-colors hover:bg-violet-700'
        }
        title={isKo ? 'SMS 템플릿 관리' : 'SMS template management'}
        aria-label={isKo ? 'SMS 관리' : 'SMS management'}
      >
        <Smartphone className="h-5 w-5" />
      </button>

      <AdminSmsManagementModal open={open} onClose={() => setOpen(false)} locale={locale} />
    </>
  )
}
