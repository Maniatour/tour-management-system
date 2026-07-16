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
  /** grid: 출석 관리 4열 / strip: 접힌 채팅 메뉴 한 줄 */
  layout?: 'grid' | 'strip'
}

export default function AttendanceMobileDashboard({
  actions,
  className = '',
  layout = 'grid',
}: Props) {
  if (actions.length === 0) return null

  const isStrip = layout === 'strip'

  return (
    <div
      className={`${
        isStrip
          ? 'px-0.5 py-0.5'
          : 'rounded-2xl border border-gray-200/80 bg-gradient-to-b from-slate-50 to-white px-3 pt-3 pb-4 shadow-sm'
      } ${className}`}
    >
      <div
        className={
          isStrip
            ? 'flex flex-nowrap items-center justify-between gap-0.5 w-full'
            : 'grid grid-cols-4 gap-x-2 gap-y-4'
        }
      >
        {actions.map((action) => {
          const Icon = action.icon
          return (
            <button
              key={action.id}
              type="button"
              onClick={action.onClick}
              className={`group flex flex-col items-center min-w-0 active:scale-95 transition-transform ${
                isStrip ? 'flex-1 min-w-0 gap-0.5' : 'gap-1.5'
              }`}
            >
              <span className="relative">
                <span
                  className={`flex items-center justify-center p-0 shadow-md ring-1 ring-black/5 ${action.tileClass} ${
                    isStrip
                      ? 'h-8 w-8 rounded-lg'
                      : 'h-14 w-14 rounded-[1.15rem]'
                  }`}
                >
                  <Icon
                    className={`text-white drop-shadow-sm shrink-0 ${
                      isStrip ? 'h-[1.125rem] w-[1.125rem]' : 'h-7 w-7'
                    }`}
                    strokeWidth={1.75}
                  />
                </span>
                {action.badge != null && action.badge > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[1.125rem] h-[1.125rem] px-1 flex items-center justify-center text-[9px] font-bold text-white bg-red-500 rounded-full ring-2 ring-white">
                    {action.badge > 99 ? '99+' : action.badge}
                  </span>
                )}
              </span>
              <span
                className={`font-medium text-gray-700 text-center leading-none w-full px-0.5 ${
                  isStrip
                    ? 'text-[8px] truncate'
                    : 'text-[10px] line-clamp-2'
                }`}
              >
                {action.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
