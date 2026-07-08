'use client'

import { useEffect, useState } from 'react'
import LightRichEditor from '@/components/LightRichEditor'
import { hasChecklistManualContent } from '@/lib/sopQuickEdit'
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
import { FileText, Pencil } from 'lucide-react'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  editTitle?: string
  description?: string
  value: string
  status: SopManualStatus
  uiLocaleEn: boolean
  langLabel: string
  /** true면 수정 불가 (보기만) */
  readOnly?: boolean
  /** true면 처음에 보기 모드로 열고, 수정 버튼으로 편집 전환 */
  startInViewMode?: boolean
  onSave: (value: string, status: SopManualStatus) => void
}

function StatusOption({
  active,
  label,
  iconClass,
  onClick,
  disabled,
}: {
  active: boolean
  label: string
  iconClass: string
  onClick?: () => void
  disabled?: boolean
}) {
  const Tag = onClick && !disabled ? 'button' : 'div'
  return (
    <Tag
      type={Tag === 'button' ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors sm:min-h-0',
        onClick && !disabled && 'touch-manipulation',
        active
          ? 'border-gray-900 bg-gray-900 text-white shadow-sm'
          : 'border-gray-200 bg-white text-gray-700',
        !disabled && onClick && !active && 'hover:bg-gray-50',
        disabled && 'opacity-90'
      )}
    >
      <FileText className={cn('h-4 w-4', active ? 'text-white' : iconClass)} />
      {label}
    </Tag>
  )
}

export default function SopManualEditDialog({
  open,
  onOpenChange,
  title,
  editTitle,
  description,
  value,
  status,
  uiLocaleEn,
  langLabel,
  readOnly = false,
  startInViewMode = false,
  onSave,
}: Props) {
  const [draft, setDraft] = useState(value)
  const [draftStatus, setDraftStatus] = useState<SopManualStatus>(status)
  const [isEditing, setIsEditing] = useState(false)

  const isEn = uiLocaleEn
  const canEdit = !readOnly
  const isViewMode = !isEditing || readOnly
  const dialogTitle = isViewMode
    ? title
    : editTitle ?? (isEn ? 'Edit manual' : '메뉴얼 수정')
  const hasContent = hasChecklistManualContent(value)
  const hasDraftContent = hasChecklistManualContent(draft)

  useEffect(() => {
    if (!open) return
    setIsEditing(!startInViewMode && canEdit)
  }, [open, startInViewMode, canEdit])

  useEffect(() => {
    if (!open || isEditing) return
    setDraft(value)
    setDraftStatus(status)
  }, [open, value, status, isEditing])

  const handleClose = () => onOpenChange(false)

  const handleCancelEdit = () => {
    setDraft(value)
    setDraftStatus(status)
    if (startInViewMode) {
      setIsEditing(false)
    } else {
      handleClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-full max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 p-0 sm:h-auto sm:max-h-[90vh] sm:max-w-[48rem] sm:rounded-lg sm:border">
        <DialogHeader className="border-b px-4 py-3 pr-12 text-left sm:px-5 sm:py-4">
          <DialogTitle className="text-base">{dialogTitle}</DialogTitle>
          {description ? <p className="text-sm font-normal text-gray-500">{description}</p> : null}
          <p className="text-xs font-medium text-indigo-700">{langLabel}</p>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3 sm:px-5 sm:py-4">
          {hasContent || hasDraftContent || !isViewMode ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                {isEn ? 'Status' : '작성 상태'}
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <StatusOption
                  active={draftStatus === 'draft'}
                  label={isEn ? 'In progress' : '수정중'}
                  iconClass="text-red-600"
                  disabled={isViewMode}
                  {...(!isViewMode
                    ? { onClick: () => setDraftStatus('draft') }
                    : {})}
                />
                <StatusOption
                  active={draftStatus === 'complete'}
                  label={isEn ? 'Complete' : '작성완료'}
                  iconClass="text-green-600"
                  disabled={isViewMode}
                  {...(!isViewMode
                    ? { onClick: () => setDraftStatus('complete') }
                    : {})}
                />
              </div>
            </div>
          ) : null}

          {isViewMode && !hasContent && !hasDraftContent ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
              {isEn ? 'No manual content yet.' : '아직 메뉴얼 내용이 없습니다.'}
            </div>
          ) : (
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
              readOnly={isViewMode}
            />
          )}
        </div>

        <DialogFooter className="shrink-0 flex-col-reverse gap-2 border-t px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
          {isViewMode ? (
            <>
              <Button
                type="button"
                variant="secondary"
                className="w-full touch-manipulation sm:w-auto"
                onClick={handleClose}
              >
                {isEn ? 'Close' : '닫기'}
              </Button>
              {canEdit ? (
                <Button
                  type="button"
                  className="w-full touch-manipulation sm:w-auto"
                  onClick={() => setIsEditing(true)}
                >
                  <Pencil className="mr-1.5 h-4 w-4" />
                  {isEn ? 'Edit' : '수정'}
                </Button>
              ) : null}
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="secondary"
                className="w-full touch-manipulation sm:w-auto"
                onClick={handleCancelEdit}
              >
                {isEn ? 'Cancel' : '취소'}
              </Button>
              <Button
                type="button"
                className="w-full touch-manipulation sm:w-auto"
                onClick={() => {
                  const trimmed = draft.trim()
                  onSave(draft, trimmed ? draftStatus : 'draft')
                  if (startInViewMode) {
                    setIsEditing(false)
                  } else {
                    handleClose()
                  }
                }}
              >
                {isEn ? 'Apply' : '적용'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
