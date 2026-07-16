'use client'

import {
  PICKUP_ACCESS_CLASSES,
  PICKUP_ACCESS_CLASS_LABELS,
  normalizeAllowedPickupAccessClasses,
  type PickupAccessClass,
} from '@/lib/pickupAccessClass'
import { isAllPickupAccessClassesAllowed } from '@/lib/pickupHotelVehicleAccess'
import { PICKUP_VEHICLE_ICONS, PICKUP_VEHICLE_ICON_TONES } from '@/components/pickup-hotel/PickupVehicleIcons'

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
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onChange(null)}
          className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
            allAllowed
              ? 'border-emerald-300 bg-emerald-100 text-emerald-800'
              : 'border-border bg-white text-slate-700 hover:bg-muted'
          }`}
        >
          {locale === 'en' ? 'Allow all' : '전체 허용'}
        </button>
        <button
          type="button"
          onClick={() => onChange(['regular'])}
          className="rounded-lg border border-border bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-muted"
        >
          {locale === 'en' ? 'Low top only' : 'Low top만'}
        </button>
      </div>

      <div className="flex flex-wrap items-stretch justify-start gap-2">
        {PICKUP_ACCESS_CLASSES.map((accessClass) => {
          const checked = selected.has(accessClass)
          const labels = PICKUP_ACCESS_CLASS_LABELS[accessClass]
          const Icon = PICKUP_VEHICLE_ICONS[accessClass]
          const tone = PICKUP_VEHICLE_ICON_TONES[accessClass]
          const name = locale === 'en' ? labels.en : labels.ko
          const description = locale === 'en' ? labels.descriptionEn : labels.descriptionKo

          return (
            <button
              key={accessClass}
              type="button"
              onClick={() => toggleClass(accessClass)}
              aria-pressed={checked}
              aria-label={`${name}. ${description}`}
              title={`${name}\n${description}`}
              className={`group relative flex min-w-[4.5rem] flex-1 flex-col items-center justify-center gap-1.5 rounded-lg border px-2 py-2.5 transition-colors sm:max-w-[7.5rem] ${
                checked
                  ? 'border-border/70 bg-white text-slate-800 hover:bg-muted/40'
                  : 'border-slate-200 bg-slate-50 text-slate-400 hover:border-slate-300 hover:bg-slate-100'
              }`}
            >
              <span
                className={`relative inline-flex h-11 w-11 items-center justify-center rounded-full ${
                  checked ? `${tone.circle} ${tone.icon}` : `${tone.mutedCircle} ${tone.mutedIcon}`
                }`}
              >
                <Icon size={22} />
                {!checked && (
                  <span
                    className="pointer-events-none absolute inset-0 flex items-center justify-center"
                    aria-hidden
                  >
                    <span className="block h-0.5 w-[72%] rotate-[-32deg] rounded-full bg-slate-400/90" />
                  </span>
                )}
              </span>
              <span className={`text-xs font-semibold ${checked ? 'text-slate-800' : 'text-slate-400'}`}>
                {name}
              </span>

              {/* Hover tooltip */}
              <span
                role="tooltip"
                className="pointer-events-none absolute left-1/2 top-[calc(100%+0.4rem)] z-20 w-max max-w-[14rem] -translate-x-1/2 rounded-lg border border-border bg-white px-3 py-2 text-left opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
              >
                <span className="block text-xs font-semibold text-slate-900">{name}</span>
                <span className="mt-0.5 block text-[11px] leading-4 text-slate-600">
                  {description}
                </span>
                <span className="mt-1 block text-[10px] font-medium text-slate-500">
                  {checked
                    ? locale === 'en'
                      ? 'Allowed — click to disable'
                      : '진입 가능 — 클릭하여 해제'
                    : locale === 'en'
                      ? 'Not allowed — click to enable'
                      : '진입 불가 — 클릭하여 허용'}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      {!allAllowed && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
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
