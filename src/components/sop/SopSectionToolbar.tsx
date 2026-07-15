'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { SopEditLocale } from '@/types/sopStructure'
import {
  AlignLeft,
  ChevronDown,
  ChevronUp,
  LayoutList,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react'

type Props = {
  sectionId: string
  sectionIndex: number
  sectionCount: number
  viewLang: SopEditLocale
  lastCategoryId?: string
  onEditSection?: (sectionId: string) => void
  onEditSectionContent?: (sectionId: string) => void
  onAddCategory?: (sectionId: string, afterCategoryId?: string) => void
  onDeleteSection?: (sectionId: string) => void
  onMoveSection?: (sectionId: string, direction: -1 | 1) => void
}

export default function SopSectionToolbar({
  sectionId,
  sectionIndex,
  sectionCount,
  viewLang,
  lastCategoryId,
  onEditSection,
  onEditSectionContent,
  onAddCategory,
  onDeleteSection,
  onMoveSection,
}: Props) {
  const isEn = viewLang === 'en'
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const hasActions = Boolean(
    onEditSection ||
      onEditSectionContent ||
      onAddCategory ||
      onDeleteSection ||
      onMoveSection
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
          'h-9 w-9 shrink-0 touch-manipulation border-gray-200 bg-white/95 shadow-sm sm:h-8 sm:w-8',
          open && 'border-indigo-200 bg-indigo-50 text-indigo-700'
        )}
        title={isEn ? 'Section actions' : '섹션 작업'}
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
          {onMoveSection && sectionIndex > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(iconBtn, 'text-gray-500 hover:bg-gray-100')}
              title={isEn ? 'Move up' : '위로'}
              onClick={run(() => onMoveSection(sectionId, -1))}
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </Button>
          ) : null}
          {onMoveSection && sectionIndex < sectionCount - 1 ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(iconBtn, 'text-gray-500 hover:bg-gray-100')}
              title={isEn ? 'Move down' : '아래로'}
              onClick={run(() => onMoveSection(sectionId, 1))}
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          ) : null}
          {onEditSection ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(iconBtn, 'text-indigo-700 hover:bg-indigo-50')}
              title={isEn ? 'Edit title' : '제목 수정'}
              onClick={run(() => onEditSection(sectionId))}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          ) : null}
          {onEditSectionContent ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(iconBtn, 'text-indigo-700 hover:bg-indigo-50')}
              title={isEn ? 'Edit content' : '내용 추가'}
              onClick={run(() => onEditSectionContent(sectionId))}
            >
              <AlignLeft className="h-3.5 w-3.5" />
            </Button>
          ) : null}
          {onAddCategory ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(iconBtn, 'text-indigo-700 hover:bg-indigo-50')}
              title={isEn ? 'Add category' : '카테고리 추가'}
              onClick={run(() => onAddCategory(sectionId, lastCategoryId))}
            >
              <LayoutList className="h-3.5 w-3.5" />
            </Button>
          ) : null}
          {onDeleteSection ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(iconBtn, 'text-red-700 hover:bg-red-50')}
              title={
                sectionCount <= 1
                  ? isEn
                    ? 'Clear section'
                    : '섹션 비우기'
                  : isEn
                    ? 'Delete section'
                    : '섹션 삭제'
              }
              onClick={run(() => onDeleteSection(sectionId))}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
