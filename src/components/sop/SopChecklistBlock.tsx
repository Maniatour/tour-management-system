'use client'

import { useEffect, useRef, useState } from 'react'
import { markdownToHtml, sopPlainDisplayText } from '@/components/LightRichEditor'
import SopManualEditDialog from '@/components/sop/SopManualEditDialog'
import { getChecklistManualStatus, getManualIconState } from '@/lib/sopQuickEdit'
import { sopChecklistAnchorId } from '@/lib/sopDocumentToc'
import type { SopChecklistItem, SopEditLocale, SopRowAttachment } from '@/types/sopStructure'
import { checklistRootRows, getChecklistRowDisplay, sopText } from '@/types/sopStructure'
import { cn } from '@/lib/utils'
import {
  ChevronDown,
  ChevronUp,
  FileText,
  List,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Plus,
  Trash2,
  Type,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

type RowCallbacks = {
  onEditChecklistItem?: (sectionId: string, categoryId: string, itemId: string) => void
  onEditChecklistManual?: (sectionId: string, categoryId: string, itemId: string) => void
  onDeleteChecklistItem?: (sectionId: string, categoryId: string, itemId: string) => void
  onMoveChecklistItem?: (
    sectionId: string,
    categoryId: string,
    itemId: string,
    direction: -1 | 1
  ) => void
  onAddChecklistItem?: (sectionId: string, categoryId: string, afterItemId?: string) => void
  onManageAttachments?: (sectionId: string, categoryId: string, itemId: string) => void
  onChangeRowDisplay?: (
    sectionId: string,
    categoryId: string,
    itemId: string,
    display: 'list' | 'text'
  ) => void
}

type Props = RowCallbacks & {
  sectionId: string
  categoryId: string
  items: SopChecklistItem[]
  viewLang: SopEditLocale
  flat?: boolean
  anchors?: boolean
}

const MANUAL_ICON_CLASS = {
  empty: 'text-gray-400 hover:text-gray-500',
  draft: 'text-red-600 hover:text-red-700',
  complete: 'text-green-600 hover:text-green-700',
} as const

/** ROW 제목 HTML — prose/인라인 margin 제거로 `-`와 텍스트 수직 정렬 */
const CHECKLIST_TITLE_HTML_CLASS =
  'min-w-0 flex-1 break-words text-[15px] font-medium leading-snug text-gray-900 sm:text-sm [&_a]:break-all [&_li]:!my-0 [&_ol]:!my-0 [&_p]:!m-0 [&_p]:!inline [&_p]:!leading-snug [&_ul]:!my-0'

const CHECKLIST_TEXT_HTML_CLASS =
  'min-w-0 flex-1 break-words text-[15px] leading-snug text-gray-800 sm:text-sm [&_a]:break-all [&_li]:!my-0 [&_ol]:!my-0 [&_p]:!m-0 [&_p]:!inline [&_p]:!leading-snug [&_ul]:!my-0'

function attachmentLabel(att: SopRowAttachment, viewLang: SopEditLocale): string {
  const label = sopText(att.label_ko, att.label_en, viewLang).trim()
  if (label) return label
  try {
    const name = new URL(att.url).pathname.split('/').pop()
    return name || att.url
  } catch {
    return att.url
  }
}

function AttachmentList({
  attachments,
  viewLang,
}: {
  attachments: SopRowAttachment[]
  viewLang: SopEditLocale
}) {
  if (!attachments.length) return null
  const sorted = [...attachments].sort((a, b) => a.sort_order - b.sort_order)
  return (
    <ul className="mt-2 space-y-1.5 pl-0 sm:pl-5">
      {sorted.map((att) => (
        <li key={att.id}>
          <a
            href={att.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full max-w-full items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50/60 px-3 py-2.5 text-sm font-medium text-indigo-800 transition-colors hover:bg-indigo-100 active:bg-indigo-100"
          >
            <FileText className="h-4 w-4 shrink-0" />
            <span className="truncate">{attachmentLabel(att, viewLang)}</span>
          </a>
        </li>
      ))}
    </ul>
  )
}

function ManualDocIcon({
  item,
  viewLang,
  isEn,
  onClick,
}: {
  item: SopChecklistItem
  viewLang: SopEditLocale
  isEn: boolean
  onClick?: () => void
}) {
  const state = getManualIconState(item, viewLang)
  const title =
    state === 'complete'
      ? isEn
        ? 'Manual complete'
        : '메뉴얼 작성완료'
      : state === 'draft'
        ? isEn
          ? 'Manual in progress'
          : '메뉴얼 수정중'
        : isEn
          ? 'No manual yet'
          : '메뉴얼 없음'

  if (!onClick) {
    return (
      <span className="inline-flex shrink-0 items-center justify-center p-0.5" title={title}>
        <FileText className={cn('h-4 w-4', MANUAL_ICON_CLASS[state])} />
      </span>
    )
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-9 w-9 shrink-0 touch-manipulation sm:h-7 sm:w-7"
      title={title}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
    >
      <FileText className={cn('h-4 w-4', MANUAL_ICON_CLASS[state])} />
    </Button>
  )
}

function ItemToolbar({
  sectionId,
  categoryId,
  item,
  siblings,
  siblingIdx,
  viewLang,
  callbacks,
}: {
  sectionId: string
  categoryId: string
  item: SopChecklistItem
  siblings: SopChecklistItem[]
  siblingIdx: number
  viewLang: SopEditLocale
  callbacks: RowCallbacks
}) {
  const isEn = viewLang === 'en'
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const {
    onMoveChecklistItem,
    onEditChecklistItem,
    onAddChecklistItem,
    onDeleteChecklistItem,
    onManageAttachments,
    onChangeRowDisplay,
  } = callbacks
  const rowDisplay = getChecklistRowDisplay(item)

  const hasActions = Boolean(
    onMoveChecklistItem ||
      onEditChecklistItem ||
      onChangeRowDisplay ||
      onManageAttachments ||
      onAddChecklistItem ||
      onDeleteChecklistItem
  )

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (!hasActions) return null

  const run = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation()
    fn()
    setOpen(false)
  }

  const iconBtn =
    'h-8 w-8 shrink-0 touch-manipulation sm:h-7 sm:w-7'

  return (
    <div ref={rootRef} className="relative shrink-0">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={cn(
          'h-8 w-8 shrink-0 touch-manipulation border-gray-200 bg-white shadow-sm sm:h-7 sm:w-7',
          open && 'border-indigo-200 bg-indigo-50 text-indigo-700'
        )}
        title={isEn ? 'Row actions' : '줄 작업'}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 flex max-w-[min(100vw-2rem,20rem)] items-center gap-0.5 rounded-lg border border-gray-200 bg-white p-1 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          {onMoveChecklistItem && siblingIdx > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(iconBtn, 'text-gray-500 hover:bg-gray-100')}
              title={isEn ? 'Move up' : '위로'}
              onClick={run(() => onMoveChecklistItem(sectionId, categoryId, item.id, -1))}
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </Button>
          ) : null}
          {onMoveChecklistItem && siblingIdx < siblings.length - 1 ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(iconBtn, 'text-gray-500 hover:bg-gray-100')}
              title={isEn ? 'Move down' : '아래로'}
              onClick={run(() => onMoveChecklistItem(sectionId, categoryId, item.id, 1))}
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          ) : null}
          {onEditChecklistItem ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(iconBtn, 'text-indigo-700 hover:bg-indigo-50')}
              title={isEn ? 'Edit title' : '제목 수정'}
              onClick={run(() => onEditChecklistItem(sectionId, categoryId, item.id))}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          ) : null}
          {onChangeRowDisplay ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                iconBtn,
                rowDisplay === 'list'
                  ? 'text-indigo-700 hover:bg-indigo-50'
                  : 'text-gray-600 hover:bg-gray-100'
              )}
              title={
                rowDisplay === 'list'
                  ? isEn
                    ? 'List style — click for text'
                    : '목록 형식 — 클릭 시 텍스트'
                  : isEn
                    ? 'Text style — click for list'
                    : '텍스트 형식 — 클릭 시 목록'
              }
              onClick={run(() =>
                onChangeRowDisplay(
                  sectionId,
                  categoryId,
                  item.id,
                  rowDisplay === 'list' ? 'text' : 'list'
                )
              )}
            >
              {rowDisplay === 'list' ? (
                <List className="h-3.5 w-3.5" />
              ) : (
                <Type className="h-3.5 w-3.5" />
              )}
            </Button>
          ) : null}
          {onManageAttachments ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(iconBtn, 'text-gray-600 hover:bg-gray-100')}
              title={isEn ? 'Attachments' : '첨부파일'}
              onClick={run(() => onManageAttachments(sectionId, categoryId, item.id))}
            >
              <Paperclip className="h-3.5 w-3.5" />
            </Button>
          ) : null}
          {onAddChecklistItem ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(iconBtn, 'text-gray-600 hover:bg-gray-100')}
              title={isEn ? 'Add row below' : '아래에 줄 추가'}
              onClick={run(() => onAddChecklistItem(sectionId, categoryId, item.id))}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          ) : null}
          {onDeleteChecklistItem ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(iconBtn, 'text-red-700 hover:bg-red-50')}
              title={isEn ? 'Delete' : '삭제'}
              onClick={run(() => onDeleteChecklistItem(sectionId, categoryId, item.id))}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function ChecklistRootRow({
  row,
  allItems,
  sectionId,
  categoryId,
  viewLang,
  anchors,
  callbacks,
  onViewManual,
}: {
  row: SopChecklistItem
  allItems: SopChecklistItem[]
  sectionId: string
  categoryId: string
  viewLang: SopEditLocale
  anchors?: boolean
  callbacks: RowCallbacks
  onViewManual?: (row: SopChecklistItem) => void
}) {
  const roots = checklistRootRows(allItems)
  const rootIdx = roots.findIndex((r) => r.id === row.id)
  const title = sopText(row.title_ko, row.title_en, viewLang).trim()
  const attachments = row.attachments ?? []
  const rowDisplay = getChecklistRowDisplay(row)
  const isListRow = rowDisplay === 'list'
  const editable = Boolean(
    callbacks.onEditChecklistItem ||
      callbacks.onEditChecklistManual ||
      callbacks.onManageAttachments
  )
  const isEn = viewLang === 'en'
  const openManual = callbacks.onEditChecklistManual
    ? () => callbacks.onEditChecklistManual!(sectionId, categoryId, row.id)
    : onViewManual
      ? () => onViewManual(row)
      : undefined

  return (
    <div
      id={anchors ? sopChecklistAnchorId(row.id) : undefined}
      className={cn(
        'group scroll-mt-20',
        isListRow ? 'border-b border-gray-100 py-3 last:border-b-0 sm:py-3' : 'py-2 sm:py-1.5'
      )}
    >
      <div className="flex w-full min-w-0 items-center gap-1.5">
        <div
          className={cn(
            'flex min-w-0 flex-1 items-center gap-2 sm:gap-1.5',
            callbacks.onEditChecklistItem &&
              'cursor-pointer rounded-md hover:bg-gray-50/80 active:bg-gray-50'
          )}
          onClick={() => callbacks.onEditChecklistItem?.(sectionId, categoryId, row.id)}
        >
          {isListRow ? (
            <>
              <span
                aria-hidden
                className="inline-flex h-[1.35rem] w-3 shrink-0 items-center justify-center text-[15px] leading-none text-indigo-600 sm:h-[1.25rem] sm:text-sm"
              >
                -
              </span>
              <div
                className={cn(
                  CHECKLIST_TITLE_HTML_CLASS,
                  !title && editable && 'italic text-gray-400'
                )}
                dangerouslySetInnerHTML={{
                  __html: markdownToHtml(title || (isEn ? '(Row)' : '(줄)')),
                }}
              />
            </>
          ) : (
            <div
              className={cn(
                CHECKLIST_TEXT_HTML_CLASS,
                !title && editable && 'italic text-gray-400'
              )}
              dangerouslySetInnerHTML={{
                __html: markdownToHtml(title || (isEn ? '(Row)' : '(줄)')),
              }}
            />
          )}

          <ManualDocIcon
            item={row}
            viewLang={viewLang}
            isEn={isEn}
            {...(openManual ? { onClick: openManual } : {})}
          />
        </div>

        {editable ? (
          <ItemToolbar
            sectionId={sectionId}
            categoryId={categoryId}
            item={row}
            siblings={roots}
            siblingIdx={rootIdx}
            viewLang={viewLang}
            callbacks={callbacks}
          />
        ) : null}
      </div>

      <AttachmentList attachments={attachments} viewLang={viewLang} />
    </div>
  )
}

