'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  PICKUP_ACCESS_CLASSES,
  PICKUP_ACCESS_CLASS_BADGE_STYLES,
  PICKUP_ACCESS_CLASS_LABELS,
  resolvePickupAccessClass,
  type PickupAccessClass,
} from '@/lib/pickupAccessClass'

interface PickupAccessClassBadgePickerProps {
  value: PickupAccessClass | null | undefined
  onChange: (accessClass: PickupAccessClass) => Promise<void>
  disabled?: boolean
  locale?: 'ko' | 'en'
}

export default function PickupAccessClassBadgePicker({
  value,
  onChange,
  disabled = false,
  locale = 'ko',
}: PickupAccessClassBadgePickerProps) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const current = resolvePickupAccessClass(value)

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const handleSelect = async (accessClass: PickupAccessClass) => {
    if (accessClass === current || saving || disabled) {
      setOpen(false)
      return
    }
    setSaving(true)
    try {
      await onChange(accessClass)
      setOpen(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => !disabled && !saving && setOpen((prev) => !prev)}
        disabled={disabled || saving}
        title={locale === 'en' ? 'Click to change pickup access class' : '클릭하여 픽업 진입 등급 변경'}
        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border transition-colors disabled:opacity-60 ${PICKUP_ACCESS_CLASS_BADGE_STYLES[current]}`}
      >
        {saving ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : null}
        {PICKUP_ACCESS_CLASS_LABELS[current][locale === 'en' ? 'en' : 'ko']}
      </button>

      {open && (
        <div className="absolute z-30 mt-1 left-0 min-w-[220px] rounded-lg border border-gray-200 bg-white shadow-lg py-1">
          <p className="px-3 py-1.5 text-[10px] font-medium text-gray-500 uppercase tracking-wide">
            {locale === 'en' ? 'Pickup access class' : '픽업 진입 등급'}
          </p>
          {PICKUP_ACCESS_CLASSES.map((accessClass) => {
            const selected = accessClass === current
            const labels = PICKUP_ACCESS_CLASS_LABELS[accessClass]
            return (
              <button
                key={accessClass}
                type="button"
                onClick={() => void handleSelect(accessClass)}
                className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                  selected ? 'bg-blue-50 text-blue-800' : 'hover:bg-gray-50 text-gray-800'
                }`}
              >
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border mr-2 ${PICKUP_ACCESS_CLASS_BADGE_STYLES[accessClass]}`}
                >
                  {labels[locale === 'en' ? 'en' : 'ko']}
                </span>
                <span className="text-xs text-gray-500">
                  {locale === 'en' ? labels.descriptionEn : labels.descriptionKo}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
