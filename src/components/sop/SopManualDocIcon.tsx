'use client'

import { Button } from '@/components/ui/button'
import { getManualIconStateFromFields, type ManualIconState, type SopManualFields } from '@/lib/sopQuickEdit'
import { cn } from '@/lib/utils'
import type { SopEditLocale } from '@/types/sopStructure'
import { FileText } from 'lucide-react'

const MANUAL_ICON_CLASS: Record<ManualIconState, string> = {
  empty: 'text-gray-400 hover:text-gray-500',
  draft: 'text-red-600 hover:text-red-700',
  complete: 'text-green-600 hover:text-green-700',
}

type Props = {
  source: SopManualFields
  viewLang: SopEditLocale
  isEn: boolean
  onClick?: () => void
  titleComplete?: string
  titleDraft?: string
  titleEmpty?: string
}

export default function SopManualDocIcon({
  source,
  viewLang,
  isEn,
  onClick,
  titleComplete,
  titleDraft,
  titleEmpty,
}: Props) {
  const state = getManualIconStateFromFields(source, viewLang)
  const title =
    state === 'complete'
      ? titleComplete ?? (isEn ? 'Manual complete' : '메뉴얼 작성완료')
      : state === 'draft'
        ? titleDraft ?? (isEn ? 'Manual draft' : '메뉴얼 작성중')
        : titleEmpty ?? (isEn ? 'No manual' : '메뉴얼 없음')

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
