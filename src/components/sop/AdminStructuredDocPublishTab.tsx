'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Send } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import LightRichEditor from '@/components/LightRichEditor'
import SopStructureEditor from '@/components/sop/SopStructureEditor'
import SopPrintPreviewFrame from '@/components/sop/SopPrintPreviewFrame'
import SopFreeformPrintPreviewFrame from '@/components/sop/SopFreeformPrintPreviewFrame'
import SopPrintPreviewFloatingPanel from '@/components/sop/SopPrintPreviewFloatingPanel'
import SopDocumentReadonly from '@/components/sop/SopDocumentReadonly'
import type { Json } from '@/lib/database.types'
import {
  emptySopDocument,
  parseSopDocumentJson,
  parseSopPlainTextToDocument,
  mergeParallelKoEnPasteDocs,
  isPublishableSopDocument,
  sopDocumentToJson,
  prefillSortOrders,
  primaryDocumentTitle,
  mergeLatestSectionSnapshotsIntoDoc,
  parseSopSectionJson,
  sopText,
  flattenSopDocumentToPlainText,
  mergeStructuredDocKeepOtherLocaleFromBaseline,
  type SopDocument,
  type SopEditLocale,
  type SopSection,
} from '@/types/sopStructure'
import { normalizeEmail } from '@/lib/sopPermissions'
import { insertStructuredDocVersion, isMissingFreeformColumnError } from '@/lib/companyStructuredDocVersions'
import { cn } from '@/lib/utils'

export type AdminStructuredDocKind = 'sop' | 'employee_contract'

/** 미리보기·구조 편집 열: 🇰🇷 ↔ 🇺🇸 토글 (왼쪽=한국어, 오른쪽=English) */
function KoEnLangSwitch({
  value,
  onChange,
  disabled,
  uiLocaleEn,
}: {
  value: SopEditLocale
  onChange: (next: SopEditLocale) => void
  disabled?: boolean
  uiLocaleEn: boolean
}) {
  const isEn = value === 'en'
  const aria =
    isEn
      ? uiLocaleEn
        ? 'Language: English (switch for Korean)'
        : '언어: English (누르면 한국어)'
      : uiLocaleEn
        ? 'Language: Korean (switch for English)'
        : '언어: 한국어 (누르면 English)'
  return (
    <div
      className="inline-flex items-center gap-2 rounded-md border border-slate-200/80 bg-slate-50/80 px-2 py-1"
      title={isEn ? 'English' : '한국어'}
    >
      <span className="text-lg leading-none select-none" aria-hidden>
        🇰🇷
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={isEn}
        aria-label={aria}
        disabled={disabled}
        onClick={() => onChange(isEn ? 'ko' : 'en')}
        className={cn(
          'relative h-7 w-[2.75rem] shrink-0 rounded-full border-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400',
          isEn ? 'border-violet-400 bg-violet-200/90' : 'border-sky-400 bg-sky-200/90',
          disabled && 'pointer-events-none opacity-45'
        )}
      >
        <span
          className={cn(
            'pointer-events-none absolute top-0.5 h-[1.125rem] w-[1.125rem] rounded-full bg-white shadow transition-transform duration-200 ease-out',
            isEn ? 'translate-x-[1.35rem]' : 'translate-x-0.5'
          )}
          aria-hidden
        />
      </button>
      <span className="text-lg leading-none select-none" title="English" aria-hidden>
        🇺🇸
      </span>
    </div>
  )
}

export type StructuredDocVersionRow = {
  id: string
  version_number: number
  title: string
  body_md: string | null
  body_structure: unknown
  freeform_markdown?: string | null
  published_at: string
}

type ModalMainTab = 'preview' | 'structure' | 'freeform'

type SectionAuditRow = {
  id: string
  section_id: string
  revision: number
  created_at: string
  created_by: string | null
  section_json: Json
}

type ComplianceSigRow = {
  signer_email: string
  signer_name: string
  signed_at: string
  pdf_storage_path: string
}

type TeamRow = { email: string; name_ko: string | null; name_en: string | null }

export type StructuredDocDualCompliance = {
  team: TeamRow[]
  sopLatest: StructuredDocVersionRow | null
  sopSigs: ComplianceSigRow[]
  contractLatest: StructuredDocVersionRow | null
  contractSigs: ComplianceSigRow[]
  onOpenPdf: (path: string, bucket: 'sop-signatures' | 'employee-contract-signatures') => void
  openingPdf: string | null
  openingPdfBucket: 'sop-signatures' | 'employee-contract-signatures'
}

function defaultEditorSopDocument(): SopDocument {
  return prefillSortOrders({
    ...emptySopDocument(),
    title_ko: '투어 가이드 / 드라이버 표준 운영 절차 (SOP)',
    title_en: 'Tour Guide / Driver Standard Operating Procedures (SOP)',
  })
}

function defaultEditorContractDocument(): SopDocument {
  return prefillSortOrders({
    ...emptySopDocument(),
    title_ko: '직원 계약서',
    title_en: 'Employment contract',
  })
}

function cloneSopDocument(doc: SopDocument): SopDocument {
  const parsed = parseSopDocumentJson(sopDocumentToJson(doc) as unknown)
  return parsed ? prefillSortOrders(parsed) : doc
}

function sigMap(rows: ComplianceSigRow[]) {
  const m = new Map<string, ComplianceSigRow>()
  for (const s of rows) {
    m.set(s.signer_email.trim().toLowerCase(), s)
  }
  return m
}

