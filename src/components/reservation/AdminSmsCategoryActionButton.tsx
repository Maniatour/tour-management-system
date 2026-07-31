'use client'

import { Loader2 } from 'lucide-react'
import { resolveAdminSmsCategoryIcon } from '@/lib/adminSmsCategoryIcons'
import {
  resolveAdminSmsCategoryIconKey,
  resolveAdminSmsCategoryLabel,
} from '@/lib/adminSmsCategorySettings'
import type { AdminSmsCategoryId } from '@/lib/adminSmsTemplateCatalog'
import { useAdminSmsCategorySettings } from '@/hooks/useAdminSmsCategorySettings'

type Props = {
  categoryId: AdminSmsCategoryId
  uiLocale?: string
  onClick: (e: React.MouseEvent) => void
  disabled?: boolean
  busy?: boolean
  variant?: 'icon' | 'menuItem'
  /** icon variant 전용 */
  iconClassName?: string
  /** menuItem variant 전용 — 미지정 시 설정된 이름 사용 */
  labelOverride?: string
}

export function AdminSmsCategoryActionButton({
  categoryId,
  uiLocale = 'ko',
  onClick,
  disabled = false,
  busy = false,
  variant = 'icon',
  iconClassName = 'text-violet-700',
  labelOverride,
}: Props) {
  const { settings } = useAdminSmsCategorySettings()
  const label = labelOverride ?? resolveAdminSmsCategoryLabel(categoryId, settings, uiLocale)
  const iconKey = resolveAdminSmsCategoryIconKey(categoryId, settings)
  const Icon = resolveAdminSmsCategoryIcon(iconKey)

  if (variant === 'menuItem') {
    return (
      <button
        type="button"
        role="menuitem"
        disabled={disabled || busy}
        onClick={onClick}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        title={label}
        aria-label={label}
      >
        {busy ? (
          <Loader2 className={`h-3.5 w-3.5 shrink-0 animate-spin ${iconClassName}`} aria-hidden />
        ) : (
          <Icon className={`h-3.5 w-3.5 shrink-0 ${iconClassName}`} aria-hidden />
        )}
        {label}
      </button>
    )
  }

  return (
    <button
      type="button"
      disabled={disabled || busy}
      onClick={onClick}
      className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-50 ${iconClassName}`}
      title={label}
      aria-label={label}
    >
      {busy ? (
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
      ) : (
        <Icon className="h-3 w-3" aria-hidden />
      )}
    </button>
  )
}
