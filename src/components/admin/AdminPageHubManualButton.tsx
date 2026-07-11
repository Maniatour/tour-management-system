'use client'

import { useEffect, useState } from 'react'
import { useLocale } from 'next-intl'
import SopDocumentWithToc from '@/components/sop/SopDocumentWithToc'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ResizableDialogContent } from '@/components/ui/ResizableDialogContent'
import { fetchHubArticleDocumentBySlug } from '@/lib/hubArticleManualLink'
import { cn } from '@/lib/utils'
import type { SopDocument, SopEditLocale } from '@/types/sopStructure'
import { sopText } from '@/types/sopStructure'
import { BookOpen, GripVertical, Loader2 } from 'lucide-react'

type Props = {
  slug: string
  /** 운영 허브에 문서가 없을 때만 사용 */
  fallbackDoc?: SopDocument
  fallbackTitle?: { ko: string; en: string }
  storageKey?: string
  className?: string
}

export default function AdminPageHubManualButton({
  slug,
  fallbackDoc,
  fallbackTitle,
  storageKey = 'admin-page-hub-manual-modal-v1',
  className,
}: Props) {
  const locale = useLocale()
  const isEn = locale === 'en'
  const viewLang: SopEditLocale = isEn ? 'en' : 'ko'
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [doc, setDoc] = useState<SopDocument | null>(null)
  const [title, setTitle] = useState('')

  useEffect(() => {
    if (!open) {
      setDoc(null)
      setTitle('')
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    void fetchHubArticleDocumentBySlug(slug).then((result) => {
      if (cancelled) return

      if (result?.doc) {
        setDoc(result.doc)
        setTitle(
          sopText(result.row.title_ko, result.row.title_en, viewLang).trim() ||
            (isEn ? fallbackTitle?.en : fallbackTitle?.ko) ||
            (isEn ? 'Manual' : '메뉴얼')
        )
      } else if (fallbackDoc) {
        setDoc(fallbackDoc)
        setTitle(
          (isEn ? fallbackTitle?.en : fallbackTitle?.ko) ||
            sopText(fallbackDoc.title_ko, fallbackDoc.title_en, viewLang).trim() ||
            (isEn ? 'Manual' : '메뉴얼')
        )
      } else {
        setDoc(null)
        setTitle(isEn ? 'Manual' : '메뉴얼')
      }
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [open, slug, fallbackDoc, fallbackTitle, viewLang, isEn])

  const buttonLabel = isEn ? 'Open page manual' : '페이지 메뉴얼 보기'

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          'h-8 w-8 shrink-0 touch-manipulation text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 sm:h-9 sm:w-9',
          className
        )}
        title={buttonLabel}
        aria-label={buttonLabel}
        onClick={() => setOpen(true)}
      >
        <BookOpen className="h-4 w-4 sm:h-[1.125rem] sm:w-[1.125rem]" aria-hidden />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <ResizableDialogContent
          storageKey={storageKey}
          defaultWidth={960}
          defaultHeight={720}
          stackLevel="nestedElevated"
          className="flex flex-col gap-0"
        >
          <DialogHeader
            data-dialog-drag-handle
            className="shrink-0 border-b px-4 py-3 pr-12 text-left sm:cursor-grab sm:px-5 sm:py-4 sm:active:cursor-grabbing"
          >
            <div className="flex items-start gap-2">
              <GripVertical className="mt-0.5 hidden h-4 w-4 shrink-0 text-gray-400 sm:block" aria-hidden />
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base">{title || (isEn ? 'Manual' : '메뉴얼')}</DialogTitle>
                <p className="text-sm font-normal text-gray-500">
                  {isEn ? 'Operations Hub · System guide' : '운영 허브 · 시스템 사용법'}
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-hidden p-3 sm:p-4">
            {loading ? (
              <div className="flex h-full min-h-[12rem] items-center justify-center rounded-xl border border-gray-200 bg-gray-50">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-600" aria-hidden />
                <span className="sr-only">{isEn ? 'Loading manual…' : '메뉴얼 불러오는 중…'}</span>
              </div>
            ) : doc ? (
              <div className="h-full min-h-0 overflow-auto rounded-xl border border-gray-200 bg-white p-2 sm:p-3">
                <SopDocumentWithToc doc={doc} viewLang={viewLang} uiLocaleEn={isEn} resizableToc={false} />
              </div>
            ) : (
              <div className="flex h-full min-h-[12rem] items-center justify-center rounded-xl border border-dashed border-amber-200 bg-amber-50 px-4 text-center text-sm text-amber-800">
                {isEn
                  ? 'No manual found in Operations Hub for this page.'
                  : '운영 허브에 이 페이지용 메뉴얼이 없습니다.'}
              </div>
            )}
          </div>

          <DialogFooter className="shrink-0 border-t px-4 py-3 sm:px-5" data-no-drag>
            <Button
              type="button"
              variant="secondary"
              className="w-full touch-manipulation sm:w-auto"
              onClick={() => setOpen(false)}
            >
              {isEn ? 'Close' : '닫기'}
            </Button>
          </DialogFooter>
        </ResizableDialogContent>
      </Dialog>
    </>
  )
}
