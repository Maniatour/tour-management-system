'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Plus, Edit, Trash2, Calendar, Wrench, DollarSign, AlertTriangle } from 'lucide-react'
import { Database } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'
import { apiBearerAuthHeaders } from '@/lib/api-client-bearer'
import { isInactiveVehicleStatus } from '@/lib/vehicleStatus'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import VehicleMaintenanceSchedulePanel from '@/components/VehicleMaintenanceSchedulePanel'
import VehicleMaintenanceFormDialog from '@/components/vehicle-maintenance/VehicleMaintenanceFormDialog'
import {
  formatMaintenanceStatsDate,
  vehicleDisplayLabel,
} from '@/components/vehicle-maintenance/vehicleMaintenanceFormShared'
import {
  resolveCatalogLabelForSubcategoryKey,
  type VehicleMaintenanceCatalogRow,
} from '@/lib/vehicleMaintenanceCatalog'
import { normalizeMaintenanceTypeBucket } from '@/lib/vehicleMaintenanceType'
import { toast } from 'sonner'
import type { ExpenseStandardCategoryPickRow } from '@/lib/expenseStandardCategoryPaidFor'
import { usePaymentMethodOptions } from '@/hooks/usePaymentMethodOptions'
import {
  buildVehicleMaintenanceStandardGroups,
  parseVehicleMaintenanceSubcategories,
  resolveVehicleMaintenanceWorkSubcategoryLabels,
  isVehicleMaintenanceWorkSubcategoryKey,
} from '@/lib/vehicleMaintenanceStandardCategory'

type VehicleMaintenance = Database['public']['Tables']['vehicle_maintenance']['Row']
type Vehicle = Database['public']['Tables']['vehicles']['Row']

type VehicleMaintenanceStats = {
  count: number
  totalCost: number
  averageCost: number
  lastMaintenanceDate: string | null
  latestMileage: number | null
}

function computeMaintenanceStats(rows: VehicleMaintenance[]): VehicleMaintenanceStats {
  if (rows.length === 0) {
    return { count: 0, totalCost: 0, averageCost: 0, lastMaintenanceDate: null, latestMileage: null }
  }
  let totalCost = 0
  for (const m of rows) {
    const n = parseFloat(String(m.total_cost ?? 0))
    if (Number.isFinite(n)) totalCost += n
  }
  const sorted = [...rows].sort((a, b) =>
    String(b.maintenance_date).localeCompare(String(a.maintenance_date))
  )
  const latestWithMileage = sorted.find((m) => m.mileage != null && m.mileage > 0)
  return {
    count: rows.length,
    totalCost,
    averageCost: totalCost / rows.length,
    lastMaintenanceDate: sorted[0]?.maintenance_date ?? null,
    latestMileage: latestWithMileage?.mileage ?? null,
  }
}

function isCompanyVehicle(vehicle: Pick<Vehicle, 'vehicle_category'>): boolean {
  return vehicle.vehicle_category === 'company' || !vehicle.vehicle_category
}

export type VehicleMaintenanceVehicleModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  vehicleId: string
  vehicleLabel?: string | null
}

