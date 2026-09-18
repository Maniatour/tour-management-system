'use client'

import type { GuidePhotoStop, PhotoStopStatus } from '@/lib/guidePhotoStopCoverage'
import { photoStopStatus } from '@/lib/guidePhotoStopCoverage'

type GuidePhotoStopStripProps = {
  stops: GuidePhotoStop[]
  selectedId: string | null
  counts: Record<string, number>
  onSelect: (id: string) => void
  missingLabel: string
  lowLabel: string
  variant?: 'camera' | 'sheet'
}

function statusClass(status: PhotoStopStatus, selected: boolean, variant: 'camera' | 'sheet') {
  if (variant === 'camera') {
    if (selected) return 'bg-[#FFB800] text-gray-900'
    if (status === 'missing') return 'bg-red-500/80 text-white'
    if (status === 'low') return 'bg-amber-500/80 text-white'
    return 'bg-white/15 text-white'
  }
  if (selected) return 'border-[#0B5FFF] bg-blue-50 text-gray-900'
  if (status === 'missing') return 'border-red-200 bg-red-50 text-red-800'
  if (status === 'low') return 'border-amber-200 bg-amber-50 text-amber-900'
  return 'border-emerald-200 bg-emerald-50 text-emerald-900'
}

export default function GuidePhotoStopStrip({
  stops,
  selectedId,
  counts,
  onSelect,
  missingLabel,
  lowLabel,
  variant = 'sheet',
}: GuidePhotoStopStripProps) {
  if (stops.length === 0) return null

  return (
    <div className={variant === 'camera' ? 'pointer-events-auto mb-3' : ''}>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {stops.map((stop) => {
          const count = counts[stop.id] || 0
          const status = photoStopStatus(count)
          const selected = selectedId === stop.id
          const note = status === 'missing' ? missingLabel : status === 'low' ? lowLabel : `${count}`
          return (
            <button
              key={stop.id}
              type="button"
              onClick={() => onSelect(stop.id)}
              aria-pressed={selected}
              className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium ${statusClass(status, selected, variant)}`}
            >
              {stop.label}
              <span className="ml-1 opacity-80">{note}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
