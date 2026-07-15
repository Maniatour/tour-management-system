'use client'

import { useState } from 'react'
import { GripVertical } from 'lucide-react'
import TravelGuideEditorForm, {
  type TravelGuideEditorSavedArticle,
} from '@/components/travel-guide/TravelGuideEditorForm'
import {
  Dialog,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ResizableDialogContent } from '@/components/ui/ResizableDialogContent'

const TRAVEL_GUIDE_EDITOR_MODAL_STORAGE_KEY = 'travel-guide-editor-modal-rect'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  articleId?: string | undefined
  t: (key: string, values?: Record<string, string | number>) => string
  onSaved?: (article: TravelGuideEditorSavedArticle) => void
  onDeleted?: () => void
}

export default function TravelGuideEditorModal({
  open,
  onOpenChange,
  articleId,
  t,
  onSaved,
  onDeleted,
}: Props) {
  const [localeToolbarEl, setLocaleToolbarEl] = useState<HTMLDivElement | null>(null)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ResizableDialogContent
        storageKey={TRAVEL_GUIDE_EDITOR_MODAL_STORAGE_KEY}
        defaultWidth={920}
        defaultHeight={760}
        stackLevel="nested"
        respectHeaderInset={false}
        className="flex flex-col gap-0 bg-white shadow-2xl"
      >
        <DialogHeader
          data-dialog-drag-handle
          className="shrink-0 border-b px-4 py-3 pr-16 text-left sm:cursor-grab sm:px-5 sm:py-4 sm:pr-[4.5rem] sm:active:cursor-grabbing"
        >
          <div className="flex items-center gap-2 sm:gap-3">
            <GripVertical
              className="hidden h-4 w-4 shrink-0 text-muted-foreground sm:block"
              aria-hidden
            />
            <DialogTitle className="min-w-0 flex-1 truncate text-base sm:text-lg">
              {articleId ? t('travelGuideEditArticle') : t('travelGuideWriteArticle')}
            </DialogTitle>
            <div
              ref={setLocaleToolbarEl}
              className="shrink-0"
              data-no-drag
            />
          </div>
          <p className="mt-1 text-sm font-normal text-muted-foreground sm:pl-7">
            {t('travelGuideEditorSubtitle')}
          </p>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
          <TravelGuideEditorForm
            key={articleId ?? 'new'}
            t={t}
            editId={articleId ?? ''}
            variant="modal"
            localeToolbarTarget={localeToolbarEl}
            onCancel={() => onOpenChange(false)}
            onSaved={(article) => {
              onSaved?.(article)
              onOpenChange(false)
            }}
            onDeleted={() => {
              onDeleted?.()
              onOpenChange(false)
            }}
          />
        </div>
      </ResizableDialogContent>
    </Dialog>
  )
}
