'use client'

import { CheckSquare, Square } from 'lucide-react'
import {
  PICKUP_ACCESS_CLASSES,
  PICKUP_ACCESS_CLASS_LABELS,
  normalizeAllowedPickupAccessClasses,
  type PickupAccessClass,
} from '@/lib/pickupAccessClass'
import { isAllPickupAccessClassesAllowed } from '@/lib/pickupHotelVehicleAccess'

interface PickupHotelVehicleAccessSelectProps {
  value: PickupAccessClass[] | null
  onChange: (classes: PickupAccessClass[] | null) => void
  locale?: 'ko' | 'en'
}

export default function PickupHotelVehicleAccessSelect({
  value,
  onChange,
  locale = 'ko',
}: PickupHotelVehicleAccessSelectProps) {
  const allAllowed = isAllPickupAccessClassesAllowed({
    allowed_pickup_access_classes: value,
  } as never)
  const selected = new Set(allAllowed ? PICKUP_ACCESS_CLASSES : (value ?? []))

  const toggleClass = (accessClass: PickupAccessClass) => {
    const next = new Set(allAllowed ? PICKUP_ACCESS_CLASSES : selected)
    if (next.has(accessClass)) {
      next.delete(accessClass)
    } else {
      next.add(accessClass)
    }
    onChange(normalizeAllowedPickupAccessClasses(Array.from(next)))
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onChange(null)}
          className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
            allAllowed
              ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          {locale === 'en' ? 'All classes allowed' : '전체 허용 (Regular + High Top + Bus)'}
        </button>
        <button
          type="button"
          onClick={() => onChange(['regular'])}
          className="px-3 py-1.5 text-xs rounded-lg border border-border text-primary bg-primary/5 hover:bg-muted transition-colors"
        >
          {locale === 'en' ? 'Regular only' : 'Regular만 (표준 차량)'}
        </button>
      </div>

      <p className="text-xs text-gray-500">
        {locale === 'en'
          ? 'Select which vehicle size classes can enter this hotel. Most hotels allow Regular only; enable High Top or Bus if clearance allows.'
          : '이 호텔에 진입 가능한 차량 크기 등급을 선택하세요. 대부분 Regular만 허용하고, 높이·진입 여유가 있으면 High Top·Bus도 선택합니다.'}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {PICKUP_ACCESS_CLASSES.map((accessClass) => {
          const checked = selected.has(accessClass)
          const labels = PICKUP_ACCESS_CLASS_LABELS[accessClass]
          return (
            <label
              key={accessClass}
              className={`flex flex-col gap-1 p-3 rounded-lg cursor-pointer border transition-colors ${
                checked
                  ? 'bg-emerald-50 border-emerald-300'
                  : 'bg-red-50 border-red-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={checked}
                  onChange={() => toggleClass(accessClass)}
                />
                {checked ? (
                  <CheckSquare size={18} className="text-emerald-600 shrink-0" />
                ) : (
                  <Square size={18} className="text-red-500 shrink-0" />
                )}
                <span className="font-semibold text-gray-900">
                  {locale === 'en' ? labels.en : labels.ko}
                </span>
              </div>
              <p className="text-xs text-gray-600 pl-7">
                {locale === 'en' ? labels.descriptionEn : labels.descriptionKo}
              </p>
            </label>
          )
        })}
      </div>

      {!allAllowed && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">
          {locale === 'en'
            ? `Allowed: ${getAllowedLabels(selected, locale)}`
            : `진입 가능: ${getAllowedLabels(selected, locale)}`}
        </p>
      )}
    </div>
  )
}

function getAllowedLabels(selected: Set<PickupAccessClass>, locale: 'ko' | 'en'): string {
  return PICKUP_ACCESS_CLASSES.filter((c) => selected.has(c))
    .map((c) => PICKUP_ACCESS_CLASS_LABELS[c][locale === 'en' ? 'en' : 'ko'])
    .join(', ')
}
