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
  convertSopCategoryToRow,
  convertSopRowToCategory,
  moveSopCategory,
  moveSopChecklistItem,
  moveSopSection,
  removeSopCategory,
  removeSopChecklistItem,
  removeSopSection,
  setChecklistItemAttachments,
  splitChecklistTitlesIntoListRows,
} from '@/lib/sopDocumentMutations'
import {
  applyCategoryBodyDraft,
  applyCategoryManualSave,
  applyCategoryTitleValue,
  applyChecklistItemValue,
  applyChecklistManualSave,
  applyChecklistRowDisplay,
  applySectionTitleValue,
  applySectionBodyValue,
  checklistItemIdsMatch,
  detectCategoryEditField,
  getCategoryBodyDraft,
  getCategoryManualStatus,
  getCategoryManualValue,
  getCategoryTitleValue,
  getChecklistItemDisplayLabel,
  getChecklistItemValue,
  getChecklistManualStatus,
  getChecklistManualValue,
  getLinkedHubArticleIds,
  getSectionBodyValue,
  getSectionTitleValue,
  sopDisplayLabel,
  hydrateDocumentForRowEditing,
  updateDocCategory,
  type ManualSavePayload,
} from '@/lib/sopQuickEdit'
import {
  fetchHubArticlesForManualLink,
  type HubArticleLinkOption,
} from '@/lib/hubArticleManualLink'
import { cn } from '@/lib/utils'
import {
  prefillSortOrders,
  splitRichContentToChecklistLines,
  type SopDocument,
  type SopEditLocale,
  type SopRowAttachment,
} from '@/types/sopStructure'

type QuickEdit =
  | { scope: 'section'; sectionId: string; field: 'title' | 'body' }
  | { scope: 'category'; sectionId: string; categoryId: string; field: 'title' | 'body' | 'manual' }
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
  /** 메뉴얼 적용 직후 문서를 DB에 저장 (최신 doc 전달) */
  onPersistDocument?: (doc: SopDocument) => void | Promise<void>
}

