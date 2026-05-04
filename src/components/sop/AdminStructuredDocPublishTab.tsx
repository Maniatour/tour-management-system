'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import LightRichEditor from '@/components/LightRichEditor'
import SopStructureEditor from '@/components/sop/SopStructureEditor'
import SopPrintPreviewFrame from '@/components/sop/SopPrintPreviewFrame'
import SopPrintPreviewFloatingPanel from '@/components/sop/SopPrintPreviewFloatingPanel'
import type { Json } from '@/lib/database.types'
import {
  emptySopDocument,
  parseSopDocumentJson,
  parseSopPlainTextToDocument,
  isPublishableSopDocument,
  sopDocumentToJson,
  prefillSortOrders,
  primaryDocumentTitle,
  mergeLatestSectionSnapshotsIntoDoc,
  parseSopSectionJson,
  type SopDocument,
  type SopEditLocale,
  type SopSection,
} from '@/types/sopStructure'

export type AdminStructuredDocKind = 'sop' | 'employee_contract'

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

type VersionRow = {
  id: string
  version_number: number
  title: string
  body_md: string | null
  body_structure: unknown
  published_at: string
}

export default function AdminStructuredDocPublishTab({
  kind,
  locale,
  uiLocaleEn,
  canManage,
  onPublished,
}: {
  kind: AdminStructuredDocKind
  locale: string
  uiLocaleEn: boolean
  canManage: boolean
  onPublished: () => void | Promise<void>
}) {
  const { authUser } = useAuth()
  const [sopEditLang, setSopEditLang] = useState<SopEditLocale>('ko')
  const defaultDoc = kind === 'sop' ? defaultEditorSopDocument : defaultEditorContractDocument
  const [structureDoc, setStructureDoc] = useState<SopDocument>(() => defaultDoc())
  const [editorBootstrapped, setEditorBootstrapped] = useState(false)
  const [sectionVersionMeta, setSectionVersionMeta] = useState<
    Record<string, { revision: number; savedAt: string }>
  >({})
  const [savingSectionId, setSavingSectionId] = useState<string | null>(null)
  const [pasteRaw, setPasteRaw] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [publishMsg, setPublishMsg] = useState<string | null>(null)
  const [savingDraft, setSavingDraft] = useState(false)
  const [draftMsg, setDraftMsg] = useState<string | null>(null)
  const [serverDraftUpdatedAt, setServerDraftUpdatedAt] = useState<string | null>(null)
  const [latest, setLatest] = useState<VersionRow | null>(null)
  const [printPreviewOpen, setPrintPreviewOpen] = useState(false)

  const floatingPreviewStorageKey = useMemo(
    () => (kind === 'sop' ? 'admin-sop-print-floating-rect' : 'admin-contract-print-floating-rect'),
    [kind]
  )

  const publishUrl = kind === 'sop' ? '/api/sop/publish' : '/api/employee-contract/publish'

  const refreshLatest = useCallback(async () => {
    const table = kind === 'sop' ? 'company_sop_versions' : 'company_employee_contract_versions'
    const { data } = await supabase
      .from(table)
      .select('id, version_number, title, body_md, body_structure, published_at')
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle()
    setLatest((data as VersionRow) || null)
  }, [kind])

  useEffect(() => {
    void refreshLatest()
  }, [refreshLatest])

  const refreshServerDraftMeta = useCallback(async () => {
    const table = kind === 'sop' ? 'company_sop_draft' : 'company_employee_contract_draft'
    const { data, error } = await supabase.from(table).select('updated_at').eq('singleton', 1).maybeSingle()
    if (error) {
      console.warn(`${table}:`, error.message)
      setServerDraftUpdatedAt(null)
      return
    }
    setServerDraftUpdatedAt(data?.updated_at ?? null)
  }, [kind])

  useEffect(() => {
    if (!canManage) {
      setServerDraftUpdatedAt(null)
      return
    }
    void refreshServerDraftMeta()
  }, [canManage, refreshServerDraftMeta])

  const refreshSectionSnapshots = useCallback(async (): Promise<Map<string, SopSection>> => {
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

    const { data: rpcData, error: rpcError } = await supabase.rpc(
      'company_structured_doc_section_versions_latest',
      { p_doc_kind: kind }
    )

    if (!rpcError && Array.isArray(rpcData)) {
      applyRows(rpcData)
      setSectionVersionMeta(meta)
      return m
    }

    if (rpcError) {
      console.warn(
        'company_structured_doc_section_versions_latest:',
        rpcError.message,
        '— 테이블 직접 조회로 대체합니다. Supabase에 마이그레이션 20260615120000_company_structured_doc_section_versions.sql 적용 시 RPC를 쓸 수 있습니다.'
      )
    }

    const { data: allRows, error: tableError } = await supabase
      .from('company_structured_doc_section_versions')
      .select('section_id, revision, created_at, section_json')
      .eq('doc_kind', kind)

    if (tableError) {
      console.warn('company_structured_doc_section_versions:', tableError.message)
      setSectionVersionMeta({})
      return new Map<string, SopSection>()
    }

    const bySection = new Map<
      string,
      { section_id: string; revision: number; created_at: string; section_json: Json }
    >()
    for (const row of allRows || []) {
      const prev = bySection.get(row.section_id)
      if (
        !prev ||
        row.revision > prev.revision ||
        (row.revision === prev.revision && row.created_at > prev.created_at)
      ) {
        bySection.set(row.section_id, row)
      }
    }
    applyRows(Array.from(bySection.values()))
    setSectionVersionMeta(meta)
    return m
  }, [kind])

  useEffect(() => {
    if (!canManage) {
      setEditorBootstrapped(true)
      return
    }
    let cancelled = false
    setEditorBootstrapped(false)
    const def = kind === 'sop' ? defaultEditorSopDocument : defaultEditorContractDocument
    void (async () => {
      try {
        const snapMap = await refreshSectionSnapshots()
        if (cancelled) return
        const draftTable = kind === 'sop' ? 'company_sop_draft' : 'company_employee_contract_draft'
        const verTable = kind === 'sop' ? 'company_sop_versions' : 'company_employee_contract_versions'
        const [{ data: draftRow }, { data: top }] = await Promise.all([
          supabase.from(draftTable).select('body_structure, paste_raw, edit_locale').eq('singleton', 1).maybeSingle(),
          supabase.from(verTable).select('id, title, body_md, body_structure').order('version_number', { ascending: false }).limit(1).maybeSingle(),
        ])
        if (cancelled) return

        let baseDoc: SopDocument
        const draftParsed = draftRow ? parseSopDocumentJson(draftRow.body_structure) : null
        if (draftParsed) {
          baseDoc = prefillSortOrders(draftParsed)
          setPasteRaw(typeof draftRow?.paste_raw === 'string' ? draftRow.paste_raw : '')
          if (draftRow?.edit_locale === 'en' || draftRow?.edit_locale === 'ko') {
            setSopEditLang(draftRow.edit_locale)
          }
        } else {
          const fromPub = top ? parseSopDocumentJson(top.body_structure) : null
          if (fromPub) {
            let doc = prefillSortOrders(fromPub)
            if (!doc.title_ko?.trim() && !doc.title_en?.trim() && top?.title) {
              doc = { ...doc, title_ko: top.title }
            }
            baseDoc = doc
          } else if (top?.body_md?.trim()) {
            baseDoc = parseSopPlainTextToDocument(top.body_md)
          } else {
            baseDoc = def()
          }
          setPasteRaw('')
        }
        baseDoc = mergeLatestSectionSnapshotsIntoDoc(baseDoc, snapMap)
        setStructureDoc(baseDoc)
        await refreshServerDraftMeta()
      } catch (e) {
        console.warn('admin structured doc bootstrap:', e)
        if (!cancelled) {
          const fallback = kind === 'sop' ? defaultEditorSopDocument : defaultEditorContractDocument
          setStructureDoc(fallback())
        }
      } finally {
        if (!cancelled) setEditorBootstrapped(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [canManage, kind, refreshSectionSnapshots, refreshServerDraftMeta])

  const loadLatestIntoEditor = async () => {
    if (!latest) return
    const snapMap = await refreshSectionSnapshots()
    let next: SopDocument
    const parsed = parseSopDocumentJson(latest.body_structure)
    if (parsed) {
      if (!parsed.title_ko?.trim() && !parsed.title_en?.trim() && latest.title) {
        next = { ...parsed, title_ko: latest.title }
      } else {
        next = parsed
      }
    } else if (latest.body_md?.trim()) {
      next = parseSopPlainTextToDocument(latest.body_md)
    } else {
      next = prefillSortOrders(emptySopDocument())
    }
    setStructureDoc(mergeLatestSectionSnapshotsIntoDoc(prefillSortOrders(next), snapMap))
  }

  const fetchSectionVersionHistory = useCallback(
    async (sectionId: string) => {
      const { data, error } = await supabase
        .from('company_structured_doc_section_versions')
        .select('id, revision, created_at, section_json, created_by')
        .eq('doc_kind', kind)
        .eq('section_id', sectionId)
        .order('revision', { ascending: false })
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
        setPublishMsg(
          uiLocaleEn ? 'Could not read that section snapshot.' : '해당 섹션 저장 형식을 읽을 수 없습니다.'
        )
        return
      }
      setStructureDoc((prev) =>
        prefillSortOrders({
          ...prev,
          sections: prev.sections.map((s) => (s.id === sectionId ? { ...restored, id: sectionId } : s)),
        })
      )
      await refreshSectionSnapshots()
      setPublishMsg(
        uiLocaleEn ? 'Section content replaced from the selected version.' : '선택한 버전으로 이 섹션 내용을 바꿨습니다.'
      )
    },
    [refreshSectionSnapshots, uiLocaleEn]
  )

  const saveSectionVersion = async (section: SopSection) => {
    if (!canManage || !authUser?.id) return
    setSavingSectionId(section.id)
    setPublishMsg(null)
    try {
      const { data, error } = await supabase
        .from('company_structured_doc_section_versions')
        .insert({
          doc_kind: kind,
          section_id: section.id,
          section_json: section as unknown as Json,
          created_by: authUser.id,
        })
        .select('revision, created_at')
        .single()
      if (error) throw error
      await refreshSectionSnapshots()
      setPublishMsg(
        uiLocaleEn
          ? `Section saved as version ${data?.revision ?? '—'}.`
          : `섹션을 버전에 저장했습니다 (제${data?.revision ?? '—'}차).`
      )
    } catch (e) {
      setPublishMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setSavingSectionId(null)
    }
  }

  const saveDraft = async () => {
    if (!canManage || !authUser?.id) return
    setSavingDraft(true)
    setDraftMsg(null)
    try {
      const table = kind === 'sop' ? 'company_sop_draft' : 'company_employee_contract_draft'
      const { data, error } = await supabase
        .from(table)
        .upsert(
          {
            singleton: 1,
            body_structure: sopDocumentToJson(structureDoc) as Json,
            paste_raw: pasteRaw,
            edit_locale: sopEditLang,
            updated_by: authUser.id,
          },
          { onConflict: 'singleton' }
        )
        .select('updated_at')
        .single()
      if (error) throw error
      if (data?.updated_at) setServerDraftUpdatedAt(data.updated_at)
      setDraftMsg(
        uiLocaleEn
          ? 'Draft saved on the server. No push notification was sent.'
          : '서버에 초안만 저장했습니다. 직원에게는 알림이 가지 않습니다.'
      )
    } catch (e) {
      setDraftMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setSavingDraft(false)
    }
  }

  const loadServerDraft = async () => {
    if (!canManage) return
    const ok = window.confirm(
      uiLocaleEn
        ? 'Replace the current editor with the saved server draft?'
        : '저장된 서버 초안으로 지금 편집 중인 내용을 덮어씁니다. 계속할까요?'
    )
    if (!ok) return
    setSavingDraft(true)
    setDraftMsg(null)
    try {
      const table = kind === 'sop' ? 'company_sop_draft' : 'company_employee_contract_draft'
      const { data, error } = await supabase
        .from(table)
        .select('body_structure, paste_raw, edit_locale')
        .eq('singleton', 1)
        .maybeSingle()
      if (error) throw error
      if (!data) {
        setDraftMsg(uiLocaleEn ? 'No draft found on the server.' : '서버에 저장된 초안이 없습니다.')
        return
      }
      const parsed = parseSopDocumentJson(data.body_structure)
      const snapMap = await refreshSectionSnapshots()
      let nextDoc: SopDocument
      if (parsed) {
        nextDoc = prefillSortOrders(parsed)
      } else {
        nextDoc = defaultDoc()
      }
      setStructureDoc(mergeLatestSectionSnapshotsIntoDoc(nextDoc, snapMap))
      setPasteRaw(typeof data.paste_raw === 'string' ? data.paste_raw : '')
      if (data.edit_locale === 'en' || data.edit_locale === 'ko') {
        setSopEditLang(data.edit_locale)
      }
      setDraftMsg(uiLocaleEn ? 'Draft loaded from the server.' : '서버에서 초안을 불러왔습니다.')
      setPublishMsg(null)
    } catch (e) {
      setDraftMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setSavingDraft(false)
    }
  }

  const applyPasteAsStructure = async () => {
    if (!pasteRaw.trim()) {
      setPublishMsg(uiLocaleEn ? 'Paste text first.' : '먼저 텍스트를 붙여넣으세요.')
      return
    }
    const snapMap = await refreshSectionSnapshots()
    setStructureDoc(
      mergeLatestSectionSnapshotsIntoDoc(parseSopPlainTextToDocument(pasteRaw), snapMap)
    )
    setPublishMsg(
      uiLocaleEn
        ? 'Structure imported. Korean and English columns are shown side by side below.'
        : '구조로 반영했습니다. 아래에서 한국어·English 열을 나란히 확인할 수 있습니다.'
    )
  }

  const publish = async () => {
    if (!canManage) return
    if (!isPublishableSopDocument(structureDoc)) {
      setPublishMsg(
        uiLocaleEn
          ? 'Add document title or section/category content (KO or EN).'
          : '문서 제목 또는 섹션·카테고리 내용(한글 또는 영문)을 입력해 주세요.'
      )
      return
    }
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    if (!token) {
      setPublishMsg(uiLocaleEn ? 'Session expired. Sign in again.' : '세션이 만료되었습니다. 다시 로그인해 주세요.')
      return
    }
    setPublishing(true)
    setPublishMsg(null)
    try {
      const res = await fetch(publishUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          body_structure: sopDocumentToJson(structureDoc),
          locale,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setPublishMsg(json.error || (uiLocaleEn ? 'Publish failed.' : '게시에 실패했습니다.'))
        return
      }
      setPublishMsg(
        uiLocaleEn
          ? `Published v${json.version?.version_number}. Push: sent ${json.push?.sent ?? 0}.`
          : `제${json.version?.version_number}판이 게시되었습니다. 푸시 전송 ${json.push?.sent ?? 0}건.`
      )
      setStructureDoc(defaultDoc())
      setPasteRaw('')
      setDraftMsg(null)
      if (authUser?.id) {
        const table = kind === 'sop' ? 'company_sop_draft' : 'company_employee_contract_draft'
        const { error: draftErr } = await supabase.from(table).upsert(
          {
            singleton: 1,
            body_structure: sopDocumentToJson(defaultDoc()) as Json,
            paste_raw: '',
            edit_locale: 'ko',
            updated_by: authUser.id,
          },
          { onConflict: 'singleton' }
        )
        if (draftErr) console.warn(`clear ${table}:`, draftErr.message)
        else await refreshServerDraftMeta()
      }
      await refreshLatest()
      await refreshSectionSnapshots()
      await onPublished()
    } catch (e) {
      setPublishMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setPublishing(false)
    }
  }

  const titlePlaceholderKo = useMemo(
    () =>
      kind === 'sop' ? '투어 가이드 / 드라이버 표준 운영 절차 (SOP)' : '직원 계약서',
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
        ? 'Paste full SOP text…'
        : 'Paste full contract text…'
      : kind === 'sop'
        ? '전체 SOP 텍스트를 여기에 붙여넣기…'
        : '전체 계약서 텍스트를 여기에 붙여넣기…'
  }, [kind, uiLocaleEn])

  if (!editorBootstrapped) {
    return (
      <div className="p-6" role="tabpanel">
        <p className="text-gray-600">{uiLocaleEn ? 'Loading saved content…' : '저장된 내용 불러오는 중…'}</p>
      </div>
    )
  }

  return (
    <div className="p-4" role="tabpanel">
      <div className="w-full min-w-0 max-w-none space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-gray-700">
            {uiLocaleEn ? 'Print / PDF preview language' : '인쇄·PDF 미리보기 언어'}
          </span>
          <Button
            type="button"
            size="sm"
            variant={sopEditLang === 'ko' ? 'default' : 'outline'}
            onClick={() => setSopEditLang('ko')}
          >
            한국어
          </Button>
          <Button
            type="button"
            size="sm"
            variant={sopEditLang === 'en' ? 'default' : 'outline'}
            onClick={() => setSopEditLang('en')}
          >
            English
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => setPrintPreviewOpen(true)}>
            {uiLocaleEn ? 'Open print preview window' : '인쇄·PDF 미리보기 창'}
          </Button>
          <span className="text-xs text-gray-500">
            {uiLocaleEn
              ? `Checklist “split from notes” uses the language above. DB title (KO priority): ${primaryDocumentTitle(structureDoc)} · Preview opens in a movable window (no dim overlay).`
              : `「추가 설명 → 체크」는 위 언어 기준입니다. DB 제목(한글 우선): ${primaryDocumentTitle(structureDoc)} · 미리보기는 화면 위 떠 있는 창으로 열립니다(배경 어둡게 가리지 않음).`}
          </span>
        </div>

          <div className="space-y-2">
            <span className="block text-sm font-medium text-gray-800">
              {uiLocaleEn ? 'Document title (both languages)' : '문서 제목 (한국어 / English 동시 표시)'}
            </span>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border-2 border-sky-300 bg-sky-50/90 p-3 shadow-sm">
                <div className="mb-2 flex items-center gap-2">
                  <span className="rounded bg-sky-700 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
                    한국어
                  </span>
                  <span className="text-xs text-sky-900/90">Korean</span>
                </div>
                <LightRichEditor
                  key={`${kind}-doc-title-ko`}
                  value={structureDoc.title_ko}
                  onChange={(v) => setStructureDoc((prev) => ({ ...prev, title_ko: v ?? '' }))}
                  height={120}
                  enableImageUpload={false}
                  enableResize={false}
                  className="rounded-md border border-sky-200 bg-white overflow-hidden"
                  placeholder={titlePlaceholderKo}
                />
              </div>
              <div className="rounded-lg border-2 border-violet-300 bg-violet-50/90 p-3 shadow-sm">
                <div className="mb-2 flex items-center gap-2">
                  <span className="rounded bg-violet-700 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
                    English
                  </span>
                  <span className="text-xs text-violet-900/90">영문</span>
                </div>
                <LightRichEditor
                  key={`${kind}-doc-title-en`}
                  value={structureDoc.title_en}
                  onChange={(v) => setStructureDoc((prev) => ({ ...prev, title_en: v ?? '' }))}
                  height={120}
                  enableImageUpload={false}
                  enableResize={false}
                  className="rounded-md border border-violet-200 bg-white overflow-hidden"
                  placeholder={titlePlaceholderEn}
                />
              </div>
            </div>
          </div>

          <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-3 space-y-2">
            <label className="text-sm font-medium text-gray-800">
              {uiLocaleEn ? 'Import from pasted text' : '텍스트 붙여넣기로 가져오기'}
            </label>
            <p className="text-xs text-gray-600">
              {uiLocaleEn
                ? 'Parsed text fills Korean fields only; add English in the violet “English” column in each block below.'
                : '변환된 내용은 한국어(하늘색) 열에만 들어갑니다. 영문은 아래 각 블록의 보라색 English 열에 입력하세요.'}
            </p>
            <textarea
              className="w-full min-h-[100px] rounded border border-gray-200 bg-white px-2 py-2 text-xs font-mono"
              value={pasteRaw}
              onChange={(e) => setPasteRaw(e.target.value)}
              placeholder={pastePlaceholder}
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => void applyPasteAsStructure()}>
                {uiLocaleEn ? 'Parse into structure' : '구조로 변환'}
              </Button>
              {latest ? (
                <Button type="button" variant="outline" size="sm" onClick={() => void loadLatestIntoEditor()}>
                  {uiLocaleEn ? 'Load latest published version' : '현재 게시본 불러오기'}
                </Button>
              ) : null}
            </div>
          </div>

          <SopStructureEditor
            value={structureDoc}
            onChange={setStructureDoc}
            uiLocaleEn={uiLocaleEn}
            editLocale={sopEditLang}
            disabled={publishing || savingDraft}
            sectionVersionMeta={sectionVersionMeta}
            savingSectionId={savingSectionId}
            onSaveSectionVersion={saveSectionVersion}
            onFetchSectionVersionHistory={fetchSectionVersionHistory}
            onRestoreSectionFromHistory={restoreSectionFromHistory}
          />

          <div className="rounded-md border border-amber-200 bg-amber-50/90 p-3 space-y-2 text-sm text-amber-950">
            <p className="text-xs leading-relaxed">
              {uiLocaleEn
                ? 'Save a draft on the server anytime (no version created, no staff push). When ready, use Publish & notify to release and alert the team.'
                : '작업 중인 내용은 「초안 저장」으로 서버에만 보관할 수 있습니다(새 버전 생성·직원 알림 없음). 준비되면 「게시 및 알림」으로 게시하고 푸시 알림을 보냅니다.'}
            </p>
            <div className="flex flex-wrap gap-2 items-center">
              <Button type="button" variant="secondary" disabled={publishing || savingDraft} onClick={saveDraft}>
                {savingDraft
                  ? uiLocaleEn
                    ? 'Saving draft…'
                    : '초안 저장 중…'
                  : uiLocaleEn
                    ? 'Save draft'
                    : '초안 저장'}
              </Button>
              {serverDraftUpdatedAt ? (
                <>
                  <span className="text-xs text-amber-900/85">
                    {uiLocaleEn ? 'Last saved: ' : '마지막 저장: '}
                    {new Date(serverDraftUpdatedAt).toLocaleString(uiLocaleEn ? 'en-US' : 'ko-KR')}
                  </span>
                  <Button type="button" variant="outline" size="sm" disabled={publishing || savingDraft} onClick={loadServerDraft}>
                    {uiLocaleEn ? 'Load saved draft' : '초안 불러오기'}
                  </Button>
                </>
              ) : null}
            </div>
            {draftMsg ? <p className="text-xs text-amber-900/90">{draftMsg}</p> : null}
          </div>

        <div className="flex flex-wrap gap-2 items-center pt-2 border-t border-gray-100">
          <Button type="button" disabled={publishing || savingDraft} onClick={publish}>
            {publishing ? (uiLocaleEn ? 'Publishing…' : '게시 중…') : uiLocaleEn ? 'Publish & notify' : '게시 및 알림'}
          </Button>
          {publishMsg ? <span className="text-sm text-gray-700">{publishMsg}</span> : null}
        </div>
      </div>

      <SopPrintPreviewFloatingPanel
        open={printPreviewOpen}
        onOpenChange={setPrintPreviewOpen}
        uiLocaleEn={uiLocaleEn}
        storageKey={floatingPreviewStorageKey}
        title={uiLocaleEn ? 'Print / PDF preview' : '인쇄·PDF 미리보기'}
      >
        <SopPrintPreviewFrame
          scrollMode="floating"
          doc={structureDoc}
          viewLang={sopEditLang}
          caption={
            uiLocaleEn
              ? 'Full A4 width (210mm). Drag the window by its title bar; resize from the bottom-right corner. Esc closes.'
              : '본문은 A4 폭(210mm)입니다. 제목 줄로 창을 옮기고, 오른쪽 아래 모서리로 크기를 조절하세요. Esc로 닫습니다.'
          }
          signatureNote={
            uiLocaleEn
              ? 'Signature block: each signer’s name and signature appear here on the signed PDF.'
              : '서명란: 서명 완료된 PDF에는 직원별 이름·서명이 이 아래에 포함됩니다.'
          }
        />
      </SopPrintPreviewFloatingPanel>
    </div>
  )
}
