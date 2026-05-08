'use client'

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SortDir } from '@/lib/clientTableSort'

type Props = {
  label: React.ReactNode
  active: boolean
  dir: SortDir
  onClick: () => void
  className?: string
}

export default function TableSortHeaderButton({ label, active, dir, onClick, className }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 max-w-full text-left font-medium text-gray-500 hover:text-gray-800',
        className
      )}
    >
      <span className="truncate">{label}</span>
      {active ? (
        dir === 'asc' ? (
          <ArrowUp className="w-3.5 h-3.5 shrink-0 text-gray-700" aria-hidden />
        ) : (
          <ArrowDown className="w-3.5 h-3.5 shrink-0 text-gray-700" aria-hidden />
        )
      ) : (
        <ArrowUpDown className="w-3.5 h-3.5 shrink-0 text-gray-300" aria-hidden />
      )}
    </button>
  )
}
