'use client'

import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { LayoutGrid } from 'lucide-react'

export type ScheduleMobileTool = {
  id: string
  label: string
  tileClass: string
  icon: ReactNode
  badge?: number
  disabled?: boolean
  onClick: () => void
}

function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span className="absolute -right-1 -top-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white">
      {count > 99 ? '99+' : count}
    </span>
  )
}

type ScheduleViewMobileToolGridProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  tools: ScheduleMobileTool[]
  attentionCount: number
  title: string
  launcherTarget: HTMLElement | null
  panelTarget: HTMLElement | null
}

export function ScheduleViewMobileToolGrid({
  open,
  onOpenChange,
  tools,
  attentionCount,
  title,
  launcherTarget,
  panelTarget,
}: ScheduleViewMobileToolGridProps) {
  if (!launcherTarget || tools.length === 0) return null

  const launcher = (
    <button
      type="button"
      className={`relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors ${
        open ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-700'
      }`}
      aria-expanded={open}
      aria-label={attentionCount > 0 ? `${title}, ${attentionCount}` : title}
      onClick={() => onOpenChange(!open)}
    >
      <LayoutGrid className="h-5 w-5" />
      <CountBadge count={attentionCount} />
    </button>
  )

  const panel = open ? (
    <div className="mt-2 w-full rounded-2xl border border-gray-200 bg-gray-50 px-3 py-3 shadow-sm">
          <p className="mb-3 text-xs font-medium text-gray-500">{title}</p>
          <div className="grid grid-cols-4 gap-x-2 gap-y-4">
            {tools.map((tool) => (
              <button
                key={tool.id}
                type="button"
                disabled={tool.disabled}
                onClick={() => {
                  if (tool.disabled) return
                  tool.onClick()
                  onOpenChange(false)
                }}
                className="flex min-w-0 flex-col items-center gap-1.5 rounded-2xl p-1 active:scale-[0.98] disabled:opacity-40"
              >
                <span
                  className={`relative flex h-14 w-14 items-center justify-center rounded-2xl border shadow-sm ${tool.tileClass}`}
                >
                  {tool.icon}
                  <CountBadge count={tool.badge ?? 0} />
                </span>
                <span className="line-clamp-2 w-full text-center text-[11px] font-medium leading-tight text-gray-800">
                  {tool.label}
                </span>
              </button>
            ))}
          </div>
        </div>
  ) : null

  return (
    <>
      {createPortal(launcher, launcherTarget)}
      {panel && panelTarget ? createPortal(panel, panelTarget) : null}
    </>
  )
}
