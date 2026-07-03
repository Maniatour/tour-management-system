'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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
  RefreshCw,
  Shield,
  Sparkles,
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
import SopDocumentWithToc from '@/components/sop/SopDocumentWithToc'
import KnowledgeArticleEditorPanel from '@/components/operations/KnowledgeArticleEditorPanel'
import { parseSopDocumentJson, type SopEditLocale } from '@/types/sopStructure'
import {
  articleBodyToDocument,
  articleRowToHubEntry,
  contentTypeLabel,
  defaultKnowledgeArticleSeeds,
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
import {
  syncKnowledgeArticleTemplates,
  templateSyncConfirmMessage,
  templateSyncResultMessage,
} from '@/lib/knowledgeArticleTemplateSync'
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
  const editLang: SopEditLocale = isEn ? 'en' : 'ko'

  const { authUser, userRole, loading, isInitialized } = useAuth()
  const [canManage, setCanManage] = useState(false)
  const [teamPosition, setTeamPosition] = useState<string | null>(null)
  const [articles, setArticles] = useState<KnowledgeArticleRow[]>([])
  const [sopSections, setSopSections] = useState<ReturnType<typeof sopSectionsToHubEntries>>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadingData, setLoadingData] = useState(true)

  const [readArticle, setReadArticle] = useState<KnowledgeArticleRow | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [form, setForm] = useState<KnowledgeArticleDraftForm>(() => emptyKnowledgeArticleForm())
  const [editTab, setEditTab] = useState<'meta' | 'body' | 'preview'>('meta')
  const [busy, setBusy] = useState(false)
  const [crudMsg, setCrudMsg] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeArticleRow | null>(null)

  const staffOk =
    userRole === 'admin' || userRole === 'manager' || userRole === 'team_member'

  const hubBase = `/${locale}/${basePath}/operations-hub`
  const adminCrud = enableAdminCrud && canManage

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
      .filter((e) => matchesHubTargetRoles(e.target_roles, position))
    const sopEntries = sopSections.filter((e) => matchesHubTargetRoles(e.target_roles, position))
    return mergeHubEntries(articleEntries, sopEntries)
  }, [hubArticles, position, sopSections])

  const grouped = useMemo(() => groupHubEntriesByCategory(visibleEntries), [visibleEntries])

  const unpublishedSlugs = useMemo(
    () => new Set(articles.filter((a) => !a.is_published).map((a) => a.slug)),
    [articles]
  )

  const readDoc = useMemo(
    () => (readArticle ? articleBodyToDocument(readArticle) : null),
    [readArticle]
  )

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
    setEditTab('meta')
    setCrudMsg(null)
    setEditOpen(true)
  }

  const openEditRow = (row: KnowledgeArticleRow) => {
    setForm(knowledgeArticleRowToForm(row))
    setEditTab('meta')
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
    await load()
    const { data: refreshed } = await supabase
      .from('company_knowledge_articles')
      .select(KNOWLEDGE_ARTICLE_SELECT)
      .eq('id', result.id)
      .maybeSingle()
    const saved = refreshed as KnowledgeArticleRow | null
    setEditOpen(false)
    if (saved && saved.is_published) {
      setReadArticle(saved)
    }
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
    await load()
  }

  const runTemplateSync = async (mode: 'append' | 'overwrite') => {
    if (!adminCrud) return
    if (mode === 'overwrite') {
      const ok = window.confirm(templateSyncConfirmMessage('overwrite', isEn))
      if (!ok) return
    }
    setBusy(true)
    setCrudMsg(null)
    const result = await syncKnowledgeArticleTemplates(mode, authUser?.id ?? null)
    setBusy(false)
    setCrudMsg(templateSyncResultMessage(mode, result, defaultKnowledgeArticleSeeds().length, isEn))
    await load()
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
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => void runTemplateSync('append')}
              >
                <Sparkles className="mr-1 h-4 w-4" />
                {isEn ? 'Add templates' : '템플릿 추가'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-amber-300 text-amber-900 hover:bg-amber-50"
                disabled={busy}
                onClick={() => void runTemplateSync('overwrite')}
              >
                <RefreshCw className="mr-1 h-4 w-4" />
                {isEn ? 'Overwrite' : '덮어쓰기'}
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
              {isEn ? 'No published documents yet.' : '게시된 운영 문서가 아직 없습니다.'}
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
                  <FileText className="h-5 w-5 text-indigo-600" />
                  {hubCategoryLabel(category.id, viewLang)}
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

      {/* 읽기 모달 */}
      <Dialog open={!!readArticle && !!readDoc} onOpenChange={(open) => !open && setReadArticle(null)}>
        <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
          {readArticle && readDoc ? (
            <>
              <DialogHeader className="shrink-0 space-y-1 border-b px-6 py-4 pr-12 text-left">
                <DialogTitle className="text-lg">
                  {isEn
                    ? readArticle.title_en || readArticle.title_ko
                    : readArticle.title_ko || readArticle.title_en}
                </DialogTitle>
                <p className="text-xs font-normal text-gray-500">
                  {hubCategoryLabel(readArticle.hub_category, viewLang)}
                  {' · '}
                  {contentTypeLabel(readArticle.content_type, viewLang)}
                  {!readArticle.is_published ? (isEn ? ' · Draft' : ' · 초안') : ''}
                </p>
                {adminCrud ? (
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setReadArticle(null)
                        openEditRow(readArticle)
                      }}
                    >
                      <Pencil className="mr-1 h-3.5 w-3.5" />
                      {isEn ? 'Edit' : '수정'}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => setDeleteTarget(readArticle)}
                    >
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                      {isEn ? 'Delete' : '삭제'}
                    </Button>
                  </div>
                ) : null}
              </DialogHeader>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
                <SopDocumentWithToc doc={readDoc} viewLang={viewLang} uiLocaleEn={isEn} />
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* 편집 모달 */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="flex max-h-[92vh] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl">
          <DialogHeader className="shrink-0 border-b px-6 py-4 pr-12 text-left">
            <DialogTitle>
              {form.id ? (isEn ? 'Edit document' : '문서 수정') : isEn ? 'New document' : '새 문서'}
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
            <KnowledgeArticleEditorPanel
              form={form}
              setForm={setForm}
              editTab={editTab}
              setEditTab={setEditTab}
              isEn={isEn}
              editLang={editLang}
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
        <AlertDialogContent>
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
