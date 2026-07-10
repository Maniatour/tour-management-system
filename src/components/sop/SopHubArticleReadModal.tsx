'use client'

import { useEffect, useState } from 'react'
import SopDocumentWithToc from '@/components/sop/SopDocumentWithToc'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ResizableDialogContent } from '@/components/ui/ResizableDialogContent'
import {
  fetchHubArticleDocumentById,
  hubArticleLinkLabel,
  hubArticleLinkMeta,
  type HubArticleLinkOption,
} from '@/lib/hubArticleManualLink'
import type { SopDocument, SopEditLocale } from '@/types/sopStructure'
import { GripVertical, Loader2 } from 'lucide-react'

const HUB_ARTICLE_READ_MODAL_RECT_KEY = 'sop-hub-article-read-modal-rect-v1'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  articleId: string | null
  hubArticles?: HubArticleLinkOption[]
  viewLang: SopEditLocale
  uiLocaleEn: boolean
}

export default function SopHubArticleReadModal({
  open,
  onOpenChange,
  articleId,
  hubArticles = [],
  viewLang,
  uiLocaleEn,
}: Props) {
  const isEn = uiLocaleEn
  const [loading, setLoading] = useState(false)
  const [doc, setDoc] = useState<SopDocument | null>(null)
  const [title, setTitle] = useState('')

  const known = articleId ? hubArticles.find((a) => a.id === articleId) : undefined

  useEffect(() => {
    const id = articleId?.trim()
    if (!open || !id) {
      setDoc(null)
      setTitle('')
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    void fetchHubArticleDocumentById(id).then((result) => {
      if (cancelled) return
      if (!result) {
        setDoc(null)
        setTitle(
          known
            ? hubArticleLinkLabel(known, viewLang)
            : isEn
              ? 'Document unavailable'
              : '문서를 불러올 수 없습니다'
        )
        setLoading(false)
        return
      }
      setDoc(result.doc)
      setTitle(hubArticleLinkLabel(result.row, viewLang))
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [articleId, open, viewLang, known, isEn])

  const meta = known ? hubArticleLinkMeta(known, viewLang) : ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ResizableDialogContent
        storageKey={HUB_ARTICLE_READ_MODAL_RECT_KEY}
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
              <DialogTitle className="text-base">{title || (isEn ? 'Hub document' : '허브 문서')}</DialogTitle>
              {meta ? <p className="text-sm font-normal text-gray-500">{meta}</p> : null}
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-hidden p-3 sm:p-4">
          {loading ? (
            <div className="flex h-full min-h-[12rem] items-center justify-center rounded-xl border border-gray-200 bg-gray-50">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-600" aria-hidden />
              <span className="sr-only">{isEn ? 'Loading document…' : '문서 불러오는 중…'}</span>
            </div>
          ) : doc ? (
            <div className="h-full min-h-0 overflow-auto rounded-xl border border-gray-200 bg-white p-2 sm:p-3">
              <SopDocumentWithToc doc={doc} viewLang={viewLang} uiLocaleEn={uiLocaleEn} resizableToc={false} />
            </div>
          ) : (
            <div className="flex h-full min-h-[12rem] items-center justify-center rounded-xl border border-dashed border-amber-200 bg-amber-50 px-4 text-center text-sm text-amber-800">
              {isEn
                ? 'Could not load the document. It may have been removed.'
                : '문서를 불러올 수 없습니다. 삭제되었을 수 있습니다.'}
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t px-4 py-3 sm:px-5" data-no-drag>
          <Button type="button" variant="secondary" className="w-full touch-manipulation sm:w-auto" onClick={() => onOpenChange(false)}>
            {isEn ? 'Close' : '닫기'}
          </Button>
        </DialogFooter>
      </ResizableDialogContent>
    </Dialog>
  )
}
