'use client'

import { cn } from '@/lib/utils'

export function MarketResearchToggleChips({
  options,
  selected,
  onChange,
  multiple = false,
}: {
  options: Array<{ id: string; label: string }>
  selected: string[]
  onChange: (next: string[]) => void
  multiple?: boolean
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = selected.includes(option.id)
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={active}
            className={cn(
              'h-11 min-w-11 rounded-xl border px-4 text-sm font-medium transition duration-300',
              active
                ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                : 'border-border/60 bg-background text-foreground hover:border-primary/40 hover:bg-muted/40'
            )}
            onClick={() => {
              if (multiple) {
                onChange(
                  active ? selected.filter((id) => id !== option.id) : [...selected, option.id]
                )
                return
              }
              onChange([option.id])
            }}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
