'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import type { StructuredDocDualCompliance, StructuredDocVersionRow } from '@/components/sop/structuredDocAdminTypes'

type ComplianceSigRow = {
  signer_email: string
  signer_name: string
  signed_at: string
  pdf_storage_path: string
}

type TeamRow = { email: string; name_ko: string | null; name_en: string | null }

type FilterMode = 'all' | 'pending'

function ComplianceColumn({
  title,
  latest,
  sigs,
  team,
  docRoute,
  bucket,
  locale,
  uiLocaleEn,
  onOpenPdf,
  openingPdf,
  openingPdfBucket,
}: {
  title: string
  latest: StructuredDocVersionRow | null
  sigs: Map<string, ComplianceSigRow>
  team: TeamRow[]
  docRoute: 'sop' | 'employee-contract'
  bucket: 'sop-signatures' | 'employee-contract-signatures'
  locale: string
  uiLocaleEn: boolean
  onOpenPdf: StructuredDocDualCompliance['onOpenPdf']
  openingPdf: string | null
  openingPdfBucket: 'sop-signatures' | 'employee-contract-signatures'
}) {
  const [filter, setFilter] = useState<FilterMode>('all')
  const [copyMsg, setCopyMsg] = useState<string | null>(null)
  const [remindBusy, setRemindBusy] = useState(false)
  const [remindMsg, setRemindMsg] = useState<string | null>(null)

  const signHref = latest
    ? docRoute === 'sop'
      ? `/${locale}/sop/sign?version=${latest.id}`
      : `/${locale}/employee-contract/sign?version=${latest.id}`
    : null

  const rows = useMemo(() => {
    return team.map((t) => {
      const sig = sigs.get(t.email.trim().toLowerCase())
      const label = uiLocaleEn ? t.name_en || t.name_ko || t.email : t.name_ko || t.name_en || t.email
      return { ...t, sig, label }
    })
  }, [team, sigs, uiLocaleEn])

  const signedCount = rows.filter((r) => r.sig).length
  const pendingRows = rows.filter((r) => !r.sig)
  const pendingCount = pendingRows.length
  const visibleRows = filter === 'pending' ? pendingRows : rows

  const copyUnsignedEmails = async () => {
    const text = pendingRows.map((r) => r.email).join('\n')
    if (!text) {
      setCopyMsg(uiLocaleEn ? 'Everyone has signed.' : '미서명자가 없습니다.')
      return
    }
    try {
      await navigator.clipboard.writeText(text)
      setCopyMsg(
        uiLocaleEn ? `Copied ${pendingCount} email(s).` : `${pendingCount}명 이메일을 복사했습니다.`
      )
    } catch {
      setCopyMsg(uiLocaleEn ? 'Copy failed.' : '복사에 실패했습니다.')
    }
    window.setTimeout(() => setCopyMsg(null), 2500)
  }

  const remindUnsigned = async () => {
    if (!latest) return
    setRemindBusy(true)
    setRemindMsg(null)
    try {
      const { supabase } = await import('@/lib/supabase')
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) throw new Error(uiLocaleEn ? 'Sign in required.' : '로그인이 필요합니다.')

      const res = await fetch('/api/sop/remind-unsigned', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          docKind: docRoute === 'sop' ? 'sop' : 'employee_contract',
          versionId: latest.id,
          locale,
        }),
      })
      const json = (await res.json()) as {
        error?: string
        sent?: number
        failed?: number
        pendingCount?: number
        skippedNoVapid?: boolean
        noSubscriptions?: number
      }
      if (!res.ok) throw new Error(json.error || (uiLocaleEn ? 'Remind failed.' : '리마인드에 실패했습니다.'))

      if (json.skippedNoVapid) {
        setRemindMsg(uiLocaleEn ? 'Push is not configured (VAPID).' : '푸시(VAPID)가 설정되지 않았습니다.')
      } else if ((json.pendingCount ?? 0) === 0) {
        setRemindMsg(uiLocaleEn ? 'No pending signers.' : '미서명자가 없습니다.')
      } else {
        setRemindMsg(
          uiLocaleEn
            ? `Push sent: ${json.sent ?? 0} · failed ${json.failed ?? 0} · no subscription ${json.noSubscriptions ?? 0} (of ${json.pendingCount} pending)`
            : `푸시 발송: ${json.sent ?? 0}건 · 실패 ${json.failed ?? 0} · 구독 없음 ${json.noSubscriptions ?? 0} (미서명 ${json.pendingCount}명)`
        )
      }
    } catch (e) {
      setRemindMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setRemindBusy(false)
      window.setTimeout(() => setRemindMsg(null), 6000)
    }
  }

  return (
    <div className="min-w-0 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {latest ? (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              pendingCount === 0 ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-900'
            }`}
          >
            {uiLocaleEn
              ? `${signedCount}/${rows.length} signed`
              : `${signedCount}/${rows.length}명 완료`}
            {pendingCount > 0
              ? uiLocaleEn
                ? ` · ${pendingCount} pending`
                : ` · ${pendingCount}명 미서명`
              : null}
          </span>
        ) : null}
      </div>

      {!latest ? (
        <p className="mt-2 text-xs text-gray-600">{uiLocaleEn ? 'No published version yet.' : '게시된 버전이 없습니다.'}</p>
      ) : (
        <>
          <p className="mt-1 text-xs text-gray-700">
            {uiLocaleEn ? 'Version' : '제'} {latest.version_number} — {latest.title}{' '}
            {signHref ? (
              <Link className="text-primary underline" href={signHref}>
                {uiLocaleEn ? 'Sign page' : '서명 페이지'}
              </Link>
            ) : null}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={filter === 'all' ? 'default' : 'outline'}
              className="h-7 text-xs"
              onClick={() => setFilter('all')}
            >
              {uiLocaleEn ? 'All' : '전체'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={filter === 'pending' ? 'default' : 'outline'}
              className="h-7 text-xs"
              disabled={pendingCount === 0}
              onClick={() => setFilter('pending')}
            >
              {uiLocaleEn ? 'Pending only' : '미서명만'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              disabled={pendingCount === 0}
              onClick={() => void copyUnsignedEmails()}
            >
              {uiLocaleEn ? 'Copy emails' : '이메일 복사'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-7 text-xs"
              disabled={pendingCount === 0 || remindBusy}
              onClick={() => void remindUnsigned()}
            >
              {remindBusy
                ? uiLocaleEn
                  ? 'Sending…'
                  : '발송 중…'
                : uiLocaleEn
                  ? 'Push remind'
                  : '푸시 리마인드'}
            </Button>
          </div>
          {copyMsg ? <p className="mt-1 text-xs text-gray-600">{copyMsg}</p> : null}
          {remindMsg ? <p className="mt-1 text-xs text-gray-700">{remindMsg}</p> : null}

          <div className="mt-2 max-h-64 overflow-auto rounded border border-gray-100">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="px-2 py-1.5">{uiLocaleEn ? 'Member' : '팀원'}</th>
                  <th className="px-2 py-1.5">{uiLocaleEn ? 'Status' : '상태'}</th>
                  <th className="px-2 py-1.5">PDF</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-2 py-4 text-center text-gray-500">
                      {filter === 'pending'
                        ? uiLocaleEn
                          ? 'No pending signers.'
                          : '미서명자가 없습니다.'
                        : uiLocaleEn
                          ? 'No team members.'
                          : '팀원이 없습니다.'}
                    </td>
                  </tr>
                ) : (
                  visibleRows.map((t) => (
                    <tr key={t.email} className="border-t border-gray-100">
                      <td className="px-2 py-1.5">
                        <div className="font-medium text-gray-900">{t.label}</div>
                        <div className="truncate text-gray-500">{t.email}</div>
                      </td>
                      <td className="px-2 py-1.5">
                        {t.sig ? (
                          <span className="text-green-700">{uiLocaleEn ? 'Signed' : '완료'}</span>
                        ) : (
                          <span className="text-amber-700">
                            {uiLocaleEn ? 'Pending' : '미서명'}
                            {signHref ? (
                              <>
                                {' · '}
                                <Link className="underline" href={signHref}>
                                  {uiLocaleEn ? 'Sign' : '서명'}
                                </Link>
                              </>
                            ) : null}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        {t.sig ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            disabled={openingPdf === t.sig.pdf_storage_path && openingPdfBucket === bucket}
                            onClick={() => onOpenPdf(t.sig!.pdf_storage_path, bucket)}
                          >
                            PDF
                          </Button>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

export default function StructuredDocCompliancePanels({
  uiLocaleEn,
  locale,
  bundle,
}: {
  uiLocaleEn: boolean
  locale: string
  bundle: StructuredDocDualCompliance
}) {
  const { team, sopLatest, sopSigs, contractLatest, contractSigs, onOpenPdf, openingPdf, openingPdfBucket } = bundle

  const sopMap = useMemo(() => {
    const m = new Map<string, ComplianceSigRow>()
    for (const s of sopSigs) m.set(s.signer_email.trim().toLowerCase(), s)
    return m
  }, [sopSigs])

  const contractMap = useMemo(() => {
    const m = new Map<string, ComplianceSigRow>()
    for (const s of contractSigs) m.set(s.signer_email.trim().toLowerCase(), s)
    return m
  }, [contractSigs])

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <ComplianceColumn
        title={uiLocaleEn ? 'SOP signature status (latest version)' : 'SOP 서명 현황 (최신 버전)'}
        latest={sopLatest}
        sigs={sopMap}
        team={team}
        docRoute="sop"
        bucket="sop-signatures"
        locale={locale}
        uiLocaleEn={uiLocaleEn}
        onOpenPdf={onOpenPdf}
        openingPdf={openingPdf}
        openingPdfBucket={openingPdfBucket}
      />
      <ComplianceColumn
        title={uiLocaleEn ? 'Employment contract signature status' : '직원 계약서 서명 현황 (최신 버전)'}
        latest={contractLatest}
        sigs={contractMap}
        team={team}
        docRoute="employee-contract"
        bucket="employee-contract-signatures"
        locale={locale}
        uiLocaleEn={uiLocaleEn}
        onOpenPdf={onOpenPdf}
        openingPdf={openingPdf}
        openingPdfBucket={openingPdfBucket}
      />
    </div>
  )
}
