'use client'

import React from 'react'
import { TableBody, TableCell, TableRow } from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Wrench } from 'lucide-react'
import { StatementReconciledBadge } from '@/components/reconciliation/StatementReconciledBadge'
import { Database } from '@/lib/database.types'

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
}

const cellClickableCls =
  'cursor-pointer rounded-md px-1 -mx-1 py-0.5 transition-colors hover:bg-muted/80 hover:text-foreground underline-offset-2 hover:underline'

export function CompanyExpenseListDesktopTableBody({
  expenses,
  handleEdit,
  reconciledExpenseIds,
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
}: Props) {
  return (
    <TableBody>
      {expenses.map((expense) => (
        <TableRow key={expense.id} onClick={() => handleEdit(expense)} className="cursor-pointer hover:bg-gray-50">
          <TableCell className="py-2 w-10 text-center align-middle" onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={selectedExpenseIds.has(expense.id)}
              onCheckedChange={(c) => onToggleExpenseSelect(expense.id, c === true)}
              aria-label={t('listBatchStandard.selectRowAria')}
            />
          </TableCell>
          <TableCell className="py-2 text-center" onClick={(e) => e.stopPropagation()}>
            <StatementReconciledBadge matched={reconciledExpenseIds.has(expense.id)} />
          </TableCell>
          <TableCell className="py-2">
            {expense.submit_on ? new Date(expense.submit_on).toLocaleDateString() : '-'}
          </TableCell>
          <TableCell className="py-2">{expense.paid_to}</TableCell>
          <TableCell className="max-w-[11rem] py-2">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-sm" title={expense.paid_for ?? undefined}>
                {expense.paid_for}
              </span>
              {paidForLabelBadge(expense, paidForLabels, locale, t)}
            </div>
          </TableCell>
          <TableCell className="max-w-[10rem] py-2 text-sm align-top" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={`${cellClickableCls} w-full text-left`}
              title={t('listQuickEdit.openStandardHint')}
              onClick={() => onOpenQuickStandard(expense)}
            >
              {expense.standard_paid_for ? (
                <span className="line-clamp-3 text-gray-800">{expense.standard_paid_for}</span>
              ) : (
                <span className="text-muted-foreground">{t('listQuickEdit.tapToSetStandard')}</span>
              )}
            </button>
          </TableCell>
          <TableCell className="max-w-xs truncate py-2">{expense.description || '-'}</TableCell>
          <TableCell className="font-medium py-2">
            ${expense.amount ? parseFloat(expense.amount.toString()).toLocaleString() : '0'}
          </TableCell>
          <TableCell className="py-2" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={`${cellClickableCls} max-w-full truncate text-left text-sm`}
              title={t('listQuickEdit.openPaymentHint')}
              onClick={() => onOpenQuickPayment(expense)}
            >
              {expense.payment_method
                ? paymentMethodMap[expense.payment_method] || expense.payment_method
                : t('listQuickEdit.tapToSetPayment')}
            </button>
          </TableCell>
          <TableCell className="w-32 py-2">
            {expense.category && <Badge variant="outline">{getCategoryLabel(expense.category)}</Badge>}
          </TableCell>
          <TableCell
            className="max-w-[12rem] py-2 text-xs text-gray-800 align-top"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className={`${cellClickableCls} line-clamp-2 w-full break-words text-left`}
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
          <TableCell className="w-12 py-2 text-center" onClick={(e) => e.stopPropagation()}>
            {hasUsableVehicleId(expense.vehicle_id) ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => openVehicleMaintenanceHistory(expense.vehicle_id!)}
                title={`${t('vehicleMaintenanceHistory.openButton')} — ${getVehicleLineLabel(expense.vehicle_id!)}`}
              >
                <Wrench className="w-4 h-4" />
              </Button>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </TableCell>
          <TableCell className="w-28 py-2">{getStatusBadge(expense.status || 'pending')}</TableCell>
          {renderEmployeeEmailCell(expense)}
          <TableCell className="py-2">
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
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  )
}
