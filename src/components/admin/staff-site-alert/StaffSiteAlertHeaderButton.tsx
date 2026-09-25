'use client'

import { useEffect, useState, type MutableRefObject } from 'react'
import { Megaphone } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { canSendStaffSiteAlert } from '@/lib/staffSiteAlert'
import { StaffSiteAlertSendModal } from '@/components/admin/staff-site-alert/StaffSiteAlertSendModal'

type StaffSiteAlertHeaderButtonProps = {
  locale: string
  className?: string
  /** 화면 밖 트리거. 모바일 앱 그리드가 같은 모달을 연다. */
  hostOnly?: boolean
  registerOpen?: MutableRefObject<(() => void) | null>
}

export function StaffSiteAlertHeaderButton({
  locale,
  className,
  hostOnly = false,
  registerOpen,
}: StaffSiteAlertHeaderButtonProps) {
  const { authUser, userRole, userPosition } = useAuth()
  const [open, setOpen] = useState(false)
  const isKo = locale.startsWith('ko')

  const canSend = canSendStaffSiteAlert({
    userRole,
    userPosition,
    authUserEmail: authUser?.email,
  })

  useEffect(() => {
    if (!registerOpen || !canSend) return
    registerOpen.current = () => setOpen(true)
    return () => {
      registerOpen.current = null
    }
  }, [canSend, registerOpen])

  if (!canSend) return null

  return (
    <>
      <div className={hostOnly ? 'contents' : `relative hidden sm:inline-block ${className ?? ''}`}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={
            hostOnly
              ? 'sr-only'
              : 'inline-flex h-9 w-9 items-center justify-center rounded-lg bg-violet-600 text-white transition-colors hover:bg-violet-700'
          }
          title={isKo ? '사이트 알림 발송' : 'Send site alert'}
          aria-label={isKo ? '사이트 알림 발송' : 'Send site alert'}
          tabIndex={hostOnly ? -1 : undefined}
        >
          <Megaphone className="h-5 w-5" />
        </button>
      </div>

      <StaffSiteAlertSendModal open={open} locale={locale} onClose={() => setOpen(false)} />
    </>
  )
}