export default function SopChecklistBlock({
  sectionId,
  categoryId,
  items,
  viewLang,
  anchors,
  ...callbacks
}: Props) {
  const roots = checklistRootRows(items)
  const isEn = viewLang === 'en'
  const [viewRow, setViewRow] = useState<SopChecklistItem | null>(null)

  if (roots.length === 0) return null

  const handleViewManual = callbacks.onEditChecklistManual
    ? undefined
    : (row: SopChecklistItem) => setViewRow(row)

  const viewManualValue = viewRow
    ? sopText(viewRow.manual_ko ?? '', viewRow.manual_en ?? '', viewLang)
    : ''

  return (
    <>
      <div className="mb-2 w-full min-w-0">
        {roots.map((row) => (
          <ChecklistRootRow
            key={row.id}
            row={row}
            allItems={items}
            sectionId={sectionId}
            categoryId={categoryId}
            viewLang={viewLang}
            {...(anchors ? { anchors } : {})}
            callbacks={callbacks}
            {...(handleViewManual ? { onViewManual: handleViewManual } : {})}
          />
        ))}
      </div>

      {viewRow ? (
        <SopManualEditDialog
          open
          onOpenChange={(open) => !open && setViewRow(null)}
          title={isEn ? 'View manual' : '메뉴얼 보기'}
          {...(() => {
            const desc = sopPlainDisplayText(sopText(viewRow.title_ko, viewRow.title_en, viewLang))
            return desc ? { description: desc } : {}
          })()}
          value={viewManualValue}
          status={getChecklistManualStatus(viewRow)}
          uiLocaleEn={isEn}
          langLabel={viewLang === 'en' ? 'English' : '한국어'}
          readOnly
          onSave={() => {}}
        />
      ) : null}
    </>
  )
}
