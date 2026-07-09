'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { SopEditLocale } from '@/types/sopStructure'
import { ChevronDown, ChevronUp, LayoutList, List, ListPlus, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'

type Props = {
  sectionId: string
  categoryId: string
  categoryIndex: number
  categoryCount: number
  sectionCategoryCount: number
  viewLang: SopEditLocale
  onEditCategory?: (sectionId: string, categoryId: string) => void
  onDeleteCategory?: (sectionId: string, categoryId: string) => void
  onMoveCategory?: (sectionId: string, categoryId: string, direction: -1 | 1) => void
  onAddChecklistItem?: (sectionId: string, categoryId: string, afterItemId?: string) => void
  onAddCategory?: (sectionId: string, afterCategoryId?: string) => void
  onConvertCategoryToRow?: (sectionId: string, categoryId: string) => void
}

export default function SopCategoryToolbar({
  sectionId,
  categoryId,
  categoryIndex,
  categoryCount,
  sectionCategoryCount,
  viewLang,
  onEditCategory,
  onDeleteCategory,
  onMoveCategory,
  onAddChecklistItem,
  onAddCategory,
  onConvertCategoryToRow,
}: Props) {
  const isEn = viewLang === 'en'
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const hasActions = Boolean(
    onEditCategory ||
      onDeleteCategory ||
      onMoveCategory ||
      onAddChecklistItem ||
      onAddCategory ||
      onConvertCategoryToRow
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

  const iconBtn = 'h-8 w-8 shrink-0 touch-manipulation sm:h-7 sm:w-7'

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
        title={isEn ? 'Block actions' : '영역 작업'}
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
          {onMoveCategory && categoryIndex > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(iconBtn, 'text-gray-500 hover:bg-gray-100')}
              title={isEn ? 'Move up' : '위로'}
              onClick={run(() => onMoveCategory(sectionId, categoryId, -1))}
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </Button>
          ) : null}
          {onMoveCategory && categoryIndex < categoryCount - 1 ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(iconBtn, 'text-gray-500 hover:bg-gray-100')}
              title={isEn ? 'Move down' : '아래로'}
              onClick={run(() => onMoveCategory(sectionId, categoryId, 1))}
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          ) : null}
          {onEditCategory ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(iconBtn, 'text-indigo-700 hover:bg-indigo-50')}
              title={isEn ? 'Edit block title' : '영역 제목 수정'}
              onClick={run(() => onEditCategory(sectionId, categoryId))}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          ) : null}
          {onAddChecklistItem ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(iconBtn, 'text-gray-600 hover:bg-gray-100')}
              title={isEn ? 'Add row' : '줄 추가'}
              onClick={run(() => onAddChecklistItem(sectionId, categoryId))}
            >
              <ListPlus className="h-3.5 w-3.5" />
            </Button>
          ) : null}
          {onAddCategory ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(iconBtn, 'text-indigo-700 hover:bg-indigo-50')}
              title={isEn ? 'Add block below' : '아래에 영역 추가'}
              onClick={run(() => onAddCategory(sectionId, categoryId))}
            >
              <LayoutList className="h-3.5 w-3.5" />
            </Button>
          ) : null}
          {onConvertCategoryToRow && sectionCategoryCount > 1 ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(iconBtn, 'text-violet-700 hover:bg-violet-50')}
              title={isEn ? 'Convert to row' : '줄(ROW)로 변환'}
              onClick={run(() => onConvertCategoryToRow(sectionId, categoryId))}
            >
              <List className="h-3.5 w-3.5" />
            </Button>
          ) : null}
          {onDeleteCategory && sectionCategoryCount > 1 ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(iconBtn, 'text-red-700 hover:bg-red-50')}
              title={isEn ? 'Delete' : '삭제'}
              onClick={run(() => onDeleteCategory(sectionId, categoryId))}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
