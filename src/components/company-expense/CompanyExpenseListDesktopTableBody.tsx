'use client'

import React from 'react'
import { TableBody, TableCell, TableRow } from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Wrench } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { ExpenseStatementReconIcon } from '@/components/reconciliation/ExpenseStatementReconIcon'
import { Database } from '@/lib/database.types'
import { parseReimbursedAmount, reimbursementOutstanding } from '@/lib/expenseReimbursement'

type CompanyExpense = Database['public']['Tables']['company_expenses']['Row']
type TeamMember = Database['public']['Tables']['team']['Row']

type PaidForLabelRow = {
  id: string
  code: string
  label_ko: string
  label_en: string | null
  links_vehicle_maintenance?: boolean
  is_active?: boolean
}

function paidForLabelBadge(
  expense: CompanyExpense,
  labels: PaidForLabelRow[],
  locale: string,
  t: (key: string) => string
): React.ReactNode {
  const id = expense.paid_for_label_id
  if (!id || String(id).trim() === '') return null
  const lab = labels.find((l) => l.id === id)
  const text = lab
    ? locale === 'ko'
      ? lab.label_ko
      : lab.label_en || lab.label_ko
    : t('listInlineEdit.labelUnknown')
  return (
    <Badge
      variant="secondary"
      className={`mt-0.5 w-fit max-w-full truncate text-[10px] font-normal ${lab?.is_active === false ? 'opacity-70' : ''}`}
      title={lab?.code}
    >
      {text}
      {lab?.is_active === false ? ` ${t('listInlineEdit.labelInactiveSuffix')}` : ''}
    </Badge>
  )
}

type Props = {
  expenses: CompanyExpense[]
  handleEdit: (e: CompanyExpense) => void
  reconciledExpenseIds: Set<string>
  onOpenStatementRecon: (e: CompanyExpense) => void
  paymentMethodMap: Record<string, string>
  getCategoryLabel: (c: string) => string
  getStatusBadge: (s: string | null) => React.ReactNode
  hasUsableVehicleId: (id: string | null | undefined) => boolean
  getVehicleLineLabel: (id: string) => string
  openVehicleMaintenanceHistory: (id: string) => void
  renderEmployeeEmailCell: (e: CompanyExpense) => React.ReactNode
  teamMembers: Map<string, TeamMember>
  locale: string
  paidForLabels: PaidForLabelRow[]
  t: (key: string) => string
  selectedExpenseIds: Set<string>
  onToggleExpenseSelect: (id: string, selected: boolean) => void
  onOpenQuickStandard: (e: CompanyExpense) => void
  onOpenQuickPayment: (e: CompanyExpense) => void
  onOpenQuickVehicle: (e: CompanyExpense) => void
  formatCurrency: (amount: number) => string
}

const cellClickableCls =
  'cursor-pointer rounded-md px-1 -mx-1 py-0.5 transition-colors hover:bg-muted/80 hover:text-foreground underline-offset-2 hover:underline'