export default function VehicleMaintenanceVehicleModal({
  open,
  onOpenChange,
  vehicleId,
  vehicleLabel,
}: VehicleMaintenanceVehicleModalProps) {
  const t = useTranslations('vehicleMaintenance')
  let locale = 'ko'
  try {
    locale = useLocale()
  } catch {
    locale = 'ko'
  }
  const { paymentMethodOptions } = usePaymentMethodOptions()

  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [allVehicles, setAllVehicles] = useState<Vehicle[]>([])
  const [maintenances, setMaintenances] = useState<VehicleMaintenance[]>([])
  const [maintenanceCatalog, setMaintenanceCatalog] = useState<VehicleMaintenanceCatalogRow[]>([])
  const [expenseStandardCategories, setExpenseStandardCategories] = useState<ExpenseStandardCategoryPickRow[]>([])
  const [loading, setLoading] = useState(true)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingMaintenance, setEditingMaintenance] = useState<VehicleMaintenance | null>(null)

  const vehicleById = useMemo(() => new Map(allVehicles.map((v) => [v.id, v])), [allVehicles])

  const activeCompanyVehicles = useMemo(
    () =>
      allVehicles
        .filter((v) => isCompanyVehicle(v) && !isInactiveVehicleStatus(v.status))
        .sort((a, b) => vehicleDisplayLabel(a).localeCompare(vehicleDisplayLabel(b), 'ko')),
    [allVehicles]
  )

  const vehicleStandardGroups = useMemo(
    () => buildVehicleMaintenanceStandardGroups(expenseStandardCategories, locale),
    [expenseStandardCategories, locale]
  )

  const scopedMaintenances = useMemo(
    () => maintenances.filter((m) => m.vehicle_id === vehicleId),
    [maintenances, vehicleId]
  )

  const stats = useMemo(() => computeMaintenanceStats(scopedMaintenances), [scopedMaintenances])

  const titleLabel =
    vehicleLabel?.trim() ||
    (vehicle ? vehicleDisplayLabel(vehicle) : vehicleId)

  const loadMaintenances = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({ vehicle_id: vehicleId })
      const response = await fetch(`/api/vehicle-maintenance?${params.toString()}`, {
        headers: apiBearerAuthHeaders(),
      })
      const result = await response.json()
      if (response.ok) {
        setMaintenances(result.data || [])
      } else {
        toast.error(result.error || '정비 기록을 불러올 수 없습니다.')
      }
    } catch (error) {
      console.error('정비 기록 로드 오류:', error)
      toast.error('정비 기록을 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [vehicleId])

  const loadVehicle = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('vehicles').select('*').eq('id', vehicleId).single()
      if (error) throw error
      setVehicle((data as Vehicle) ?? null)
    } catch (error) {
      console.error('차량 조회 오류:', error)
      setVehicle(null)
    }
  }, [vehicleId])

  const loadAllVehicles = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('vehicles').select('*').order('vehicle_number')
      if (error) throw error
      setAllVehicles(data || [])
    } catch (error) {
      console.error('차량 목록 로드 오류:', error)
    }
  }, [])

  const loadExpenseStandardCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/company-expenses/expense-standard-categories', {
        headers: apiBearerAuthHeaders(),
      })
      if (res.ok) {
        const json = await res.json()
        if (Array.isArray(json.data)) {
          setExpenseStandardCategories(json.data as ExpenseStandardCategoryPickRow[])
          return
        }
      }
      const { data, error } = await supabase
        .from('expense_standard_categories')
        .select('id, name, name_ko, parent_id, tax_deductible, display_order, is_active')
        .order('display_order', { ascending: true })
      if (error) {
        setExpenseStandardCategories([])
        return
      }
      setExpenseStandardCategories((data as ExpenseStandardCategoryPickRow[]) || [])
    } catch {
      setExpenseStandardCategories([])
    }
  }, [])

  const loadMaintenanceCatalog = useCallback(async () => {
    try {
      const res = await fetch('/api/vehicle-maintenance/catalog', {
        headers: apiBearerAuthHeaders(),
      })
      if (res.ok) {
        const json = await res.json()
        if (Array.isArray(json.data)) {
          setMaintenanceCatalog(json.data as VehicleMaintenanceCatalogRow[])
        }
      }
    } catch {
      setMaintenanceCatalog([])
    }
  }, [])

  useEffect(() => {
    if (!open) return
    void loadVehicle()
    void loadAllVehicles()
    void loadMaintenances()
    void loadExpenseStandardCategories()
    void loadMaintenanceCatalog()
  }, [
    open,
    loadVehicle,
    loadAllVehicles,
    loadMaintenances,
    loadExpenseStandardCategories,
    loadMaintenanceCatalog,
  ])

  const legacyPartOrWorkLabel = useCallback(
    (key: string) =>
      isVehicleMaintenanceWorkSubcategoryKey(key)
        ? t(`subcategories.${key}`)
        : t(`categories.${key}`),
    [t]
  )

  const formatWorkSubcategoryLabelsForRow = useCallback(
    (category: string, subcategory: string | null | undefined) => {
      const parsed = parseVehicleMaintenanceSubcategories(subcategory)
      if (parsed.length > 0 && maintenanceCatalog.length > 0) {
        return parsed.map((key) =>
          resolveCatalogLabelForSubcategoryKey(key, maintenanceCatalog, locale, legacyPartOrWorkLabel)
        )
      }
      return resolveVehicleMaintenanceWorkSubcategoryLabels(category, subcategory, legacyPartOrWorkLabel)
    },
    [maintenanceCatalog, locale, legacyPartOrWorkLabel]
  )

  const handleEdit = (maintenance: VehicleMaintenance) => {
    setEditingMaintenance(maintenance)
    setIsFormOpen(true)
  }

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/vehicle-maintenance/${id}`, {
        method: 'DELETE',
        headers: apiBearerAuthHeaders(),
      })
      const result = await response.json()
      if (response.ok) {
        toast.success(t('messages.maintenanceDeleted'))
        void loadMaintenances()
      } else {
        toast.error(result.error || '정비 기록 삭제 중 오류가 발생했습니다.')
      }
    } catch (error) {
      console.error('정비 기록 삭제 오류:', error)
      toast.error('정비 기록 삭제 중 오류가 발생했습니다.')
    }
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      scheduled: { color: 'bg-blue-100 text-blue-800', icon: Calendar },
      in_progress: { color: 'bg-yellow-100 text-yellow-800', icon: Wrench },
      completed: { color: 'bg-green-100 text-green-800', icon: DollarSign },
      cancelled: { color: 'bg-red-100 text-red-800', icon: AlertTriangle },
    }
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.completed
    const Icon = config.icon
    return (
      <Badge className={config.color}>
        <Icon className="w-3 h-3 mr-1" />
        {t(`status.${status}`)}
      </Badge>
    )
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)

  const scheduleVehicleFields = vehicle
    ? [
        {
          id: vehicle.id,
          vehicle_number: vehicle.vehicle_number,
          vehicle_type: vehicle.vehicle_type,
          nick: (vehicle as Vehicle & { nick?: string | null }).nick ?? null,
          current_mileage: vehicle.current_mileage,
          engine_oil_change_cycle: vehicle.engine_oil_change_cycle,
          recent_engine_oil_change_mileage: vehicle.recent_engine_oil_change_mileage,
          maintenance_duty_preset: vehicle.maintenance_duty_preset,
          fuel_type: vehicle.fuel_type,
          maintenance_vehicle_class: vehicle.maintenance_vehicle_class,
        },
      ]
    : []

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          overlayClassName="z-[1300]"
          className="z-[1300] flex max-h-[min(92vh,900px)] w-[min(96vw,72rem)] max-w-[min(96vw,72rem)] flex-col gap-0 overflow-hidden p-0"
        >
          <DialogHeader className="shrink-0 border-b px-5 py-4 pr-12">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Wrench className="h-4 w-4 shrink-0 text-amber-600" />
              {t('title')}
              <span className="font-normal text-muted-foreground">— {titleLabel}</span>
            </DialogTitle>
            <DialogDescription>{t('maintenanceList')}</DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <div className="rounded-lg border bg-slate-50 p-3">
                <div className="text-xs text-muted-foreground">{t('statistics.maintenanceCount')}</div>
                <div className="mt-0.5 text-lg font-semibold tabular-nums">{stats.count}</div>
              </div>
              <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
                <div className="text-xs text-muted-foreground">{t('statistics.totalCost')}</div>
                <div className="mt-0.5 text-lg font-semibold tabular-nums">
                  {formatCurrency(stats.totalCost)}
                </div>
              </div>
              <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-3">
                <div className="text-xs text-muted-foreground">{t('statistics.averageCost')}</div>
                <div className="mt-0.5 text-lg font-semibold tabular-nums">
                  {stats.count > 0 ? formatCurrency(stats.averageCost) : '—'}
                </div>
              </div>
              <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3">
                <div className="text-xs text-muted-foreground">{t('statistics.lastMaintenanceDate')}</div>
                <div className="mt-0.5 text-lg font-semibold">
                  {formatMaintenanceStatsDate(stats.lastMaintenanceDate)}
                </div>
              </div>
              <div className="rounded-lg border border-amber-100 bg-amber-50 p-3">
                <div className="text-xs text-muted-foreground">{t('statistics.latestMileage')}</div>
                <div className="mt-0.5 text-lg font-semibold tabular-nums">
                  {stats.latestMileage != null ? `${stats.latestMileage.toLocaleString()} mi` : '—'}
                </div>
              </div>
              <div className="rounded-lg border bg-gray-50 p-3">
                <div className="text-xs text-muted-foreground">{t('statistics.currentMileage')}</div>
                <div className="mt-0.5 text-lg font-semibold tabular-nums">
                  {vehicle?.current_mileage != null
                    ? `${vehicle.current_mileage.toLocaleString()} mi`
                    : '—'}
                </div>
              </div>
            </div>

            {vehicle && (
              <VehicleMaintenanceSchedulePanel
                vehicles={scheduleVehicleFields}
                maintenances={scopedMaintenances.map((m) => ({
                  id: m.id,
                  vehicle_id: m.vehicle_id,
                  maintenance_date: m.maintenance_date,
                  mileage: m.mileage,
                  subcategory: m.subcategory,
                  mileage_interval: m.mileage_interval,
                  next_maintenance_mileage: m.next_maintenance_mileage,
                }))}
                vehicleIds={[vehicleId]}
                showVehicleColumn={false}
                vehicleLabel={(v) => vehicleDisplayLabel(v)}
                formatDate={formatMaintenanceStatsDate}
              />
            )}

            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">{t('maintenanceList')}</h3>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setEditingMaintenance(null)
                  setIsFormOpen(true)
                }}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                {t('addMaintenance')}
              </Button>
            </div>

            {loading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">{t('loading')}</div>
            ) : scopedMaintenances.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">{t('noMaintenance')}</div>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">{t('list.maintenanceDate')}</TableHead>
                      <TableHead className="whitespace-nowrap">{t('list.mileage')}</TableHead>
                      <TableHead className="whitespace-nowrap">{t('list.maintenanceType')}</TableHead>
                      <TableHead className="whitespace-nowrap">{t('list.workSubcategory')}</TableHead>
                      <TableHead className="min-w-[12rem]">{t('list.description')}</TableHead>
                      <TableHead className="whitespace-nowrap text-right">{t('list.totalCost')}</TableHead>
                      <TableHead className="whitespace-nowrap">{t('list.status')}</TableHead>
                      <TableHead className="whitespace-nowrap">{t('list.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scopedMaintenances.map((maintenance) => (
                        <TableRow key={maintenance.id}>
                          <TableCell>
                            {new Date(maintenance.maintenance_date).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            {maintenance.mileage ? maintenance.mileage.toLocaleString() : '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {t(
                                `maintenanceTypes.${normalizeMaintenanceTypeBucket(maintenance.maintenance_type)}`
                              )}
                            </Badge>
                          </TableCell>
                          <TableCell className="align-top text-sm">
                            {(() => {
                              const workLabels = formatWorkSubcategoryLabelsForRow(
                                maintenance.category,
                                maintenance.subcategory
                              )
                              if (workLabels.length === 0) return '—'
                              return (
                                <div className="flex flex-wrap gap-1">
                                  {workLabels.map((label) => (
                                    <Badge key={label} variant="outline">
                                      {label}
                                    </Badge>
                                  ))}
                                </div>
                              )
                            })()}
                          </TableCell>
                          <TableCell className="max-w-md whitespace-pre-wrap break-words align-top text-sm">
                            {maintenance.description}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(parseFloat(maintenance.total_cost.toString()))}
                          </TableCell>
                          <TableCell>{getStatusBadge(maintenance.status ?? 'completed')}</TableCell>
                          <TableCell>
                            <div className="flex space-x-1">
                              <Button
                                size="sm"
                                variant="outline"
                                type="button"
                                onClick={() => handleEdit(maintenance)}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="outline" type="button">
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="z-[1400]">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>정비 기록 삭제</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      {t('messages.confirmDelete')}
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>취소</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => void handleDelete(maintenance.id)}
                                      className="bg-red-600 hover:bg-red-700"
                                    >
                                      삭제
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <VehicleMaintenanceFormDialog
        open={isFormOpen}
        onOpenChange={(nextOpen) => {
          setIsFormOpen(nextOpen)
          if (!nextOpen) setEditingMaintenance(null)
        }}
        editingMaintenance={editingMaintenance}
        onSaved={() => void loadMaintenances()}
        activeCompanyVehicles={activeCompanyVehicles}
        vehicleById={vehicleById}
        maintenanceCatalog={maintenanceCatalog}
        maintenances={maintenances}
        vehicleStandardGroups={vehicleStandardGroups}
        expenseStandardCategories={expenseStandardCategories}
        paymentMethodOptions={paymentMethodOptions}
        locale={locale}
        defaultVehicleId={vehicleId}
        nestedModal
      />
    </>
  )
}
