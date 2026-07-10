'use client'

import { useEffect, useState } from 'react'
import LightRichEditor from '@/components/LightRichEditor'
import SopManualLinkedArticlePanel from '@/components/sop/SopManualLinkedArticlePanel'
import type { HubArticleLinkOption } from '@/lib/hubArticleManualLink'
import {
  hasChecklistManualContent,
  type ManualSavePayload,
} from '@/lib/sopQuickEdit'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ResizableDialogContent } from '@/components/ui/ResizableDialogContent'
import { cn } from '@/lib/utils'
import type { SopEditLocale, SopManualStatus } from '@/types/sopStructure'
import { FileText, GripVertical, Link2, Pencil } from 'lucide-react'

const MANUAL_MODAL_DEFAULT_WIDTH = 1024
const MANUAL_MODAL_DEFAULT_HEIGHT = 800
const MANUAL_MODAL_RECT_STORAGE_KEY = 'sop-manual-modal-rect-v2'
const MANUAL_EDITOR_MIN_HEIGHT = 140
const MANUAL_EDITOR_MAX_HEIGHT = 560

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  editTitle?: string
  description?: string
  value: string
  status: SopManualStatus
  linkedHubArticleIds?: string[]
  hubArticles?: HubArticleLinkOption[]
  viewLang: SopEditLocale
  uiLocaleEn: boolean
  langLabel: string
  readOnly?: boolean
  startInViewMode?: boolean
  onSave: (payload: ManualSavePayload) => void
}

function StatusOption({
  active,
  label,
  iconClass,
  onClick,
  readOnly,
}: {
  active: boolean
  label: string
  iconClass: string
  onClick?: () => void
  readOnly?: boolean
}) {
  const interactive = Boolean(onClick) && !readOnly

  const className = cn(
    'inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors sm:min-h-0',
    interactive && 'touch-manipulation cursor-pointer relative z-10',
    active
      ? 'border-gray-900 bg-gray-900 text-white shadow-sm'
      : 'border-gray-200 bg-white text-gray-700',
    interactive && !active && 'hover:bg-gray-50 active:bg-gray-50',
    readOnly && 'opacity-95'
  )

  if (!interactive) {
    return (
      <div className={className} aria-disabled="true">
        <FileText className={cn('h-4 w-4', active ? 'text-white' : iconClass)} />
        {label}
      </div>
    )
  }

  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={className}>
      <FileText className={cn('h-4 w-4', active ? 'text-white' : iconClass)} />
      {label}
    </button>
  )
}

