'use client'

import { ADMIN_SMS_CATEGORY_ICON_OPTIONS, resolveAdminSmsCategoryIcon } from '@/lib/adminSmsCategoryIcons'

type Props = {
  value: string
  onChange: (next: string) => void
  uiLocale?: string
}

export default function AdminSmsCategoryIconPicker({ value, onChange, uiLocale = 'ko' }: Props) {
  const isKo = uiLocale.startsWith('ko')

  return (
    <div className="flex flex-wrap gap-1.5">
      {ADMIN_SMS_CATEGORY_ICON_OPTIONS.map((option) => {
        const Icon = resolveAdminSmsCategoryIcon(option.key)
        const selected = value === option.key
        return (
          <button
            key={option.key}
            type="button"
            title={isKo ? option.labelKo : option.labelEn}
            onClick={() => onChange(option.key)}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
              selected
                ? 'border-violet-600 bg-violet-50 text-violet-700'
                : 'border-gray-200 bg-white text-gray-500 hover:border-violet-300 hover:bg-violet-50/50'
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden />
            <span className="sr-only">{isKo ? option.labelKo : option.labelEn}</span>
          </button>
        )
      })}
    </div>
  )
}
