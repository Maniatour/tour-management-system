'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import SopDocumentWithToc from '@/components/sop/SopDocumentWithToc'
import SopManualEditDialog from '@/components/sop/SopManualEditDialog'
import SopRichFieldEditDialog, { type SopRichFieldVariant } from '@/components/sop/SopRichFieldEditDialog'
import SopRowAttachmentsDialog from '@/components/sop/SopRowAttachmentsDialog'
import {
  addSopCategory,
  addSopChecklistItem,
  addSopSection,
  moveSopCategory,
  moveSopChecklistItem,
  moveSopSection,
  removeSopCategory,
  removeSopChecklistItem,
  removeSopSection,
  setChecklistItemAttachments,
} from '@/lib/sopDocumentMutations'
import {
  applyCategoryBodyDraft,
  applyCategoryTitleValue,
  applyChecklistItemValue,
  applyChecklistManualValue,
  applyChecklistRowDisplay,
  applySectionTitleValue,
  checklistItemIdsMatch,
  detectCategoryEditField,
  getCategoryBodyDraft,
  getCategoryTitleValue,
  getChecklistItemValue,
  getChecklistManualStatus,
  getChecklistManualValue,
  getSectionTitleValue,
  hydrateDocumentForRowEditing,
  updateDocCategory,
} from '@/lib/sopQuickEdit'
import { cn } from '@/lib/utils'
import {
  prefillSortOrders,
  sopText,
  type SopDocument,
  type SopEditLocale,
  type SopManualStatus,
  type SopRowAttachment,
} from '@/types/sopStructure'

type QuickEdit =
  | { scope: 'section'; sectionId: string; field: 'title' }
  | { scope: 'category'; sectionId: string; categoryId: string; field: 'title' | 'body' }
  | { scope: 'checklist'; sectionId: string; categoryId: string; itemId: string; field: 'title' | 'manual' }

type AttachmentTarget = {
  sectionId: string
  categoryId: string
  itemId: string
}

type DeleteTarget =
  | { scope: 'section'; sectionId: string }
  | { scope: 'category'; sectionId: string; categoryId: string }
  | { scope: 'checklist'; sectionId: string; categoryId: string; itemId: string }

type Props = {
  doc: SopDocument
  onChange: (doc: SopDocument) => void
  viewLang: SopEditLocale
  uiLocaleEn: boolean
  editable?: boolean
  resizableToc?: boolean
  tocWidthStorageKey?: string
}

