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

type GateKind = 'sop' | 'employee_contract' | 'campaign'

const CAMPAIGN_DEFER_STORAGE_KEY = 'sop_compliance_campaign_defer'
const CAMPAIGN_DEFER_MS = 60 * 60 * 1000 // 1시간 동안 동일 캠페인 게이트 숨김

function readDeferredCampaignId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(CAMPAIGN_DEFER_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { campaignId?: string; until?: number }
    if (!parsed.campaignId || typeof parsed.until !== 'number') {
      sessionStorage.removeItem(CAMPAIGN_DEFER_STORAGE_KEY)
      return null
    }
    if (Date.now() >= parsed.until) {
      sessionStorage.removeItem(CAMPAIGN_DEFER_STORAGE_KEY)
      return null
    }
    return parsed.campaignId
  } catch {
    return null
  }
}

function writeDeferredCampaign(campaignId: string) {
  sessionStorage.setItem(
    CAMPAIGN_DEFER_STORAGE_KEY,
    JSON.stringify({ campaignId, until: Date.now() + CAMPAIGN_DEFER_MS })
  )
}

/** 직원: 게시 SOP·계약서 미서명, 또는 관리자 발송「확인·서명」캠페인 대기 시 모달 */
export default function SopComplianceGate() {
  const pathname = usePathname() || ''
  const router = useRouter()
  const { authUser, userRole, loading, isInitialized, isSimulating } = useAuth()
  const [blocked, setBlocked] = useState(false)
  const [gateKind, setGateKind] = useState<GateKind>('sop')
  const [versionId, setVersionId] = useState<string | null>(null)
  const [campaignId, setCampaignId] = useState<string | null>(null)
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
    pathname.includes('/sop/campaign-sign') ||
    pathname.includes('/employee-contract/sign') ||
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

    const { data: latestSop, error: sopVErr } = await supabase
      .from('company_sop_versions')
      .select('id, title, version_number')
      .order('published_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!sopVErr && latestSop) {
      const { data: sopSig } = await supabase
        .from('sop_signatures')
        .select('id')
        .eq('version_id', latestSop.id)
        .eq('user_id', authUser.id)
        .maybeSingle()

      if (!sopSig) {
        setGateKind('sop')
        setVersionId(latestSop.id)
        setCampaignId(null)
        setTitle(latestSop.title)
        setVersionNumber(latestSop.version_number)
        setBlocked(true)
        return
      }
    }

    const { data: latestContract, error: cErr } = await supabase
      .from('company_employee_contract_versions')
      .select('id, title, version_number')
      .order('published_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!cErr && latestContract) {
      const { data: cSig } = await supabase
        .from('employee_contract_signatures')
        .select('id')
        .eq('version_id', latestContract.id)
        .eq('user_id', authUser.id)
        .maybeSingle()

      if (!cSig) {
        setGateKind('employee_contract')
        setVersionId(latestContract.id)
        setCampaignId(null)
        setTitle(latestContract.title)
        setVersionNumber(latestContract.version_number)
        setBlocked(true)
        return
      }
    }

    const email = (authUser.email || '').trim().toLowerCase()
    if (email) {
      const deferredCampaignId = readDeferredCampaignId()

      const { data: pendings, error: pErr } = await supabase
        .from('company_structured_doc_sign_campaign_recipients')
        .select('id, campaign_id')
        .eq('status', 'pending')
        .ilike('recipient_email', email)
        .order('id', { ascending: false })
        .limit(20)

      if (!pErr && pendings?.length) {
        for (const row of pendings) {
          const { data: camp } = await supabase
            .from('company_structured_doc_sign_campaigns')
            .select('id, title, closed_at')
            .eq('id', row.campaign_id)
            .maybeSingle()
          if (!camp || camp.closed_at) continue
          if (deferredCampaignId && camp.id === deferredCampaignId) continue

          const { data: csig } = await supabase
            .from('company_structured_doc_campaign_signatures')
            .select('id')
            .eq('campaign_id', camp.id)
            .eq('user_id', authUser.id)
            .maybeSingle()
          if (csig) continue

          setGateKind('campaign')
          setCampaignId(camp.id)
          setVersionId(null)
          setTitle(camp.title || (isEn ? 'Sign request' : '서명 요청'))
          setVersionNumber(null)
          setBlocked(true)
          return
        }
      }
    }

    setBlocked(false)
  }, [
    authUser?.email,
    authUser?.id,
    isInitialized,
    isEn,
    loading,
    isSimulating,
    pathname,
    shouldSkipPath,
    staffRoles,
  ])

  useEffect(() => {
    void check()
  }, [check])

  const deferCampaignSign = () => {
    if (!campaignId) return
    writeDeferredCampaign(campaignId)
    setBlocked(false)
  }

  const goSign = () => {
    if (gateKind === 'campaign') {
      if (!campaignId) return
      router.push(`/${locale}/sop/campaign-sign?campaign=${campaignId}`)
      return
    }
    if (!versionId) return
    if (gateKind === 'sop') {
      router.push(`/${locale}/sop/sign?version=${versionId}`)
    } else {
      router.push(`/${locale}/employee-contract/sign?version=${versionId}`)
    }
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

  if (!blocked) return null
  if (gateKind === 'campaign' && !campaignId) return null
  if (gateKind !== 'campaign' && (!versionId || versionNumber == null)) return null

  const isContract = gateKind === 'employee_contract'
  const isCampaign = gateKind === 'campaign'

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
            {isCampaign
              ? isEn
                ? 'Sign request from your manager'
                : '관리자 발송: 문서 확인·서명이 필요합니다'
              : isContract
                ? isEn
                  ? 'Action required: sign the employment contract'
                  : '필수: 직원 계약서 서명이 필요합니다'
                : isEn
                  ? 'Action required: sign the company SOP'
                  : '필수: 회사 SOP 서명이 필요합니다'}
          </DialogTitle>
          <DialogDescription className="text-left space-y-2 pt-2">
            <span className="block text-gray-800">
              {isCampaign
                ? isEn
                  ? 'Open the document, review it, and save your signature. A PDF is stored for you and the office.'
                  : '문서를 확인한 뒤 전자서명을 저장해 주세요. PDF는 본인과 사무실에서 동일하게 보관됩니다.'
                : isContract
                  ? isEn
                    ? `Version ${versionNumber} is in effect. You must read and sign before using the system.`
                    : `현재 적용 중인 직원 계약서는 제${versionNumber}판입니다. 내용을 확인하고 전자서명(PDF 보관)까지 완료해 주세요.`
                  : isEn
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
          {isCampaign ? (
            <>
              <Button type="button" variant="outline" className="w-full" onClick={deferCampaignSign}>
                {isEn ? 'Not now' : '다음에 하기'}
              </Button>
              <p className="text-center text-xs text-gray-500">
                {isEn
                  ? 'This reminder stays hidden for about an hour; you can still sign afterward.'
                  : '약 1시간 동안 이 알림을 띄우지 않습니다. 이후에도 서명할 수 있습니다.'}
              </p>
            </>
          ) : null}
          {!isCampaign ? (
            <Button type="button" variant="outline" className="w-full" disabled={pushBusy} onClick={enablePush}>
              {pushBusy
                ? isEn
                  ? 'Working…'
                  : '처리 중…'
                : isEn
                  ? 'Enable update notifications (browser)'
                  : '문서 개정 시 브라우저 알림 받기'}
            </Button>
          ) : null}
          {pushMsg ? <p className="text-sm text-gray-600">{pushMsg}</p> : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
