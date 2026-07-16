'use client'

import type { ReactElement, SVGProps } from 'react'
import type { PickupAccessClass } from '@/lib/pickupAccessClass'
import { PICKUP_ACCESS_CLASS_LABELS } from '@/lib/pickupAccessClass'

type IconProps = SVGProps<SVGSVGElement> & {
  size?: number
}

function baseProps({ size = 28, className, ...rest }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 64 40',
    fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg',
    className,
    'aria-hidden': true as const,
    ...rest,
  }
}

/** Bold stroke for small badge readability */
const stroke = {
  stroke: 'currentColor',
  strokeWidth: 2.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

/**
 * Low top — short flat roof, compact van profile.
 * Height kept low so it reads differently from High top at badge size.
 */
export function RegularVanIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      {/* Flat low body */}
      <path
        d="M5 28V17c0-1.2.7-2.3 1.8-2.8L15 11h22c1.4 0 2.6.9 3.1 2.2L44 21h9c1.7 0 3 1.3 3 3v4"
        {...stroke}
      />
      {/* Bumper */}
      <path d="M5 21.5H2.5c-.8 0-1.5.7-1.5 1.5V26" {...stroke} />
      {/* One side window + windshield (simple) */}
      <path d="M17 14h9v6H17z" {...stroke} />
      <path d="M28 14h8l4 7H28z" {...stroke} />
      {/* Wheels — larger hubs for clarity */}
      <circle cx="15" cy="28" r="4.5" {...stroke} />
      <circle cx="45" cy="28" r="4.5" {...stroke} />
      <circle cx="15" cy="28" r="1.6" fill="currentColor" />
      <circle cx="45" cy="28" r="1.6" fill="currentColor" />
    </svg>
  )
}

/**
 * High top — exaggerated raised roof box (key differentiator).
 */
export function HighTopVanIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      {/* Tall roof box — very high vs low-top */}
      <path d="M15 4h26c1.4 0 2.5 1.1 2.5 2.5V10" {...stroke} />
      {/* Body under tall roof */}
      <path
        d="M5 28V14c0-1.2.8-2.3 1.9-2.7L15 8.5h26c1.5 0 2.8 1 3.2 2.4L48 20h8c1.7 0 3 1.3 3 3v5"
        {...stroke}
      />
      {/* Bumper */}
      <path d="M5 20.5H2.5c-.8 0-1.5.7-1.5 1.5V26" {...stroke} />
      {/* Tall cabin windows */}
      <path d="M18 11h9v9H18z" {...stroke} />
      <path d="M29 11h9l4.5 9H29z" {...stroke} />
      {/* Roof / body join line */}
      <path d="M15 10.5h28" {...stroke} />
      <circle cx="15" cy="28" r="4.5" {...stroke} />
      <circle cx="45" cy="28" r="4.5" {...stroke} />
      <circle cx="15" cy="28" r="1.6" fill="currentColor" />
      <circle cx="45" cy="28" r="1.6" fill="currentColor" />
    </svg>
  )
}

/**
 * Bus — long rectangular body + window strip (reads as coach, not van).
 */
export function BusIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      {/* Long flat bus body */}
      <rect x="2" y="8" width="54" height="20" rx="3" {...stroke} />
      {/* Flat front nose */}
      <path d="M56 12h4.5c1.4 0 2.5 1.1 2.5 2.5V24" {...stroke} />
      {/* Door near front */}
      <path d="M10 11v16" {...stroke} />
      {/* 4-window strip — bus signature */}
      <path d="M14 12h7v7h-7zM24 12h7v7h-7zM34 12h7v7h-7zM44 12h7v7h-7z" {...stroke} />
      {/* Belt */}
      <path d="M14 20h37" {...stroke} />
      <circle cx="14" cy="28" r="4.2" {...stroke} />
      <circle cx="48" cy="28" r="4.2" {...stroke} />
      <circle cx="14" cy="28" r="1.5" fill="currentColor" />
      <circle cx="48" cy="28" r="1.5" fill="currentColor" />
    </svg>
  )
}

export const PICKUP_VEHICLE_ICONS: Record<
  PickupAccessClass,
  (props: IconProps) => ReactElement
> = {
  regular: RegularVanIcon,
  high_top: HighTopVanIcon,
  bus: BusIcon,
}

/** High-contrast badge colors — easy to tell apart at a glance */
export const PICKUP_VEHICLE_ICON_TONES: Record<
  PickupAccessClass,
  { circle: string; icon: string; mutedCircle: string; mutedIcon: string }
