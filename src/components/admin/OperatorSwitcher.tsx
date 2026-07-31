'use client'

import { Building2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { useOperatorOptional } from '@/contexts/OperatorContext'
import { KOVEgAS_OPERATOR_ID } from '@/lib/operatorConstants'
import { shortOperatorDisplayName } from '@/lib/operatorDisplayName'

/** Compact tenant switcher for admin header (multi-membership). */
export default function OperatorSwitcher() {
  const t = useTranslations('adminOperators')
  const { operatorId, availableOperators, setActiveOperatorId, loading } =
    useOperatorOptional()

  const options =
    availableOperators.length > 0
      ? availableOperators
      : [
          {
            operatorId: KOVEgAS_OPERATOR_ID,
            name: 'Kovegas',
            slug: 'kovegas',
            role: 'admin' as const,
            status: 'active' as const,
          },
        ]

  const activeOption =
    options.find((op) => op.operatorId === operatorId) ?? options[0]

  if (options.length <= 1) {
    const fullName = activeOption?.name || 'Kovegas'
    const shortName = shortOperatorDisplayName(fullName, activeOption?.slug)

    return (
      <div
        className="hidden items-center gap-1.5 rounded-lg border border-border/60 bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground lg:flex"
        title={fullName}
      >
        <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="font-medium text-foreground">{shortName}</span>
      </div>
    )
  }

  const activeFullName = activeOption?.name || t('switcherLabel')
  const activeShortName = shortOperatorDisplayName(
    activeFullName,
    activeOption?.slug
  )

  return (
    <div className="hidden items-center gap-2 lg:flex">
      <Building2 className="h-4 w-4 text-muted-foreground" aria-hidden />
      <Select
        value={operatorId}
        disabled={loading}
        onValueChange={(id) => {
          void setActiveOperatorId(id)
        }}
      >
        <SelectTrigger
          aria-label={`${t('switcherLabel')}: ${activeFullName}`}
          title={activeFullName}
          className="h-9 w-auto min-w-[5.5rem] rounded-lg border-border/60 px-2.5 text-xs"
        >
          <span className="truncate font-medium">{activeShortName}</span>
        </SelectTrigger>
        <SelectContent>
          {options.map((op) => (
            <SelectItem key={op.operatorId} value={op.operatorId}>
              {op.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
