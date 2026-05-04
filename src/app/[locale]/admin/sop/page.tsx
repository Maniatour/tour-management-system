'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { canManageCompanySop, normalizeEmail } from '@/lib/sopPermissions'
import { fetchStructuredDocVersionList } from '@/lib/companyStructuredDocVersions'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import AdminStructuredDocPublishTab, {
  type StructuredDocDualCompliance,
  type StructuredDocVersionRow,
} from '@/components/sop/AdminStructuredDocPublishTab'

type SopVersion = StructuredDocVersionRow

type TeamRow = { email: string; name_ko: string | null; name_en: string | null; is_active: boolean | null }
type SigRow = {
  signer_email: string
  signer_name: string
  signed_at: string
  pdf_storage_path: string
}

type StorageBucket = 'sop-signatures' | 'employee-contract-signatures'

export default function AdminSopPage() {
  const params = useParams()
  const locale = (params?.locale as string) || 'ko'
  const uiLocaleEn = locale === 'en'
  const { authUser, userRole, loading, isInitialized } = useAuth()

  const [canManage, setCanManage] = useState(false)

  const [versions, setVersions] = useState<SopVersion[]>([])
  const [latest, setLatest] = useState<SopVersion | null>(null)
  const [team, setTeam] = useState<TeamRow[]>([])
  const [sigs, setSigs] = useState<SigRow[]>([])

  const [contractVersions, setContractVersions] = useState<SopVersion[]>([])
  const [contractLatest, setContractLatest] = useState<SopVersion | null>(null)
  const [contractSigs, setContractSigs] = useState<SigRow[]>([])

  const [openingPdf, setOpeningPdf] = useState<string | null>(null)
  const [openingPdfBucket, setOpeningPdfBucket] = useState<StorageBucket>('sop-signatures')

  const [sopAdminTab, setSopAdminTab] = useState<'edit' | 'employee-contract' | 'tour-checklists'>('edit')

  const staffOk =
    userRole === 'admin' || userRole === 'manager' || userRole === 'team_member'

  const loadTeam = useCallback(async () => {
    const { data: teamData } = await supabase
      .from('team')
      .select('email, name_ko, name_en, is_active')
      .eq('is_active', true)
      .order('email')
    setTeam((teamData || []) as TeamRow[])
  }, [])

  const loadCompliance = useCallback(
    async (versionId: string) => {
      const { data: sigData } = await supabase
        .from('sop_signatures')
        .select('signer_email, signer_name, signed_at, pdf_storage_path')
        .eq('version_id', versionId)
      await loadTeam()
      setSigs((sigData || []) as SigRow[])
    },
    [loadTeam]
  )

  const refreshVersions = useCallback(async () => {
    const { rows, error } = await fetchStructuredDocVersionList(supabase, 'company_sop_versions')
    if (error) console.warn('company_sop_versions list:', error.message)
    const list = rows as SopVersion[]
    setVersions(list)
    const top = list[0] || null
    setLatest(top)
    if (top) await loadCompliance(top.id)
    else {
      setSigs([])
    }
  }, [loadCompliance])

  const loadContractCompliance = useCallback(
    async (versionId: string) => {
      const { data: sigData } = await supabase
        .from('employee_contract_signatures')
        .select('signer_email, signer_name, signed_at, pdf_storage_path')
        .eq('version_id', versionId)
      await loadTeam()
      setContractSigs((sigData || []) as SigRow[])
    },
    [loadTeam]
  )

  const refreshContractVersions = useCallback(async () => {
    const { rows, error } = await fetchStructuredDocVersionList(supabase, 'company_employee_contract_versions')
    if (error) console.warn('company_employee_contract_versions list:', error.message)
    const list = rows as SopVersion[]
    setContractVersions(list)
    const top = list[0] || null
    setContractLatest(top)
    if (top) await loadContractCompliance(top.id)
    else {
      setContractSigs([])
    }
  }, [loadContractCompliance])

  useEffect(() => {
    if (!isInitialized || loading || !authUser?.email) return
    if (!staffOk) return

    const run = async () => {
      const { data: teamRow } = await supabase
        .from('team')
        .select('position, is_active')
        .eq('email', normalizeEmail(authUser.email))
        .maybeSingle()

      setCanManage(canManageCompanySop(authUser.email, teamRow))
      await refreshVersions()
      await refreshContractVersions()
    }
    void run()
  }, [authUser?.email, isInitialized, loading, loadTeam, refreshVersions, refreshContractVersions, staffOk])

  const contractSigByEmail = useMemo(() => {
    const m = new Map<string, SigRow>()
    for (const s of contractSigs) {
      m.set(s.signer_email.trim().toLowerCase(), s)
    }
    return m
  }, [contractSigs])

  const sigByEmail = useMemo(() => {
    const m = new Map<string, SigRow>()
    for (const s of sigs) {
      m.set(s.signer_email.trim().toLowerCase(), s)
    }
    return m
  }, [sigs])

  const openPdf = useCallback(async (path: string, bucket: StorageBucket) => {
    setOpeningPdf(path)
    setOpeningPdfBucket(bucket)
    try {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600)
      if (error || !data?.signedUrl) {
        alert(error?.message || (uiLocaleEn ? 'Could not open PDF.' : 'PDF 링크를 만들 수 없습니다.'))
        return
      }
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
    } finally {
      setOpeningPdf(null)
    }
  }, [uiLocaleEn])

  const dualComplianceBundle: StructuredDocDualCompliance = useMemo(
    () => ({
      team: team.map((t) => ({ email: t.email, name_ko: t.name_ko, name_en: t.name_en })),
      sopLatest: latest,
      sopSigs: sigs,
      contractLatest,
      contractSigs,
      onOpenPdf: openPdf,
      openingPdf,
      openingPdfBucket,
    }),
    [team, latest, sigs, contractLatest, contractSigs, openingPdf, openingPdfBucket, openPdf]
  )

  if (!isInitialized || loading) {
    return (
      <div className="p-6">
        <p className="text-gray-600">{uiLocaleEn ? 'Loading…' : '불러오는 중…'}</p>
      </div>
    )
  }

  if (!staffOk) {
    return (
      <div className="p-6">
        <p className="text-red-600">{uiLocaleEn ? 'Access denied.' : '접근할 수 없습니다.'}</p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-none px-3 py-4 sm:px-5 sm:py-6 md:px-6 space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {uiLocaleEn ? 'Company SOP' : '회사 SOP'}
        </h1>
        <p className="text-gray-600 mt-1 text-sm">
          {canManage
            ? uiLocaleEn
              ? 'Open a version row to edit. Saving creates a new version. Signature compliance for both documents is under each tab.'
              : '버전 행을 열어 수정합니다. 저장 시 새 버전이 추가됩니다. 두 문서의 서명 현황은 각 탭 하단에서 확인합니다.'
            : uiLocaleEn
              ? 'View signature compliance and published versions below.'
              : '아래에서 서명 현황과 게시된 버전을 확인할 수 있습니다.'}
        </p>
      </div>

      {canManage ? (
        <div className="w-full rounded-lg border border-gray-200 bg-white shadow-sm">
          <div
            role="tablist"
            aria-label={uiLocaleEn ? 'Company SOP admin' : '회사 SOP 관리'}
            className="flex flex-wrap gap-1 border-b border-gray-200 bg-slate-50/90 px-2 pt-2"
          >
            <button
              type="button"
              role="tab"
              aria-selected={sopAdminTab === 'edit'}
              className={`rounded-t-md px-4 py-2.5 text-sm font-medium transition-colors ${
                sopAdminTab === 'edit'
                  ? 'border border-b-0 border-gray-200 bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:bg-white/60 hover:text-gray-900'
              }`}
              onClick={() => setSopAdminTab('edit')}
            >
              {uiLocaleEn ? 'Edit SOP' : 'SOP 수정'}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={sopAdminTab === 'employee-contract'}
              className={`rounded-t-md px-4 py-2.5 text-sm font-medium transition-colors ${
                sopAdminTab === 'employee-contract'
                  ? 'border border-b-0 border-gray-200 bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:bg-white/60 hover:text-gray-900'
              }`}
              onClick={() => setSopAdminTab('employee-contract')}
            >
              {uiLocaleEn ? 'Employment contract' : '직원 계약서'}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={sopAdminTab === 'tour-checklists'}
              className={`rounded-t-md px-4 py-2.5 text-sm font-medium transition-colors ${
                sopAdminTab === 'tour-checklists'
                  ? 'border border-b-0 border-gray-200 bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:bg-white/60 hover:text-gray-900'
              }`}
              onClick={() => setSopAdminTab('tour-checklists')}
            >
              {uiLocaleEn ? 'Per-tour checklists' : '투어별 체크리스트 관리'}
            </button>
          </div>

          {sopAdminTab === 'tour-checklists' ? (
            <div className="p-6" role="tabpanel">
              <p className="text-sm leading-relaxed text-gray-700">
                {uiLocaleEn
                  ? 'Here you will link SOP checklist lines to tours and track guide completion. Database and UI for tour-level checklist assignments are not connected yet; this tab reserves the workflow.'
                  : 'SOP에 정의한 체크 줄을 투어별로 붙이고, 가이드 이행 여부를 관리하는 화면입니다. 투어 연동·저장 테이블은 아직 연결 전이며, 이 탭에서 작업 흐름을 확장할 예정입니다.'}
              </p>
              <p className="mt-3 text-xs text-gray-500">
                {uiLocaleEn
                  ? 'Checklist line IDs are stored in the published SOP body_structure for future use.'
                  : '체크 줄 id는 게시된 SOP의 body_structure에 포함되어 추후 투어와 매칭할 수 있습니다.'}
              </p>
            </div>
          ) : sopAdminTab === 'edit' ? (
            <AdminStructuredDocPublishTab
              kind="sop"
              locale={locale}
              uiLocaleEn={uiLocaleEn}
              canManage={canManage}
              versionRows={versions}
              onVersionsChange={() => {
                void refreshVersions()
                void refreshContractVersions()
              }}
              dualCompliance={dualComplianceBundle}
            />
          ) : (
            <AdminStructuredDocPublishTab
              kind="employee_contract"
              locale={locale}
              uiLocaleEn={uiLocaleEn}
              canManage={canManage}
              versionRows={contractVersions}
              onVersionsChange={() => {
                void refreshVersions()
                void refreshContractVersions()
              }}
              dualCompliance={dualComplianceBundle}
            />
          )}
        </div>
      ) : (
        <p className="text-sm text-gray-600">
          {uiLocaleEn
            ? 'You can view compliance and open PDFs. Only Super / OP / Office Manager can edit versions.'
            : '서명 현황 조회·PDF 열람은 가능합니다. SOP·직원 계약서 버전 수정은 Super / OP / Office Manager만 할 수 있습니다.'}
        </p>
      )}

      {!canManage ? (
        <>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{uiLocaleEn ? 'Latest SOP — compliance' : '최신 SOP 서명 현황'}</h2>
        {!latest ? (
          <p className="text-gray-600 text-sm">{uiLocaleEn ? 'No SOP published yet.' : '게시된 SOP가 없습니다.'}</p>
        ) : (
          <>
            <p className="text-sm text-gray-700">
              {uiLocaleEn ? 'Version' : '제'} {latest.version_number} — {latest.title}{' '}
              <Link className="text-blue-600 underline" href={`/${locale}/sop/sign?version=${latest.id}`}>
                {uiLocaleEn ? 'Open sign page' : '서명 페이지'}
              </Link>
            </p>
            <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left">
                  <tr>
                    <th className="px-3 py-2">{uiLocaleEn ? 'Team member' : '팀원'}</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">{uiLocaleEn ? 'Status' : '상태'}</th>
                    <th className="px-3 py-2">{uiLocaleEn ? 'Signed at' : '서명 시각'}</th>
                    <th className="px-3 py-2">PDF</th>
                  </tr>
                </thead>
                <tbody>
                  {team.map((t) => {
                    const sig = sigByEmail.get(t.email.trim().toLowerCase())
                    return (
                      <tr key={t.email} className="border-t border-gray-100">
                        <td className="px-3 py-2">{t.name_ko || t.name_en || '—'}</td>
                        <td className="px-3 py-2">{t.email}</td>
                        <td className="px-3 py-2">
                          {sig ? (
                            <span className="text-green-700 font-medium">{uiLocaleEn ? 'Signed' : '완료'}</span>
                          ) : (
                            <span className="text-amber-700 font-medium">{uiLocaleEn ? 'Pending' : '미서명'}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-600">
                          {sig ? new Date(sig.signed_at).toLocaleString(uiLocaleEn ? 'en-US' : 'ko-KR') : '—'}
                        </td>
                        <td className="px-3 py-2">
                          {sig ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={openingPdf === sig.pdf_storage_path && openingPdfBucket === 'sop-signatures'}
                              onClick={() => void openPdf(sig.pdf_storage_path, 'sop-signatures')}
                            >
                              {openingPdf === sig.pdf_storage_path && openingPdfBucket === 'sop-signatures'
                                ? uiLocaleEn
                                  ? 'Opening…'
                                  : '열기…'
                                : uiLocaleEn
                                  ? 'View PDF'
                                  : 'PDF 보기'}
                            </Button>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">
          {uiLocaleEn ? 'Latest employment contract — compliance' : '최신 직원 계약서 서명 현황'}
        </h2>
        {!contractLatest ? (
          <p className="text-gray-600 text-sm">
            {uiLocaleEn ? 'No employment contract published yet.' : '게시된 직원 계약서가 없습니다.'}
          </p>
        ) : (
          <>
            <p className="text-sm text-gray-700">
              {uiLocaleEn ? 'Version' : '제'} {contractLatest.version_number} — {contractLatest.title}{' '}
              <Link className="text-blue-600 underline" href={`/${locale}/employee-contract/sign?version=${contractLatest.id}`}>
                {uiLocaleEn ? 'Open sign page' : '서명 페이지'}
              </Link>
            </p>
            <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left">
                  <tr>
                    <th className="px-3 py-2">{uiLocaleEn ? 'Team member' : '팀원'}</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">{uiLocaleEn ? 'Status' : '상태'}</th>
                    <th className="px-3 py-2">{uiLocaleEn ? 'Signed at' : '서명 시각'}</th>
                    <th className="px-3 py-2">PDF</th>
                  </tr>
                </thead>
                <tbody>
                  {team.map((t) => {
                    const sig = contractSigByEmail.get(t.email.trim().toLowerCase())
                    return (
                      <tr key={`c-${t.email}`} className="border-t border-gray-100">
                        <td className="px-3 py-2">{t.name_ko || t.name_en || '—'}</td>
                        <td className="px-3 py-2">{t.email}</td>
                        <td className="px-3 py-2">
                          {sig ? (
                            <span className="text-green-700 font-medium">{uiLocaleEn ? 'Signed' : '완료'}</span>
                          ) : (
                            <span className="text-amber-700 font-medium">{uiLocaleEn ? 'Pending' : '미서명'}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-600">
                          {sig ? new Date(sig.signed_at).toLocaleString(uiLocaleEn ? 'en-US' : 'ko-KR') : '—'}
                        </td>
                        <td className="px-3 py-2">
                          {sig ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={
                                openingPdf === sig.pdf_storage_path && openingPdfBucket === 'employee-contract-signatures'
                              }
                              onClick={() => void openPdf(sig.pdf_storage_path, 'employee-contract-signatures')}
                            >
                              {openingPdf === sig.pdf_storage_path &&
                              openingPdfBucket === 'employee-contract-signatures'
                                ? uiLocaleEn
                                  ? 'Opening…'
                                  : '열기…'
                                : uiLocaleEn
                                  ? 'View PDF'
                                  : 'PDF 보기'}
                            </Button>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">{uiLocaleEn ? 'Published SOP versions' : '게시된 SOP 버전'}</h2>
        <ul className="text-sm space-y-1 text-gray-800">
          {versions.map((v) => (
            <li key={v.id}>
              v{v.version_number} — {v.title}{' '}
              <span className="text-gray-500">({new Date(v.published_at).toLocaleString(uiLocaleEn ? 'en-US' : 'ko-KR')})</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">{uiLocaleEn ? 'Published contract versions' : '게시된 직원 계약서 버전'}</h2>
        <ul className="text-sm space-y-1 text-gray-800">
          {contractVersions.map((v) => (
            <li key={v.id}>
              v{v.version_number} — {v.title}{' '}
              <span className="text-gray-500">({new Date(v.published_at).toLocaleString(uiLocaleEn ? 'en-US' : 'ko-KR')})</span>
            </li>
          ))}
        </ul>
      </section>
        </>
      ) : null}
    </div>
  )
}
