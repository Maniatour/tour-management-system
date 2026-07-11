'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ExternalLink, FileText, Loader2, Save } from 'lucide-react'
import LightRichEditor from '@/components/LightRichEditor'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ResizableDialogContent } from '@/components/ui/ResizableDialogContent'
import { buildLegalPageHref, type LegalPageSlug } from '@/lib/customerSiteRoutes'
import {
  getDefaultLegalPageContent,
  normalizeLegalPageContent,
  type LegalPageContent,
} from '@/lib/legalContent'
import {
  fetchAllLegalPageContents,
  persistLegalPageContents,
  type LegalPageLocale,
} from '@/lib/legalContentPersistence'
import { LEGAL_PAGE_CATALOG } from '@/lib/legalPageCatalog'
import { cn } from '@/lib/utils'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  locale: string
  isEn: boolean
}

type DraftState = Record<LegalPageSlug, Record<LegalPageLocale, LegalPageContent>>

function buildInitialDraft(): DraftState {
  const draft = {} as DraftState

  for (const entry of LEGAL_PAGE_CATALOG) {
    draft[entry.slug] = {
      ko: getDefaultLegalPageContent(entry.slug, 'ko'),
      en: getDefaultLegalPageContent(entry.slug, 'en'),
    }
  }

  return draft
}

