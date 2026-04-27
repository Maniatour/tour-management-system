'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { saveStaffPushSubscription } from '@/lib/staffPushSubscription'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

/** 직원(팀)이 최신 SOP에 서명하지 않은 경우 사이트 접속 시 안내 모달 */
export default function SopComplianceGate() {
  const pathname = usePathname() || ''
  const router = useRouter()
  const { authUser, userRole, loading, isInitialized, isSimulating } = useAuth()
  const [blocked, setBlocked] = useState(false)
  const [versionId, setVersionId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [versionNumber, setVersionNumber] = useState<number | null>(null)
  const [pushBusy, setPushBusy] = useState(false)
  const [pushMsg, setPushMsg] = useState<string | null>(null)

  const locale = pathname.split('/').filter(Boolean)[0] || 'ko'
  const isEn = locale === 'en'

  const staffRoles = userRole === 'admin' || userRole === 'manager' || userRole === 'team_member'

  const shouldSkipPath =
    pathname.includes('/auth') ||
    pathname.includes('/sop/sign') ||
    pathname.includes('/embed') ||
    pathname.includes('/photos/')

  const check = useCallback(async () => {
    if (!isInitialized || loading || isSimulating) return
    if (!authUser?.id || !staffRoles) {
      setBlocked(false)
      return
    }
    if (shouldSkipPath) {
      setBlocked(false)
      return
    }

    const { data: latest, error: vErr } = await supabase
      .from('company_sop_versions')
      .select('id, title, version_number')
      .order('published_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (vErr || !latest) {
      setBlocked(false)
      return
    }

    const { data: sig } = await supabase
      .from('sop_signatures')
      .select('id')
      .eq('version_id', latest.id)
      .eq('user_id', authUser.id)
      .maybeSingle()

    if (sig) {
      setBlocked(false)
      return
    }

    setVersionId(latest.id)
    setTitle(latest.title)
    setVersionNumber(latest.version_number)
    setBlocked(true)
  }, [
    authUser?.id,
    isInitialized,
    loading,
    isSimulating,
    pathname,
    shouldSkipPath,
    staffRoles,
  ])

  useEffect(() => {
    void check()
  }, [check])

  const goSign = () => {
    router.push(`/${locale}/sop/sign?version=${versionId}`)
  }

  const enablePush = async () => {
    if (!authUser?.id || !authUser.email) return
    setPushBusy(true)
    setPushMsg(null)
    const r = await saveStaffPushSubscription(authUser.id, authUser.email, isEn ? 'en' : 'ko')
    setPushBusy(false)
    if (r.ok) {
      setPushMsg(isEn ? 'Browser notifications enabled.' : '브라우저 알림을 켰습니다.')
    } else {
      setPushMsg(
        isEn
          ? 'Could not enable notifications (permission or browser).'
          : '알림을 켤 수 없습니다. 브라우저 권한을 확인해 주세요.'
      )
    }
  }

  if (!blocked || !versionId || versionNumber == null) return null

  return (
    <Dialog open={blocked} modal onOpenChange={() => {}}>
      <DialogContent
        className="max-w-md"
        hideCloseButton
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>
            {isEn ? 'Action required: sign the company SOP' : '필수: 회사 SOP 서명이 필요합니다'}
          </DialogTitle>
          <DialogDescription className="text-left space-y-2 pt-2">
            <span className="block text-gray-800">
              {isEn
                ? `Version ${versionNumber} is in effect. You must read and sign before using the system.`
                : `현재 적용 중인 SOP는 제${versionNumber}판입니다. 내용을 확인하고 전자서명(PDF 보관)까지 완료해 주세요.`}
            </span>
            <span className="block font-medium text-gray-900">{title}</span>
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 pt-2">
          <Button type="button" onClick={goSign} className="w-full">
            {isEn ? 'Review and sign' : '내용 확인 후 서명하기'}
          </Button>
          <Button type="button" variant="outline" className="w-full" disabled={pushBusy} onClick={enablePush}>
            {pushBusy
              ? isEn
                ? 'Working…'
                : '처리 중…'
              : isEn
                ? 'Enable update notifications (browser)'
                : 'SOP 개정 시 브라우저 알림 받기'}
          </Button>
          {pushMsg ? <p className="text-sm text-gray-600">{pushMsg}</p> : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
