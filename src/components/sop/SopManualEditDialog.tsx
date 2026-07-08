'use client'

import { useEffect, useState } from 'react'
import LightRichEditor from '@/components/LightRichEditor'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { SopManualStatus } from '@/types/sopStructure'
import { FileText } from 'lucide-react'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  value: string
  status: SopManualStatus
  uiLocaleEn: boolean
  langLabel: string
  readOnly?: boolean
  onSave: (value: string, status: SopManualStatus) => void
}

function StatusOption({
  active,
  label,
  iconClass,
  onClick,
}: {
  active: boolean
  label: string
  iconClass: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors touch-manipulation sm:min-h-0',
        active
          ? 'border-gray-900 bg-gray-900 text-white shadow-sm'
          : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
      )}
    >
      <FileText className={cn('h-4 w-4', active ? 'text-white' : iconClass)} />
      {label}
    </button>
  )
}

export default function SopManualEditDialog({
  open,
  onOpenChange,
  title,
  description,
  value,
  status,
  uiLocaleEn,
  langLabel,
  readOnly = false,
  onSave,
}: Props) {
  const [draft, setDraft] = useState(value)
  const [draftStatus, setDraftStatus] = useState<SopManualStatus>(status)

  useEffect(() => {
    if (open) {
      setDraft(value)
      setDraftStatus(status)
    }
  }, [open, value, status])

  const isEn = uiLocaleEn

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-full max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 p-0 sm:h-auto sm:max-h-[90vh] sm:max-w-[48rem] sm:rounded-lg sm:border">
        <DialogHeader className="border-b px-4 py-3 pr-12 text-left sm:px-5 sm:py-4">
          <DialogTitle className="text-base">{title}</DialogTitle>
          {description ? <p className="text-sm font-normal text-gray-500">{description}</p> : null}
          <p className="text-xs font-medium text-indigo-700">{langLabel}</p>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3 sm:px-5 sm:py-4">
          {!readOnly ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                {isEn ? 'Status' : '작성 상태'}
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <StatusOption
                  active={draftStatus === 'draft'}
                  label={isEn ? 'In progress' : '수정중'}
                  iconClass="text-red-600"
                  onClick={() => setDraftStatus('draft')}
                />
                <StatusOption
                  active={draftStatus === 'complete'}
                  label={isEn ? 'Complete' : '작성완료'}
                  iconClass="text-green-600"
                  onClick={() => setDraftStatus('complete')}
                />
              </div>
            </div>
          ) : null}

          <LightRichEditor
            className="w-full min-w-0"
            value={draft}
            onChange={(v) => setDraft(v ?? '')}
            placeholder={isEn ? 'Enter manual content…' : '메뉴얼 내용을 입력하세요…'}
            height={280}
            enableImageUpload={false}
            enableResize
            minHeight={160}
            maxHeight={520}
            readOnly={readOnly}
          />
        </div>

        <DialogFooter className="shrink-0 flex-col-reverse gap-2 border-t px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
          <Button type="button" variant="secondary" className="w-full touch-manipulation sm:w-auto" onClick={() => onOpenChange(false)}>
            {isEn ? (readOnly ? 'Close' : 'Cancel') : readOnly ? '닫기' : '취소'}
          </Button>
          {!readOnly ? (
            <Button
              type="button"
              className="w-full touch-manipulation sm:w-auto"
              onClick={() => {
                const trimmed = draft.trim()
                onSave(draft, trimmed ? draftStatus : 'draft')
                onOpenChange(false)
              }}
            >
              {isEn ? 'Apply' : '적용'}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
