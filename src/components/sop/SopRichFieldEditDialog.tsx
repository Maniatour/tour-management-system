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

export type SopRichFieldVariant = 'title' | 'body'

const VARIANT_PROPS = {
  title: {
    height: 100,
    enableImageUpload: false,
    enableTable: false,
    enableResize: false,
    enableColorPicker: false,
    enableFontSize: false,
    minHeight: 80,
    maxHeight: 200,
  },
  body: {
    height: 280,
    enableImageUpload: false,
    enableResize: true,
    minHeight: 160,
    maxHeight: 520,
  },
} as const

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  value: string
  variant: SopRichFieldVariant
  uiLocaleEn: boolean
  langLabel: string
  onSave: (value: string) => void
  /** 줄 제목 편집 시 텍스트 형식으로 바로 적용 */
  onSaveAsText?: (value: string) => void
  /** 줄 제목 편집 시 여러 줄을 각각 목록 ROW로 나누어 적용 */
  onSaveAsSplitListRows?: (value: string) => void
}

export default function SopRichFieldEditDialog({
  open,
  onOpenChange,
  title,
  description,
  value,
  variant,
  uiLocaleEn,
  langLabel,
  onSave,
  onSaveAsText,
  onSaveAsSplitListRows,
}: Props) {
  const [draft, setDraft] = useState(value)

  useEffect(() => {
    if (open) setDraft(value)
  }, [open, value])

  const editorProps = onSaveAsText ? VARIANT_PROPS.body : VARIANT_PROPS[variant]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent stackLevel="nested" className="flex h-[100dvh] max-h-[100dvh] w-full max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 p-0 sm:h-auto sm:max-h-[90vh] sm:max-w-[48rem] sm:rounded-lg sm:border">
        <DialogHeader className="border-b px-4 py-3 pr-12 text-left sm:px-5 sm:py-4">
          <DialogTitle className="text-base">{title}</DialogTitle>
          {description ? <p className="text-sm font-normal text-gray-500">{description}</p> : null}
          <p className="text-xs font-medium text-indigo-700">{langLabel}</p>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5 sm:py-4">
          <LightRichEditor
            className="w-full min-w-0"
            value={draft}
            onChange={(v) => setDraft(v ?? '')}
            placeholder={
              onSaveAsText
                ? uiLocaleEn
                  ? 'Enter one title per line, or paste multiple lines…'
                  : '한 줄에 하나씩 입력하거나 여러 줄을 붙여넣으세요…'
                : variant === 'title'
                  ? uiLocaleEn
                    ? 'Enter title…'
                    : '제목을 입력하세요…'
                  : uiLocaleEn
                    ? 'Enter content…'
                    : '내용을 입력하세요…'
            }
            uiLocale={uiLocaleEn ? 'en' : 'ko'}
            {...editorProps}
          />
        </div>
        <DialogFooter className="shrink-0 flex-col-reverse gap-2 border-t px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
          <Button type="button" variant="secondary" className="w-full touch-manipulation sm:w-auto" onClick={() => onOpenChange(false)}>
            {uiLocaleEn ? 'Cancel' : '취소'}
          </Button>
          {onSaveAsText ? (
            <>
              {onSaveAsSplitListRows ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full touch-manipulation sm:w-auto"
                  onClick={() => {
                    onSaveAsSplitListRows(draft)
                    onOpenChange(false)
                  }}
                >
                  {uiLocaleEn ? 'Apply as separate rows' : '줄별 목록으로 적용'}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className="w-full touch-manipulation sm:w-auto"
                onClick={() => {
                  onSaveAsText(draft)
                  onOpenChange(false)
                }}
              >
                {uiLocaleEn ? 'Apply as text' : '텍스트로 적용'}
              </Button>
              <Button
                type="button"
                className="w-full touch-manipulation sm:w-auto"
                onClick={() => {
                  onSave(draft)
                  onOpenChange(false)
                }}
              >
                {uiLocaleEn ? 'Apply' : '적용'}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              className="w-full touch-manipulation sm:w-auto"
              onClick={() => {
                onSave(draft)
                onOpenChange(false)
              }}
            >
              {uiLocaleEn ? 'Apply' : '적용'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