function SectionHeading({
  icon: Icon,
  label,
}: {
  icon: typeof FileText
  label: string
}) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <Icon className="h-4 w-4 text-indigo-600" aria-hidden />
      <h3 className="text-sm font-semibold text-gray-900">{label}</h3>
    </div>
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
  linkedHubArticleIds = [],
  hubArticles = [],
  viewLang,
  uiLocaleEn,
  langLabel,
  readOnly = false,
  startInViewMode = false,
  onSave,
}: Props) {
  const [draft, setDraft] = useState(value)
  const [draftStatus, setDraftStatus] = useState<SopManualStatus>(status)
  const [draftLinkedIds, setDraftLinkedIds] = useState<string[]>(linkedHubArticleIds)
  const [isEditing, setIsEditing] = useState(false)

  const isEn = uiLocaleEn
  const canEdit = !readOnly
  const isViewMode = !isEditing || readOnly
  const linkedIds = isViewMode ? linkedHubArticleIds : draftLinkedIds
  const isLinked = linkedIds.length > 0
  const dialogTitle = isViewMode
    ? title
    : editTitle ?? (isEn ? 'Edit manual' : '메뉴얼 수정')
  const inlineContent = isViewMode ? value : draft
  const hasInlineContent = hasChecklistManualContent(inlineContent)
  const hasContent = hasInlineContent || isLinked
  const canMarkComplete = hasInlineContent || isLinked
  const showStatus = hasContent || !isViewMode || canEdit
  const showLinkedSection = isLinked || !isViewMode || hubArticles.length > 0
  const completeHint = isEn
    ? 'Add manual notes or link a hub document before marking complete.'
    : '직접 작성 내용 또는 허브 문서 연결 후 작성완료로 변경할 수 있습니다.'

  useEffect(() => {
    if (!open) return
    setIsEditing(!startInViewMode && canEdit)
  }, [open, startInViewMode, canEdit])

  useEffect(() => {
    if (!open || isEditing) return
    setDraft(value)
    setDraftStatus(status)
    setDraftLinkedIds(linkedHubArticleIds)
  }, [open, value, status, linkedHubArticleIds, isEditing])

  const buildSavePayload = (
    nextStatus: SopManualStatus,
    inlineValue: string,
    linkedIdsValue: string[]
  ): ManualSavePayload => ({
    value: inlineValue,
    linkedHubArticleIds: [...new Set(linkedIdsValue.map((id) => id.trim()).filter(Boolean))],
    status: nextStatus,
  })

  const handleClose = () => onOpenChange(false)

  const handleCancelEdit = () => {
    setDraft(value)
    setDraftStatus(status)
    setDraftLinkedIds(linkedHubArticleIds)
    if (startInViewMode) {
      setIsEditing(false)
    } else {
      handleClose()
    }
  }

  const handleStatusSelect = (next: SopManualStatus) => {
    if (next === draftStatus) return
    setDraftStatus(next)
    if (isViewMode && canEdit) {
      onSave(buildSavePayload(next, value, linkedHubArticleIds))
    }
  }

  const handleApply = () => {
    onSave(buildSavePayload(draftStatus, draft, draftLinkedIds))
    if (startInViewMode) {
      setIsEditing(false)
    } else {
      handleClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ResizableDialogContent
        storageKey={MANUAL_MODAL_RECT_STORAGE_KEY}
        defaultWidth={MANUAL_MODAL_DEFAULT_WIDTH}
        defaultHeight={MANUAL_MODAL_DEFAULT_HEIGHT}
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
              <DialogTitle className="text-base">{dialogTitle}</DialogTitle>
              {description ? (
                <p className="text-sm font-normal text-gray-500">{description}</p>
              ) : null}
              <p className="text-xs font-medium text-indigo-700">{langLabel}</p>
            </div>
          </div>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-3 sm:px-5 sm:py-4">
          {showStatus ? (
            <div className="relative z-10 mb-4 shrink-0 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                {isEn ? 'Status' : '작성 상태'}
              </p>
              <p className="text-xs leading-relaxed text-gray-500">
                {isEn
                  ? 'In progress: still being edited. Complete: ready for others to read.'
                  : '수정중: 아직 작업 중입니다. 작성완료: 다른 사람이 볼 수 있습니다.'}
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <StatusOption
                  active={draftStatus === 'draft'}
                  label={isEn ? 'In progress' : '수정중'}
                  iconClass="text-red-600"
                  readOnly={!canEdit}
                  {...(canEdit ? { onClick: () => handleStatusSelect('draft') } : {})}
                />
                <StatusOption
                  active={draftStatus === 'complete'}
                  label={isEn ? 'Complete' : '작성완료'}
                  iconClass="text-green-600"
                  readOnly={!canEdit || !canMarkComplete}
                  {...(canEdit && canMarkComplete
                    ? { onClick: () => handleStatusSelect('complete') }
                    : {})}
                />
              </div>
              {canEdit && !canMarkComplete ? (
                <p className="text-xs text-amber-700">{completeHint}</p>
              ) : null}
            </div>
          ) : null}

          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto">
            <section className="shrink-0">
              <SectionHeading
                icon={FileText}
                label={isEn ? 'Write here' : '직접 작성'}
              />
              {isViewMode && !hasInlineContent ? (
                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
                  {isEn ? 'No notes written here yet.' : '직접 작성한 내용이 없습니다.'}
                </div>
              ) : (
                <div className="shrink-0">
                  <LightRichEditor
                    className="flex w-full min-w-0 flex-col"
                    value={draft}
                    onChange={(v) => setDraft(v ?? '')}
                    placeholder={
                      isEn
                        ? 'Add row-specific notes or instructions…'
                        : '이 줄에 대한 메모·안내를 입력하세요…'
                    }
                    height={220}
                    enableImageUpload={!isViewMode}
                    enableResize
                    resizeWhenReadOnly
                    minHeight={MANUAL_EDITOR_MIN_HEIGHT}
                    maxHeight={MANUAL_EDITOR_MAX_HEIGHT}
                    readOnly={isViewMode}
                  />
                </div>
              )}
            </section>

            {showLinkedSection ? (
              <section className="shrink-0 flex-col border-t border-gray-100 pt-5">
                <SectionHeading
                  icon={Link2}
                  label={isEn ? 'Linked hub documents' : '허브 문서 연결'}
                />
                {!isViewMode && hubArticles.length === 0 ? (
                  <p className="mb-3 text-xs text-gray-500">
                    {isEn
                      ? 'No Operations Hub documents yet. Create one in Operations Hub first.'
                      : '운영 허브에 등록된 문서가 없습니다. 먼저 운영 허브에서 문서를 만드세요.'}
                  </p>
                ) : null}
                <SopManualLinkedArticlePanel
                  articleIds={linkedIds}
                  {...(!isViewMode && canEdit ? { onArticleIdsChange: setDraftLinkedIds } : {})}
                  hubArticles={hubArticles}
                  viewLang={viewLang}
                  uiLocaleEn={uiLocaleEn}
                  readOnly={isViewMode || !canEdit}
                  embedded
                />
              </section>
            ) : null}
          </div>
        </div>

        <DialogFooter className="shrink-0 flex-col-reverse gap-2 border-t px-4 py-3 sm:flex-row sm:justify-end sm:px-5" data-no-drag>
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
                onClick={handleApply}
              >
                {isEn ? 'Apply' : '적용'}
              </Button>
            </>
          )}
        </DialogFooter>
      </ResizableDialogContent>
    </Dialog>
  )
}
