'use client'

import { Plus, Trash2 } from 'lucide-react'
import {
  addDirectionStep,
  removeDirectionStep,
  updateDirectionStep,
} from '@/lib/pickupHotelDirectionSteps'

interface PickupHotelDirectionStepsEditorProps {
  steps: string[]
  onChange: (steps: string[]) => void
  accent?: 'blue' | 'green'
  addLabel?: string
  placeholder?: string
}

export default function PickupHotelDirectionStepsEditor({
  steps,
  onChange,
  accent = 'blue',
  addLabel = '+ 단계 추가',
  placeholder = '단계를 입력하세요',
}: PickupHotelDirectionStepsEditorProps) {
  const numberBg = accent === 'green' ? 'bg-emerald-500' : 'bg-blue-500'
  const focusRing = accent === 'green' ? 'focus:ring-emerald-500' : 'focus:ring-blue-500'

  const list = steps.length > 0 ? steps : ['']

  return (
    <div className="space-y-1.5">
      {list.map((step, index) => (
        <div
          key={index}
          className="flex items-start gap-1.5 rounded-lg border border-border/60 bg-white px-2 py-1.5 shadow-sm"
        >
          <span
            className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white ${numberBg}`}
          >
            {index + 1}
          </span>
          <textarea
            value={step}
            onChange={(e) => {
              const next = updateDirectionStep(list, index, e.target.value)
              onChange(next)
            }}
            rows={1}
            className={`min-h-[1.75rem] flex-1 resize-y rounded-md border-0 bg-transparent px-1 py-0.5 text-sm leading-5 text-foreground focus:outline-none focus:ring-2 ${focusRing}`}
            placeholder={placeholder}
          />
          <button
            type="button"
            onClick={() => {
              if (list.length <= 1) {
                onChange([''])
                return
              }
              onChange(removeDirectionStep(list, index))
            }}
            className="mt-0.5 rounded-md p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600"
            aria-label="단계 삭제"
          >
            <Trash2 size={12} />
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => onChange(addDirectionStep(steps))}
        className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-border bg-muted/20 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/40 hover:text-foreground"
      >
        <Plus size={14} />
        {addLabel}
      </button>
    </div>
  )
}
