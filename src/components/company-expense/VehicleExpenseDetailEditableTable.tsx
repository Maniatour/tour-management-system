'use client'

import React, { useCallback, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Pencil, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { PaymentMethodAutocomplete } from '@/components/expense/PaymentMethodAutocomplete'
import { usePaymentMethodOptions } from '@/hooks/usePaymentMethodOptions'
import { Database } from '@/lib/database.types'

type CompanyExpenseRow = Database['public']['Tables']['company_expenses']['Row']

function ymdFromLocalDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function ymdFromSubmitOnIso(iso: string | null | undefined): string {
  if (!iso) return ymdFromLocalDate(new Date())
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ymdFromLocalDate(new Date())
  return ymdFromLocalDate(d)
}

function submitOnIsoFromYmd(ymd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    return `${ymdFromLocalDate(new Date())}T12:00:00.000Z`
  }
  return `${ymd}T12:00:00.000Z`
}

type Draft = {
  submit_on: string
  paid_to: string
  paid_for: string
  description: string
  notes: string
  amount: string
  payment_method: string
  category: string
  subcategory: string
  expense_type: string
  tax_deductible: boolean
  photo_url: string
  maintenance_type: string
  submit_by: string
}

function rowToDraft(r: CompanyExpenseRow): Draft {
  return {
    submit_on: ymdFromSubmitOnIso(r.submit_on),
    paid_to: r.paid_to ?? '',
    paid_for: r.paid_for ?? '',
    description: r.description ?? '',
    notes: r.notes ?? '',
    amount: r.amount != null && r.amount !== '' ? String(r.amount) : '',
    payment_method: r.payment_method?.trim() ?? '',
    category: r.category ?? '',
    subcategory: r.subcategory ?? '',
    expense_type: r.expense_type ?? '',
    tax_deductible: r.tax_deductible !== false,
    photo_url: r.photo_url ?? '',
    maintenance_type: r.maintenance_type ?? '',
    submit_by: r.submit_by?.trim() ?? ''
  }
}

const formatMoney = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)

type Props = {
  vehicleId: string
  rows: CompanyExpenseRow[]
  setRows: React.Dispatch<React.SetStateAction<CompanyExpenseRow[]>>
  onAfterSave?: () => void
  vehicleMileage?: {
    odometerStart: number | null
    odometerEnd: number | null
  }
}

