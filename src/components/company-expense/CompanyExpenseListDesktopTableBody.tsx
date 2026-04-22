'use client'

import React, { useMemo } from 'react'
import { TableBody, TableCell, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Pencil, Check, X, Wrench } from 'lucide-react'
import { StatementReconciledBadge } from '@/components/reconciliation/StatementReconciledBadge'
import { PaymentMethodAutocomplete } from '@/components/expense/PaymentMethodAutocomplete'
import { Database } from '@/lib/database.types'
import { CompanyExpenseInlineListDraft } from './companyExpenseListInlineTypes'
import type { ExpenseStandardCategoryPickRow } from '@/lib/expenseStandardCategoryPaidFor'
import {
  applyStandardLeafToCompanyExpense,
  matchUnifiedLeafIdFromForm,
  type UnifiedStandardLeafGroup,
} from '@/lib/companyExpenseStandardUnified'

type CompanyExpense = Database['public']['Tables']['company_expenses']['Row']
type TeamMember = Database['public']['Tables']['team']['Row']

const STATUS_VALUES = ['pending', 'approved', 'rejected', 'paid'] as const

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
  listTableEditMode: boolean
  inlineEditingId: string | null
  inlineDraft: CompanyExpenseInlineListDraft | null
  setInlineDraft: React.Dispatch<React.SetStateAction<CompanyExpenseInlineListDraft | null>>
  inlineSaving: boolean
  onSaveInline: () => void
  onCancelInline: () => void
  onStartInline: (e: CompanyExpense) => void
  handleEdit: (e: CompanyExpense) => void
  /** tailwind: h-8 text-xs w-full... */
  inputCls: string
  reconciledExpenseIds: Set<string>
  paymentMethodMap: Record<string, string>
  paymentMethodOptions: { id: string; name: string }[]
  getCategoryLabel: (c: string) => string
  categorySelectOptions: { value: string; label: string }[]
  expenseTypeSelectOptions: { value: string; label: string }[]
  getStatusBadge: (s: string | null) => React.ReactNode
  hasUsableVehicleId: (id: string | null | undefined) => boolean
  getVehicleLineLabel: (id: string) => string
  openVehicleMaintenanceHistory: (id: string) => void
  renderEmployeeEmailCell: (e: CompanyExpense) => React.ReactNode
  vehicles: Database['public']['Tables']['vehicles']['Row'][]
  teamMembers: Map<string, TeamMember>
  locale: string
  paidForLabels: PaidForLabelRow[]
  unifiedStandardGroups: UnifiedStandardLeafGroup[]
  expenseStandardCategories: ExpenseStandardCategoryPickRow[]
  t: (key: string) => string
}

