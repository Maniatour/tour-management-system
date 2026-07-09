'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import {
  BookOpen,
  ClipboardList,
  FileText,
  GraduationCap,
  ListChecks,
  Loader2,
  Pencil,
  Plus,
  Save,
  Settings2,
  Shield,
  GripVertical,
  Trash2,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { canManageCompanySop } from '@/lib/sopPermissions'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ResizableDialogContent } from '@/components/ui/ResizableDialogContent'
import SopDocumentInlinePreviewEditor from '@/components/sop/SopDocumentInlinePreviewEditor'
import KnowledgeArticleEditorPanel from '@/components/operations/KnowledgeArticleEditorPanel'
import { hydrateDocumentForRowEditing } from '@/lib/sopQuickEdit'
import { parseSopDocumentJson, sopText, type SopDocument, type SopEditLocale } from '@/types/sopStructure'
import {
  articleBodyToDocument,
  articleRowToHubEntry,
  contentTypeLabel,
  groupHubEntriesByCategory,
  hubCategoryLabel,
  hubEntrySummary,
  hubEntryTitle,
  matchesHubTargetRoles,
  mergeHubEntries,
  sopSectionsToHubEntries,
  type HubEntry,
  type KnowledgeArticleRow,
} from '@/lib/operationsHub'
import {
  emptyKnowledgeArticleForm,
  KNOWLEDGE_ARTICLE_SELECT,
  knowledgeArticleRowToForm,
  type KnowledgeArticleDraftForm,
} from '@/lib/knowledgeArticleForm'
import { deleteKnowledgeArticle, saveKnowledgeArticle } from '@/lib/knowledgeArticleCrud'
import { cn } from '@/lib/utils'

type Props = {
  basePath: 'admin' | 'guide'
  enableAdminCrud?: boolean
}