export function VehicleExpenseDetailEditableTable({
  vehicleId,
  rows,
  setRows,
  onAfterSave,
  vehicleMileage
}: Props) {
  const t = useTranslations('companyExpense.vehicleRepairReport')
  const tForm = useTranslations('companyExpense.form')
  const { user } = useAuth()
  const { paymentMethodOptions, paymentMethodMap } = usePaymentMethodOptions()
  let locale = 'ko'
  try {
    locale = useLocale()
  } catch {
    // ignore
  }

  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)

  const startEdit = useCallback((r: CompanyExpenseRow) => {
    setEditingId(r.id)
    setDraft(rowToDraft(r))
  }, [])

  const cancelEdit = useCallback(() => {
    setEditingId(null)
    setDraft(null)
  }, [])

  const updateRow = useCallback((id: string, next: CompanyExpenseRow) => {
    setRows((prev) => prev.map((r) => (r.id === id ? next : r)))
  }, [setRows])

  const save = useCallback(async () => {
    if (!editingId || !draft) return
    const pm = draft.payment_method?.trim() ?? ''
    if (!draft.paid_to?.trim() || !draft.paid_for?.trim() || !draft.amount?.trim() || !pm) {
      toast.error(t('saveError'))
      return
    }
    const submitBy = draft.submit_by?.trim() || user?.email || ''
    if (!submitBy) {
      toast.error(t('saveError'))
      return
    }
    setSaving(true)
    try {
      const amount = parseFloat(draft.amount)
      if (Number.isNaN(amount)) {
        toast.error(t('saveError'))
        return
      }
      const res = await fetch(`/api/company-expenses/${encodeURIComponent(editingId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paid_to: draft.paid_to.trim(),
          paid_for: draft.paid_for.trim(),
          description: draft.description || null,
          amount,
          payment_method: pm,
          submit_by: submitBy,
          submit_on: submitOnIsoFromYmd(draft.submit_on),
          photo_url: draft.photo_url || null,
          category: draft.category || null,
          subcategory: draft.subcategory || null,
          vehicle_id: vehicleId,
          maintenance_type: draft.maintenance_type || null,
          notes: draft.notes || null,
          attachments: rows.find((r) => r.id === editingId)?.attachments ?? null,
          expense_type: draft.expense_type || null,
          tax_deductible: draft.tax_deductible,
          paid_for_label_id: rows.find((r) => r.id === editingId)?.paid_for_label_id ?? null
        })
      })
      const json = (await res.json()) as { data?: CompanyExpenseRow; error?: string }
      if (!res.ok) {
        toast.error(json.error || t('saveError'))
        return
      }
      if (json.data) {
        updateRow(editingId, json.data)
      }
      toast.success(t('saveSuccess'))
      cancelEdit()
      onAfterSave?.()
    } catch {
      toast.error(t('saveError'))
    } finally {
      setSaving(false)
    }
  }, [cancelEdit, draft, editingId, onAfterSave, rows, t, updateRow, user?.email, vehicleId])

  const paymentName = useCallback(
    (id: string | null | undefined) => {
      if (!id) return '—'
      return paymentMethodMap[id] || id
    },
    [paymentMethodMap]
  )

  const inputCls =
    'h-8 text-xs w-full min-w-0 sm:h-8 sm:text-sm border border-input rounded-md bg-background px-2 py-1'

  if (rows.length === 0) {
    return null
  }

  return (
    <div className="overflow-x-auto rounded-md border w-full -mx-0">
      <Table className="w-full min-w-[1060px] table-fixed sm:min-w-[1240px]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-28 sm:w-32 font-medium text-xs sm:text-sm">{t('detailDate')}</TableHead>
            <TableHead className="w-[7.5rem] sm:w-32 font-medium text-xs sm:text-sm">{t('labelPaidTo')}</TableHead>
            <TableHead className="w-[7.5rem] sm:w-36 font-medium text-xs sm:text-sm">{t('labelPaidFor')}</TableHead>
            <TableHead className="w-[7.5rem] sm:w-36 font-medium text-xs sm:text-sm">{t('labelStandardPaidFor')}</TableHead>
            <TableHead className="w-[7rem] sm:w-32 font-medium text-xs sm:text-sm whitespace-nowrap">{t('colVehicleMileage')}</TableHead>
            <TableHead className="w-[20%] min-w-[7rem] font-medium text-xs sm:text-sm">{t('labelDescription')}</TableHead>
            <TableHead className="w-[16%] min-w-[5rem] font-medium text-xs sm:text-sm">{t('labelNotes')}</TableHead>
            <TableHead className="w-20 sm:w-24 text-right font-medium text-xs sm:text-sm whitespace-nowrap">
              {t('detailAmount')}
            </TableHead>
            <TableHead className="w-32 sm:w-40 font-medium text-xs sm:text-sm">{t('colPaymentMethod')}</TableHead>
            <TableHead className="w-28 sm:w-32 text-right pr-1 font-medium text-xs sm:text-sm whitespace-nowrap">
              {t('colActions')}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const isEdit = editingId === r.id && draft != null
            if (isEdit && draft) {
              return (
                <TableRow key={r.id} className="align-top">
                  <TableCell>
                    <Input
                      className={inputCls}
                      type="date"
                      value={draft.submit_on}
                      onChange={(e) => setDraft({ ...draft, submit_on: e.target.value })}
                    />
                  </TableCell>
                  <TableCell>
                    <Textarea
                      className="min-h-[2.5rem] text-xs sm:text-sm"
                      value={draft.paid_to}
                      onChange={(e) => setDraft({ ...draft, paid_to: e.target.value })}
                      rows={2}
                    />
                  </TableCell>
                  <TableCell>
                    <Textarea
                      className="min-h-[2.5rem] text-xs sm:text-sm"
                      value={draft.paid_for}
                      onChange={(e) => setDraft({ ...draft, paid_for: e.target.value })}
                      rows={2}
                    />
                  </TableCell>
                  <TableCell className="text-xs sm:text-sm text-muted-foreground break-words max-w-0">
                    <p className="line-clamp-3" title={r.standard_paid_for || undefined}>
                      {r.standard_paid_for || '—'}
                    </p>
                  </TableCell>
                  <TableCell className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
                    {vehicleMileage?.odometerEnd != null
                      ? t('mileageKm', { n: Math.round(vehicleMileage.odometerEnd).toLocaleString() })
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <Textarea
                      className="min-h-[3rem] text-xs sm:text-sm max-h-40"
                      value={draft.description}
                      onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                      rows={3}
                    />
                  </TableCell>
                  <TableCell>
                    <Textarea
                      className="min-h-[2.5rem] text-xs sm:text-sm max-h-40"
                      value={draft.notes}
                      onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                      rows={2}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      className={inputCls + ' text-right tabular-nums'}
                      type="number"
                      step="0.01"
                      value={draft.amount}
                      onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
                    />
                  </TableCell>
                  <TableCell>
                    <PaymentMethodAutocomplete
                      options={paymentMethodOptions}
                      valueId={draft.payment_method}
                      onChange={(id) => setDraft({ ...draft, payment_method: id })}
                      disabled={saving}
                      pleaseSelectLabel={tForm('selectPaymentMethodPlaceholder')}
                      className={inputCls}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-col gap-1 items-end sm:flex-row sm:justify-end sm:items-center">
                      <Button type="button" size="sm" className="h-8" onClick={save} disabled={saving}>
                        <Check className="h-3.5 w-3.5 sm:mr-1" />
                        <span className="hidden sm:inline">{saving ? t('saving') : t('saveAction')}</span>
                      </Button>
                      <Button type="button" size="sm" variant="ghost" className="h-8" onClick={cancelEdit} disabled={saving}>
                        <X className="h-3.5 w-3.5 sm:mr-1" />
                        <span className="hidden sm:inline">{t('cancelAction')}</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            }
            return (
              <TableRow key={r.id} className="align-top group">
                <TableCell className="whitespace-nowrap text-xs sm:text-sm text-muted-foreground">
                  {r.submit_on
                    ? new Date(r.submit_on).toLocaleDateString(locale, {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit'
                      })
                    : '—'}
                </TableCell>
                <TableCell className="text-xs sm:text-sm break-words max-w-0">
                  <p className="line-clamp-3" title={r.paid_to || undefined}>
                    {r.paid_to || '—'}
                  </p>
                </TableCell>
                <TableCell className="text-xs sm:text-sm break-words max-w-0">
                  <p className="line-clamp-3" title={r.paid_for || undefined}>
                    {r.paid_for || '—'}
                  </p>
                </TableCell>
                <TableCell className="text-xs sm:text-sm break-words max-w-0">
                  <p className="line-clamp-3" title={r.standard_paid_for || undefined}>
                    {r.standard_paid_for || '—'}
                  </p>
                </TableCell>
                <TableCell className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
                  {vehicleMileage?.odometerEnd != null
                    ? t('mileageKm', { n: Math.round(vehicleMileage.odometerEnd).toLocaleString() })
                    : '—'}
                </TableCell>
                <TableCell className="text-xs sm:text-sm break-words max-w-0">
                  <p className="line-clamp-4 whitespace-pre-wrap" title={r.description || undefined}>
                    {r.description || '—'}
                  </p>
                </TableCell>
                <TableCell className="text-xs sm:text-sm break-words max-w-0">
                  <p className="line-clamp-3 whitespace-pre-wrap" title={r.notes || undefined}>
                    {r.notes || '—'}
                  </p>
                </TableCell>
                <TableCell className="text-right tabular-nums text-xs sm:text-sm font-medium">
                  {r.amount != null ? formatMoney(Number(r.amount)) : '—'}
                </TableCell>
                <TableCell className="text-xs sm:text-sm break-words" title={paymentName(r.payment_method)}>
                  {paymentName(r.payment_method)}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={() => startEdit(r)}
                    disabled={editingId != null && editingId !== r.id}
                  >
                    <Pencil className="h-3.5 w-3.5 sm:mr-1" />
                    <span className="hidden sm:inline">{t('editAction')}</span>
                  </Button>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