export default function SopDocumentInlinePreviewEditor({
  doc,
  onChange,
  viewLang,
  uiLocaleEn,
  editable = true,
  resizableToc = false,
  tocWidthStorageKey,
}: Props) {
  const isEn = uiLocaleEn
  const editLang = viewLang

  const [quickEdit, setQuickEdit] = useState<QuickEdit | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [attachmentTarget, setAttachmentTarget] = useState<AttachmentTarget | null>(null)

  useEffect(() => {
    if (!editable) return
    const hydrated = hydrateDocumentForRowEditing(doc)
    if (hydrated !== doc) onChange(hydrated)
  }, [doc, editable, onChange])

  const quickEditValue = useMemo(() => {
    if (!quickEdit) return ''
    if (quickEdit.scope === 'section') {
      const section = doc.sections.find((s) => s.id === quickEdit.sectionId)
      return section ? getSectionTitleValue(section, editLang) : ''
    }
    const section = doc.sections.find((s) => s.id === quickEdit.sectionId)
    const category = section?.categories.find((c) => c.id === quickEdit.categoryId)
    if (!category) return ''
    if (quickEdit.scope === 'checklist') {
      const item = category.checklist_items?.find((i) =>
        checklistItemIdsMatch(i.id, quickEdit.itemId)
      )
      if (!item) return ''
      return quickEdit.field === 'manual'
        ? getChecklistManualValue(item, editLang)
        : getChecklistItemValue(item, editLang)
    }
    return quickEdit.field === 'title'
      ? getCategoryTitleValue(category, editLang)
      : getCategoryBodyDraft(category, editLang)
  }, [doc.sections, editLang, quickEdit])

  const quickEditMeta = useMemo(() => {
    if (!quickEdit) return null
    const langLabel = editLang === 'en' ? 'English' : '한국어'
    const variant: SopRichFieldVariant = quickEdit.field === 'title' ? 'title' : 'body'

    if (quickEdit.scope === 'section') {
      const section = doc.sections.find((s) => s.id === quickEdit.sectionId)
      const label = section ? sopText(section.title_ko, section.title_en, editLang).trim() : ''
      return {
        variant,
        langLabel,
        title: isEn ? 'Edit section title' : '섹션 제목 수정',
        description: label
          ? isEn
            ? `Section: ${label}`
            : `섹션: ${label}`
          : undefined,
      }
    }

    const section = doc.sections.find((s) => s.id === quickEdit.sectionId)
    const category = section?.categories.find((c) => c.id === quickEdit.categoryId)
    const label = category ? sopText(category.title_ko, category.title_en, editLang).trim() : ''

    if (quickEdit.scope === 'checklist') {
      const item = category?.checklist_items?.find((i) =>
        checklistItemIdsMatch(i.id, quickEdit.itemId)
      )
      const rowLabel = item ? sopText(item.title_ko, item.title_en, editLang).trim() : ''
      const isManual = quickEdit.field === 'manual'
      const isStep = Boolean(item?.parent_id)
      return {
        variant: 'body' as const,
        langLabel,
        title: isManual
          ? isEn
            ? 'Edit manual'
            : '메뉴얼 수정'
          : isStep
            ? isEn
              ? 'Edit step title'
              : '메뉴얼 항목 제목'
            : isEn
              ? 'Edit row title'
              : '줄 제목 수정',
        description: rowLabel
          ? isEn
            ? `${isStep ? 'Step' : 'Row'}: ${rowLabel}`
            : `${isStep ? '항목' : '줄'}: ${rowLabel}`
          : label
            ? isEn
              ? `Block: ${label}`
              : `영역: ${label}`
            : undefined,
      }
    }

    if (quickEdit.field === 'title') {
      return {
        variant,
        langLabel,
        title: isEn ? 'Edit block title' : '영역 제목 수정',
        description: label
          ? isEn
            ? `Block: ${label}`
            : `영역: ${label}`
          : undefined,
      }
    }

    return {
      variant,
      langLabel,
      title: isEn ? 'Edit block content' : '영역 내용 수정',
      description: label
        ? isEn
          ? `Block: ${label}`
          : `영역: ${label}`
        : undefined,
    }
  }, [doc.sections, editLang, isEn, quickEdit])

  const isManualEdit =
    quickEdit?.scope === 'checklist' && quickEdit.field === 'manual'

  const manualEditContext = useMemo(() => {
    if (!isManualEdit || !quickEdit || quickEdit.scope !== 'checklist') return null
    const section = doc.sections.find((s) => s.id === quickEdit.sectionId)
    const category = section?.categories.find((c) => c.id === quickEdit.categoryId)
    const item = category?.checklist_items?.find((i) =>
      checklistItemIdsMatch(i.id, quickEdit.itemId)
    )
    if (!item) return null
    const rowLabel = sopText(item.title_ko, item.title_en, editLang).trim()
    const blockLabel = category
      ? sopText(category.title_ko, category.title_en, editLang).trim()
      : ''
    return {
      value: getChecklistManualValue(item, editLang),
      status: getChecklistManualStatus(item),
      title: isEn ? 'Edit manual' : '메뉴얼 수정',
      description: rowLabel
        ? isEn
          ? `Row: ${rowLabel}`
          : `줄: ${rowLabel}`
        : blockLabel
          ? isEn
            ? `Block: ${blockLabel}`
            : `영역: ${blockLabel}`
          : undefined,
      langLabel: editLang === 'en' ? 'English' : '한국어',
    }
  }, [doc.sections, editLang, isEn, isManualEdit, quickEdit])

  const deleteLabel = useMemo(() => {
    if (!deleteTarget) return ''
    if (deleteTarget.scope === 'section') {
      const section = doc.sections.find((s) => s.id === deleteTarget.sectionId)
      const label = section ? sopText(section.title_ko, section.title_en, editLang).trim() : ''
      return label || (isEn ? 'this section' : '이 섹션')
    }
    if (deleteTarget.scope === 'checklist') {
      const section = doc.sections.find((s) => s.id === deleteTarget.sectionId)
      const category = section?.categories.find((c) => c.id === deleteTarget.categoryId)
      const item = category?.checklist_items?.find((i) => i.id === deleteTarget.itemId)
      const label = item ? sopText(item.title_ko, item.title_en, editLang).trim() : ''
      return label || (isEn ? 'this row' : '이 줄')
    }
    const section = doc.sections.find((s) => s.id === deleteTarget.sectionId)
    const category = section?.categories.find((c) => c.id === deleteTarget.categoryId)
    const label = category ? sopText(category.title_ko, category.title_en, editLang).trim() : ''
    return label || (isEn ? 'this block' : '이 영역')
  }, [deleteTarget, doc.sections, editLang, isEn])

  const openSectionEdit = (sectionId: string) => {
    setQuickEdit({ scope: 'section', sectionId, field: 'title' })
  }

  const openCategoryEdit = (sectionId: string, categoryId: string) => {
    const section = doc.sections.find((s) => s.id === sectionId)
    const category = section?.categories.find((c) => c.id === categoryId)
    const field = category ? detectCategoryEditField(category, editLang) : 'title'
    setQuickEdit({ scope: 'category', sectionId, categoryId, field })
  }

  const openChecklistEdit = (sectionId: string, categoryId: string, itemId: string) => {
    setQuickEdit({ scope: 'checklist', sectionId, categoryId, itemId, field: 'title' })
  }

  const openChecklistManualEdit = (sectionId: string, categoryId: string, itemId: string) => {
    setQuickEdit({ scope: 'checklist', sectionId, categoryId, itemId, field: 'manual' })
  }

  const handleChangeRowDisplay = (
    sectionId: string,
    categoryId: string,
    itemId: string,
    display: 'list' | 'text'
  ) => {
    onChange(
      prefillSortOrders(
        updateDocCategory(doc, sectionId, categoryId, (category) => {
          const items = category.checklist_items?.map((item) => {
            if (!checklistItemIdsMatch(item.id, itemId)) return item
            return applyChecklistRowDisplay(item, display)
          })
          return items?.length ? { ...category, checklist_items: items } : category
        })
      )
    )
  }

  const handleManualSave = (value: string, status: SopManualStatus) => {
    if (!quickEdit || quickEdit.scope !== 'checklist' || quickEdit.field !== 'manual') return

    onChange(
      prefillSortOrders(
        updateDocCategory(doc, quickEdit.sectionId, quickEdit.categoryId, (category) => {
          const items = category.checklist_items?.map((item) => {
            if (!checklistItemIdsMatch(item.id, quickEdit.itemId)) return item
            return applyChecklistManualValue(item, editLang, value, status)
          })
          return items?.length ? { ...category, checklist_items: items } : category
        })
      )
    )
  }

  const handleQuickEditSave = (value: string) => {
    if (!quickEdit) return

    if (quickEdit.scope === 'section') {
      onChange(
        prefillSortOrders({
          ...doc,
          sections: doc.sections.map((section) =>
            section.id === quickEdit.sectionId
              ? applySectionTitleValue(section, editLang, value)
              : section
          ),
        })
      )
      return
    }

    if (quickEdit.scope === 'checklist') {
      onChange(
        prefillSortOrders(
          updateDocCategory(doc, quickEdit.sectionId, quickEdit.categoryId, (category) => {
            const items = category.checklist_items?.map((item) => {
              if (!checklistItemIdsMatch(item.id, quickEdit.itemId)) return item
              if (quickEdit.field === 'manual') return item
              return applyChecklistItemValue(item, editLang, value)
            })
            return items?.length ? { ...category, checklist_items: items } : category
          })
        )
      )
      return
    }

    onChange(
      prefillSortOrders(
        updateDocCategory(doc, quickEdit.sectionId, quickEdit.categoryId, (category) =>
          quickEdit.field === 'title'
            ? applyCategoryTitleValue(category, editLang, value)
            : applyCategoryBodyDraft(category, editLang, value)
        )
      )
    )
  }

  const handleAddSection = () => {
    const result = addSopSection(doc)
    onChange(result.doc)
    setQuickEdit({ scope: 'section', sectionId: result.sectionId, field: 'title' })
  }

  const handleAddCategory = (sectionId: string, afterCategoryId?: string) => {
    const result = addSopCategory(doc, sectionId, afterCategoryId)
    if (!result) return
    onChange(result.doc)
    setQuickEdit({
      scope: 'category',
      sectionId,
      categoryId: result.categoryId,
      field: 'title',
    })
  }

  const handleAddChecklistItem = (
    sectionId: string,
    categoryId: string,
    afterItemId?: string
  ) => {
    const result = addSopChecklistItem(
      doc,
      sectionId,
      categoryId,
      afterItemId ? { afterItemId } : undefined
    )
    if (!result) return
    onChange(result.doc)
    setQuickEdit({
      scope: 'checklist',
      sectionId,
      categoryId,
      itemId: result.itemId,
      field: 'title',
    })
  }

  const attachmentContext = useMemo(() => {
    if (!attachmentTarget) return null
    const section = doc.sections.find((s) => s.id === attachmentTarget.sectionId)
    const category = section?.categories.find((c) => c.id === attachmentTarget.categoryId)
    const item = category?.checklist_items?.find((i) =>
      checklistItemIdsMatch(i.id, attachmentTarget.itemId)
    )
    if (!item) return null
    return {
      rowLabel: sopText(item.title_ko, item.title_en, editLang).trim() || (isEn ? 'Row' : '줄'),
      attachments: item.attachments ?? [],
    }
  }, [attachmentTarget, doc.sections, editLang, isEn])

  const handleSaveAttachments = (attachments: SopRowAttachment[]) => {
    if (!attachmentTarget) return
    onChange(
      prefillSortOrders(
        setChecklistItemAttachments(
          doc,
          attachmentTarget.sectionId,
          attachmentTarget.categoryId,
          attachmentTarget.itemId,
          attachments.length > 0 ? attachments : undefined
        )
      )
    )
  }

  const confirmDelete = () => {
    if (!deleteTarget) return

    if (deleteTarget.scope === 'section') {
      const next = removeSopSection(doc, deleteTarget.sectionId)
      if (next) {
        onChange(next)
        if (quickEdit?.scope === 'section' && quickEdit.sectionId === deleteTarget.sectionId) {
          setQuickEdit(null)
        }
      }
    } else if (deleteTarget.scope === 'category') {
      const next = removeSopCategory(doc, deleteTarget.sectionId, deleteTarget.categoryId)
      if (next) {
        onChange(next)
        if (
          quickEdit?.scope === 'category' &&
          quickEdit.categoryId === deleteTarget.categoryId
        ) {
          setQuickEdit(null)
        }
        if (
          quickEdit?.scope === 'checklist' &&
          quickEdit.categoryId === deleteTarget.categoryId
        ) {
          setQuickEdit(null)
        }
      }
    } else {
      const next = removeSopChecklistItem(
        doc,
        deleteTarget.sectionId,
        deleteTarget.categoryId,
        deleteTarget.itemId
      )
      if (next) {
        onChange(next)
        if (
          quickEdit?.scope === 'checklist' &&
          quickEdit.itemId === deleteTarget.itemId
        ) {
          setQuickEdit(null)
        }
      }
    }

    setDeleteTarget(null)
  }

  const previewCallbacks = editable
    ? {
        onEditSection: openSectionEdit,
        onEditCategory: openCategoryEdit,
        onAddSection: handleAddSection,
        onDeleteSection: (sectionId: string) => setDeleteTarget({ scope: 'section', sectionId }),
        onAddCategory: handleAddCategory,
        onDeleteCategory: (sectionId: string, categoryId: string) =>
          setDeleteTarget({ scope: 'category', sectionId, categoryId }),
        onAddChecklistItem: handleAddChecklistItem,
        onEditChecklistItem: openChecklistEdit,
        onEditChecklistManual: openChecklistManualEdit,
        onChangeRowDisplay: handleChangeRowDisplay,
        onManageAttachments: (sectionId: string, categoryId: string, itemId: string) =>
          setAttachmentTarget({ sectionId, categoryId, itemId }),
        onDeleteChecklistItem: (sectionId: string, categoryId: string, itemId: string) =>
          setDeleteTarget({ scope: 'checklist', sectionId, categoryId, itemId }),
        onMoveChecklistItem: (
          sectionId: string,
          categoryId: string,
          itemId: string,
          direction: -1 | 1
        ) => {
          const next = moveSopChecklistItem(doc, sectionId, categoryId, itemId, direction)
          if (next) onChange(next)
        },
        onMoveSection: (sectionId: string, direction: -1 | 1) => {
          const next = moveSopSection(doc, sectionId, direction)
          if (next) onChange(next)
        },
        onMoveCategory: (sectionId: string, categoryId: string, direction: -1 | 1) => {
          const next = moveSopCategory(doc, sectionId, categoryId, direction)
          if (next) onChange(next)
        },
      }
    : {}

  return (
    <div className={cn('min-h-0', resizableToc && 'flex h-full flex-col')}>
      <SopDocumentWithToc
        doc={doc}
        viewLang={viewLang}
        uiLocaleEn={isEn}
        resizableToc={resizableToc}
        {...(tocWidthStorageKey ? { tocWidthStorageKey } : {})}
        {...previewCallbacks}
      />

      {quickEditMeta && !isManualEdit ? (
        <SopRichFieldEditDialog
          open={!!quickEdit}
          onOpenChange={(open) => !open && setQuickEdit(null)}
          title={quickEditMeta.title}
          {...(quickEditMeta.description ? { description: quickEditMeta.description } : {})}
          value={quickEditValue}
          variant={quickEditMeta.variant}
          uiLocaleEn={isEn}
          langLabel={quickEditMeta.langLabel}
          onSave={handleQuickEditSave}
        />
      ) : null}

      {manualEditContext ? (
        <SopManualEditDialog
          open={!!quickEdit && isManualEdit}
          onOpenChange={(open) => !open && setQuickEdit(null)}
          title={manualEditContext.title}
          {...(manualEditContext.description ? { description: manualEditContext.description } : {})}
          value={manualEditContext.value}
          status={manualEditContext.status}
          uiLocaleEn={isEn}
          langLabel={manualEditContext.langLabel}
          onSave={handleManualSave}
        />
      ) : null}

      {attachmentContext ? (
        <SopRowAttachmentsDialog
          open={!!attachmentTarget}
          onOpenChange={(open) => !open && setAttachmentTarget(null)}
          rowLabel={attachmentContext.rowLabel}
          attachments={attachmentContext.attachments}
          editLang={editLang}
          uiLocaleEn={isEn}
          onSave={handleSaveAttachments}
        />
      ) : null}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTarget?.scope === 'section'
                ? isEn
                  ? 'Delete section?'
                  : '섹션을 삭제할까요?'
                : deleteTarget?.scope === 'checklist'
                  ? isEn
                    ? 'Delete row?'
                    : '줄을 삭제할까요?'
                  : isEn
                    ? 'Delete block?'
                    : '영역을 삭제할까요?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isEn
                ? `“${deleteLabel}” will be removed. Save the document to persist changes.`
                : `「${deleteLabel}」이(가) 삭제됩니다. 문서 저장 후 반영됩니다.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isEn ? 'Cancel' : '취소'}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={(e) => {
                e.preventDefault()
                confirmDelete()
              }}
            >
              {isEn ? 'Delete' : '삭제'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