> = {
  regular: {
    circle: 'bg-sky-500 shadow-sm ring-2 ring-white/90',
    icon: 'text-white',
    mutedCircle: 'bg-slate-200 shadow-sm ring-2 ring-white/80',
    mutedIcon: 'text-slate-400',
  },
  high_top: {
    circle: 'bg-violet-500 shadow-sm ring-2 ring-white/90',
    icon: 'text-white',
    mutedCircle: 'bg-slate-200 shadow-sm ring-2 ring-white/80',
    mutedIcon: 'text-slate-400',
  },
  bus: {
    circle: 'bg-amber-500 shadow-sm ring-2 ring-white/90',
    icon: 'text-white',
    mutedCircle: 'bg-slate-200 shadow-sm ring-2 ring-white/80',
    mutedIcon: 'text-slate-400',
  },
}

interface PickupVehicleAccessIconRowProps {
  allowed: PickupAccessClass[]
  locale?: 'ko' | 'en'
  size?: number
  className?: string
  /** Hide text labels under icons (e.g. image overlay). */
  showLabels?: boolean
  /** Floating circles on photo — no outer chrome/box. */
  variant?: 'default' | 'overlay'
  /** When set, each icon toggles that vehicle class. */
  onToggleClass?: (accessClass: PickupAccessClass) => void
  disabled?: boolean
}

/** Shows Low top / High top / Bus icons; muted + slash when not allowed */
export function PickupVehicleAccessIconRow({
  allowed,
  locale = 'ko',
  size = 30,
  className = '',
  showLabels = true,
  variant = 'default',
  onToggleClass,
  disabled = false,
}: PickupVehicleAccessIconRowProps) {
  const allowedSet = new Set(allowed)
  const isOverlay = variant === 'overlay'
  const interactive = typeof onToggleClass === 'function'

  return (
    <div
      className={`flex items-center ${isOverlay ? 'gap-1.5' : 'justify-center gap-2 sm:gap-3'} ${className}`}
      role={interactive ? 'group' : 'list'}
      aria-label={locale === 'en' ? 'Allowed vehicle classes' : '진입 가능 차량 등급'}
    >
      {(['regular', 'high_top', 'bus'] as const).map((accessClass) => {
        const Icon = PICKUP_VEHICLE_ICONS[accessClass]
        const isAllowed = allowedSet.has(accessClass)
        const label = PICKUP_ACCESS_CLASS_LABELS[accessClass][locale === 'en' ? 'en' : 'ko']
        const tone = PICKUP_VEHICLE_ICON_TONES[accessClass]
        const title = interactive
          ? isAllowed
            ? `${label} — ${locale === 'en' ? 'Allowed (click to disable)' : '진입 가능 (클릭하여 해제)'}`
            : `${label} — ${locale === 'en' ? 'Not allowed (click to enable)' : '진입 불가 (클릭하여 허용)'}`
          : isAllowed
            ? `${label} — ${locale === 'en' ? 'Allowed' : '진입 가능'}`
            : `${label} — ${locale === 'en' ? 'Not allowed' : '진입 불가'}`

        const circleClass = `relative inline-flex items-center justify-center rounded-full ${
          isOverlay ? 'h-10 w-10' : 'h-12 w-12'
        } ${isAllowed ? tone.circle : tone.mutedCircle} ${isAllowed ? tone.icon : tone.mutedIcon} ${
          interactive
            ? 'cursor-pointer transition hover:scale-105 hover:brightness-95 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60'
            : ''
        }`

        const inner = (
          <>
            <Icon size={isOverlay ? Math.max(size, 24) : Math.max(size, 26)} />
            {!isAllowed && (
              <span
                className="pointer-events-none absolute inset-0 flex items-center justify-center"
                aria-hidden
              >
                <span className="block h-[3px] w-[70%] rotate-[-32deg] rounded-full bg-slate-500/85" />
              </span>
            )}
          </>
        )

        return (
          <div
            key={accessClass}
            role={interactive ? undefined : 'listitem'}
            className={`relative flex flex-col items-center ${
              showLabels && !isOverlay ? 'gap-1' : ''
            }`}
          >
            {interactive ? (
              <button
                type="button"
                className={circleClass}
                title={title}
                aria-pressed={isAllowed}
                aria-label={title}
                disabled={disabled}
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleClass(accessClass)
                }}
              >
                {inner}
              </button>
            ) : (
              <span className={circleClass} title={title}>
                {inner}
              </span>
            )}
            {showLabels && !isOverlay && (
              <span
                className={`text-[10px] font-semibold leading-none ${
                  isAllowed ? 'text-slate-700' : 'text-slate-400'
                }`}
              >
                {label}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
