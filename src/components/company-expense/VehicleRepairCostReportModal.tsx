'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { BarChart3 } from 'lucide-react'
import type { VehicleRepairReportItem, VehicleRepairReportResponse } from '@/lib/vehicle-repair-report'
import { Database } from '@/lib/database.types'
import { VehicleExpenseDetailEditableTable } from '@/components/company-expense/VehicleExpenseDetailEditableTable'

const formatMoney = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)

type CompanyExpenseRow = Database['public']['Tables']['company_expenses']['Row']

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function VehicleRepairCostReportModal({ open, onOpenChange }: Props) {
  const t = useTranslations('companyExpense.vehicleRepairReport')
  let locale = 'ko'
  try {
    locale = useLocale()
  } catch {
    // ignore
  }
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [payload, setPayload] = useState<VehicleRepairReportResponse | null>(null)

  const [detailFor, setDetailFor] = useState<Pick<
    VehicleRepairReportItem,
    'vehicle_id' | 'vehicle_number' | 'vehicle_type'
  > | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [detailRows, setDetailRows] = useState<CompanyExpenseRow[]>([])

  useEffect(() => {
    if (!open) {
      setDetailFor(null)
      setDetailRows([])
      setDetailError(null)
    }
  }, [open])

  const loadMainReport = useCallback(async () => {
    const res = await fetch('/api/vehicles/repair-cost-report')
    const json = (await res.json()) as VehicleRepairReportResponse & { error?: string }
    if (!res.ok) {
      setError(json.error || t('loadError'))
      return
    }
    setError(null)
    setPayload({ data: json.data || [], summary: json.summary || { total_repair: 0, vehicle_count: 0 } })
  }, [t])

  const loadDetailExpenses = useCallback(
    async (forVehicle: { vehicle_id: string }) => {
      setDetailLoading(true)
      setDetailError(null)
      setDetailRows([])
      try {
        const res = await fetch(
          `/api/vehicles/repair-cost-report/${encodeURIComponent(forVehicle.vehicle_id)}/expenses`
        )
        const json = (await res.json()) as { data?: CompanyExpenseRow[]; error?: string }
        if (!res.ok) {
          setDetailError(json.error || t('detailError'))
          return
        }
        setDetailRows(json.data ?? [])
      } catch {
        setDetailError(t('detailError'))
      } finally {
        setDetailLoading(false)
      }
    },
    [t]
  )

  useEffect(() => {
    if (!open) {
      return
    }
    setLoading(true)
    setError(null)
    setPayload(null)
    void (async () => {
      try {
        await loadMainReport()
      } catch {
        setError(t('loadError'))
      } finally {
        setLoading(false)
      }
    })()
  }, [open, t, loadMainReport])

  useEffect(() => {
    if (!detailFor) return
    void loadDetailExpenses(detailFor)
  }, [detailFor, loadDetailExpenses])

  const openDetail = useCallback((row: VehicleRepairReportItem) => {
    setDetailFor({
      vehicle_id: row.vehicle_id,
      vehicle_number: row.vehicle_number,
      vehicle_type: row.vehicle_type
    })
  }, [])

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(100vw,56rem)] max-h-[min(90vh,900px)] flex flex-col gap-0 p-0 sm:max-w-5xl">
        <DialogHeader className="px-4 pt-4 pb-2 sm:px-6 sm:pt-6 border-b">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg pr-6">
            <BarChart3 className="h-5 w-5 text-blue-600 shrink-0" />
            {t('title')}
          </DialogTitle>
          <DialogDescription className="text-left text-xs sm:text-sm">
            {t('description')}
          </DialogDescription>
        </DialogHeader>

        <div className="px-4 py-2 sm:px-6 sm:py-3 bg-slate-50/90 border-b text-xs sm:text-sm text-muted-foreground">
          {t('methodNote')}
        </div>

        <p className="px-4 pt-2 sm:px-6 text-[11px] sm:text-xs text-blue-800/80">{t('rowClickHint')}</p>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2 sm:px-6 sm:py-3">
          {loading && (
            <div className="py-16 text-center text-sm text-muted-foreground">{t('loading')}</div>
          )}
          {error && !loading && <p className="text-sm text-destructive py-6 text-center">{error}</p>}

          {!loading && !error && payload && (
            <>
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4 rounded-lg border bg-white p-3 text-sm">
                <p>
                  <span className="text-muted-foreground">{t('summaryVehicles')}</span>{' '}
                  <span className="font-semibold tabular-nums">{payload.summary.vehicle_count}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">{t('summaryTotalRepair')}</span>{' '}
                  <span className="font-semibold tabular-nums text-green-700">
                    {formatMoney(payload.summary.total_repair)}
                  </span>
                </p>
              </div>

              {payload.data.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">{t('empty')}</p>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="whitespace-nowrap min-w-[7rem]">{t('colVehicle')}</TableHead>
                        <TableHead className="whitespace-nowrap min-w-[9rem]">{t('colPeriod')}</TableHead>
                        <TableHead className="whitespace-nowrap text-right tabular-nums">
                          {t('colMonths')}
                        </TableHead>
                        <TableHead className="whitespace-nowrap text-right tabular-nums">
                          {t('colDistance')}
                        </TableHead>
                        <TableHead className="whitespace-nowrap text-right tabular-nums">
                          {t('colTotalRepair')}
                        </TableHead>
                        <TableHead className="whitespace-nowrap text-right tabular-nums min-w-[6rem]">
                          {t('colAnnualized')}
                        </TableHead>
                        <TableHead className="whitespace-nowrap text-right tabular-nums min-w-[6rem]">
                          {t('colPerKm')}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payload.data.map((row) => (
                        <TableRow
                          key={row.vehicle_id}
                          role="button"
                          tabIndex={0}
                          className="cursor-pointer hover:bg-muted/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                          onClick={() => openDetail(row)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              openDetail(row)
                            }
                          }}
                        >
                          <TableCell className="align-top">
                            <div className="font-medium">{row.vehicle_number}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">{row.vehicle_type}</div>
                            {row.is_active ? (
                              <Badge variant="secondary" className="mt-1 text-[10px] h-5">
                                {t('badgeActive')}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="mt-1 text-[10px] h-5">
                                {t('badgeEnded')}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs sm:text-sm align-top whitespace-nowrap">
                            {new Date(row.period_start).toLocaleDateString(locale, {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit'
                            })}
                            {` `}~{` `}
                            {new Date(row.period_end).toLocaleDateString(locale, {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit'
                            })}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.months_held < 0.01
                              ? '—'
                              : t('monthsDisplay', { n: row.months_held.toFixed(1) })}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-xs sm:text-sm">
                            {row.distance > 0
                              ? t('distanceKm', { n: Math.round(row.distance).toLocaleString() })
                              : '—'}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-medium text-green-800">
                            {formatMoney(row.total_repair)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-xs sm:text-sm">
                            {formatMoney(row.annualized_repair)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-xs sm:text-sm">
                            {row.repair_per_km != null
                              ? t('perKm', { amount: formatMoney(row.repair_per_km) })
                              : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>

    <Dialog
      open={!!detailFor}
      onOpenChange={(v) => {
        if (!v) setDetailFor(null)
      }}
    >
      <DialogContent className="max-w-[min(100vw,72rem)] max-h-[min(90vh,900px)] flex flex-col gap-0 p-0 sm:max-w-6xl">
        <DialogHeader className="px-4 pt-4 pb-2 sm:px-6 sm:pt-5 border-b shrink-0">
          <DialogTitle className="text-base sm:text-lg pr-8">
            {t('detailTitle')}
            {detailFor ? (
              <span className="block sm:inline sm:ml-1 font-medium text-foreground/90 text-sm sm:text-base">
                — {detailFor.vehicle_number}{' '}
                <span className="text-muted-foreground font-normal">({detailFor.vehicle_type})</span>
              </span>
            ) : null}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t('detailText')}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2 sm:px-4 sm:py-3">
          {detailLoading && (
            <div className="py-12 text-center text-sm text-muted-foreground">{t('detailLoading')}</div>
          )}
          {detailError && !detailLoading && (
            <p className="text-sm text-destructive py-8 text-center">{detailError}</p>
          )}
          {!detailLoading && !detailError && detailFor && detailRows.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center">{t('detailEmpty')}</p>
          )}
          {!detailLoading && !detailError && detailFor && detailRows.length > 0 && (
            <VehicleExpenseDetailEditableTable
              vehicleId={detailFor.vehicle_id}
              rows={detailRows}
              setRows={setDetailRows}
              onAfterSave={() => {
                void loadMainReport()
                void loadDetailExpenses(detailFor)
              }}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
    </>
  )
}