export default function LegalPagesHubPanel({ open, onOpenChange, locale, isEn }: Props) {
  const [draft, setDraft] = useState<DraftState>(() => buildInitialDraft())
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [editSlug, setEditSlug] = useState<LegalPageSlug | null>(null)
  const [editLocale, setEditLocale] = useState<LegalPageLocale>('ko')

  const loadDraft = useCallback(async () => {
    setLoading(true)
    setMessage(null)
    try {
      const contents = await fetchAllLegalPageContents()
      setDraft(contents)
      setLoaded(true)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open && !loaded) {
      void loadDraft()
    }
  }, [open, loaded, loadDraft])

  useEffect(() => {
    if (!open) {
      setEditSlug(null)
      setMessage(null)
    }
  }, [open])

  const activeBody = useMemo(() => {
    if (!editSlug) return ''
    return draft[editSlug][editLocale].body
  }, [draft, editLocale, editSlug])

  const updateActiveBody = useCallback(
    (body: string) => {
      if (!editSlug) return
      setDraft((prev) => ({
        ...prev,
        [editSlug]: {
          ...prev[editSlug],
          [editLocale]: normalizeLegalPageContent({ body }, editSlug, editLocale),
        },
      }))
    },
    [editLocale, editSlug]
  )

  const handleSave = async () => {
    if (!editSlug) return
    setBusy(true)
    setMessage(null)
    try {
      await persistLegalPageContents(editSlug, draft[editSlug])
      setMessage(isEn ? 'Saved successfully.' : '저장되었습니다.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  const handleResetLocale = () => {
    if (!editSlug) return
    const confirmed = window.confirm(
      isEn
        ? 'Reset this language to the built-in default content?'
        : '이 언어를 기본 템플릿 내용으로 되돌릴까요?'
    )
    if (!confirmed) return

    setDraft((prev) => ({
      ...prev,
      [editSlug]: {
        ...prev[editSlug],
        [editLocale]: getDefaultLegalPageContent(editSlug, editLocale),
      },
    }))
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <ResizableDialogContent
          storageKey="operations-hub-legal-pages-list"
          className="max-w-3xl gap-0 overflow-hidden p-0"
        >
          <DialogHeader className="border-b border-gray-200 px-5 py-4">
            <DialogTitle className="flex items-center gap-2 text-left text-lg">
              <FileText className="h-5 w-5 text-booking" aria-hidden />
              {isEn ? 'Legal & policy pages' : '법적 고지 · 정책 페이지'}
            </DialogTitle>
            <p className="text-left text-sm font-normal text-gray-600">
              {isEn
                ? 'Choose a policy to edit in the rich-text editor.'
                : '수정할 정책을 선택하면 에디터에서 내용을 편집할 수 있습니다.'}
            </p>
          </DialogHeader>

          <div className="max-h-[min(70vh,640px)] overflow-y-auto px-5 py-4">
            <div className="mb-4 flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void loadDraft()}
                disabled={loading}
              >
                {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                {isEn ? 'Reload' : '새로고침'}
              </Button>
            </div>

            {message && !editSlug ? (
              <p className="mb-4 text-sm text-gray-600">{message}</p>
            ) : null}

            {loading ? (
              <div className="flex items-center gap-2 py-12 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                {isEn ? 'Loading legal pages…' : '정책 페이지 불러오는 중…'}
              </div>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {LEGAL_PAGE_CATALOG.map((entry) => (
                  <li key={entry.slug}>
                    <button
                      type="button"
                      onClick={() => {
                        setEditSlug(entry.slug)
                        setEditLocale(isEn ? 'en' : 'ko')
                        setMessage(null)
                      }}
                      className="flex h-full w-full flex-col rounded-xl border border-gray-200 bg-slate-50/60 p-4 text-left transition hover:border-booking/30 hover:bg-white hover:shadow-md"
                    >
                      <span className="text-sm font-semibold text-gray-900">
                        {isEn ? entry.title_en : entry.title_ko}
                      </span>
                      <span className="mt-1 text-xs text-gray-600">
                        {isEn ? entry.description_en : entry.description_ko}
                      </span>
                      <span className="mt-3 text-[11px] font-medium uppercase tracking-wide text-booking">
                        {isEn ? 'Open editor' : '에디터 열기'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </ResizableDialogContent>
      </Dialog>

      <Dialog
        open={editSlug !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setEditSlug(null)
        }}
      >
        <ResizableDialogContent
          storageKey="operations-hub-legal-page-editor"
          className="max-w-5xl gap-0 overflow-hidden p-0"
        >
          <DialogHeader className="border-b border-gray-200 px-5 py-4">
            <DialogTitle className="text-left text-lg">
              {editSlug
                ? isEn
                  ? LEGAL_PAGE_CATALOG.find((entry) => entry.slug === editSlug)?.title_en
                  : LEGAL_PAGE_CATALOG.find((entry) => entry.slug === editSlug)?.title_ko
                : ''}
            </DialogTitle>
          </DialogHeader>

          {editSlug ? (
            <div className="flex max-h-[calc(100vh-8rem)] flex-col">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-3">
                <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
                  {(['ko', 'en'] as const).map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => setEditLocale(lang)}
                      className={cn(
                        'rounded-md px-3 py-1.5 text-xs font-medium transition',
                        editLocale === lang
                          ? 'bg-white text-booking shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      )}
                    >
                      {lang === 'ko' ? '한국어' : 'English'}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" asChild>
                    <Link href={buildLegalPageHref(locale, editSlug)} target="_blank">
                      <ExternalLink className="mr-1 h-4 w-4" />
                      {isEn ? 'Preview' : '미리보기'}
                    </Link>
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={handleResetLocale}>
                    {isEn ? 'Reset language' : '언어 초기화'}
                  </Button>
                  <Button type="button" size="sm" onClick={() => void handleSave()} disabled={busy}>
                    {busy ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-1 h-4 w-4" />
                    )}
                    {isEn ? 'Save' : '저장'}
                  </Button>
                </div>
              </div>

              {message ? <p className="px-5 pt-3 text-sm text-gray-600">{message}</p> : null}

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                <LightRichEditor
                  value={activeBody}
                  onChange={(value) => updateActiveBody(value ?? '')}
                  height={520}
                  minHeight={360}
                  maxHeight={900}
                  enableResize
                  showToolbar
                  enableList
                  enableBold
                  enableItalic
                  enableUnderline
                  enableLink
                  placeholder={
                    isEn
                      ? 'Write the full policy here. Use headings, paragraphs, and lists.'
                      : '정책 전체 내용을 여기에 작성하세요. 제목, 문단, 목록을 자유롭게 사용할 수 있습니다.'
                  }
                  className="rounded-xl border border-gray-200"
                />
              </div>
            </div>
          ) : null}
        </ResizableDialogContent>
      </Dialog>
    </>
  )
}
