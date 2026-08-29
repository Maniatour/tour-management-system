'use client'

import { ChevronDown, ChevronUp } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface TourReportNumberStepperProps {
  id: string
  value: number | null
  onChange: (value: number | null) => void
  placeholder?: string
  min?: number
  max?: number
  className?: string
  increaseLabel?: string
  decreaseLabel?: string
}

export default function TourReportNumberStepper({
  id,
  value,
  onChange,
  placeholder,
  min = 0,
  max = 999,
  className,
  increaseLabel = 'Increase',
  decreaseLabel = 'Decrease',
}: TourReportNumberStepperProps) {
  const current = value ?? 0

  const bump = (delta: number) => {
    const next = Math.min(max, Math.max(min, current + delta))
    onChange(next)
  }

  return (
    <div className={cn('relative', className)}>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value ?? ''}
        onChange={(e) => {
          const raw = e.target.value
          if (raw === '') {
            onChange(null)
            return
          }
          const parsed = parseInt(raw, 10)
          if (Number.isNaN(parsed)) {
            onChange(null)
            return
          }
          onChange(Math.min(max, Math.max(min, parsed)))
        }}
        placeholder={placeholder}
        className="h-11 pr-12 md:h-10 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <div className="absolute inset-y-0.5 right-0.5 flex w-10 flex-col overflow-hidden rounded-md border border-border/70 bg-muted/40">
        <button
          type="button"
          aria-label={increaseLabel}
          onClick={() => bump(1)}
          className="flex h-1/2 items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ChevronUp className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label={decreaseLabel}
          onClick={() => bump(-1)}
          className="flex h-1/2 items-center justify-center border-t border-border/70 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