export default function SopDocumentInlinePreviewEditor({
  doc,
  onChange,
  viewLang,
  uiLocaleEn,
  editable = true,
  resizableToc = false,
  tocWidthStorageKey,
  onPersistDocument,
}: Props) {
  const isEn = uiLocaleEn
  const editLang = viewLang

  const [quickEdit, setQuickEdit] = useState<QuickEdit | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [attachmentTarget, setAttachmentTarget] = useState<AttachmentTarget | null>(null)
  const [hubArticles, setHubArticles] = useState<HubArticleLinkOption[]>([])

  useEffect(() => {
    if (!editable) return
    void fetchHubArticlesForManualLink().then(setHubArticles)
  }, [editable])

  useEffect(() => {
    if (!editable) return
    const hydrated = hydrateDocumentForRowEditing(doc)
    if (hydrated !== doc) onChange(hydrated)
  }, [doc, editable, onChange])

  const quickEditValue = useMemo(() => {
    if (!quickEdit) return ''
    if (quickEdit.scope === 'section') {
      const section = doc.sections.find((s) => s.id === quickEdit.sectionId)
      if (!section) return ''
      return quickEdit.field === 'title'
        ? getSectionTitleValue(section, editLang)
        : getSectionBodyValue(section, editLang)
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
    if (quickEdit.field === 'manual') {
      return getCategoryManualValue(category, editLang)
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
      const label = section ? sopDisplayLabel(section.title_ko, section.title_en, editLang) : ''
      const isBody = quickEdit.field === 'body'
      return {
        variant,
        langLabel,
        title: isBody
          ? isEn
            ? 'Edit section content'
            : '섹션 내용 수정'
          : isEn
            ? 'Edit section title'
            : '섹션 제목 수정',
        description: label
          ? isEn
            ? `Section: ${label}`
            : `섹션: ${label}`
          : undefined,
      }
    }

    const section = doc.sections.find((s) => s.id === quickEdit.sectionId)
    const category = section?.categories.find((c) => c.id === quickEdit.categoryId)
    const label = category ? sopDisplayLabel(category.title_ko, category.title_en, editLang) : ''

    if (quickEdit.scope === 'checklist') {
      const item = category?.checklist_items?.find((i) =>
        checklistItemIdsMatch(i.id, quickEdit.itemId)
      )
      const rowLabel = item ? getChecklistItemDisplayLabel(item, editLang) : ''
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

    const sectionForBody = doc.sections.find((s) => s.id === quickEdit.sectionId)
    const categoryForBody = sectionForBody?.categories.find((c) => c.id === quickEdit.categoryId)

    return {
      variant,
      langLabel,
      title: isEn ? 'Edit block content' : '영역 내용 수정',
      description: categoryForBody
        ? isEn
          ? `Block: ${sopDisplayLabel(categoryForBody.title_ko, categoryForBody.title_en, editLang) || '—'}`
          : `영역: ${sopDisplayLabel(categoryForBody.title_ko, categoryForBody.title_en, editLang) || '—'}`
        : undefined,
    }
  }, [doc.sections, editLang, isEn, quickEdit])

  const isManualEdit =
    quickEdit?.field === 'manual' &&
    (quickEdit.scope === 'checklist' || quickEdit.scope === 'category')

  const manualEditContext = useMemo(() => {
    if (!isManualEdit || !quickEdit) return null

    if (quickEdit.scope === 'checklist') {
      const section = doc.sections.find((s) => s.id === quickEdit.sectionId)
      const category = section?.categories.find((c) => c.id === quickEdit.categoryId)
      const item = category?.checklist_items?.find((i) =>
        checklistItemIdsMatch(i.id, quickEdit.itemId)
      )
      if (!item) return null
      const rowLabel = getChecklistItemDisplayLabel(item, editLang)
      const blockLabel = category
        ? sopDisplayLabel(category.title_ko, category.title_en, editLang)
        : ''
      return {
        value: getChecklistManualValue(item, editLang),
        status: getChecklistManualStatus(item),
        linkedHubArticleIds: getLinkedHubArticleIds(item),
        documentTitle: rowLabel || blockLabel || (isEn ? 'Manual notes' : '메뉴얼'),
        title: isEn ? 'View manual' : '메뉴얼 보기',
        editTitle: isEn ? 'Edit manual' : '메뉴얼 수정',
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
    }

    if (quickEdit.scope === 'category') {
      const section = doc.sections.find((s) => s.id === quickEdit.sectionId)
      const category = section?.categories.find((c) => c.id === quickEdit.categoryId)
      if (!category) return null
      const blockLabel = sopDisplayLabel(category.title_ko, category.title_en, editLang)
      return {
        value: getCategoryManualValue(category, editLang),
        status: getCategoryManualStatus(category),
        linkedHubArticleIds: getLinkedHubArticleIds(category),
        documentTitle: blockLabel || (isEn ? 'Block manual' : '영역 메뉴얼'),
        title: isEn ? 'View block manual' : '영역 메뉴얼 보기',
        editTitle: isEn ? 'Edit block manual' : '영역 메뉴얼 수정',
        description: blockLabel
          ? isEn
            ? `Block: ${blockLabel}`
            : `영역: ${blockLabel}`
          : undefined,
        langLabel: editLang === 'en' ? 'English' : '한국어',
      }
    }

    return null
  }, [doc.sections, editLang, isEn, isManualEdit, quickEdit])

  const deleteLabel = useMemo(() => {
    if (!deleteTarget) return ''
    if (deleteTarget.scope === 'section') {
      const section = doc.sections.find((s) => s.id === deleteTarget.sectionId)
      const label = section ? sopDisplayLabel(section.title_ko, section.title_en, editLang) : ''
      return label || (isEn ? 'this section' : '이 섹션')
    }
    if (deleteTarget.scope === 'checklist') {
      const section = doc.sections.find((s) => s.id === deleteTarget.sectionId)
      const category = section?.categories.find((c) => c.id === deleteTarget.categoryId)
      const item = category?.checklist_items?.find((i) => i.id === deleteTarget.itemId)
      const label = item ? getChecklistItemDisplayLabel(item, editLang) : ''
      return label || (isEn ? 'this row' : '이 줄')
    }
    const section = doc.sections.find((s) => s.id === deleteTarget.sectionId)
    const category = section?.categories.find((c) => c.id === deleteTarget.categoryId)
    const label = category ? sopDisplayLabel(category.title_ko, category.title_en, editLang) : ''
    return label || (isEn ? 'this block' : '이 영역')
  }, [deleteTarget, doc.sections, editLang, isEn])

  const openSectionEdit = (sectionId: string) => {
    setQuickEdit({ scope: 'section', sectionId, field: 'title' })
  }

  const openSectionContentEdit = (sectionId: string) => {
    setQuickEdit({ scope: 'section', sectionId, field: 'body' })
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

  const openCategoryManualEdit = (sectionId: string, categoryId: string) => {
    setQuickEdit({ scope: 'category', sectionId, categoryId, field: 'manual' })
  }

  const commitDoc = (nextDoc: SopDocument) => {
    onChange(nextDoc)
    void onPersistDocument?.(nextDoc)
  }

  const handleChangeRowDisplay = (
    sectionId: string,
    categoryId: string,
    itemId: string,
    display: 'list' | 'text'
  ) => {
    commitDoc(
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

  const handleManualSave = (payload: ManualSavePayload) => {
    if (!quickEdit || quickEdit.field !== 'manual') return

    if (quickEdit.scope === 'checklist') {
      const nextDoc = prefillSortOrders(
        updateDocCategory(doc, quickEdit.sectionId, quickEdit.categoryId, (category) => {
          const items = category.checklist_items?.map((item) => {
            if (!checklistItemIdsMatch(item.id, quickEdit.itemId)) return item
            return applyChecklistManualSave(item, editLang, payload)
          })
          return items?.length ? { ...category, checklist_items: items } : category
        })
      )
      commitDoc(nextDoc)
      return
    }

    if (quickEdit.scope === 'category') {
      const nextDoc = prefillSortOrders(
        updateDocCategory(doc, quickEdit.sectionId, quickEdit.categoryId, (category) =>
          applyCategoryManualSave(category, editLang, payload)
        )
      )
      commitDoc(nextDoc)
    }
  }

  const handleQuickEditSave = (value: string) => {
    if (!quickEdit) return

    if (quickEdit.scope === 'section') {
      commitDoc(
        prefillSortOrders({
          ...doc,
          sections: doc.sections.map((section) =>
            section.id === quickEdit.sectionId
              ? quickEdit.field === 'title'
                ? applySectionTitleValue(section, editLang, value)
                : applySectionBodyValue(section, editLang, value)
              : section
          ),
        })
      )
      return
    }

    if (quickEdit.scope === 'checklist') {
      if (quickEdit.field === 'title') {
        handleChecklistTitleSave(value, 'list')
      }
      return
    }

    commitDoc(
      prefillSortOrders(
        updateDocCategory(doc, quickEdit.sectionId, quickEdit.categoryId, (category) =>
          quickEdit.field === 'title'
            ? applyCategoryTitleValue(category, editLang, value)
            : applyCategoryBodyDraft(category, editLang, value)
        )
      )
    )
  }

  const handleChecklistTitleSave = (value: string, display: 'list' | 'text') => {
    if (!quickEdit || quickEdit.scope !== 'checklist' || quickEdit.field !== 'title') return
    commitDoc(
      prefillSortOrders(
        updateDocCategory(doc, quickEdit.sectionId, quickEdit.categoryId, (category) => {
          const items = category.checklist_items?.map((item) => {
            if (!checklistItemIdsMatch(item.id, quickEdit.itemId)) return item
            const withValue = applyChecklistItemValue(item, editLang, value)
            return applyChecklistRowDisplay(withValue, display)
          })
          return items?.length ? { ...category, checklist_items: items } : category
        })
      )
    )
  }

  const handleChecklistTitleSaveAsSplitListRows = (value: string) => {
    if (!quickEdit || quickEdit.scope !== 'checklist' || quickEdit.field !== 'title') return
    const titles = splitRichContentToChecklistLines(value)
    if (!titles.length) return
    if (titles.length === 1) {
      handleChecklistTitleSave(titles[0], 'list')
      return
    }
    const next = splitChecklistTitlesIntoListRows(
      doc,
      quickEdit.sectionId,
      quickEdit.categoryId,
      quickEdit.itemId,
      titles,
      editLang
    )
    if (next) commitDoc(next)
  }

  const isChecklistTitleEdit =
    quickEdit?.scope === 'checklist' && quickEdit.field === 'title'

  const handleAddSection = () => {
    const result = addSopSection(doc)
    commitDoc(result.doc)
    setQuickEdit({ scope: 'section', sectionId: result.sectionId, field: 'title' })
  }

  const handleAddCategory = (sectionId: string, afterCategoryId?: string) => {
    const result = addSopCategory(doc, sectionId, afterCategoryId)
    if (!result) return
    commitDoc(result.doc)
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
    commitDoc(result.doc)
    setQuickEdit({
      scope: 'checklist',
      sectionId,
      categoryId,
      itemId: result.itemId,
      field: 'title',
    })
  }

  const handleConvertCategoryToRow = (sectionId: string, categoryId: string) => {
    const result = convertSopCategoryToRow(doc, sectionId, categoryId)
    if (!result) return
    commitDoc(result.doc)
    if (
      quickEdit?.scope === 'category' &&
      quickEdit.categoryId === categoryId
    ) {
      setQuickEdit(null)
    }
    setQuickEdit({
      scope: 'checklist',
      sectionId,
      categoryId: result.hostCategoryId,
      itemId: result.rowId,
      field: 'title',
    })
  }

  const handleConvertRowToCategory = (
    sectionId: string,
    categoryId: string,
    itemId: string
  ) => {
    const result = convertSopRowToCategory(doc, sectionId, categoryId, itemId)
    if (!result) return
    commitDoc(result.doc)
    if (
      quickEdit?.scope === 'checklist' &&
      quickEdit.itemId === itemId
    ) {
      setQuickEdit(null)
    }
    setQuickEdit({
      scope: 'category',
      sectionId,
      categoryId: result.newCategoryId,
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
      rowLabel: getChecklistItemDisplayLabel(item, editLang) || (isEn ? 'Row' : '줄'),
      attachments: item.attachments ?? [],
    }
  }, [attachmentTarget, doc.sections, editLang, isEn])

  const handleSaveAttachments = (attachments: SopRowAttachment[]) => {
    if (!attachmentTarget) return
    commitDoc(
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
        commitDoc(next)
        if (quickEdit?.scope === 'section' && quickEdit.sectionId === deleteTarget.sectionId) {
          setQuickEdit(null)
        }
      }
    } else if (deleteTarget.scope === 'category') {
      const next = removeSopCategory(doc, deleteTarget.sectionId, deleteTarget.categoryId)
      if (next) {
        commitDoc(next)
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
        commitDoc(next)
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
        onEditSectionContent: openSectionContentEdit,
        onEditCategory: openCategoryEdit,
        onAddSection: handleAddSection,
        onDeleteSection: (sectionId: string) => setDeleteTarget({ scope: 'section', sectionId }),
        onAddCategory: handleAddCategory,
        onDeleteCategory: (sectionId: string, categoryId: string) =>
          setDeleteTarget({ scope: 'category', sectionId, categoryId }),
        onAddChecklistItem: handleAddChecklistItem,
        onEditChecklistItem: openChecklistEdit,
        onEditChecklistManual: openChecklistManualEdit,
        onEditCategoryManual: openCategoryManualEdit,
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
          if (next) commitDoc(next)
        },
        onMoveSection: (sectionId: string, direction: -1 | 1) => {
          const next = moveSopSection(doc, sectionId, direction)
          if (next) commitDoc(next)
        },
        onMoveCategory: (sectionId: string, categoryId: string, direction: -1 | 1) => {
          const next = moveSopCategory(doc, sectionId, categoryId, direction)
          if (next) commitDoc(next)
        },
        onConvertCategoryToRow: handleConvertCategoryToRow,
        onConvertRowToCategory: handleConvertRowToCategory,
      }
    : {}

  return (
    <div className={cn('min-h-0', resizableToc && 'flex h-full flex-col')}>
      <SopDocumentWithToc
        doc={doc}
        viewLang={viewLang}
        uiLocaleEn={isEn}
        resizableToc={resizableToc}
        enableSearch
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
          {...(isChecklistTitleEdit
            ? {
                onSaveAsText: (value) => handleChecklistTitleSave(value, 'text'),
                onSaveAsSplitListRows: handleChecklistTitleSaveAsSplitListRows,
              }
            : {})}
        />
      ) : null}

      {manualEditContext ? (
        <SopManualEditDialog
          open={!!quickEdit && isManualEdit}
          onOpenChange={(open) => !open && setQuickEdit(null)}
          title={manualEditContext.title}
          {...(manualEditContext.editTitle ? { editTitle: manualEditContext.editTitle } : {})}
          {...(manualEditContext.description ? { description: manualEditContext.description } : {})}
          documentTitle={manualEditContext.documentTitle}
          value={manualEditContext.value}
          status={manualEditContext.status}
          linkedHubArticleIds={manualEditContext.linkedHubArticleIds}
          hubArticles={hubArticles}
          viewLang={editLang}
          uiLocaleEn={isEn}
          langLabel={manualEditContext.langLabel}
          startInViewMode
          onSave={handleManualSave}
          onHubArticleCreated={(article) => {
            setHubArticles((prev) => {
              if (prev.some((a) => a.id === article.id)) return prev
              return [...prev, article].sort((a, b) =>
                (a.title_ko || a.title_en || a.slug).localeCompare(
                  b.title_ko || b.title_en || b.slug,
                  'ko'
                )
              )
            })
          }}
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
        <AlertDialogContent stackLevel="nested">
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
              {deleteTarget?.scope === 'section' && doc.sections.length <= 1
                ? isEn
                  ? `“${deleteLabel}” is the only section — it will be cleared to an empty section. Changes auto-save shortly.`
                  : `「${deleteLabel}」은(는) 유일한 섹션이라 빈 섹션으로 초기화됩니다. 잠시 후 자동 저장됩니다.`
                : isEn
                  ? `“${deleteLabel}” will be removed. Changes auto-save shortly.`
                  : `「${deleteLabel}」이(가) 삭제됩니다. 잠시 후 자동 저장됩니다.`}
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
