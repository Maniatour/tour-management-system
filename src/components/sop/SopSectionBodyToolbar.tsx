'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { SopEditLocale } from '@/types/sopStructure'
import { MoreHorizontal, Pencil } from 'lucide-react'

type Props = {
  sectionId: string
  viewLang: SopEditLocale
  onEditSectionContent?: (sectionId: string) => void
}

export default function SopSectionBodyToolbar({
  sectionId,
  viewLang,
  onEditSectionContent,
}: Props) {
  const isEn = viewLang === 'en'
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

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

  if (!onEditSectionContent) return null

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
        title={isEn ? 'Content actions' : '본문 작업'}
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
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(iconBtn, 'text-indigo-700 hover:bg-indigo-50')}
            title={isEn ? 'Edit content' : '내용 수정'}
            onClick={run(() => onEditSectionContent(sectionId))}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : null}
    </div>
  )
}
