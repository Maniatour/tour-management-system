'use client'

import { useState } from 'react'
import { Megaphone } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { canSendStaffSiteAlert } from '@/lib/staffSiteAlert'
import { StaffSiteAlertSendModal } from '@/components/admin/staff-site-alert/StaffSiteAlertSendModal'

type StaffSiteAlertHeaderButtonProps = {
  locale: string
  className?: string
}

export function StaffSiteAlertHeaderButton({ locale, className }: StaffSiteAlertHeaderButtonProps) {
  const { authUser, userRole, userPosition } = useAuth()
  const [open, setOpen] = useState(false)
  const isKo = locale.startsWith('ko')

  const canSend = canSendStaffSiteAlert({
    userRole,
    userPosition,
    authUserEmail: authUser?.email,
  })

  if (!canSend) return null

  return (
    <>
      <div className={`relative hidden sm:inline-block ${className ?? ''}`}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-violet-600 text-white transition-colors hover:bg-violet-700"
          title={isKo ? '사이트 알림 발송' : 'Send site alert'}
          aria-label={isKo ? '사이트 알림 발송' : 'Send site alert'}
        >
          <Megaphone className="h-5 w-5" />
        </button>
      </div>

      <StaffSiteAlertSendModal open={open} locale={locale} onClose={() => setOpen(false)} />
    </>
  )
}