export function CompanyExpenseListDesktopTableBody({
  expenses,
  listTableEditMode,
  inlineEditingId,
  inlineDraft,
  setInlineDraft,
  inlineSaving,
  onSaveInline,
  onCancelInline,
  onStartInline,
  handleEdit,
  inputCls,
  reconciledExpenseIds,
  paymentMethodMap,
  paymentMethodOptions,
  getCategoryLabel,
  categorySelectOptions,
  expenseTypeSelectOptions,
  getStatusBadge,
  hasUsableVehicleId,
  getVehicleLineLabel,
  openVehicleMaintenanceHistory,
  renderEmployeeEmailCell,
  vehicles,
  teamMembers,
  locale,
  paidForLabels,
  unifiedStandardGroups,
  expenseStandardCategories,
  t,
}: Props) {
  const activePaidForLabels = useMemo(
    () => paidForLabels.filter((l) => l.is_active !== false),
    [paidForLabels]
  )

  return (
    <TableBody>
      {expenses.map((expense) => {
        const isEditing = Boolean(
          listTableEditMode && inlineEditingId === expense.id && inlineDraft
        )
        if (isEditing && inlineDraft) {
          const d = inlineDraft
          return (
            <TableRow key={expense.id} className="align-top border-amber-200/50 bg-amber-50/25">
              <TableCell className="py-2 text-center" onClick={(e) => e.stopPropagation()}>
                <StatementReconciledBadge matched={reconciledExpenseIds.has(expense.id)} />
              </TableCell>
              <TableCell className="py-2 w-[9rem]">
                <input
                  type="date"
                  className={inputCls}
                  value={d.submit_on}
                  onChange={(e) => setInlineDraft({ ...d, submit_on: e.target.value })}
                />
              </TableCell>
              <TableCell className="py-2 min-w-[5.5rem] max-w-[8rem]">
                <input
                  className={inputCls}
                  value={d.paid_to}
                  onChange={(e) => setInlineDraft({ ...d, paid_to: e.target.value })}
                />
              </TableCell>
              <TableCell className="py-2 min-w-[7rem] max-w-[11rem]">
                <div className="space-y-1 min-w-0">
                  {unifiedStandardGroups.length > 0 && (
                    <select
                      className={inputCls}
                      title={t('form.unifiedStandardClassification')}
                      value={(() => {
                        const matched = matchUnifiedLeafIdFromForm(
                          d.paid_for,
                          d.category,
                          d.expense_type,
                          expenseStandardCategories,
                          locale
                        )
                        return matched === '__custom__' ? '' : `std:${matched}`
                      })()}
                      onChange={(e) => {
                        const v = e.target.value
                        setInlineDraft((prev) => {
                          if (!prev) return prev
                          if (!v) return { ...prev, paid_for_label_id: '' }
                          const id = v.startsWith('std:') ? v.slice(4) : ''
                          const byId = new Map(expenseStandardCategories.map((c) => [c.id, c]))
                          const applied = applyStandardLeafToCompanyExpense(id, byId)
                          if (!applied) return prev
                          return {
                            ...prev,
                            paid_for: applied.paid_for,
                            category: applied.category,
                            expense_type: applied.expense_type,
                            paid_for_label_id: '',
                          }
                        })
                      }}
                    >
                      <option value="">{t('form.paidForStandardCategoryManual')}</option>
                      {unifiedStandardGroups.map((g) => (
                        <optgroup key={g.rootId} label={g.groupLabel}>
                          {g.items.map((it) => (
                            <option key={it.id} value={`std:${it.id}`}>
                              {it.displayLabel}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  )}
                  <input
                    className={inputCls}
                    value={d.paid_for}
                    onChange={(e) =>
                      setInlineDraft({ ...d, paid_for: e.target.value, paid_for_label_id: '' })
                    }
                  />
                  <select
                    className={inputCls}
                    value={d.paid_for_label_id || ''}
                    onChange={(e) => {
                      const v = e.target.value
                      setInlineDraft((prev) => {
                        if (!prev) return prev
                        if (!v) return { ...prev, paid_for_label_id: '' }
                        const lab = activePaidForLabels.find((l) => l.id === v)
                        return {
                          ...prev,
                          paid_for_label_id: v,
                          paid_for: lab?.label_ko ?? prev.paid_for,
                        }
                      })
                    }}
                  >
                    <option value="">{t('listInlineEdit.standardLabelNoneOption')}</option>
                    {activePaidForLabels.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.label_ko}
                      </option>
                    ))}
                  </select>
                </div>
              </TableCell>
              <TableCell className="py-2 min-w-[5.5rem] max-w-[9rem]">
                <input
                  className={inputCls}
                  value={d.description}
                  onChange={(e) => setInlineDraft({ ...d, description: e.target.value })}
                />
              </TableCell>
              <TableCell className="py-2 w-24">
                <input
                  type="number"
                  step="0.01"
                  className={inputCls + ' text-right tabular-nums'}
                  value={d.amount}
                  onChange={(e) => setInlineDraft({ ...d, amount: e.target.value })}
                />
              </TableCell>
              <TableCell className="py-2 min-w-[8rem] max-w-[14rem]">
                <PaymentMethodAutocomplete
                  options={paymentMethodOptions}
                  valueId={d.payment_method}
                  onChange={(id) => setInlineDraft({ ...d, payment_method: id })}
                  disabled={inlineSaving}
                  pleaseSelectLabel={t('form.selectPaymentMethodPlaceholder')}
                  className={inputCls}
                />
              </TableCell>
              <TableCell className="w-36 py-2">
                <div className="flex flex-col gap-1 min-w-0">
                  <select
                    className={inputCls}
                    value={d.category}
                    onChange={(e) => setInlineDraft({ ...d, category: e.target.value })}
                  >
                    <option value="">{t('listInlineEdit.categoryEmpty')}</option>
                    {categorySelectOptions.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <select
                    className={inputCls}
                    value={d.expense_type}
                    onChange={(e) => setInlineDraft({ ...d, expense_type: e.target.value })}
                  >
                    <option value="">{t('listInlineEdit.expenseTypeEmpty')}</option>
                    {expenseTypeSelectOptions.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </TableCell>
              <TableCell className="max-w-[12rem] py-2">
                <select
                  className={inputCls}
                  value={d.vehicle_id}
                  onChange={(e) => setInlineDraft({ ...d, vehicle_id: e.target.value })}
                >
                  <option value="none">{t('listInlineEdit.noVehicle')}</option>
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {`${vehicle.vehicle_number || vehicle.vehicle_type || 'Unknown'} (${vehicle.vehicle_category || 'N/A'})`}
                    </option>
                  ))}
                </select>
              </TableCell>
              <TableCell className="w-12 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                {hasUsableVehicleId(d.vehicle_id) ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => openVehicleMaintenanceHistory(d.vehicle_id)}
                    title={`${t('vehicleMaintenanceHistory.openButton')} — ${getVehicleLineLabel(d.vehicle_id)}`}
                  >
                    <Wrench className="w-4 h-4" />
                  </Button>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="w-28 py-2">
                <select
                  className={inputCls}
                  value={d.status}
                  onChange={(e) => setInlineDraft({ ...d, status: e.target.value })}
                >
                  {STATUS_VALUES.map((s) => (
                    <option key={s} value={s}>
                      {t(`status.${s}`)}
                    </option>
                  ))}
                </select>
              </TableCell>
              {renderEmployeeEmailCell(expense)}
              <TableCell className="py-2 min-w-[6rem]">
                <input
                  type="text"
                  className={inputCls}
                  value={d.submit_by}
                  onChange={(e) => setInlineDraft({ ...d, submit_by: e.target.value })}
                  autoComplete="off"
                />
              </TableCell>
              <TableCell className="py-2 w-[6.5rem] text-right" onClick={(e) => e.stopPropagation()}>
                <div className="flex flex-col gap-1 items-stretch min-w-0">
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 w-full"
                    onClick={onSaveInline}
                    disabled={inlineSaving}
                  >
                    <Check className="h-3.5 w-3.5 sm:mr-1" />
                    {inlineSaving ? t('listInlineEdit.saving') : t('buttons.save')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 w-full"
                    onClick={onCancelInline}
                    disabled={inlineSaving}
                  >
                    <X className="h-3.5 w-3.5 sm:mr-1" />
                    {t('buttons.cancel')}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          )
        }
        return (
          <TableRow
            key={expense.id}
            onClick={!listTableEditMode ? () => handleEdit(expense) : undefined}
            className={!listTableEditMode ? 'cursor-pointer hover:bg-gray-50' : 'hover:bg-gray-50/50'}
          >
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
            <TableCell className="max-w-xs truncate py-2">{expense.description || '-'}</TableCell>
            <TableCell className="font-medium py-2">
              ${expense.amount ? parseFloat(expense.amount.toString()).toLocaleString() : '0'}
            </TableCell>
            <TableCell className="py-2">
              {expense.payment_method
                ? paymentMethodMap[expense.payment_method] || expense.payment_method
                : '-'}
            </TableCell>
            <TableCell className="w-32 py-2">
              {expense.category && <Badge variant="outline">{getCategoryLabel(expense.category)}</Badge>}
            </TableCell>
            <TableCell
              className="max-w-[12rem] py-2 text-xs text-gray-800 align-top"
              title={
                hasUsableVehicleId(expense.vehicle_id)
                  ? getVehicleLineLabel(expense.vehicle_id!)
                  : undefined
              }
            >
              {hasUsableVehicleId(expense.vehicle_id) ? (
                <span className="line-clamp-2 break-words">
                  {getVehicleLineLabel(expense.vehicle_id!)}
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
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
            {listTableEditMode && (
              <TableCell className="py-2 w-[6.5rem] text-right" onClick={(e) => e.stopPropagation()}>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 w-full"
                  onClick={() => onStartInline(expense)}
                  disabled={inlineEditingId != null && inlineEditingId !== expense.id}
                >
                  <Pencil className="h-3.5 w-3.5 sm:mr-1" />
                  <span className="hidden sm:inline">{t('listInlineEdit.pencil')}</span>
                </Button>
              </TableCell>
            )}
          </TableRow>
        )
      })}
    </TableBody>
  )
}
