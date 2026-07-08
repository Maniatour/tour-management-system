'use client'

import type { LucideIcon } from 'lucide-react'

export type AttendanceDashboardAction = {
  id: string
  label: string
  icon: LucideIcon
  onClick: () => void
  /** Tailwind background classes for the icon tile */
  tileClass: string
  badge?: number
}

type Props = {
  actions: AttendanceDashboardAction[]
  className?: string
}

export default function AttendanceMobileDashboard({ actions, className = '' }: Props) {
  if (actions.length === 0) return null

  return (
    <div
      className={`rounded-2xl border border-gray-200/80 bg-gradient-to-b from-slate-50 to-white px-3 pt-3 pb-4 shadow-sm ${className}`}
    >
      <div className="grid grid-cols-4 gap-x-2 gap-y-4">
        {actions.map((action) => {
          const Icon = action.icon
          return (
            <button
              key={action.id}
              type="button"
              onClick={action.onClick}
              className="group flex flex-col items-center gap-1.5 min-w-0 active:scale-95 transition-transform"
            >
              <span className="relative">
                <span
                  className={`flex h-14 w-14 items-center justify-center rounded-[1.15rem] shadow-md ring-1 ring-black/5 ${action.tileClass}`}
                >
                  <Icon className="h-7 w-7 text-white drop-shadow-sm" strokeWidth={1.75} />
                </span>
                {action.badge != null && action.badge > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[1.125rem] h-[1.125rem] px-1 flex items-center justify-center text-[9px] font-bold text-white bg-red-500 rounded-full ring-2 ring-white">
                    {action.badge > 99 ? '99+' : action.badge}
                  </span>
                )}
              </span>
              <span className="text-[10px] font-medium text-gray-700 text-center leading-tight line-clamp-2 w-full px-0.5">
                {action.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