function DualCompliancePanels({
  uiLocaleEn,
  locale,
  bundle,
}: {
  uiLocaleEn: boolean
  locale: string
  bundle: StructuredDocDualCompliance
}) {
  const { team, sopLatest, sopSigs, contractLatest, contractSigs, onOpenPdf, openingPdf, openingPdfBucket } = bundle
  const sopMap = useMemo(() => sigMap(sopSigs), [sopSigs])
  const contractMap = useMemo(() => sigMap(contractSigs), [contractSigs])

  const col = (
    title: string,
    latest: StructuredDocVersionRow | null,
    sigs: Map<string, ComplianceSigRow>,
    docRoute: 'sop' | 'employee-contract',
    bucket: 'sop-signatures' | 'employee-contract-signatures'
  ) => (
    <div className="min-w-0 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      {!latest ? (
        <p className="mt-2 text-xs text-gray-600">{uiLocaleEn ? 'No published version yet.' : '게시된 버전이 없습니다.'}</p>
      ) : (
        <>
          <p className="mt-1 text-xs text-gray-700">
            {uiLocaleEn ? 'Version' : '제'} {latest.version_number} — {latest.title}{' '}
            <Link
              className="text-blue-600 underline"
              href={
                docRoute === 'sop'
                  ? `/${locale}/sop/sign?version=${latest.id}`
                  : `/${locale}/employee-contract/sign?version=${latest.id}`
              }
            >
              {uiLocaleEn ? 'Sign page' : '서명 페이지'}
            </Link>
          </p>
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
                {team.map((t) => {
                  const sig = sigs.get(t.email.trim().toLowerCase())
                  const label = uiLocaleEn ? t.name_en || t.name_ko || t.email : t.name_ko || t.name_en || t.email
                  return (
                    <tr key={t.email} className="border-t border-gray-100">
                      <td className="px-2 py-1.5">
                        <div className="font-medium text-gray-900">{label}</div>
                        <div className="truncate text-gray-500">{t.email}</div>
                      </td>
                      <td className="px-2 py-1.5">
                        {sig ? (
                          <span className="text-green-700">{uiLocaleEn ? 'Signed' : '완료'}</span>
                        ) : (
                          <span className="text-amber-700">{uiLocaleEn ? 'Pending' : '미서명'}</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        {sig ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            disabled={openingPdf === sig.pdf_storage_path && openingPdfBucket === bucket}
                            onClick={() => onOpenPdf(sig.pdf_storage_path, bucket)}
                          >
                            PDF
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
    </div>
  )

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {col(
        uiLocaleEn ? 'SOP signature status (latest version)' : 'SOP 서명 현황 (최신 버전)',
        sopLatest,
        sopMap,
        'sop',
        'sop-signatures'
      )}
      {col(
        uiLocaleEn ? 'Employment contract signature status' : '직원 계약서 서명 현황 (최신 버전)',
        contractLatest,
        contractMap,
        'employee-contract',
        'employee-contract-signatures'
      )}
    </div>
  )
}

export default function AdminStructuredDocPublishTab({
  kind,
  locale,
  uiLocaleEn,
  canManage,
  versionRows,
  onVersionsChange,
  dualCompliance,
}: {
  kind: AdminStructuredDocKind
  locale: string
  uiLocaleEn: boolean
  canManage: boolean
  versionRows: StructuredDocVersionRow[]
  onVersionsChange: () => void | Promise<void>
  dualCompliance: StructuredDocDualCompliance
}) {
  const { authUser } = useAuth()
  const defaultDoc = kind === 'sop' ? defaultEditorSopDocument : defaultEditorContractDocument

  const [sopEditLang, setSopEditLang] = useState<SopEditLocale>('ko')
  const [structureDoc, setStructureDoc] = useState<SopDocument>(() => defaultDoc())
  const [freeformMarkdown, setFreeformMarkdown] = useState('')
  const [sectionVersionMeta, setSectionVersionMeta] = useState<Record<string, { revision: number; savedAt: string }>>({})
  const [savingSectionId, setSavingSectionId] = useState<string | null>(null)
  const [pasteRaw, setPasteRaw] = useState('')
  const [pasteRawEn, setPasteRawEn] = useState('')
  const [teamRows, setTeamRows] = useState<TeamRow[]>([])
  const [selectedCampaignEmails, setSelectedCampaignEmails] = useState<Set<string>>(() => new Set())
  const [campaignTitle, setCampaignTitle] = useState('')
  const [campaignNote, setCampaignNote] = useState('')
  const [sendingCampaign, setSendingCampaign] = useState(false)
  const [campaignModalOpen, setCampaignModalOpen] = useState(false)
  const [campaignBodyStructure, setCampaignBodyStructure] = useState<SopDocument | null>(null)
  const [pasteImportModalOpen, setPasteImportModalOpen] = useState(false)
  type CampaignSigListRow = {
    id: string
    signed_at: string
    signer_name: string
    signer_email: string
    pdf_storage_path: string
    campaign_id: string
    company_structured_doc_sign_campaigns: {
      title: string
      doc_kind: string
      created_at: string
    } | null
  }
  const [campaignSigRows, setCampaignSigRows] = useState<CampaignSigListRow[]>([])
  const [campaignSigLoading, setCampaignSigLoading] = useState(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [savingVersion, setSavingVersion] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [modalMainTab, setModalMainTab] = useState<ModalMainTab>('preview')
  const [auditRows, setAuditRows] = useState<SectionAuditRow[]>([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditErr, setAuditErr] = useState<string | null>(null)
  const [printPreviewOpen, setPrintPreviewOpen] = useState(false)
  const previewA4Ref = useRef<HTMLDivElement>(null)
  /** 모달에서 편집 중인 `company_*_versions` 행 id — 섹션 스냅샷·이력 스코프. 새 템플릿만 열면 null */
  const editingPublishedVersionIdRef = useRef<string | null>(null)
  /** 마지막으로 서버에 반영된 스냅샷(반대 언어 병합 시 참조) */
  const baselineStructureDocRef = useRef<SopDocument | null>(null)
  const [structureContentFocus, setStructureContentFocus] = useState<SopEditLocale>('ko')
  const [savingLocaleSlice, setSavingLocaleSlice] = useState<SopEditLocale | null>(null)

  const floatingPreviewStorageKey = useMemo(
    () => (kind === 'sop' ? 'admin-sop-print-floating-rect' : 'admin-contract-print-floating-rect'),
    [kind]
  )

  useEffect(() => {
    if (!canManage) {
      setTeamRows([])
      return
    }
    void (async () => {
      const { data } = await supabase
        .from('team')
        .select('email, name_ko, name_en')
        .eq('is_active', true)
        .order('email')
      setTeamRows((data || []) as TeamRow[])
    })()
  }, [canManage])

  const refreshCampaignSignatures = useCallback(async () => {
    if (!canManage) return
    setCampaignSigLoading(true)
    try {
      const { data, error } = await supabase
        .from('company_structured_doc_campaign_signatures')
        .select(
          `id, signed_at, signer_name, signer_email, pdf_storage_path, campaign_id, company_structured_doc_sign_campaigns ( title, doc_kind, created_at )`
        )
        .order('signed_at', { ascending: false })
        .limit(80)
      if (error) throw error
      const rows = (data || []) as CampaignSigListRow[]
      setCampaignSigRows(rows.filter((r) => r.company_structured_doc_sign_campaigns?.doc_kind === kind))
    } catch (e) {
      console.warn('campaign signatures list:', e)
      setCampaignSigRows([])
    } finally {
      setCampaignSigLoading(false)
    }
  }, [canManage, kind])

  useEffect(() => {
    if (!canManage) return
    void refreshCampaignSignatures()
  }, [canManage, refreshCampaignSignatures])

  useEffect(() => {
    if (!campaignModalOpen || !canManage) return
    void refreshCampaignSignatures()
  }, [campaignModalOpen, canManage, refreshCampaignSignatures])

  const openCampaignSignedPdf = async (storagePath: string) => {
    const { data, error } = await supabase.storage
      .from('structured-doc-campaign-signatures')
      .createSignedUrl(storagePath, 3600)
    if (error || !data?.signedUrl) {
      setToastMsg(uiLocaleEn ? 'Could not open PDF.' : 'PDF를 열 수 없습니다.')
      return
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  const refreshSectionSnapshots = useCallback(
    async (publishedDocumentVersionId: string | null): Promise<Map<string, SopSection>> => {
      const m = new Map<string, SopSection>()
      const meta: Record<string, { revision: number; savedAt: string }> = {}

      const applyRows = (
        rows: Array<{
          section_id: string
          revision: number
          created_at: string
          section_json: Json
        }>
      ) => {
        for (const row of rows) {
          meta[row.section_id] = { revision: row.revision, savedAt: row.created_at }
          const sec = parseSopSectionJson(row.section_json)
          if (sec) m.set(row.section_id, sec)
        }
      }

      const { data: rpcData, error: rpcError } = await supabase.rpc('company_structured_doc_section_versions_latest', {
        p_doc_kind: kind,
        p_published_document_version_id: publishedDocumentVersionId,
      })

      if (!rpcError && Array.isArray(rpcData)) {
        applyRows(rpcData as Array<{ section_id: string; revision: number; created_at: string; section_json: Json }>)
        setSectionVersionMeta(meta)
        return m
      }

      if (rpcError) {
        console.warn('company_structured_doc_section_versions_latest:', rpcError.message)
      }

      const { data: allRows, error: tableError } = await supabase
        .from('company_structured_doc_section_versions')
        .select('section_id, revision, created_at, section_json, published_document_version_id')
        .eq('doc_kind', kind)

      if (tableError) {
        console.warn('company_structured_doc_section_versions:', tableError.message)
        setSectionVersionMeta({})
        return new Map<string, SopSection>()
      }

      const filtered = (allRows || []).filter((row) => {
        const rid = row.published_document_version_id as string | null | undefined
        if (publishedDocumentVersionId === null) return rid == null
        return rid === publishedDocumentVersionId
      })

      const bySection = new Map<string, { section_id: string; revision: number; created_at: string; section_json: Json }>()
      for (const row of filtered) {
        const prev = bySection.get(row.section_id)
        if (!prev || row.revision > prev.revision || (row.revision === prev.revision && row.created_at > prev.created_at)) {
          bySection.set(row.section_id, row)
        }
      }
      applyRows(Array.from(bySection.values()))
      setSectionVersionMeta(meta)
      return m
    },
    [kind]
  )

  const refreshSectionAuditLog = useCallback(async () => {
    if (!canManage) return
    const vid = editingPublishedVersionIdRef.current
    setAuditLoading(true)
    setAuditErr(null)
    try {
      let q = supabase
        .from('company_structured_doc_section_versions')
        .select('id, section_id, revision, created_at, created_by, section_json')
        .eq('doc_kind', kind)
      if (vid) q = q.eq('published_document_version_id', vid)
      else q = q.is('published_document_version_id', null)
      const { data, error } = await q.order('created_at', { ascending: false }).limit(100)
      if (error) throw error
      setAuditRows((data || []) as SectionAuditRow[])
    } catch (e) {
      setAuditErr(e instanceof Error ? e.message : String(e))
      setAuditRows([])
    } finally {
      setAuditLoading(false)
    }
  }, [canManage, kind])

  useEffect(() => {
    if (!editModalOpen || !canManage || modalMainTab !== 'preview') return
    void refreshSectionAuditLog()
  }, [editModalOpen, canManage, modalMainTab, refreshSectionAuditLog])

  const rowToStructureDoc = useCallback(
    (row: StructuredDocVersionRow, snapMap: Map<string, SopSection>): SopDocument => {
      const parsed = parseSopDocumentJson(row.body_structure)
      let base: SopDocument
      if (parsed) {
        if (!parsed.title_ko?.trim() && !parsed.title_en?.trim() && row.title) {
          base = { ...parsed, title_ko: row.title }
        } else {
          base = parsed
        }
      } else if (row.body_md?.trim()) {
        base = parseSopPlainTextToDocument(row.body_md)
      } else {
        base = kind === 'sop' ? defaultEditorSopDocument() : defaultEditorContractDocument()
      }
      return mergeLatestSectionSnapshotsIntoDoc(prefillSortOrders(base), snapMap)
    },
    [kind]
  )

  const openEditModal = useCallback(
    async (row: StructuredDocVersionRow | null) => {
      if (!canManage) return
      editingPublishedVersionIdRef.current = row?.id ?? null
      setToastMsg(null)
      setModalMainTab('preview')
      if (row) {
        const snapMap = await refreshSectionSnapshots(row.id)
        const loaded = rowToStructureDoc(row, snapMap)
        setStructureDoc(loaded)
        baselineStructureDocRef.current = cloneSopDocument(loaded)
        setFreeformMarkdown(typeof row.freeform_markdown === 'string' ? row.freeform_markdown : '')
      } else {
        const blank = prefillSortOrders(kind === 'sop' ? defaultEditorSopDocument() : defaultEditorContractDocument())
        setStructureDoc(blank)
        baselineStructureDocRef.current = cloneSopDocument(blank)
        setFreeformMarkdown('')
      }
      setStructureContentFocus('ko')
      setEditModalOpen(true)
    },
    [canManage, kind, refreshSectionSnapshots, rowToStructureDoc]
  )

  const openCampaignFromVersion = useCallback(
    async (row: StructuredDocVersionRow) => {
      if (!canManage) return
      const snapMap = await refreshSectionSnapshots(row.id)
      const doc = rowToStructureDoc(row, snapMap)
      setCampaignBodyStructure(doc)
      setCampaignTitle(primaryDocumentTitle(doc).trim() || row.title)
      setCampaignNote('')
      setSelectedCampaignEmails(new Set())
      setCampaignModalOpen(true)
    },
    [canManage, refreshSectionSnapshots, rowToStructureDoc]
  )

  const fetchSectionVersionHistory = useCallback(
    async (sectionId: string) => {
      const vid = editingPublishedVersionIdRef.current
      let q = supabase
        .from('company_structured_doc_section_versions')
        .select('id, revision, created_at, section_json, created_by')
        .eq('doc_kind', kind)
        .eq('section_id', sectionId)
      if (vid) q = q.eq('published_document_version_id', vid)
      else q = q.is('published_document_version_id', null)
      const { data, error } = await q.order('revision', { ascending: false })
      if (error) throw error
      return (data || []) as Array<{
        id: string
        revision: number
        created_at: string
        section_json: Json
        created_by: string | null
      }>
    },
    [kind]
  )

  const restoreSectionFromHistory = useCallback(
    async (sectionId: string, sectionJson: unknown) => {
      const restored = parseSopSectionJson(sectionJson)
      if (!restored) {
        setToastMsg(uiLocaleEn ? 'Could not read that section snapshot.' : '해당 섹션 저장 형식을 읽을 수 없습니다.')
        return
      }
      setStructureDoc((prev) =>
        prefillSortOrders({
          ...prev,
          sections: prev.sections.map((s) => (s.id === sectionId ? { ...restored, id: sectionId } : s)),
        })
      )
      await refreshSectionSnapshots(editingPublishedVersionIdRef.current)
      void refreshSectionAuditLog()
      setToastMsg(uiLocaleEn ? 'Section replaced from the selected version.' : '선택한 버전으로 이 섹션 내용을 바꿨습니다.')
    },
    [refreshSectionSnapshots, refreshSectionAuditLog, uiLocaleEn]
  )

  const sectionAuditLabel = useCallback(
    (sectionId: string, sectionJson: Json) => {
      const fromDoc = structureDoc.sections.find((s) => s.id === sectionId)
      if (fromDoc) {
        const t = sopText(fromDoc.title_ko, fromDoc.title_en, sopEditLang).trim()
        if (t) return t
      }
      const parsed = parseSopSectionJson(sectionJson)
      if (parsed) {
        const t = sopText(parsed.title_ko, parsed.title_en, sopEditLang).trim()
        if (t) return t
      }
      return uiLocaleEn ? `Section ${sectionId.slice(0, 8)}…` : `섹션 ${sectionId.slice(0, 8)}…`
    },
    [structureDoc, sopEditLang, uiLocaleEn]
  )

  const formatAuditSavedBy = (uid: string | null) => {
    if (!uid) return uiLocaleEn ? 'Unknown' : '알 수 없음'
    if (authUser?.id === uid) return uiLocaleEn ? 'You' : '본인'
    return `${uid.slice(0, 8)}…`
  }

  const saveSectionVersion = async (section: SopSection) => {
    if (!canManage || !authUser?.id) return
    setSavingSectionId(section.id)
    setToastMsg(null)
    try {
      const { data, error } = await supabase
        .from('company_structured_doc_section_versions')
        .insert({
          doc_kind: kind,
          section_id: section.id,
          section_json: section as unknown as Json,
          created_by: authUser.id,
          published_document_version_id: editingPublishedVersionIdRef.current,
        })
        .select('revision, created_at')
        .single()
      if (error) throw error
      await refreshSectionSnapshots(editingPublishedVersionIdRef.current)
      void refreshSectionAuditLog()
      setToastMsg(
        uiLocaleEn
          ? `Section snapshot saved (rev ${data?.revision ?? '—'}).`
          : `섹션 스냅샷 저장됨 (${data?.revision ?? '—'}차).`
      )
    } catch (e) {
      setToastMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setSavingSectionId(null)
    }
  }

  /** 붙여넣기 상자 내용 → 병합 문서 (실패 시 null, 토스트 설정) */
  const mergePasteInputToDocument = async (): Promise<SopDocument | null> => {
    if (!pasteRaw.trim() && !pasteRawEn.trim()) {
      setToastMsg(uiLocaleEn ? 'Paste Korean and/or English text first.' : '한국어·영문 중 하나 이상 붙여넣어 주세요.')
      return null
    }
    try {
      const snapMap = await refreshSectionSnapshots(editingPublishedVersionIdRef.current)
      const koDoc = parseSopPlainTextToDocument(pasteRaw, 'ko')
      const enDoc = parseSopPlainTextToDocument(pasteRawEn, 'en')
      const merged = mergeParallelKoEnPasteDocs(koDoc, enDoc)
      return mergeLatestSectionSnapshotsIntoDoc(merged, snapMap)
    } catch (e) {
      setToastMsg(e instanceof Error ? e.message : String(e))
      return null
    }
  }

  const applyPasteAsStructure = async (): Promise<boolean> => {
    const mergedDoc = await mergePasteInputToDocument()
    if (!mergedDoc) return false
    setStructureDoc(mergedDoc)
    baselineStructureDocRef.current = cloneSopDocument(mergedDoc)
    setToastMsg(
      uiLocaleEn ? 'Imported into structure. Review both columns.' : '구조로 반영했습니다. 두 열을 확인하세요.'
    )
    return true
  }

  /** `docOverride`가 있으면 해당 구조로 새 행 삽입(붙여넣기 저장 등). 없으면 현재 `structureDoc`. */
  const saveAsNewVersion = async (docOverride?: SopDocument) => {
    if (!canManage || !authUser?.id) return
    const doc = docOverride ?? structureDoc
    if (!isPublishableSopDocument(doc)) {
      setToastMsg(
        uiLocaleEn
          ? 'Add title and section/category content (KO or EN).'
          : '문서 제목과 섹션·카테고리 내용(한글 또는 영문)을 입력해 주세요.'
      )
      return
    }
    const table = kind === 'sop' ? 'company_sop_versions' : 'company_employee_contract_versions'
    setSavingVersion(true)
    setToastMsg(null)
    try {
      const { data: maxRow, error: maxErr } = await supabase
        .from(table)
        .select('version_number')
        .order('version_number', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (maxErr) throw maxErr
      const nextNum = (maxRow?.version_number ?? 0) + 1
      const title = primaryDocumentTitle(doc).trim()
      const bodyMd = flattenSopDocumentToPlainText(doc, 'ko')
      if (!title.trim() || !bodyMd.trim()) {
        setToastMsg(uiLocaleEn ? 'Title and body are required.' : '제목과 본문이 필요합니다.')
        return
      }
      const { error: insErr } = await insertStructuredDocVersion(supabase, table, {
        version_number: nextNum,
        title,
        body_md: bodyMd,
        body_structure: sopDocumentToJson(doc) as Json,
        freeform_markdown: freeformMarkdown,
        published_by: authUser.id,
      })
      if (insErr) throw insErr
      baselineStructureDocRef.current = cloneSopDocument(doc)
      setStructureDoc(doc)
      setToastMsg(
        uiLocaleEn ? `Saved as version ${nextNum}.` : `제${nextNum}판으로 저장했습니다.`
      )
      setEditModalOpen(false)
      await refreshSectionSnapshots(editingPublishedVersionIdRef.current)
      await onVersionsChange()
    } catch (e) {
      setToastMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setSavingVersion(false)
    }
  }

  /** 붙여넣기 모달에서 구조 반영 후 곧바로 새 버전으로 DB 저장 */
  const applyPasteAsStructureAndSaveNewVersion = async (): Promise<void> => {
    if (!canManage || !authUser?.id) return
    const mergedDoc = await mergePasteInputToDocument()
    if (!mergedDoc) return
    if (!isPublishableSopDocument(mergedDoc)) {
      setToastMsg(
        uiLocaleEn
          ? 'Parsed document is missing title or section content. Adjust the pasted text.'
          : '변환 결과에 제목 또는 섹션 내용이 부족합니다. 붙여넣은 텍스트를 확인해 주세요.'
      )
      return
    }
    setStructureDoc(mergedDoc)
    baselineStructureDocRef.current = cloneSopDocument(mergedDoc)
    setPasteImportModalOpen(false)
    await saveAsNewVersion(mergedDoc)
  }

  const sendSignCampaign = async () => {
    if (!canManage) return
    const doc = campaignBodyStructure
    const emails = [...selectedCampaignEmails].map((e) => normalizeEmail(e)).filter(Boolean)
    if (emails.length === 0) {
      setToastMsg(uiLocaleEn ? 'Select at least one teammate.' : '팀원을 한 명 이상 선택하세요.')
      return
    }
    if (!doc || !isPublishableSopDocument(doc)) {
      setToastMsg(uiLocaleEn ? 'Document structure is empty or invalid.' : '구조화 본문이 비었거나 형식이 맞지 않습니다.')
      return
    }
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    if (!token) {
      setToastMsg(uiLocaleEn ? 'Session expired.' : '세션이 만료되었습니다.')
      return
    }
    setSendingCampaign(true)
    setToastMsg(null)
    try {
      const res = await fetch('/api/structured-doc/sign-campaign', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          doc_kind: kind,
          recipient_emails: emails,
          body_structure: sopDocumentToJson(doc),
          title: campaignTitle.trim() || undefined,
          note: campaignNote.trim() || undefined,
        }),
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string; recipient_count?: number }
      if (!res.ok) throw new Error(json.error || (uiLocaleEn ? 'Send failed.' : '발송에 실패했습니다.'))
      setToastMsg(
        uiLocaleEn
          ? `Sent to ${json.recipient_count ?? emails.length} teammate(s).`
          : `${json.recipient_count ?? emails.length}명에게 발송했습니다.`
      )
      setSelectedCampaignEmails(new Set())
      setCampaignModalOpen(false)
      setCampaignBodyStructure(null)
      void refreshCampaignSignatures()
    } catch (e) {
      setToastMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setSendingCampaign(false)
    }
  }

  const saveLocaleSlice = async (loc: SopEditLocale) => {
    if (!canManage || !authUser?.id) return
    const baseline = baselineStructureDocRef.current ?? cloneSopDocument(structureDoc)
    const merged = mergeStructuredDocKeepOtherLocaleFromBaseline(structureDoc, baseline, loc)
    if (!isPublishableSopDocument(merged)) {
      setToastMsg(
        uiLocaleEn
          ? 'The merged document must still have a title and section content (KO or EN).'
          : '병합 결과가 제목·섹션 내용(한글 또는 영문) 요건을 만족해야 합니다.'
      )
      return
    }
    const table = kind === 'sop' ? 'company_sop_versions' : 'company_employee_contract_versions'
    const title = primaryDocumentTitle(merged).trim()
    const bodyMd = flattenSopDocumentToPlainText(merged, 'ko')
    if (!title.trim() || !bodyMd.trim()) {
      setToastMsg(uiLocaleEn ? 'Title and body are required.' : '제목과 본문이 필요합니다.')
      return
    }
    setSavingLocaleSlice(loc)
    setToastMsg(null)
    try {
      const vid = editingPublishedVersionIdRef.current
      if (vid) {
        let up = await supabase
          .from(table)
          .update({
            title,
            body_md: bodyMd,
            body_structure: sopDocumentToJson(merged) as Json,
            freeform_markdown: freeformMarkdown,
          })
          .eq('id', vid)
        if (up.error && isMissingFreeformColumnError(up.error.message)) {
          up = await supabase
            .from(table)
            .update({
              title,
              body_md: bodyMd,
              body_structure: sopDocumentToJson(merged) as Json,
            })
            .eq('id', vid)
        }
        if (up.error) throw up.error
      } else {
        const { data: maxRow, error: maxErr } = await supabase
          .from(table)
          .select('version_number')
          .order('version_number', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (maxErr) throw maxErr
        const nextNum = (maxRow?.version_number ?? 0) + 1
        const { error: insErr, insertedId } = await insertStructuredDocVersion(supabase, table, {
          version_number: nextNum,
          title,
          body_md: bodyMd,
          body_structure: sopDocumentToJson(merged) as Json,
          freeform_markdown: freeformMarkdown,
          published_by: authUser.id,
        })
        if (insErr) throw insErr
        if (typeof insertedId === 'string') editingPublishedVersionIdRef.current = insertedId
      }
      baselineStructureDocRef.current = cloneSopDocument(merged)
      setStructureDoc(merged)
      setToastMsg(
        loc === 'ko'
          ? uiLocaleEn
            ? 'Korean saved. English on the server was left as before.'
            : '한국어만 저장했습니다. 서버의 영문은 이전 저장본 그대로입니다.'
          : uiLocaleEn
            ? 'English saved. Korean on the server was left as before.'
            : '영문만 저장했습니다. 서버의 한국어는 이전 저장본 그대로입니다.'
      )
      await refreshSectionSnapshots(editingPublishedVersionIdRef.current)
      await onVersionsChange()
    } catch (e) {
      setToastMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setSavingLocaleSlice(null)
    }
  }

  const titlePlaceholderKo = useMemo(
    () => (kind === 'sop' ? '투어 가이드 / 드라이버 표준 운영 절차 (SOP)' : '직원 계약서'),
    [kind]
  )
  const titlePlaceholderEn = useMemo(
    () =>
      kind === 'sop'
        ? 'Tour Guide / Driver Standard Operating Procedures (SOP)'
        : 'Employment contract',
    [kind]
  )

  const pastePlaceholder = useMemo(() => {
    return uiLocaleEn
      ? kind === 'sop'
        ? 'Paste full SOP text (Korean)…'
        : 'Paste full contract text (Korean)…'
      : kind === 'sop'
        ? '전체 SOP 텍스트(한국어)…'
        : '전체 계약서 텍스트(한국어)…'
  }, [kind, uiLocaleEn])

  const pastePlaceholderEn = useMemo(() => {
    return uiLocaleEn
      ? kind === 'sop'
        ? 'Paste full SOP text (English)…'
        : 'Paste full contract text (English)…'
      : kind === 'sop'
        ? '전체 SOP 텍스트(English)…'
        : '전체 계약서 텍스트(English)…'
  }, [kind, uiLocaleEn])

  if (!canManage) {
    return null
  }

  return (
    <div className="p-4" role="tabpanel">
      {toastMsg ? <p className="mb-3 text-sm text-gray-800">{toastMsg}</p> : null}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-700">
          {uiLocaleEn
            ? 'Click a row to open the editor. Saving always creates a new version (existing rows are unchanged).'
            : '행을 클릭하면 편집 모달이 열립니다. 저장 시 항상 새 버전이 추가되고 기존 행은 바뀌지 않습니다.'}
        </p>
        <Button type="button" size="sm" variant="default" onClick={() => void openEditModal(null)}>
          {uiLocaleEn ? 'New version from template' : '새 버전 (템플릿)'}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-3 py-2">{uiLocaleEn ? 'Ver.' : '판'}</th>
              <th className="px-3 py-2">{uiLocaleEn ? 'Title' : '제목'}</th>
              <th className="px-3 py-2">{uiLocaleEn ? 'Saved at' : '저장 시각'}</th>
              <th className="px-3 py-2 w-14 text-center">{uiLocaleEn ? 'Send' : '발송'}</th>
            </tr>
          </thead>
          <tbody>
            {versionRows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-gray-500">
                  {uiLocaleEn ? 'No versions yet. Use “New version from template”.' : '저장된 버전이 없습니다. 「새 버전 (템플릿)」으로 시작하세요.'}
                </td>
              </tr>
            ) : (
              versionRows.map((v) => (
                <tr
                  key={v.id}
                  className="cursor-pointer border-t border-gray-100 hover:bg-slate-50"
                  onClick={() => void openEditModal(v)}
                >
                  <td className="px-3 py-2 font-medium">v{v.version_number}</td>
                  <td className="px-3 py-2">{v.title}</td>
                  <td className="px-3 py-2 text-gray-600">
                    {new Date(v.published_at).toLocaleString(uiLocaleEn ? 'en-US' : 'ko-KR')}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title={uiLocaleEn ? 'Send for signature (login notice)' : '서명 요청 발송 (접속 시 알림)'}
                      aria-label={uiLocaleEn ? 'Send for signature' : '서명 요청 발송'}
                      onClick={(e) => {
                        e.stopPropagation()
                        void openCampaignFromVersion(v)
                      }}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-base font-semibold text-gray-900">
          {uiLocaleEn ? 'Signature compliance (latest published each)' : '서명 현황 (문서별 최신 버전)'}
        </h2>
        <DualCompliancePanels uiLocaleEn={uiLocaleEn} locale={locale} bundle={dualCompliance} />
      </div>

      <Dialog
        modal={!printPreviewOpen}
        open={editModalOpen}
        onOpenChange={(o) => {
          setEditModalOpen(o)
          if (!o) {
            setToastMsg(null)
            setPrintPreviewOpen(false)
          }
        }}
      >
        <DialogContent className="flex max-h-[95vh] max-w-[min(96vw,1100px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(96vw,1100px)]">
          <DialogHeader className="shrink-0 border-b border-slate-200 px-4 py-3 pr-12 text-left sm:px-6">
            <DialogTitle>{uiLocaleEn ? 'Edit document' : '문서 편집'}</DialogTitle>
            <DialogDescription className="text-left text-xs">
              {uiLocaleEn
                ? 'Preview / structured / freeform. “Save as new version” appends a row to the list.'
                : '미리보기 · 섹션별 입력 · 자유 서식. 「새 버전으로 저장」 시 목록에 행이 추가됩니다.'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex shrink-0 flex-wrap gap-2 border-b border-slate-100 px-4 py-2 sm:px-6">
            <Button type="button" size="sm" variant={modalMainTab === 'preview' ? 'default' : 'outline'} onClick={() => setModalMainTab('preview')}>
              {uiLocaleEn ? 'Preview' : '미리보기'}
            </Button>
            <Button type="button" size="sm" variant={modalMainTab === 'structure' ? 'default' : 'outline'} onClick={() => setModalMainTab('structure')}>
              {uiLocaleEn ? 'Structured sections' : '섹션별 입력 (구조)'}
            </Button>
            <Button type="button" size="sm" variant={modalMainTab === 'freeform' ? 'default' : 'outline'} onClick={() => setModalMainTab('freeform')}>
              {uiLocaleEn ? 'Freeform' : '자유 서식'}
            </Button>
            <span className="mx-1 h-6 w-px bg-slate-200 self-center hidden sm:block" />
            <span className="text-xs text-gray-600 self-center hidden sm:inline">
              {uiLocaleEn ? 'Preview language' : '미리보기 언어'}
            </span>
            <KoEnLangSwitch
              value={sopEditLang}
              onChange={setSopEditLang}
              uiLocaleEn={uiLocaleEn}
            />
            <Button type="button" size="sm" variant="secondary" onClick={() => setPrintPreviewOpen(true)}>
              {uiLocaleEn ? 'Print / PDF' : '인쇄·PDF'}
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-6 sm:py-4">
            {modalMainTab === 'preview' ? (
              <div className="space-y-4">
                <div className="max-h-[min(60vh,720px)] overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <SopDocumentReadonly doc={structureDoc} viewLang={sopEditLang} layout="card" />
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">
                      {uiLocaleEn
                        ? 'Section snapshots (this published version)'
                        : '섹션 스냅샷 (이 게시 버전)'}
                    </h3>
                    <Button type="button" size="sm" variant="outline" disabled={auditLoading} onClick={() => void refreshSectionAuditLog()}>
                      {auditLoading ? (uiLocaleEn ? 'Loading…' : '불러오는 중…') : uiLocaleEn ? 'Refresh' : '새로고침'}
                    </Button>
                  </div>
                  {auditErr ? <p className="text-xs text-red-600">{auditErr}</p> : null}
                  <ul className="max-h-48 space-y-0 divide-y divide-slate-100 overflow-auto text-xs">
                    {!auditLoading && auditRows.length === 0 ? (
                      <li className="py-2 text-slate-500">{uiLocaleEn ? 'No section saves yet.' : '기록이 없습니다.'}</li>
                    ) : (
                      auditRows.map((row) => (
                        <li key={row.id} className="py-2">
                          <div className="font-medium text-slate-800">{sectionAuditLabel(row.section_id, row.section_json)}</div>
                          <div className="text-slate-600">
                            {uiLocaleEn ? `Rev ${row.revision}` : `${row.revision}차`} ·{' '}
                            {new Date(row.created_at).toLocaleString(uiLocaleEn ? 'en-US' : 'ko-KR')} · {formatAuditSavedBy(row.created_by)}
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </div>
            ) : modalMainTab === 'structure' ? (
              <div className="space-y-4">
                <p className="text-xs text-slate-600">
                  {uiLocaleEn
                    ? 'Edit one language at a time. The other column is read-only for reference. Use “Save Korean only” / “Save English only” to persist one side without overwriting the other on the server.'
                    : '한 번에 한 언어만 편집하고, 반대 열은 참고용(읽기 전용)입니다. 「한국어만 저장」「영문만 저장」으로 서버에 한쪽만 반영할 수 있습니다.'}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setPasteImportModalOpen(true)}>
                    {uiLocaleEn ? 'Import from pasted text…' : '텍스트 붙여넣기로 가져오기…'}
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <KoEnLangSwitch
                    value={structureContentFocus}
                    onChange={setStructureContentFocus}
                    disabled={savingVersion || savingLocaleSlice !== null}
                    uiLocaleEn={uiLocaleEn}
                  />
                  <span className="mx-1 hidden h-4 w-px bg-slate-300 sm:inline" aria-hidden />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={savingVersion || savingLocaleSlice !== null}
                    onClick={() => void saveLocaleSlice('ko')}
                  >
                    {savingLocaleSlice === 'ko'
                      ? uiLocaleEn
                        ? 'Saving KO…'
                        : '한국어 저장 중…'
                      : uiLocaleEn
                        ? 'Save Korean only'
                        : '한국어만 저장'}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={savingVersion || savingLocaleSlice !== null}
                    onClick={() => void saveLocaleSlice('en')}
                  >
                    {savingLocaleSlice === 'en'
                      ? uiLocaleEn
                        ? 'Saving EN…'
                        : '영문 저장 중…'
                      : uiLocaleEn
                        ? 'Save English only'
                        : '영문만 저장'}
                  </Button>
                </div>
                <div className="space-y-2">
                  <span className="block text-sm font-medium text-gray-800">
                    {uiLocaleEn ? 'Document title (edit + reference)' : '문서 제목 (편집 + 참고)'}
                  </span>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-lg border-2 border-sky-300 bg-sky-50/90 p-3 shadow-sm">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="rounded bg-sky-700 px-2 py-0.5 text-xs font-bold text-white">한국어</span>
                        {structureContentFocus === 'en' ? (
                          <span className="text-[10px] font-medium uppercase tracking-wide text-sky-800/80">
                            {uiLocaleEn ? 'Reference' : '참고'}
                          </span>
                        ) : null}
                      </div>
                      <LightRichEditor
                        key={`${kind}-modal-title-ko`}
                        value={structureDoc.title_ko}
                        onChange={(v) => setStructureDoc((prev) => ({ ...prev, title_ko: v ?? '' }))}
                        height={120}
                        enableImageUpload={false}
                        enableResize={false}
                        readOnly={structureContentFocus === 'en'}
                        className="rounded-md border border-sky-200 bg-white overflow-hidden"
                        placeholder={titlePlaceholderKo}
                      />
                    </div>
                    <div className="rounded-lg border-2 border-violet-300 bg-violet-50/90 p-3 shadow-sm">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="rounded bg-violet-700 px-2 py-0.5 text-xs font-bold text-white">English</span>
                        {structureContentFocus === 'ko' ? (
                          <span className="text-[10px] font-medium uppercase tracking-wide text-violet-800/80">
                            {uiLocaleEn ? 'Reference' : '참고'}
                          </span>
                        ) : null}
                      </div>
                      <LightRichEditor
                        key={`${kind}-modal-title-en`}
                        value={structureDoc.title_en}
                        onChange={(v) => setStructureDoc((prev) => ({ ...prev, title_en: v ?? '' }))}
                        height={120}
                        enableImageUpload={false}
                        enableResize={false}
                        readOnly={structureContentFocus === 'ko'}
                        className="rounded-md border border-violet-200 bg-white overflow-hidden"
                        placeholder={titlePlaceholderEn}
                      />
                    </div>
                  </div>
                </div>
                <SopStructureEditor
                  value={structureDoc}
                  onChange={setStructureDoc}
                  uiLocaleEn={uiLocaleEn}
                  editLocale={sopEditLang}
                  disabled={savingVersion || savingLocaleSlice !== null}
                  bilingualFieldMode="focus"
                  focusContentLocale={structureContentFocus}
                  sectionVersionMeta={sectionVersionMeta}
                  savingSectionId={savingSectionId}
                  onSaveSectionVersion={saveSectionVersion}
                  onFetchSectionVersionHistory={fetchSectionVersionHistory}
                  onRestoreSectionFromHistory={restoreSectionFromHistory}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-indigo-950/90">
                  {uiLocaleEn
                    ? 'One-page rich text stored with this version when you save.'
                    : '한 페이지 자유 서식입니다. 「새 버전으로 저장」 시 이 문서 버전에 함께 저장됩니다.'}
                </p>
                <LightRichEditor
                  key={`${kind}-modal-freeform`}
                  value={freeformMarkdown}
                  onChange={(v) => setFreeformMarkdown(v ?? '')}
                  height={420}
                  minHeight={220}
                  maxHeight={720}
                  enableImageUpload={false}
                  enableResize
                  className="rounded-md border border-indigo-200 bg-white overflow-hidden"
                  placeholder={uiLocaleEn ? 'Optional one-page notes…' : '선택 사항 — 한 페이지 메모…'}
                />
              </div>
            )}
          </div>

          <DialogFooter className="shrink-0 border-t border-slate-200 px-4 py-3 sm:px-6">
            <Button type="button" variant="outline" onClick={() => setEditModalOpen(false)}>
              {uiLocaleEn ? 'Close' : '닫기'}
            </Button>
            <Button
              type="button"
              variant="default"
              disabled={savingVersion || savingLocaleSlice !== null}
              onClick={() => void saveAsNewVersion()}
            >
              {savingVersion ? (uiLocaleEn ? 'Saving…' : '저장 중…') : uiLocaleEn ? 'Save as new version' : '새 버전으로 저장'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pasteImportModalOpen} onOpenChange={setPasteImportModalOpen}>
        <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
          <DialogHeader className="shrink-0 space-y-2 border-b border-slate-200 px-6 pb-4 pt-6 pr-14 text-left">
            <DialogTitle>{uiLocaleEn ? 'Import from pasted text (KO + EN)' : '텍스트 붙여넣기 (한국어·영문)'}</DialogTitle>
            <DialogDescription className="text-left">
              {uiLocaleEn
                ? 'Without “Section N:” markers: first line = section title, fixed category “Body”, each following line = one checklist row. Indented outlines: first column = section; same column again = more checklist rows under “Body”; one step in = category; deeper = nested checklist.'
                : '「섹션 N:」이 없으면: 첫 줄=섹션 제목, 카테고리는 고정「내용」, 그 아래 각 줄=체크 한 줄입니다. 들여쓰기 개요는 첫 열=섹션, 같은 열 반복=「내용」 아래 체크 줄, 한 단계 들임=카테고리 제목, 더 깊음=체크 계층입니다.'}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <span className="text-xs font-medium text-sky-900">한국어</span>
                <textarea
                  className="min-h-[180px] w-full rounded-md border border-sky-200 bg-white px-2 py-2 text-xs font-mono"
                  value={pasteRaw}
                  onChange={(e) => setPasteRaw(e.target.value)}
                  placeholder={pastePlaceholder}
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs font-medium text-violet-900">English</span>
                <textarea
                  className="min-h-[180px] w-full rounded-md border border-violet-200 bg-white px-2 py-2 text-xs font-mono"
                  value={pasteRawEn}
                  onChange={(e) => setPasteRawEn(e.target.value)}
                  placeholder={pastePlaceholderEn}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="shrink-0 flex flex-wrap gap-2 border-t border-slate-200 px-6 py-4 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setPasteImportModalOpen(false)}>
              {uiLocaleEn ? 'Close' : '닫기'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={savingVersion || savingLocaleSlice !== null}
              onClick={async () => {
                const ok = await applyPasteAsStructure()
                if (ok) setPasteImportModalOpen(false)
              }}
            >
              {uiLocaleEn ? 'Parse into structure' : '구조로 변환'}
            </Button>
            <Button
              type="button"
              variant="default"
              disabled={savingVersion || savingLocaleSlice !== null}
              onClick={() => void applyPasteAsStructureAndSaveNewVersion()}
            >
              {savingVersion
                ? uiLocaleEn
                  ? 'Saving…'
                  : '저장 중…'
                : uiLocaleEn
                  ? 'Parse & save as new version'
                  : '변환 후 새 버전 저장'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={campaignModalOpen} onOpenChange={(o) => {
        setCampaignModalOpen(o)
        if (!o) setCampaignBodyStructure(null)
      }}>
        <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="shrink-0 space-y-2 border-b border-slate-200 px-6 pb-4 pt-6 pr-14 text-left">
            <DialogTitle>{uiLocaleEn ? 'Send for signature' : '서명 요청 발송'}</DialogTitle>
            <DialogDescription className="text-left">
              {uiLocaleEn
                ? 'Uses the structured content of the version you opened from the list.'
                : '목록에서 연 해당 버전의 구조화 본문이 발송됩니다.'}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-medium text-slate-800">
                {uiLocaleEn ? 'Notice title (optional)' : '알림 제목 (선택)'}
                <input
                  type="text"
                  className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-sm"
                  value={campaignTitle}
                  onChange={(e) => setCampaignTitle(e.target.value)}
                  placeholder={
                    (campaignBodyStructure && primaryDocumentTitle(campaignBodyStructure).trim()) ||
                    (uiLocaleEn ? 'Document' : '문서')
                  }
                />
              </label>
              <label className="block text-xs font-medium text-slate-800">
                {uiLocaleEn ? 'Note (optional)' : '안내 메모 (선택)'}
                <input
                  type="text"
                  className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-sm"
                  value={campaignNote}
                  onChange={(e) => setCampaignNote(e.target.value)}
                  placeholder={uiLocaleEn ? 'Short message…' : '짧은 안내…'}
                />
              </label>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-slate-800">{uiLocaleEn ? 'Teammates' : '팀원'}</p>
              <div className="max-h-52 overflow-auto rounded-md border border-slate-200 bg-slate-50/80 p-2">
                {teamRows.length === 0 ? (
                  <p className="px-2 py-3 text-xs text-slate-500">{uiLocaleEn ? 'No active members.' : '활성 팀원이 없습니다.'}</p>
                ) : (
                  teamRows.map((row) => {
                    const emailKey = normalizeEmail(row.email)
                    const checked = selectedCampaignEmails.has(emailKey)
                    const label = uiLocaleEn ? row.name_en || row.name_ko || row.email : row.name_ko || row.name_en || row.email
                    return (
                      <label key={row.email} className="flex cursor-pointer items-center gap-2 rounded px-2 py-2 text-sm hover:bg-white">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setSelectedCampaignEmails((prev) => {
                              const next = new Set(prev)
                              if (next.has(emailKey)) next.delete(emailKey)
                              else next.add(emailKey)
                              return next
                            })
                          }}
                        />
                        <span className="font-medium text-slate-900">{label}</span>
                        <span className="truncate text-slate-500">{row.email}</span>
                      </label>
                    )
                  })
                )}
              </div>
            </div>
            <div className="border-t border-slate-200 pt-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-800">{uiLocaleEn ? 'Signed PDFs' : '서명 완료 PDF'}</span>
                <Button type="button" variant="outline" size="sm" disabled={campaignSigLoading} onClick={() => void refreshCampaignSignatures()}>
                  {campaignSigLoading ? (uiLocaleEn ? 'Loading…' : '불러오는 중…') : uiLocaleEn ? 'Refresh' : '새로고침'}
                </Button>
              </div>
              <ul className="max-h-36 overflow-auto rounded-md border border-slate-100 bg-white text-xs divide-y divide-slate-100">
                {campaignSigRows.length === 0 ? (
                  <li className="px-3 py-3 text-slate-500">{uiLocaleEn ? 'None yet.' : '없습니다.'}</li>
                ) : (
                  campaignSigRows.map((row) => {
                    const c = row.company_structured_doc_sign_campaigns
                    return (
                      <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                        <div className="min-w-0">
                          <div className="truncate font-medium text-slate-900">{row.signer_name}</div>
                          <div className="truncate text-slate-500">{row.signer_email}</div>
                          <div className="text-slate-400">
                            {c?.title ? `${c.title} · ` : ''}
                            {new Date(row.signed_at).toLocaleString(uiLocaleEn ? 'en-US' : 'ko-KR')}
                          </div>
                        </div>
                        <Button type="button" variant="secondary" size="sm" onClick={() => void openCampaignSignedPdf(row.pdf_storage_path)}>
                          PDF
                        </Button>
                      </li>
                    )
                  })
                )}
              </ul>
            </div>
          </div>
          <DialogFooter className="shrink-0 border-t border-slate-200 px-6 py-4">
            <Button type="button" variant="outline" onClick={() => setCampaignModalOpen(false)}>
              {uiLocaleEn ? 'Close' : '닫기'}
            </Button>
            <Button
              type="button"
              variant="default"
              disabled={sendingCampaign || teamRows.length === 0}
              onClick={() => void sendSignCampaign()}
            >
              {sendingCampaign ? (uiLocaleEn ? 'Sending…' : '발송 중…') : uiLocaleEn ? 'Send' : '발송'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SopPrintPreviewFloatingPanel
        open={printPreviewOpen}
        onOpenChange={setPrintPreviewOpen}
        uiLocaleEn={uiLocaleEn}
        storageKey={floatingPreviewStorageKey}
        title={uiLocaleEn ? 'Print / PDF preview' : '인쇄·PDF 미리보기'}
        printActions={{
          getA4Root: () => previewA4Ref.current,
          fileBaseName:
            kind === 'sop'
              ? `company-SOP-preview-${modalMainTab === 'freeform' ? 'freeform' : 'structured'}`
              : `employment-contract-preview-${modalMainTab === 'freeform' ? 'freeform' : 'structured'}`,
        }}
      >
        {modalMainTab === 'freeform' ? (
          <SopFreeformPrintPreviewFrame
            ref={previewA4Ref}
            scrollMode="floating"
            markdown={freeformMarkdown}
            caption={uiLocaleEn ? 'A4 preview · Esc closes.' : 'A4 미리보기 · Esc로 닫기'}
            signatureNote={
              uiLocaleEn
                ? 'Staff-facing signing uses structured sections; freeform is stored with the version for reference.'
                : '직원 서명·확인은 구조화 본문 기준입니다. 자유 서식은 버전에 참고용으로 함께 저장됩니다.'
            }
          />
        ) : (
          <SopPrintPreviewFrame
            ref={previewA4Ref}
            scrollMode="floating"
            doc={structureDoc}
            viewLang={sopEditLang}
            caption={uiLocaleEn ? 'A4 width preview.' : 'A4 폭 미리보기.'}
            signatureNote={
              uiLocaleEn ? 'Signers appear on the signed PDF.' : '서명 완료 PDF에 서명자 정보가 포함됩니다.'
            }
          />
        )}
      </SopPrintPreviewFloatingPanel>
    </div>
  )
}
