'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { canManageCompanySop, normalizeEmail } from '@/lib/sopPermissions'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import LightRichEditor from '@/components/LightRichEditor'
import SopStructureEditor from '@/components/sop/SopStructureEditor'
import SopPrintPreviewFrame from '@/components/sop/SopPrintPreviewFrame'
import type { Json } from '@/lib/database.types'
import {
  emptySopDocument,
  parseSopDocumentJson,
  parseSopPlainTextToDocument,
  isPublishableSopDocument,
  sopDocumentToJson,
  prefillSortOrders,
  primaryDocumentTitle,
  type SopDocument,
  type SopEditLocale,
} from '@/types/sopStructure'

function defaultEditorSopDocument(): SopDocument {
  return prefillSortOrders({
    ...emptySopDocument(),
    title_ko: '투어 가이드 / 드라이버 표준 운영 절차 (SOP)',
    title_en: 'Tour Guide / Driver Standard Operating Procedures (SOP)',
  })
}

type SopVersion = {
  id: string
  version_number: number
  title: string
  body_md: string | null
  body_structure: unknown
  published_at: string
}

type TeamRow = { email: string; name_ko: string | null; name_en: string | null; is_active: boolean | null }
type SigRow = {
  signer_email: string
  signer_name: string
  signed_at: string
  pdf_storage_path: string
}

