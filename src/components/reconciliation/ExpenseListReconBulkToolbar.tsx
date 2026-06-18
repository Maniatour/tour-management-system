'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import ExpenseReconciliationBulkExemptActions from '@/components/reconciliation/ExpenseReconciliationBulkExemptActions'
import type { ExpenseReconSourceTable } from '@/lib/expense-reconciliation-similar-lines'

export default function ExpenseListReconBulkToolbar({
  sourceTable,
  selectedIds,
  pageIds,
  onToggleSelectAllPage,
  onClearSelection,
  onExemptApplied,
  disabled,
}: {
  sourceTable: ExpenseReconSourceTable
  selectedIds: ReadonlySet<string>
  pageIds: string[]
  onToggleSelectAllPage: () => void
  onClearSelection: () => void
  onExemptApplied?: () => void
  disabled?: boolean
}) {
  const tBatch = useTranslations('expenses.statementRecon.reconExempt.bulk')
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id))

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-gray-200/80 bg-gray-50/50 p-2 sm:p-3 sm:flex-row sm:flex-wrap sm:items-center">
      <span className="text-xs text-muted-foreground">
        {tBatch('selectedCount', { count: selectedIds.size })}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onToggleSelectAllPage}
        disabled={disabled || pageIds.length === 0}
      >
        {allPageSelected ? tBatch('deselectPage') : tBatch('selectPage')}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onClearSelection}
        disabled={disabled || selectedIds.size === 0}
      >
        {tBatch('clearSelection')}
      </Button>
      <ExpenseReconciliationBulkExemptActions
        sourceTable={sourceTable}
        selectedIds={selectedIds}
        {...(disabled !== undefined ? { disabled } : {})}
        {...(onExemptApplied ? { onApplied: onExemptApplied } : {})}
      />
    </div>
  )
}
