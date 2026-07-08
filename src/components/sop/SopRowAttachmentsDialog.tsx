'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { SopEditLocale, SopRowAttachment, SopRowAttachmentKind } from '@/types/sopStructure'
import { newSopId, sopText } from '@/types/sopStructure'
import { Trash2 } from 'lucide-react'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  rowLabel: string
  attachments: SopRowAttachment[]
  editLang: SopEditLocale
  uiLocaleEn: boolean
  onSave: (attachments: SopRowAttachment[]) => void
}

const KIND_OPTIONS: { value: SopRowAttachmentKind; ko: string; en: string }[] = [
  { value: 'template', ko: '템플릿', en: 'Template' },
  { value: 'report', ko: '리포트', en: 'Report' },
  { value: 'reference', ko: '참고', en: 'Reference' },
  { value: 'other', ko: '기타', en: 'Other' },
]

export default function SopRowAttachmentsDialog({
  open,
  onOpenChange,
  rowLabel,
  attachments,
  editLang,
  uiLocaleEn,
  onSave,
}: Props) {
  const isEn = uiLocaleEn
  const [draft, setDraft] = useState<SopRowAttachment[]>(attachments)

  useEffect(() => {
    if (open) setDraft(attachments)
  }, [open, attachments])

  const addRow = () => {
    setDraft((prev) => [
      ...prev,
      {
        id: newSopId(),
        label_ko: editLang === 'ko' ? '' : '',
        label_en: editLang === 'en' ? '' : '',
        url: '',
        kind: 'template',
        sort_order: prev.length,
      },
    ])
  }

  const updateRow = (id: string, patch: Partial<SopRowAttachment>) => {
    setDraft((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)))
  }

  const removeRow = (id: string) => {
    setDraft((prev) =>
      prev.filter((a) => a.id !== id).map((a, i) => ({ ...a, sort_order: i }))
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="border-b px-5 py-4 pr-12 text-left">
          <DialogTitle className="text-base">
            {isEn ? 'Row attachments' : '줄 첨부파일'}
          </DialogTitle>
          <p className="text-sm text-gray-500">{rowLabel}</p>
        </DialogHeader>
        <div className="max-h-[55vh] space-y-3 overflow-y-auto px-5 py-4">
          {draft.length === 0 ? (
            <p className="text-sm text-gray-500">
              {isEn
                ? 'Add template, report, or reference file links.'
                : '템플릿·리포트·참고 파일 링크를 추가하세요.'}
            </p>
          ) : null}
          {draft.map((att) => (
            <div key={att.id} className="space-y-2 rounded-xl border border-gray-200 bg-gray-50/80 p-3">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs font-semibold text-gray-700">
                  {isEn ? 'Label' : '이름'}
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-red-600"
                  onClick={() => removeRow(att.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Input
                value={editLang === 'ko' ? att.label_ko : att.label_en}
                onChange={(e) =>
                  updateRow(
                    att.id,
                    editLang === 'ko' ? { label_ko: e.target.value } : { label_en: e.target.value }
                  )
                }
                placeholder={isEn ? 'e.g. Email report template' : '예: 이메일 리포트 템플릿'}
              />
              <div>
                <Label className="text-xs text-gray-600">{isEn ? 'URL' : '링크 URL'}</Label>
                <Input
                  value={att.url}
                  onChange={(e) => updateRow(att.id, { url: e.target.value })}
                  placeholder="https://..."
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-600">{isEn ? 'Type' : '유형'}</Label>
                <select
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                  value={att.kind}
                  onChange={(e) =>
                    updateRow(att.id, { kind: e.target.value as SopRowAttachmentKind })
                  }
                >
                  {KIND_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {isEn ? opt.en : opt.ko}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" className="gap-1" onClick={addRow}>
            {isEn ? 'Add attachment' : '첨부 추가'}
          </Button>
        </div>
        <DialogFooter className="border-t px-5 py-3">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            {isEn ? 'Cancel' : '취소'}
          </Button>
          <Button
            type="button"
            onClick={() => {
              const cleaned = draft
                .filter((a) => a.url.trim())
                .map((a, i) => ({
                  ...a,
                  sort_order: i,
                  label_ko: a.label_ko || sopText(a.label_ko, a.label_en, 'ko'),
                  label_en: a.label_en || sopText(a.label_ko, a.label_en, 'en'),
                }))
              onSave(cleaned)
              onOpenChange(false)
            }}
          >
            {isEn ? 'Apply' : '적용'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