export default function AdminSopPage() {
  const params = useParams()
  const locale = (params?.locale as string) || 'ko'
  const uiLocaleEn = locale === 'en'
  const { authUser, userRole, loading, isInitialized } = useAuth()

  const [sopEditLang, setSopEditLang] = useState<SopEditLocale>('ko')

  const [canManage, setCanManage] = useState(false)
  const [structureDoc, setStructureDoc] = useState<SopDocument>(() => defaultEditorSopDocument())
  const [pasteRaw, setPasteRaw] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [publishMsg, setPublishMsg] = useState<string | null>(null)
  const [savingDraft, setSavingDraft] = useState(false)
  const [draftMsg, setDraftMsg] = useState<string | null>(null)
  const [serverDraftUpdatedAt, setServerDraftUpdatedAt] = useState<string | null>(null)

  const [versions, setVersions] = useState<SopVersion[]>([])
  const [latest, setLatest] = useState<SopVersion | null>(null)
  const [team, setTeam] = useState<TeamRow[]>([])
  const [sigs, setSigs] = useState<SigRow[]>([])
  const [openingPdf, setOpeningPdf] = useState<string | null>(null)
  /** 데스크톱에서 인쇄 미리보기 패널 펼침(접으면 편집 영역만 넓게) */
  const [printPreviewOpen, setPrintPreviewOpen] = useState(false)
  /** lg 이상에서 미리보기 패널 너비(px). 구분선 드래그로 조절 */
  const [previewWidthPx, setPreviewWidthPx] = useState(480)
  const publishSplitRef = useRef<HTMLDivElement | null>(null)
  const previewResizeRef = useRef<{ startX: number; startW: number } | null>(null)
  const previewWidthDuringDragRef = useRef(480)

  const clampSopPreviewWidth = useCallback((px: number) => {
    const minPreview = 280
    const minEditor = 300
    const maxPreview = 1400
    const el = publishSplitRef.current
    const cw = el?.offsetWidth ?? (typeof window !== 'undefined' ? window.innerWidth : 1200)
    const capByContainer = cw - minEditor - 28
    return Math.round(Math.min(maxPreview, Math.max(minPreview, Math.min(capByContainer, px))))
  }, [])

  useEffect(() => {
    try {
      const raw = localStorage.getItem('admin-sop-preview-width-px')
      if (raw) {
        const n = parseInt(raw, 10)
        if (!Number.isNaN(n)) setPreviewWidthPx(clampSopPreviewWidth(n))
      }
    } catch {
      /* ignore */
    }
  }, [clampSopPreviewWidth])

  useEffect(() => {
    previewWidthDuringDragRef.current = previewWidthPx
  }, [previewWidthPx])

  useEffect(() => {
    const onResize = () => setPreviewWidthPx((w) => clampSopPreviewWidth(w))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [clampSopPreviewWidth])

  useEffect(() => {
    if (printPreviewOpen) setPreviewWidthPx((w) => clampSopPreviewWidth(w))
  }, [printPreviewOpen, clampSopPreviewWidth])

  const onPreviewResizeMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    previewResizeRef.current = { startX: e.clientX, startW: previewWidthDuringDragRef.current }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const onMove = (ev: MouseEvent) => {
      const d = previewResizeRef.current
      if (!d) return
      const dx = ev.clientX - d.startX
      const nw = clampSopPreviewWidth(d.startW - dx)
      previewWidthDuringDragRef.current = nw
      setPreviewWidthPx(nw)
    }
    const onUp = () => {
      previewResizeRef.current = null
      document.body.style.removeProperty('cursor')
      document.body.style.removeProperty('user-select')
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      try {
        localStorage.setItem('admin-sop-preview-width-px', String(previewWidthDuringDragRef.current))
      } catch {
        /* ignore */
      }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const staffOk =
    userRole === 'admin' || userRole === 'manager' || userRole === 'team_member'

  const loadCompliance = useCallback(
    async (versionId: string) => {
      const [{ data: teamData }, { data: sigData }] = await Promise.all([
        supabase.from('team').select('email, name_ko, name_en, is_active').eq('is_active', true).order('email'),
        supabase.from('sop_signatures').select('signer_email, signer_name, signed_at, pdf_storage_path').eq('version_id', versionId),
      ])
      setTeam((teamData || []) as TeamRow[])
      setSigs((sigData || []) as SigRow[])
    },
    []
  )

  const refreshVersions = useCallback(async () => {
    const { data } = await supabase
      .from('company_sop_versions')
      .select('id, version_number, title, body_md, body_structure, published_at')
      .order('version_number', { ascending: false })
    const list = (data || []) as SopVersion[]
    setVersions(list)
    const top = list[0] || null
    setLatest(top)
    if (top) await loadCompliance(top.id)
    else {
      setTeam([])
      setSigs([])
    }
  }, [loadCompliance])

  const refreshServerDraftMeta = useCallback(async () => {
    const { data, error } = await supabase.from('company_sop_draft').select('updated_at').eq('singleton', 1).maybeSingle()
    if (error) {
      console.warn('company_sop_draft:', error.message)
      setServerDraftUpdatedAt(null)
      return
    }
    setServerDraftUpdatedAt(data?.updated_at ?? null)
  }, [])

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
    }
    void run()
  }, [authUser?.email, isInitialized, loading, refreshVersions, staffOk])

  useEffect(() => {
    if (!canManage) {
      setServerDraftUpdatedAt(null)
      return
    }
    void refreshServerDraftMeta()
  }, [canManage, refreshServerDraftMeta])

  const sigByEmail = useMemo(() => {
    const m = new Map<string, SigRow>()
    for (const s of sigs) {
      m.set(s.signer_email.trim().toLowerCase(), s)
    }
    return m
  }, [sigs])

  const loadLatestIntoEditor = () => {
    if (!latest) return
    const parsed = parseSopDocumentJson(latest.body_structure)
    if (parsed) {
      if (!parsed.title_ko?.trim() && !parsed.title_en?.trim() && latest.title) {
        setStructureDoc({ ...parsed, title_ko: latest.title })
      } else {
        setStructureDoc(parsed)
      }
      return
    }
    if (latest.body_md?.trim()) {
      setStructureDoc(parseSopPlainTextToDocument(latest.body_md))
      return
    }
    setStructureDoc(prefillSortOrders(emptySopDocument()))
  }

  const saveDraft = async () => {
    if (!canManage || !authUser?.id) return
    setSavingDraft(true)
    setDraftMsg(null)
    try {
      const { data, error } = await supabase
        .from('company_sop_draft')
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
      const { data, error } = await supabase
        .from('company_sop_draft')
        .select('body_structure, paste_raw, edit_locale')
        .eq('singleton', 1)
        .maybeSingle()
      if (error) throw error
      if (!data) {
        setDraftMsg(uiLocaleEn ? 'No draft found on the server.' : '서버에 저장된 초안이 없습니다.')
        return
      }
      const parsed = parseSopDocumentJson(data.body_structure)
      if (parsed) {
        setStructureDoc(prefillSortOrders(parsed))
      } else {
        setStructureDoc(defaultEditorSopDocument())
      }
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

  const applyPasteAsStructure = () => {
    if (!pasteRaw.trim()) {
      setPublishMsg(uiLocaleEn ? 'Paste text first.' : '먼저 텍스트를 붙여넣으세요.')
      return
    }
    setStructureDoc(parseSopPlainTextToDocument(pasteRaw))
    setPublishMsg(
      uiLocaleEn ? 'Structure imported. Review and switch KO/EN tabs.' : '구조로 반영했습니다. 한/영 탭에서 확인·수정하세요.'
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
      const res = await fetch('/api/sop/publish', {
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
      setStructureDoc(defaultEditorSopDocument())
      setPasteRaw('')
      setDraftMsg(null)
      if (authUser?.id) {
        const { error: draftErr } = await supabase.from('company_sop_draft').upsert(
          {
            singleton: 1,
            body_structure: sopDocumentToJson(defaultEditorSopDocument()) as Json,
            paste_raw: '',
            edit_locale: 'ko',
            updated_by: authUser.id,
          },
          { onConflict: 'singleton' }
        )
        if (draftErr) console.warn('clear company_sop_draft:', draftErr.message)
        else await refreshServerDraftMeta()
      }
      await refreshVersions()
    } catch (e) {
      setPublishMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setPublishing(false)
    }
  }

  const openPdf = async (path: string) => {
    setOpeningPdf(path)
    try {
      const { data, error } = await supabase.storage.from('sop-signatures').createSignedUrl(path, 3600)
      if (error || !data?.signedUrl) {
        alert(error?.message || (uiLocaleEn ? 'Could not open PDF.' : 'PDF 링크를 만들 수 없습니다.'))
        return
      }
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
    } finally {
      setOpeningPdf(null)
    }
  }

  const docTitleValue = sopEditLang === 'ko' ? structureDoc.title_ko : structureDoc.title_en
  const setDocTitle = (v: string | undefined) => {
    const t = v ?? ''
    setStructureDoc((prev) =>
      sopEditLang === 'ko' ? { ...prev, title_ko: t } : { ...prev, title_en: t }
    )
  }

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
          {uiLocaleEn
            ? 'Switch Korean/English to edit each language. All fields use the rich text editor (markdown stored).'
            : '한/영을 전환해 각 언어별 문서 제목·섹션·카테고리·내용을 편집합니다. 모든 입력은 리치 텍스트(마크다운 저장)입니다.'}
        </p>
      </div>

      {canManage ? (
        <section className="w-full rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div
            ref={publishSplitRef}
            className="flex w-full min-w-0 flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-0"
            style={{ ['--sop-preview-w' as string]: `${previewWidthPx}px` } as CSSProperties}
          >
            <div className="min-w-0 flex-1 space-y-4">
              <h2 className="text-lg font-semibold">{uiLocaleEn ? 'Publish new version' : '새 버전 게시'}</h2>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-gray-700">{uiLocaleEn ? 'Edit language' : '편집 언어'}</span>
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
                <span className="text-xs text-gray-500 ml-2">
                  {uiLocaleEn
                    ? `DB title: ${primaryDocumentTitle(structureDoc)}`
                    : `DB 제목: ${primaryDocumentTitle(structureDoc)}`}
                </span>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  {uiLocaleEn ? 'Document title' : '문서 제목'} ({sopEditLang === 'ko' ? 'KO' : 'EN'})
                </label>
                <LightRichEditor
                  key={`doc-title-${sopEditLang}`}
                  value={docTitleValue}
                  onChange={setDocTitle}
                  height={120}
                  enableImageUpload={false}
                  enableResize={false}
                  className="rounded-md border border-gray-200 overflow-hidden"
                  placeholder={
                    sopEditLang === 'ko'
                      ? '투어 가이드 / 드라이버 표준 운영 절차 (SOP)'
                      : 'Tour Guide / Driver Standard Operating Procedures (SOP)'
                  }
                />
              </div>

              <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-3 space-y-2">
                <label className="text-sm font-medium text-gray-800">
                  {uiLocaleEn ? 'Import from pasted text' : '텍스트 붙여넣기로 가져오기'}
                </label>
                <p className="text-xs text-gray-600">
                  {uiLocaleEn
                    ? 'Parsed text fills Korean fields only; add English in the EN tab.'
                    : '변환된 내용은 한국어 필드에만 들어갑니다. 영문은 English 탭에서 입력하세요.'}
                </p>
                <textarea
                  className="w-full min-h-[100px] rounded border border-gray-200 bg-white px-2 py-2 text-xs font-mono"
                  value={pasteRaw}
                  onChange={(e) => setPasteRaw(e.target.value)}
                  placeholder={uiLocaleEn ? 'Paste full SOP text…' : '전체 SOP 텍스트를 여기에 붙여넣기…'}
                />
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" size="sm" onClick={applyPasteAsStructure}>
                    {uiLocaleEn ? 'Parse into structure' : '구조로 변환'}
                  </Button>
                  {latest ? (
                    <Button type="button" variant="outline" size="sm" onClick={loadLatestIntoEditor}>
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

            {printPreviewOpen ? (
              <div
                role="separator"
                aria-orientation="vertical"
                aria-label={uiLocaleEn ? 'Drag to resize preview panel' : '드래그하여 미리보기 너비 조절'}
                className="mx-1 hidden w-3 shrink-0 cursor-col-resize select-none self-stretch border-x border-transparent hover:border-slate-300 hover:bg-slate-100 lg:flex lg:items-stretch lg:justify-center"
                onMouseDown={onPreviewResizeMouseDown}
              >
                <span className="h-full min-h-[12rem] w-px rounded-full bg-slate-300" />
              </div>
            ) : null}

            <div className="flex min-w-0 shrink-0 flex-col lg:flex-row lg:items-stretch lg:min-w-0">
              <div className="flex justify-end border-t border-gray-100 pt-3 lg:hidden">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPrintPreviewOpen((o) => !o)}
                  aria-expanded={printPreviewOpen}
                >
                  {printPreviewOpen
                    ? uiLocaleEn
                      ? 'Hide print preview'
                      : '인쇄 미리보기 숨기기'
                    : uiLocaleEn
                      ? 'Show print preview'
                      : '인쇄 미리보기'}
                </Button>
              </div>

              {!printPreviewOpen ? (
                <button
                  type="button"
                  onClick={() => setPrintPreviewOpen(true)}
                  className="mt-3 hidden min-h-[12rem] w-11 shrink-0 flex-col items-center justify-center gap-2 self-start rounded-l-md border border-gray-300 bg-slate-100 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-200 lg:ml-3 lg:mt-0 lg:flex lg:sticky lg:top-4"
                  title={uiLocaleEn ? 'Show print / PDF preview' : '인쇄·PDF 미리보기 펼치기'}
                >
                  <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="max-h-[14rem] text-center leading-tight" style={{ writingMode: 'vertical-rl' }}>
                    {uiLocaleEn ? 'Preview' : '미리보기'}
                  </span>
                </button>
              ) : (
                <aside className="mt-3 w-full min-w-0 space-y-2 border-gray-200 lg:mt-0 lg:max-w-[min(1400px,calc(100vw-2rem))] lg:min-w-[280px] lg:shrink-0 lg:border-l-0 lg:pl-2 lg:[width:var(--sop-preview-w)]">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-gray-800">
                      {uiLocaleEn ? 'Print / PDF preview' : '인쇄·PDF 미리보기'}
                    </h3>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="hidden shrink-0 gap-1 lg:inline-flex"
                      onClick={() => setPrintPreviewOpen(false)}
                    >
                      <ChevronRight className="h-4 w-4" aria-hidden />
                      {uiLocaleEn ? 'Hide' : '접기'}
                    </Button>
                  </div>
                  <div className="lg:sticky lg:top-4">
                    <SopPrintPreviewFrame
                      doc={structureDoc}
                      viewLang={sopEditLang}
                      caption={
                        uiLocaleEn
                          ? 'Full A4 width (210mm). Scroll horizontally if the panel is narrow. Same language as edit (KO/EN) above.'
                          : '본문은 A4 폭(210mm) 그대로입니다. 패널이 좁으면 가로 스크롤하세요. 위 편집 언어(한/영)와 동일합니다.'
                      }
                      signatureNote={
                        uiLocaleEn
                          ? 'Signature block: each signer’s name and signature appear here on the signed PDF.'
                          : '서명란: 서명 완료된 PDF에는 직원별 이름·서명이 이 아래에 포함됩니다.'
                      }
                    />
                  </div>
                </aside>
              )}
            </div>
          </div>
        </section>
      ) : (
        <p className="text-sm text-gray-600">
          {uiLocaleEn
            ? 'You can view compliance and open PDFs. Only Super / OP / Office Manager can publish new versions.'
            : '서명 현황 조회·PDF 열람은 가능합니다. 새 버전 게시는 Super / OP / Office Manager만 할 수 있습니다.'}
        </p>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{uiLocaleEn ? 'Latest version compliance' : '최신 버전 서명 현황'}</h2>
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
                              disabled={openingPdf === sig.pdf_storage_path}
                              onClick={() => void openPdf(sig.pdf_storage_path)}
                            >
                              {openingPdf === sig.pdf_storage_path
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
        <h2 className="text-lg font-semibold">{uiLocaleEn ? 'Published versions' : '게시된 버전 목록'}</h2>
        <ul className="text-sm space-y-1 text-gray-800">
          {versions.map((v) => (
            <li key={v.id}>
              v{v.version_number} — {v.title}{' '}
              <span className="text-gray-500">({new Date(v.published_at).toLocaleString(uiLocaleEn ? 'en-US' : 'ko-KR')})</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