export default function OperationsHubClient({ basePath, enableAdminCrud }: Props) {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const locale = (params?.locale as string) || 'ko'
  const viewLang: SopEditLocale = locale === 'en' ? 'en' : 'ko'
  const isEn = viewLang === 'en'

  const { authUser, userRole, loading, isInitialized } = useAuth()
  const [canManage, setCanManage] = useState(false)
  const [teamPosition, setTeamPosition] = useState<string | null>(null)
  const [articles, setArticles] = useState<KnowledgeArticleRow[]>([])
  const [sopSections, setSopSections] = useState<ReturnType<typeof sopSectionsToHubEntries>>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadingData, setLoadingData] = useState(true)

  const [readArticle, setReadArticle] = useState<KnowledgeArticleRow | null>(null)
  const [readEditDoc, setReadEditDoc] = useState<SopDocument | null>(null)
  const readEditDocRef = useRef<SopDocument | null>(null)
  const [readSaveMsg, setReadSaveMsg] = useState<string | null>(null)

  useEffect(() => {
    readEditDocRef.current = readEditDoc
  }, [readEditDoc])

  const handleReadEditDocChange = useCallback((doc: SopDocument) => {
    readEditDocRef.current = doc
    setReadEditDoc(doc)
  }, [])

  const [modalViewLang, setModalViewLang] = useState<SopEditLocale>(viewLang)
  const [editOpen, setEditOpen] = useState(false)
  const [form, setForm] = useState<KnowledgeArticleDraftForm>(() => emptyKnowledgeArticleForm())
  const [busy, setBusy] = useState(false)
  const [crudMsg, setCrudMsg] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeArticleRow | null>(null)

  const staffOk =
    userRole === 'admin' || userRole === 'manager' || userRole === 'team_member'

  const hubBase = `/${locale}/${basePath}/operations-hub`
  const adminCrud = enableAdminCrud && canManage

  const reloadArticles = useCallback(async (): Promise<KnowledgeArticleRow[]> => {
    if (!authUser?.email) return []

    let q = supabase
      .from('company_knowledge_articles')
      .select(KNOWLEDGE_ARTICLE_SELECT)
      .order('sort_order')
      .order('slug')
    if (!enableAdminCrud) {
      q = q.eq('is_published', true)
    }

    const { data, error } = await q
    if (error) {
      setLoadError(error.message)
      return []
    }

    const rows = (data || []) as KnowledgeArticleRow[]
    setArticles(rows)
    return rows
  }, [authUser?.email, enableAdminCrud])

  const upsertArticleInState = useCallback((row: KnowledgeArticleRow) => {
    setArticles((prev) => {
      const index = prev.findIndex((a) => a.id === row.id)
      if (index >= 0) {
        const next = [...prev]
        next[index] = row
        return next
      }
      return [...prev, row]
    })
  }, [])

  const persistReadDoc = useCallback(
    async (doc: SopDocument, opts?: { silent?: boolean }) => {
      if (!adminCrud || !readArticle) return false
      setBusy(true)
      if (!opts?.silent) setReadSaveMsg(null)
      const draft = knowledgeArticleRowToForm(readArticle)
      draft.bodyDoc = doc
      const result = await saveKnowledgeArticle(draft, authUser?.id ?? null)
      setBusy(false)
      if (!result.ok) {
        setReadSaveMsg(result.error)
        return false
      }
      if (!opts?.silent) {
        setReadSaveMsg(isEn ? 'Saved.' : '저장했습니다.')
      }
      const { data: refreshed } = await supabase
        .from('company_knowledge_articles')
        .select(KNOWLEDGE_ARTICLE_SELECT)
        .eq('id', result.id)
        .maybeSingle()
      const saved = refreshed as KnowledgeArticleRow | null
      if (saved) {
        upsertArticleInState(saved)
        setReadArticle(saved)
        const savedDoc = articleBodyToDocument(saved)
        const hydrated = savedDoc ? hydrateDocumentForRowEditing(savedDoc) : null
        readEditDocRef.current = hydrated
        setReadEditDoc(hydrated)
      } else {
        await reloadArticles()
      }
      return true
    },
    [adminCrud, authUser?.id, isEn, readArticle, reloadArticles, upsertArticleInState]
  )

  const handlePersistReadDocFromEditor = useCallback(
    async (doc: SopDocument) => {
      const ok = await persistReadDoc(doc, { silent: true })
      if (ok) {
        setReadSaveMsg(isEn ? 'Manual saved.' : '메뉴얼을 저장했습니다.')
      }
    },
    [isEn, persistReadDoc]
  )

  const load = useCallback(async () => {
    if (!isInitialized || loading || !authUser?.email) return
    if (!staffOk) {
      setLoadError(isEn ? 'Staff only.' : '직원만 접근할 수 있습니다.')
      setLoadingData(false)
      return
    }

    setLoadingData(true)
    setLoadError(null)

    const [{ data: teamRow }, articleQuery, { data: sopRow, error: sopErr }] = await Promise.all([
      supabase.from('team').select('position, is_active').eq('email', authUser.email).maybeSingle(),
      (async () => {
        let q = supabase
          .from('company_knowledge_articles')
          .select(KNOWLEDGE_ARTICLE_SELECT)
          .order('sort_order')
          .order('slug')
        if (!enableAdminCrud) {
          q = q.eq('is_published', true)
        }
        return q
      })(),
      supabase
        .from('company_sop_versions')
        .select('body_structure')
        .order('published_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    const { data: articleRows, error: articleErr } = articleQuery

    if (enableAdminCrud) {
      setCanManage(canManageCompanySop(authUser.email, teamRow))
    } else {
      setCanManage(false)
    }

    if (articleErr) {
      setLoadError(articleErr.message)
      setLoadingData(false)
      return
    }

    setTeamPosition((teamRow as { position?: string | null } | null)?.position ?? null)
    setArticles((articleRows || []) as KnowledgeArticleRow[])

    if (!sopErr && sopRow?.body_structure) {
      const doc = parseSopDocumentJson(sopRow.body_structure)
      setSopSections(doc ? sopSectionsToHubEntries(doc.sections) : [])
    } else {
      setSopSections([])
    }

    setLoadingData(false)
  }, [authUser?.email, enableAdminCrud, isEn, isInitialized, loading, staffOk])

  useEffect(() => {
    void load()
  }, [load])

  const hubArticles = useMemo(() => {
    if (adminCrud) return articles
    return articles.filter((a) => a.is_published)
  }, [adminCrud, articles])

  const position = teamPosition

  const visibleEntries = useMemo(() => {
    const articleEntries = hubArticles
      .map(articleRowToHubEntry)
      .filter(
        (e) => adminCrud || matchesHubTargetRoles(e.target_roles, position)
      )
    const sopEntries = sopSections.filter(
      (e) => adminCrud || matchesHubTargetRoles(e.target_roles, position)
    )
    return mergeHubEntries(articleEntries, sopEntries)
  }, [adminCrud, hubArticles, position, sopSections])

  const grouped = useMemo(() => groupHubEntriesByCategory(visibleEntries), [visibleEntries])

  const unpublishedSlugs = useMemo(
    () => new Set(articles.filter((a) => !a.is_published).map((a) => a.slug)),
    [articles]
  )

  const readDoc = useMemo(
    () => (readArticle ? articleBodyToDocument(readArticle) : null),
    [readArticle]
  )

  useEffect(() => {
    if (!readArticle) {
      setReadEditDoc(null)
      setReadSaveMsg(null)
      return
    }
    const parsed = articleBodyToDocument(readArticle)
    setReadEditDoc(parsed ? hydrateDocumentForRowEditing(parsed) : null)
  }, [readArticle])

  useEffect(() => {
    if (readArticle?.id) {
      setModalViewLang(viewLang)
      setReadSaveMsg(null)
    }
  }, [readArticle?.id, viewLang])

  const clearUrlParams = useCallback(() => {
    const article = searchParams.get('article')
    const edit = searchParams.get('edit')
    if (article || edit) router.replace(hubBase, { scroll: false })
  }, [hubBase, router, searchParams])

  const openReadBySlug = useCallback(
    (slug: string) => {
      const row = hubArticles.find((a) => a.slug === slug)
      if (row) {
        setReadArticle(row)
        clearUrlParams()
      }
    },
    [clearUrlParams, hubArticles]
  )

  useEffect(() => {
    if (loadingData || hubArticles.length === 0) return
    const slug = searchParams.get('article')
    if (slug) openReadBySlug(slug)
  }, [hubArticles, loadingData, openReadBySlug, searchParams])

  const openRead = (entry: HubEntry) => {
    if (entry.source !== 'article' || !entry.slug) return
    const row = hubArticles.find((a) => a.slug === entry.slug)
    if (row) setReadArticle(row)
  }

  const openEditNew = () => {
    setForm(emptyKnowledgeArticleForm())
    setCrudMsg(null)
    setEditOpen(true)
  }

  const openEditNewInCategory = (hubCategory: string) => {
    setForm({
      ...emptyKnowledgeArticleForm(),
      hub_category: hubCategory,
    })
    setCrudMsg(null)
    setEditOpen(true)
  }

  const openEditRow = (row: KnowledgeArticleRow) => {
    setForm(knowledgeArticleRowToForm(row))
    setCrudMsg(null)
    setEditOpen(true)
  }

  const openEditFromEntry = (slug: string) => {
    const row = articles.find((a) => a.slug === slug)
    if (row) openEditRow(row)
  }

  const openArticle = (entry: HubEntry) => {
    if (entry.source === 'article' && entry.slug) {
      openRead(entry)
      return
    }
    if (entry.source === 'sop_section' && entry.sopAnchorId) {
      router.push(`/${locale}/${basePath === 'admin' ? 'admin' : 'guide'}/sop#${entry.sopAnchorId}`)
    }
  }

  const toggleRole = (role: string) => {
    setForm((f) => {
      const has = f.target_roles.includes(role)
      return {
        ...f,
        target_roles: has ? f.target_roles.filter((r) => r !== role) : [...f.target_roles, role],
      }
    })
  }

  const handleSave = async () => {
    if (!adminCrud) return
    setBusy(true)
    setCrudMsg(null)
    const result = await saveKnowledgeArticle(form, authUser?.id ?? null)
    setBusy(false)
    if (!result.ok) {
      setCrudMsg(result.error)
      return
    }
    setCrudMsg(isEn ? 'Saved.' : '저장했습니다.')

    const { data: refreshed } = await supabase
      .from('company_knowledge_articles')
      .select(KNOWLEDGE_ARTICLE_SELECT)
      .eq('id', result.id)
      .maybeSingle()
    const saved = refreshed as KnowledgeArticleRow | null
    if (saved) {
      upsertArticleInState(saved)
    } else {
      await reloadArticles()
    }

    setEditOpen(false)
    if (saved && saved.is_published) {
      setReadArticle(saved)
    }
  }

  const handleSaveReadDoc = async () => {
    const doc = readEditDocRef.current
    if (!adminCrud || !readArticle || !doc) return
    await persistReadDoc(doc)
  }

  const modalUiEn = modalViewLang === 'en'

  const openReadDocSettings = () => {
    if (!readArticle) return
    const draft = knowledgeArticleRowToForm(readArticle)
    if (readEditDoc) draft.bodyDoc = readEditDoc
    setForm(draft)
    setCrudMsg(null)
    setReadArticle(null)
    setEditOpen(true)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setBusy(true)
    const result = await deleteKnowledgeArticle(deleteTarget.id)
    setBusy(false)
    if (!result.ok) {
      setCrudMsg(result.error)
      setDeleteTarget(null)
      return
    }
    if (readArticle?.id === deleteTarget.id) setReadArticle(null)
    if (form.id === deleteTarget.id) setEditOpen(false)
    setDeleteTarget(null)
    await reloadArticles()
  }

  if (!isInitialized || loading || loadingData) {
    return (
      <div className="flex items-center gap-2 p-6 text-gray-600">
        <Loader2 className="h-5 w-5 animate-spin" />
        {isEn ? 'Loading…' : '불러오는 중…'}
      </div>
    )
  }

  if (!staffOk) {
    return (
      <div className="p-6">
        <p className="text-red-600">{loadError}</p>
      </div>
    )
  }

  return (
    <>
      <div className="mx-auto max-w-5xl p-4 sm:p-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isEn ? 'Operations hub' : '운영 허브'}
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              {isEn
                ? 'Workflows, system guides, and training materials for daily operations.'
                : '워크플로, 시스템 사용법, 트레이닝·인수인계용 매뉴얼 모음입니다.'}
            </p>
          </div>
          {adminCrud ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={openEditNew}>
                <Plus className="mr-1 h-4 w-4" />
                {isEn ? 'New' : '새 문서'}
              </Button>
            </div>
          ) : null}
        </div>

        {crudMsg ? <p className="mb-4 text-sm text-gray-600">{crudMsg}</p> : null}

        <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickLink
            href={`/${locale}/${basePath === 'admin' ? 'admin' : 'guide'}/sop`}
            icon={Shield}
            title={isEn ? 'Company SOP' : '회사 SOP (규정)'}
            desc={isEn ? 'Policies requiring signature' : '서명이 필요한 표준 규정'}
          />
          <QuickLink
            href={`/${locale}/${basePath}/team-board`}
            icon={ClipboardList}
            title={isEn ? 'Team board' : '팀보드 (업무·Todo)'}
            desc={isEn ? 'Daily checklists & tasks' : '반복 체크리스트·업무'}
          />
          {basePath === 'guide' ? (
            <QuickLink
              href={`/${locale}/guide/tours?view=calendar`}
              icon={ListChecks}
              title={isEn ? 'My tours' : '내 투어'}
              desc={isEn ? 'SOP checklist on tour day' : '투어 당일 SOP 체크'}
            />
          ) : (
            <QuickLink
              href={`/${locale}/admin/sop`}
              icon={ListChecks}
              title={isEn ? 'SOP admin' : 'SOP · 체크리스트 관리'}
              desc={isEn ? 'Publish SOP & tour checklists' : 'SOP 게시·투어 체크 설정'}
            />
          )}
          <QuickAction
            icon={GraduationCap}
            title={isEn ? 'Onboarding' : '신규 입사 가이드'}
            desc={isEn ? 'First-week roadmap' : '1주차 로드맵'}
            onClick={() => openReadBySlug('onboarding-week-1')}
          />
        </div>

        {loadError ? <p className="mb-4 text-sm text-amber-700">{loadError}</p> : null}

        {grouped.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
            <BookOpen className="mx-auto mb-3 h-10 w-10 text-gray-400" />
            <p className="text-gray-700">
              {adminCrud && articles.length > 0
                ? isEn
                  ? 'No documents match your role filter. Adjust target roles or check drafts below after saving.'
                  : '표시 조건에 맞는 문서가 없습니다. 대상 직책 설정을 확인하거나 저장 후 초안을 확인해 주세요.'
                : isEn
                  ? 'No published documents yet.'
                  : '게시된 운영 문서가 아직 없습니다.'}
            </p>
            {adminCrud ? (
              <Button type="button" className="mt-4" size="sm" onClick={openEditNew}>
                <Plus className="mr-1 h-4 w-4" />
                {isEn ? 'Create first document' : '첫 문서 만들기'}
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-8">
            {grouped.map(({ category, entries }) => (
              <section key={category.id}>
                <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gray-900">
                  <FileText className="h-5 w-5 shrink-0 text-indigo-600" />
                  <span className="min-w-0">{hubCategoryLabel(category.id, viewLang)}</span>
                  {adminCrud ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 touch-manipulation text-indigo-600 hover:bg-indigo-50"
                      title={
                        isEn
                          ? `Add document to ${hubCategoryLabel(category.id, viewLang)}`
                          : `${hubCategoryLabel(category.id, viewLang)}에 문서 추가`
                      }
                      aria-label={
                        isEn
                          ? `Add document to ${hubCategoryLabel(category.id, viewLang)}`
                          : `${hubCategoryLabel(category.id, viewLang)}에 문서 추가`
                      }
                      onClick={() => openEditNewInCategory(category.id)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  ) : null}
                </h2>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {entries.map((entry) => (
                    <li key={entry.id} className="relative">
                      <button
                        type="button"
                        onClick={() => openArticle(entry)}
                        className={cn(
                          'flex h-full w-full flex-col rounded-lg border border-gray-200 bg-white p-4 text-left shadow-sm',
                          'transition hover:border-indigo-300 hover:shadow-md',
                          entry.slug && unpublishedSlugs.has(entry.slug)
                            ? 'border-dashed border-amber-300 bg-amber-50/30'
                            : ''
                        )}
                      >
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">
                            {hubEntryTitle(entry, viewLang)}
                          </span>
                          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-gray-600">
                            {contentTypeLabel(entry.content_type, viewLang)}
                          </span>
                          {entry.slug && unpublishedSlugs.has(entry.slug) ? (
                            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                              {isEn ? 'Draft' : '초안'}
                            </span>
                          ) : null}
                        </div>
                        {hubEntrySummary(entry, viewLang) ? (
                          <p className="text-xs text-gray-600 line-clamp-2">
                            {hubEntrySummary(entry, viewLang)}
                          </p>
                        ) : null}
                        {entry.source === 'sop_section' ? (
                          <span className="mt-2 text-[10px] text-indigo-600">
                            {isEn ? 'Opens in SOP' : 'SOP에서 열기'}
                          </span>
                        ) : null}
                      </button>
                      {adminCrud && entry.source === 'article' && entry.slug ? (
                        <div className="absolute right-2 top-2 flex gap-1">
                          <button
                            type="button"
                            title={isEn ? 'Edit' : '수정'}
                            onClick={(e) => {
                              e.stopPropagation()
                              openEditFromEntry(entry.slug!)
                            }}
                            className="rounded-md bg-white/90 p-1.5 text-indigo-600 shadow-sm ring-1 ring-gray-200 hover:bg-indigo-50"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>

      {/* 읽기 모달 — 관리자는 미리보기에서 바로 편집 */}
      <Dialog
        open={!!readArticle && !!(adminCrud ? readEditDoc : readDoc)}
        onOpenChange={(open) => !open && setReadArticle(null)}
      >
        <ResizableDialogContent
          storageKey="operations-hub-article-modal-rect"
          defaultWidth={1024}
          defaultHeight={760}
          stackLevel="elevated"
          className="gap-0"
        >
          {readArticle && (adminCrud ? readEditDoc : readDoc) ? (
            <>
              <DialogHeader
                data-dialog-drag-handle
                className="relative shrink-0 space-y-1 border-b px-4 py-3 pr-12 text-left sm:cursor-grab sm:px-6 sm:py-4 sm:active:cursor-grabbing"
              >
                <div
                  className="absolute right-12 top-3 z-20 flex max-w-[min(calc(100%-2.5rem),42rem)] flex-nowrap items-center gap-1 sm:top-3.5 sm:gap-1.5"
                  data-no-drag
                >
                  {adminCrud ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        disabled={busy}
                        className="h-8 shrink-0 touch-manipulation px-2.5 text-xs"
                        onClick={() => void handleSaveReadDoc()}
                      >
                        <Save className="mr-1 h-3.5 w-3.5" />
                        {modalUiEn ? 'Save' : '저장'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="h-8 shrink-0 touch-manipulation px-2.5 text-xs"
                        onClick={openReadDocSettings}
                      >
                        <Settings2 className="mr-1 h-3.5 w-3.5" />
                        <span className="hidden sm:inline">{modalUiEn ? 'Document settings' : '문서 설정'}</span>
                        <span className="sm:hidden">{modalUiEn ? 'Settings' : '설정'}</span>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        className="h-8 shrink-0 touch-manipulation px-2.5 text-xs"
                        onClick={() => setDeleteTarget(readArticle)}
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" />
                        {modalUiEn ? 'Delete' : '삭제'}
                      </Button>
                    </>
                  ) : null}
                  <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-50 p-0.5">
                    <button
                      type="button"
                      onClick={() => setModalViewLang('ko')}
                      className={cn(
                        'rounded-md px-2 py-1 text-[11px] font-medium transition-colors touch-manipulation sm:px-2.5 sm:text-xs',
                        modalViewLang === 'ko'
                          ? 'bg-white text-indigo-700 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      )}
                    >
                      한국어
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalViewLang('en')}
                      className={cn(
                        'rounded-md px-2 py-1 text-[11px] font-medium transition-colors touch-manipulation sm:px-2.5 sm:text-xs',
                        modalViewLang === 'en'
                          ? 'bg-white text-indigo-700 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      )}
                    >
                      English
                    </button>
                  </div>
                </div>

                <div
                  className={cn(
                    'flex items-start gap-2',
                    adminCrud ? 'pr-0 sm:pr-[22rem] md:pr-[24rem]' : 'pr-0 sm:pr-[9.5rem]'
                  )}
                >
                  <GripVertical className="mt-1 hidden h-4 w-4 shrink-0 text-gray-400 sm:block" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <DialogTitle className="text-base leading-snug sm:text-lg">
                      {sopText(readArticle.title_ko, readArticle.title_en, modalViewLang) ||
                        (modalUiEn ? readArticle.title_en : readArticle.title_ko) ||
                        readArticle.title_ko ||
                        readArticle.title_en}
                    </DialogTitle>
                    <p className="text-xs font-normal text-gray-500">
                      {hubCategoryLabel(readArticle.hub_category, modalViewLang)}
                      {' · '}
                      {contentTypeLabel(readArticle.content_type, modalViewLang)}
                      {!readArticle.is_published ? (modalUiEn ? ' · Draft' : ' · 초안') : ''}
                    </p>
                    {adminCrud && readSaveMsg ? (
                      <p className="pt-1 text-xs text-gray-600">{readSaveMsg}</p>
                    ) : null}
                  </div>
                </div>
                <p className="hidden text-[11px] text-gray-400 sm:block">
                  {modalUiEn
                    ? 'Drag the title bar to move · edges/corners to resize'
                    : '제목 줄 드래그로 이동 · 가장자리/모서리로 크기 조절'}
                </p>
              </DialogHeader>
              <div className="min-h-0 flex-1 overflow-hidden px-3 py-3 sm:px-4 sm:py-4 md:px-6">
                {adminCrud && readEditDoc ? (
                  <SopDocumentInlinePreviewEditor
                    doc={readEditDoc}
                    onChange={handleReadEditDocChange}
                    onPersistDocument={handlePersistReadDocFromEditor}
                    viewLang={modalViewLang}
                    uiLocaleEn={modalUiEn}
                    resizableToc
                    tocWidthStorageKey="operations-hub-article-toc-width"
                  />
                ) : readDoc ? (
                  <SopDocumentInlinePreviewEditor
                    doc={readDoc}
                    onChange={() => {}}
                    viewLang={modalViewLang}
                    uiLocaleEn={modalUiEn}
                    editable={false}
                    resizableToc
                    tocWidthStorageKey="operations-hub-article-toc-width"
                  />
                ) : null}
              </div>
            </>
          ) : null}
        </ResizableDialogContent>
      </Dialog>

      {/* 편집 모달 */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent stackLevel="nested" className="flex max-h-[92vh] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl">
          <DialogHeader className="shrink-0 border-b px-6 py-4 pr-12 text-left">
            <DialogTitle>
              {form.id ? (isEn ? 'Edit document' : '문서 수정') : isEn ? 'New document' : '새 문서'}
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
            <KnowledgeArticleEditorPanel
              form={form}
              setForm={setForm}
              isEn={isEn}
              busy={busy}
              msg={crudMsg}
              onSave={handleSave}
              {...(form.id
                ? {
                    onDelete: () => {
                      const row = articles.find((a) => a.id === form.id)
                      if (row) setDeleteTarget(row)
                    },
                  }
                : {})}
              toggleRole={toggleRole}
              embedded
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent stackLevel="nested">
          <AlertDialogHeader>
            <AlertDialogTitle>{isEn ? 'Delete document?' : '문서를 삭제할까요?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {isEn
                ? `“${deleteTarget?.title_en || deleteTarget?.title_ko}” will be permanently removed.`
                : `「${deleteTarget?.title_ko || deleteTarget?.title_en}」 문서가 영구 삭제됩니다.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{isEn ? 'Cancel' : '취소'}</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              className="bg-red-600 hover:bg-red-700"
              onClick={(e) => {
                e.preventDefault()
                void confirmDelete()
              }}
            >
              {isEn ? 'Delete' : '삭제'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function QuickLink({
  href,
  icon: Icon,
  title,
  desc,
}: {
  href: string
  icon: LucideIcon
  title: string
  desc: string
}) {
  return (
    <Link
      href={href}
      className="flex gap-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition hover:border-indigo-200 hover:shadow"
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />
      <div>
        <div className="text-sm font-medium text-gray-900">{title}</div>
        <div className="text-xs text-gray-500">{desc}</div>
      </div>
    </Link>
  )
}

function QuickAction({
  icon: Icon,
  title,
  desc,
  onClick,
}: {
  icon: LucideIcon
  title: string
  desc: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex gap-3 rounded-lg border border-gray-200 bg-white p-3 text-left shadow-sm transition hover:border-indigo-200 hover:shadow"
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />
      <div>
        <div className="text-sm font-medium text-gray-900">{title}</div>
        <div className="text-xs text-gray-500">{desc}</div>
      </div>
    </button>
  )
}