export function CompanyExpenseListDesktopTableBody({
  expenses,
  handleEdit,
  reconciledExpenseIds,
  onOpenStatementRecon,
  paymentMethodMap,
  getCategoryLabel,
  getStatusBadge,
  hasUsableVehicleId,
  getVehicleLineLabel,
  openVehicleMaintenanceHistory,
  renderEmployeeEmailCell,
  teamMembers,
  locale,
  paidForLabels,
  t,
  selectedExpenseIds,
  onToggleExpenseSelect,
  onOpenQuickStandard,
  onOpenQuickPayment,
  onOpenQuickVehicle,
  formatCurrency,
}: Props) {
  const tStmt = useTranslations('expenses.statementRecon')
  return (
    <TableBody>
      {expenses.map((expense) => (
        <TableRow key={expense.id} onClick={() => handleEdit(expense)} className="cursor-pointer hover:bg-gray-50">
          <TableCell className="w-10 text-center align-middle px-1 py-1" onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={selectedExpenseIds.has(expense.id)}
              onCheckedChange={(c) => onToggleExpenseSelect(expense.id, c === true)}
              aria-label={t('listBatchStandard.selectRowAria')}
              className="h-3.5 w-3.5"
            />
          </TableCell>
          <TableCell className="text-center px-0.5 py-1" onClick={(e) => e.stopPropagation()}>
            <span className="inline-flex scale-90 origin-center">
              <ExpenseStatementReconIcon
                matched={reconciledExpenseIds.has(expense.id)}
                titleMatched={tStmt('matchedTitle')}
                titleUnmatched={tStmt('unmatchedTitle')}
                onClick={() => onOpenStatementRecon(expense)}
              />
            </span>
          </TableCell>
          <TableCell className="min-w-0 px-1.5 py-1 text-[11px] tabular-nums whitespace-nowrap">
            {expense.submit_on ? new Date(expense.submit_on).toLocaleDateString() : '-'}
          </TableCell>
          <TableCell className="min-w-0 px-1.5 py-1">
            <span className="line-clamp-2 break-words text-[11px] leading-snug" title={expense.paid_to ?? undefined}>
              {expense.paid_to}
            </span>
          </TableCell>
          <TableCell className="min-w-0 px-1.5 py-1">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-[11px] leading-snug" title={expense.paid_for ?? undefined}>
                {expense.paid_for}
              </span>
              {paidForLabelBadge(expense, paidForLabels, locale, t)}
            </div>
          </TableCell>
          <TableCell className="min-w-0 px-1.5 py-1 align-top" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={`${cellClickableCls} w-full min-w-0 text-left`}
              title={t('listQuickEdit.openStandardHint')}
              onClick={() => onOpenQuickStandard(expense)}
            >
              {expense.standard_paid_for ? (
                <span className="line-clamp-2 text-[11px] leading-snug text-gray-800">{expense.standard_paid_for}</span>
              ) : (
                <span className="text-muted-foreground text-[11px]">{t('listQuickEdit.tapToSetStandard')}</span>
              )}
            </button>
          </TableCell>
          <TableCell className="min-w-0 px-1.5 py-1">
            <span className="line-clamp-2 text-[11px] leading-snug text-muted-foreground" title={expense.description || undefined}>
              {expense.description || '-'}
            </span>
          </TableCell>
          <TableCell className="min-w-0 px-1.5 py-1 text-right text-[11px] font-medium tabular-nums whitespace-nowrap">
            ${expense.amount ? parseFloat(expense.amount.toString()).toLocaleString() : '0'}
          </TableCell>
          <TableCell className="min-w-0 px-1.5 py-1 text-right text-[11px] tabular-nums whitespace-nowrap">
            {formatCurrency(parseReimbursedAmount(expense.reimbursed_amount))}
          </TableCell>
          <TableCell className="min-w-0 px-1.5 py-1 text-right text-[11px] tabular-nums whitespace-nowrap">
            {formatCurrency(
              reimbursementOutstanding(expense.amount ?? 0, expense.reimbursed_amount)
            )}
          </TableCell>
          <TableCell className="min-w-0 px-1.5 py-1" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={`${cellClickableCls} block w-full min-w-0 truncate text-left text-[11px]`}
              title={t('listQuickEdit.openPaymentHint')}
              onClick={() => onOpenQuickPayment(expense)}
            >
              {expense.payment_method
                ? paymentMethodMap[expense.payment_method] || expense.payment_method
                : t('listQuickEdit.tapToSetPayment')}
            </button>
          </TableCell>
          <TableCell className="min-w-0 px-1.5 py-1">
            {expense.category && (
              <Badge variant="outline" className="max-w-full truncate px-1 py-0 text-[10px] font-normal leading-tight">
                <span className="truncate">{getCategoryLabel(expense.category)}</span>
              </Badge>
            )}
          </TableCell>
          <TableCell className="min-w-0 px-1.5 py-1 align-top" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={`${cellClickableCls} line-clamp-2 w-full min-w-0 break-words text-left text-[11px]`}
              title={t('listQuickEdit.openVehicleHint')}
              onClick={() => onOpenQuickVehicle(expense)}
            >
              {hasUsableVehicleId(expense.vehicle_id) ? (
                <span title={getVehicleLineLabel(expense.vehicle_id!)}>{getVehicleLineLabel(expense.vehicle_id!)}</span>
              ) : (
                <span className="text-muted-foreground">{t('listQuickEdit.tapToSetVehicle')}</span>
              )}
            </button>
          </TableCell>
          <TableCell className="px-0.5 py-1 text-center" onClick={(e) => e.stopPropagation()}>
            {hasUsableVehicleId(expense.vehicle_id) ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => openVehicleMaintenanceHistory(expense.vehicle_id!)}
                title={`${t('vehicleMaintenanceHistory.openButton')} — ${getVehicleLineLabel(expense.vehicle_id!)}`}
              >
                <Wrench className="w-3.5 h-3.5" />
              </Button>
            ) : (
              <span className="text-muted-foreground text-[11px]">—</span>
            )}
          </TableCell>
          <TableCell className="min-w-0 px-1.5 py-1 align-middle">
            {getStatusBadge(expense.status || 'pending')}
          </TableCell>
          {renderEmployeeEmailCell(expense)}
          <TableCell className="min-w-0 px-1.5 py-1">
            <span className="line-clamp-2 text-[11px] leading-snug" title={expense.submit_by ?? undefined}>
              {(() => {
                if (!expense.submit_by) return '-'
                try {
                  const member = teamMembers.get(expense.submit_by.toLowerCase())
                  if (member) {
                    return locale === 'ko' ? member.name_ko : member.name_en || member.name_ko
                  }
                  return expense.submit_by
                } catch {
                  return expense.submit_by
                }
              })()}
            </span>
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  )
}
