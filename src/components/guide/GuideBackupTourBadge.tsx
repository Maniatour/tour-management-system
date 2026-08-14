'use client'

import { AlertTriangle } from 'lucide-react'
import { useTranslations } from 'next-intl'

type GuideBackupTourBadgeProps = {
  variant?: 'badge' | 'chip' | 'banner'
  className?: string
}

export function GuideBackupTourBadge({
  variant = 'badge',
  className = '',
}: GuideBackupTourBadgeProps) {
  const t = useTranslations('guide.tourCard')
  const label = t('backupSchedule')
  const hint = t('backupScheduleHint')

  if (variant === 'banner') {
    return (
      <div
        role="status"
        className={`rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 ${className}`}
      >
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-amber-900">{label}</p>
            <p className="mt-0.5 text-xs leading-5 text-amber-800">{hint}</p>
          </div>
        </div>
      </div>
    )
  }

  if (variant === 'chip') {
    return (
      <span
        className={`inline-flex rounded bg-amber-300/95 px-1 py-px text-[8px] font-semibold leading-tight text-amber-950 sm:text-[9px] ${className}`}
        title={hint}
      >
        {t('backupScheduleShort')}
      </span>
    )
  }

  return (
    <span
      className={`inline-flex items-center rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900 ${className}`}
      title={hint}
    >
      <AlertTriangle className="mr-1 h-3 w-3 shrink-0" aria-hidden />
      {label}
    </span>
  )
}
