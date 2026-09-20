'use client'

import { Button } from '@/components/ui/button'

export function MarketResearchFilterChips({
  allLabel,
  options,
  selected,
  onSelectAll,
  onToggle,
}: {
  allLabel: string
  options: Array<{ id: string; label: string; count?: number }>
  selected: string[]
  onSelectAll: () => void
  onToggle: (id: string) => void
}) {
  const allActive = selected.length === 0
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant={allActive ? 'default' : 'outline'}
        className="h-10 rounded-full"
        aria-pressed={allActive}
        onClick={onSelectAll}
      >
        {allLabel}
      </Button>
      {options.map((option) => {
        const active = !allActive && selected.includes(option.id)
        return (
          <Button
            key={option.id}
            variant={active ? 'default' : 'outline'}
            className="h-10 rounded-full"
            aria-pressed={active}
            onClick={() => onToggle(option.id)}
          >
            {option.label}
            {option.count ? <span className="ml-1.5 text-xs opacity-80">{option.count}</span> : null}
          </Button>
        )
      })}
    </div>
  )
}
