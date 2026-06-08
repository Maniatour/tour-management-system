'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Database } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'
import { apiBearerAuthHeaders } from '@/lib/api-client-bearer'
import { isInactiveVehicleStatus } from '@/lib/vehicleStatus'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import Link from 'next/link'
import { Plus, Search, Filter, Edit, Trash2, Calendar, Wrench, DollarSign, AlertTriangle, Settings2, Printer } from 'lucide-react'
import VehicleMaintenanceSchedulePanel from '@/components/VehicleMaintenanceSchedulePanel'
import VehicleMaintenanceFormDialog from '@/components/vehicle-maintenance/VehicleMaintenanceFormDialog'
import { vehicleDisplayLabel } from '@/components/vehicle-maintenance/vehicleMaintenanceFormShared'
import {
  resolveCatalogLabelForSubcategoryKey,
  type VehicleMaintenanceCatalogRow,
} from '@/lib/vehicleMaintenanceCatalog'
import { normalizeMaintenanceTypeBucket } from '@/lib/vehicleMaintenanceType'
import { toast } from 'sonner'
import type { ExpenseStandardCategoryPickRow } from '@/lib/expenseStandardCategoryPaidFor'
import { Checkbox } from '@/components/ui/checkbox'
import { usePaymentMethodOptions } from '@/hooks/usePaymentMethodOptions'
import {
  printBlankMaintenanceFormForVehicle,
  printBlankMaintenanceFormsForVehicles,
  type VehicleForMaintenancePrint,
} from '@/lib/buildVehicleMaintenancePrintData'
import {
  buildVehicleMaintenanceStandardGroups,
  parseVehicleMaintenanceSubcategories,
  resolveVehicleMaintenanceCategoryDisplay,
  resolveVehicleMaintenanceWorkSubcategoryLabels,
  isVehicleMaintenanceWorkSubcategoryKey,
  vehicleMaintenanceCategoryFilterOptions,
} from '@/lib/vehicleMaintenanceStandardCategory'

type VehicleMaintenance = Database['public']['Tables']['vehicle_maintenance']['Row']
type Vehicle = Database['public']['Tables']['vehicles']['Row']

type VehicleMaintenanceWithVehicle = VehicleMaintenance & {
  vehicles?: (Pick<Vehicle, 'id' | 'vehicle_number' | 'vehicle_type' | 'vehicle_category'> & {
    nick?: string | null
  }) | null
  company_expenses?:
    | { payment_method: string | null }
    | { payment_method: string | null }[]
    | null
}

function linkedExpensePaymentMethod(row: VehicleMaintenanceWithVehicle): string | null {
  const linked = row.company_expenses
  if (!linked) return null
  const raw = Array.isArray(linked) ? linked[0]?.payment_method : linked.payment_method
  const trimmed = raw?.trim()
  return trimmed ? trimmed : null
}

type CompanyVehicleTab = 'all' | 'unassigned' | string

function isCompanyVehicle(vehicle: Pick<Vehicle, 'vehicle_category'>): boolean {
  return vehicle.vehicle_category === 'company' || !vehicle.vehicle_category
}

function maintenanceVehicleLabel(
  maintenance: VehicleMaintenanceWithVehicle,
  vehicleById: Map<string, Vehicle>,
  unassignedLabel: string
): string {
  if (!maintenance.vehicle_id) return unassignedLabel
  if (maintenance.vehicles) {
    return vehicleDisplayLabel(maintenance.vehicles)
  }
  const vehicle = vehicleById.get(maintenance.vehicle_id)
  if (vehicle) {
    return vehicleDisplayLabel(vehicle)
  }
  return maintenance.vehicle_id
}

function maintenanceMatchesVehicleActivity(
  maintenance: VehicleMaintenanceWithVehicle,
  vehicleById: Map<string, Vehicle>,
  showInactive: boolean
): boolean {
  if (!maintenance.vehicle_id) {
    return !showInactive
  }
  const vehicle = vehicleById.get(maintenance.vehicle_id)
  if (!vehicle || !isCompanyVehicle(vehicle)) {
    return !showInactive
  }
  const inactive = isInactiveVehicleStatus(vehicle.status)
  return showInactive ? inactive : !inactive
}

function isCompanyMaintenance(
  maintenance: VehicleMaintenanceWithVehicle,
  vehicleById: Map<string, Vehicle>
): boolean {
  if (!maintenance.vehicle_id) return true
  const joinedCategory = maintenance.vehicles?.vehicle_category
  if (joinedCategory === 'rental') return false
  if (joinedCategory === 'company' || joinedCategory == null) return true
  const vehicle = vehicleById.get(maintenance.vehicle_id)
  if (!vehicle) return true
  return isCompanyVehicle(vehicle)
}

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

export default function VehicleMaintenanceManager() {
  const t = useTranslations('vehicleMaintenance')
  let locale = 'ko'
  try {
    locale = useLocale()
  } catch {
    locale = 'ko'
  }
  const { paymentMethodOptions } = usePaymentMethodOptions()
  const [expenseStandardCategories, setExpenseStandardCategories] = useState<
    ExpenseStandardCategoryPickRow[]
  >([])
  const [maintenances, setMaintenances] = useState<VehicleMaintenance[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingMaintenance, setEditingMaintenance] = useState<VehicleMaintenance | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeVehicleTab, setActiveVehicleTab] = useState<CompanyVehicleTab>('all')
  const [showInactiveVehicles, setShowInactiveVehicles] = useState(false)
  const [maintenanceTypeFilter, setMaintenanceTypeFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [maintenanceCatalog, setMaintenanceCatalog] = useState<VehicleMaintenanceCatalogRow[]>([])
  const [printingMaintenanceForms, setPrintingMaintenanceForms] = useState(false)
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false)
  const [printSelectedVehicleIds, setPrintSelectedVehicleIds] = useState<string[]>([])

  const loadMaintenances = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      
      if (searchTerm) params.append('search', searchTerm)
      if (maintenanceTypeFilter && maintenanceTypeFilter !== 'all') params.append('maintenance_type', maintenanceTypeFilter)
      if (categoryFilter && categoryFilter !== 'all') params.append('category', categoryFilter)
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter)
      
      const response = await fetch(`/api/vehicle-maintenance?${params.toString()}`, {
        headers: apiBearerAuthHeaders(),
      })
      const result = await response.json()
      
      if (response.ok) {
        setMaintenances(result.data || [])
        const imported = result.sync?.imported ?? 0
        const categoriesMigrated = result.sync?.categoriesMigrated ?? 0
        if (imported > 0) {
          toast.success(`회사 지출에서 정비 기록 ${imported}건을 가져왔습니다.`)
        }
        if (categoriesMigrated > 0) {
          toast.success(`표준 카테고리로 ${categoriesMigrated}건을 맞췄습니다.`)
        }
      } else {
        toast.error(result.error || '정비 기록을 불러올 수 없습니다.')
      }
    } catch (error) {
      console.error('정비 기록 로드 오류:', error)
      toast.error('정비 기록을 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [searchTerm, maintenanceTypeFilter, categoryFilter, statusFilter])

  const vehicleById = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles])

  const allCompanyVehicles = useMemo(
    () =>
      vehicles
        .filter(isCompanyVehicle)
        .sort((a, b) => vehicleDisplayLabel(a).localeCompare(vehicleDisplayLabel(b), 'ko')),
    [vehicles]
  )

  const activeCompanyVehicles = useMemo(
    () => allCompanyVehicles.filter((v) => !isInactiveVehicleStatus(v.status)),
    [allCompanyVehicles]
  )

  const inactiveCompanyVehicles = useMemo(
    () => allCompanyVehicles.filter((v) => isInactiveVehicleStatus(v.status)),
    [allCompanyVehicles]
  )

  const tabVehicles = showInactiveVehicles ? inactiveCompanyVehicles : activeCompanyVehicles

  const toPrintVehicle = useCallback(
    (vehicle: Vehicle): VehicleForMaintenancePrint => ({
      id: vehicle.id,
      vehicle_number: vehicle.vehicle_number,
      vehicle_type: vehicle.vehicle_type,
      vin: vehicle.vin,
      nick: vehicle.nick,
      engine_oil_change_cycle: vehicle.engine_oil_change_cycle,
      maintenance_duty_preset: vehicle.maintenance_duty_preset,
      fuel_type: vehicle.fuel_type,
      maintenance_vehicle_class: vehicle.maintenance_vehicle_class,
    }),
    []
  )

  const vehiclesForPrint = useMemo(
    () => tabVehicles.map(toPrintVehicle),
    [tabVehicles, toPrintVehicle]
  )

  const openPrintVehicleDialog = useCallback(() => {
    if (tabVehicles.length === 0) {
      toast.error(t('messages.printNoVehicles'))
      return
    }
    const defaultIds =
      activeVehicleTab !== 'all' && activeVehicleTab !== 'unassigned'
        ? [activeVehicleTab]
        : tabVehicles.map((v) => v.id)
    setPrintSelectedVehicleIds(defaultIds)
    setIsPrintDialogOpen(true)
  }, [activeVehicleTab, t, tabVehicles])

  const printAllVehiclesSelected = useMemo(() => {
    if (tabVehicles.length === 0) return false
    const selected = new Set(printSelectedVehicleIds)
    return tabVehicles.every((v) => selected.has(v.id))
  }, [printSelectedVehicleIds, tabVehicles])

  const togglePrintVehicleSelection = useCallback((vehicleId: string) => {
    setPrintSelectedVehicleIds((prev) =>
      prev.includes(vehicleId)
        ? prev.filter((id) => id !== vehicleId)
        : [...prev, vehicleId]
    )
  }, [])

  const togglePrintSelectAllVehicles = useCallback(() => {
    setPrintSelectedVehicleIds(
      printAllVehiclesSelected ? [] : tabVehicles.map((v) => v.id)
    )
  }, [printAllVehiclesSelected, tabVehicles])

  const handleConfirmPrintMaintenanceForms = useCallback(async () => {
    const targets = vehiclesForPrint.filter((v) => printSelectedVehicleIds.includes(v.id))

    if (targets.length === 0) {
      toast.error(t('messages.printNoVehiclesSelected'))
      return
    }

    try {
      setPrintingMaintenanceForms(true)
      if (targets.length === 1) {
        await printBlankMaintenanceFormForVehicle(targets[0])
      } else {
        await printBlankMaintenanceFormsForVehicles(targets)
      }
      setIsPrintDialogOpen(false)
    } catch (error) {
      console.error('정비 양식 인쇄 오류:', error)
      toast.error(t('messages.printError'))
    } finally {
      setPrintingMaintenanceForms(false)
    }
  }, [printSelectedVehicleIds, t, vehiclesForPrint])

  const companyMaintenances = useMemo(() => {
    const rows = maintenances as VehicleMaintenanceWithVehicle[]
    return rows.filter((m) => isCompanyMaintenance(m, vehicleById))
  }, [maintenances, vehicleById])

  const scopedMaintenances = useMemo(
    () =>
      companyMaintenances.filter((m) =>
        maintenanceMatchesVehicleActivity(m, vehicleById, showInactiveVehicles)
      ),
    [companyMaintenances, vehicleById, showInactiveVehicles]
  )

  const inactiveMaintenanceCount = useMemo(
    () =>
      companyMaintenances.filter((m) =>
        maintenanceMatchesVehicleActivity(m, vehicleById, true)
      ).length,
    [companyMaintenances, vehicleById]
  )

  const maintenanceCountByTab = useMemo(() => {
    const counts = new Map<CompanyVehicleTab, number>()
    counts.set('all', scopedMaintenances.length)
    if (!showInactiveVehicles) {
      counts.set(
        'unassigned',
        scopedMaintenances.filter((m) => !m.vehicle_id).length
      )
    }
    for (const vehicle of tabVehicles) {
      counts.set(
        vehicle.id,
        scopedMaintenances.filter((m) => m.vehicle_id === vehicle.id).length
      )
    }
    return counts
  }, [scopedMaintenances, tabVehicles, showInactiveVehicles])

  const displayedMaintenances = useMemo(() => {
    if (activeVehicleTab === 'all') return scopedMaintenances
    if (activeVehicleTab === 'unassigned') {
      return scopedMaintenances.filter((m) => !m.vehicle_id)
    }
    return scopedMaintenances.filter((m) => m.vehicle_id === activeVehicleTab)
  }, [activeVehicleTab, scopedMaintenances])

  const toggleInactiveVehicles = () => {
    setShowInactiveVehicles((prev) => !prev)
    setActiveVehicleTab('all')
  }

  const vehicleStatsEntries = useMemo(() => {
    const entries: {
      key: CompanyVehicleTab
      label: string
      stats: VehicleMaintenanceStats
      vehicle?: Vehicle
    }[] = []

    if (!showInactiveVehicles) {
      const unassignedRows = scopedMaintenances.filter((m) => !m.vehicle_id)
      entries.push({
        key: 'unassigned',
        label: t('tabs.unassigned'),
        stats: computeMaintenanceStats(unassignedRows),
      })
    }

    for (const vehicle of tabVehicles) {
      const rows = scopedMaintenances.filter((m) => m.vehicle_id === vehicle.id)
      entries.push({
        key: vehicle.id,
        label: vehicleDisplayLabel(vehicle),
        stats: computeMaintenanceStats(rows),
        vehicle,
      })
    }

    return entries
  }, [scopedMaintenances, tabVehicles, showInactiveVehicles, t])

  const activeTabStats = useMemo(() => {
    if (activeVehicleTab === 'all') return computeMaintenanceStats(scopedMaintenances)
    if (activeVehicleTab === 'unassigned') {
      return computeMaintenanceStats(scopedMaintenances.filter((m) => !m.vehicle_id))
    }
    return computeMaintenanceStats(scopedMaintenances.filter((m) => m.vehicle_id === activeVehicleTab))
  }, [activeVehicleTab, scopedMaintenances])

  const activeTabVehicle = useMemo(() => {
    if (activeVehicleTab === 'all' || activeVehicleTab === 'unassigned') return null
    return vehicleById.get(activeVehicleTab) ?? null
  }, [activeVehicleTab, vehicleById])

  const scheduleVehicleIds = useMemo(() => {
    if (activeVehicleTab === 'all') {
      return tabVehicles.map((v) => v.id)
    }
    if (activeVehicleTab === 'unassigned') return []
    return [activeVehicleTab]
  }, [activeVehicleTab, tabVehicles])

  const formatStatsDate = (ymd: string | null) => {
    if (!ymd) return '—'
    const d = new Date(ymd)
    return Number.isNaN(d.getTime()) ? ymd : d.toLocaleDateString()
  }

  const loadVehicles = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .order('vehicle_number')
      
      if (error) throw error
      setVehicles(data || [])
    } catch (error) {
      console.error('차량 목록 로드 오류:', error)
    }
  }, [supabase])

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
  }, [supabase])

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
    loadMaintenances()
    loadVehicles()
    void loadExpenseStandardCategories()
    void loadMaintenanceCatalog()
  }, [loadMaintenances, loadVehicles, loadExpenseStandardCategories, loadMaintenanceCatalog])

  const vehicleStandardGroups = useMemo(
    () => buildVehicleMaintenanceStandardGroups(expenseStandardCategories, locale),
    [expenseStandardCategories, locale]
  )

  const standardCategoryFilterOptions = useMemo(
    () => vehicleMaintenanceCategoryFilterOptions(expenseStandardCategories, locale),
    [expenseStandardCategories, locale]
  )

  const formatCategoryLabel = useCallback(
    (categoryValue: string) =>
      resolveVehicleMaintenanceCategoryDisplay(categoryValue, expenseStandardCategories, locale),
    [expenseStandardCategories, locale]
  )

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

  const handleEdit = (maintenance: VehicleMaintenanceWithVehicle) => {
    setEditingMaintenance(maintenance)
    setIsDialogOpen(true)
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
        loadMaintenances()
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
      cancelled: { color: 'bg-red-100 text-red-800', icon: AlertTriangle }
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

  const maintenanceTypeFilterOptions = [
    { value: 'inspection', label: t('maintenanceTypes.inspection') },
    { value: 'repair', label: t('maintenanceTypes.repair') },
  ]

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)

  const renderStatMetric = (
    label: string,
    value: string,
    className = 'bg-white border rounded-lg p-3'
  ) => (
    <div className={className}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums mt-0.5">{value}</div>
    </div>
  )

  const renderStatsSummary = (stats: VehicleMaintenanceStats, vehicle?: Vehicle | null) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
      {renderStatMetric(t('statistics.maintenanceCount'), String(stats.count), 'bg-slate-50 border rounded-lg p-3')}
      {renderStatMetric(t('statistics.totalCost'), formatCurrency(stats.totalCost), 'bg-blue-50 border border-blue-100 rounded-lg p-3')}
      {renderStatMetric(
        t('statistics.averageCost'),
        stats.count > 0 ? formatCurrency(stats.averageCost) : '—',
        'bg-indigo-50 border border-indigo-100 rounded-lg p-3'
      )}
      {renderStatMetric(
        t('statistics.lastMaintenanceDate'),
        formatStatsDate(stats.lastMaintenanceDate),
        'bg-emerald-50 border border-emerald-100 rounded-lg p-3'
      )}
      {renderStatMetric(
        t('statistics.latestMileage'),
        stats.latestMileage != null ? `${stats.latestMileage.toLocaleString()} mi` : '—',
        'bg-amber-50 border border-amber-100 rounded-lg p-3'
      )}
      {renderStatMetric(
        t('statistics.currentMileage'),
        vehicle?.current_mileage != null ? `${vehicle.current_mileage.toLocaleString()} mi` : '—',
        'bg-gray-50 border rounded-lg p-3'
      )}
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">{t('maintenanceList')}</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={openPrintVehicleDialog}
            disabled={printingMaintenanceForms || tabVehicles.length === 0}
          >
            <Printer className="w-4 h-4 mr-2" />
            {printingMaintenanceForms ? t('buttons.printPreparing') : t('buttons.printBlankForms')}
          </Button>
          <Dialog open={isPrintDialogOpen} onOpenChange={setIsPrintDialogOpen}>
            <DialogContent className="max-w-md max-h-[85vh] flex flex-col gap-0 p-0">
              <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
                <DialogTitle>{t('printDialog.title')}</DialogTitle>
                <DialogDescription>{t('printDialog.description')}</DialogDescription>
              </DialogHeader>
              <div className="px-6 pb-2 shrink-0 flex items-center justify-between gap-2 border-b">
                <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                  <Checkbox
                    checked={printAllVehiclesSelected}
                    onCheckedChange={() => togglePrintSelectAllVehicles()}
                  />
                  {t('printDialog.selectAll')}
                </label>
                <span className="text-xs text-muted-foreground">
                  {t('printDialog.selectedCount', { count: printSelectedVehicleIds.length })}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-3 min-h-0 max-h-[min(50vh,420px)] space-y-1">
                {tabVehicles.map((vehicle) => {
                  const checked = printSelectedVehicleIds.includes(vehicle.id)
                  return (
                    <label
                      key={vehicle.id}
                      className={`flex items-start gap-2 rounded-md px-2 py-2 w-full cursor-pointer transition-colors ${
                        checked ? 'bg-primary/10' : 'hover:bg-muted/80'
                      }`}
                    >
                      <Checkbox
                        className="mt-0.5 shrink-0"
                        checked={checked}
                        onCheckedChange={() => togglePrintVehicleSelection(vehicle.id)}
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-medium leading-snug">
                          {vehicleDisplayLabel(vehicle)}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {vehicle.vehicle_type}
                          {vehicle.vehicle_number ? ` · ${vehicle.vehicle_number}` : ''}
                        </div>
                      </div>
                    </label>
                  )
                })}
              </div>
              <DialogFooter className="px-6 py-4 border-t shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsPrintDialogOpen(false)}
                  disabled={printingMaintenanceForms}
                >
                  {t('buttons.cancel')}
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleConfirmPrintMaintenanceForms()}
                  disabled={printingMaintenanceForms || printSelectedVehicleIds.length === 0}
                >
                  <Printer className="w-4 h-4 mr-2" />
                  {printingMaintenanceForms
                    ? t('buttons.printPreparing')
                    : t('printDialog.printSelected')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button variant="outline" asChild>
            <Link href={`/${locale}/admin/vehicle-maintenance-catalog`}>
              <Settings2 className="w-4 h-4 mr-2" />
              {t('schedule.manageCatalog')}
            </Link>
          </Button>
          <Button
            onClick={() => {
              setEditingMaintenance(null)
              setIsDialogOpen(true)
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            {t('addMaintenance')}
          </Button>
          <VehicleMaintenanceFormDialog
            open={isDialogOpen}
            onOpenChange={(open) => {
              setIsDialogOpen(open)
              if (!open) setEditingMaintenance(null)
            }}
            editingMaintenance={editingMaintenance}
            onSaved={loadMaintenances}
            activeCompanyVehicles={activeCompanyVehicles}
            vehicleById={vehicleById}
            maintenanceCatalog={maintenanceCatalog}
            maintenances={maintenances}
            vehicleStandardGroups={vehicleStandardGroups}
            expenseStandardCategories={expenseStandardCategories}
            paymentMethodOptions={paymentMethodOptions}
            locale={locale}
          />
        </div>
      </div>

      {/* 회사 차량 탭 */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <p className="text-sm text-muted-foreground">
              {showInactiveVehicles ? t('tabs.inactiveSection') : t('tabs.companySection')}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={toggleInactiveVehicles}
            >
              {showInactiveVehicles
                ? t('tabs.showActiveVehicles')
                : t('tabs.showInactiveVehicles', { count: inactiveMaintenanceCount })}
            </Button>
          </div>
          <div className="flex overflow-x-auto gap-1.5 -mx-1 px-1 scrollbar-hide">
            <button
              type="button"
              onClick={() => setActiveVehicleTab('all')}
              className={`flex-shrink-0 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md whitespace-nowrap ${
                activeVehicleTab === 'all'
                  ? 'bg-blue-100 text-blue-700 border border-blue-200'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              {t('tabs.all')} ({maintenanceCountByTab.get('all') ?? 0})
            </button>
            {!showInactiveVehicles && (
              <button
                type="button"
                onClick={() => setActiveVehicleTab('unassigned')}
                className={`flex-shrink-0 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md whitespace-nowrap ${
                  activeVehicleTab === 'unassigned'
                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                {t('tabs.unassigned')} ({maintenanceCountByTab.get('unassigned') ?? 0})
              </button>
            )}
            {tabVehicles.map((vehicle) => (
              <button
                key={vehicle.id}
                type="button"
                onClick={() => setActiveVehicleTab(vehicle.id)}
                className={`flex-shrink-0 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md whitespace-nowrap ${
                  activeVehicleTab === vehicle.id
                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                {vehicleDisplayLabel(vehicle)} ({maintenanceCountByTab.get(vehicle.id) ?? 0})
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 차량별 통계 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            {activeVehicleTab === 'all' ? t('statistics.byVehicle') : t('statistics.summaryTitle')}
          </CardTitle>
          {activeVehicleTab !== 'all' && (
            <CardDescription>
              {activeVehicleTab === 'unassigned'
                ? t('tabs.unassigned')
                : activeTabVehicle
                  ? vehicleDisplayLabel(activeTabVehicle)
                  : activeVehicleTab}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {activeVehicleTab === 'all' ? (
            <div className="space-y-4">
              {renderStatsSummary(activeTabStats)}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 pt-2 border-t">
                {vehicleStatsEntries.map(({ key, label, stats, vehicle }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveVehicleTab(key)}
                    className="text-left border rounded-lg p-3 hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="font-medium text-sm truncate">{label}</div>
                    {stats.count === 0 ? (
                      <p className="text-xs text-muted-foreground mt-2">{t('statistics.noRecords')}</p>
                    ) : (
                      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                        <div>
                          <dt className="text-muted-foreground">{t('statistics.maintenanceCount')}</dt>
                          <dd className="font-semibold tabular-nums">{stats.count}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">{t('statistics.totalCost')}</dt>
                          <dd className="font-semibold tabular-nums">{formatCurrency(stats.totalCost)}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">{t('statistics.lastMaintenanceDate')}</dt>
                          <dd className="font-medium">{formatStatsDate(stats.lastMaintenanceDate)}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">{t('statistics.latestMileage')}</dt>
                          <dd className="font-medium tabular-nums">
                            {stats.latestMileage != null ? `${stats.latestMileage.toLocaleString()} mi` : '—'}
                          </dd>
                        </div>
                        {vehicle?.current_mileage != null && (
                          <div className="col-span-2">
                            <dt className="text-muted-foreground">{t('statistics.currentMileage')}</dt>
                            <dd className="font-medium tabular-nums">{vehicle.current_mileage.toLocaleString()} mi</dd>
                          </div>
                        )}
                      </dl>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            renderStatsSummary(activeTabStats, activeTabVehicle)
          )}
        </CardContent>
      </Card>

      <VehicleMaintenanceSchedulePanel
        vehicles={tabVehicles}
        maintenances={scopedMaintenances.map((m) => ({
          id: m.id,
          vehicle_id: m.vehicle_id,
          maintenance_date: m.maintenance_date,
          mileage: m.mileage,
          subcategory: m.subcategory,
          mileage_interval: m.mileage_interval,
          next_maintenance_mileage: m.next_maintenance_mileage,
        }))}
        vehicleIds={scheduleVehicleIds}
        showVehicleColumn={activeVehicleTab === 'all'}
        vehicleLabel={vehicleDisplayLabel}
        formatDate={formatStatsDate}
        hidden={activeVehicleTab === 'unassigned'}
      />

      {/* 필터 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="w-4 h-4 mr-2" />
            필터
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="search">{t('filters.search')}</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder={t('filters.searchPlaceholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="maintenance_type">{t('filters.maintenanceType')}</Label>
              <Select value={maintenanceTypeFilter} onValueChange={setMaintenanceTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="정비 유형" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('filters.all')}</SelectItem>
                  {maintenanceTypeFilterOptions.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="category">{t('filters.category')}</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="카테고리" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('filters.all')}</SelectItem>
                  {standardCategoryFilterOptions.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="status">{t('filters.status')}</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="상태" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('filters.all')}</SelectItem>
                  <SelectItem value="scheduled">{t('status.scheduled')}</SelectItem>
                  <SelectItem value="in_progress">{t('status.in_progress')}</SelectItem>
                  <SelectItem value="completed">{t('status.completed')}</SelectItem>
                  <SelectItem value="cancelled">{t('status.cancelled')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex justify-end mt-4">
            <Button variant="outline" onClick={() => {
              setSearchTerm('')
              setActiveVehicleTab('all')
              setShowInactiveVehicles(false)
              setMaintenanceTypeFilter('')
              setCategoryFilter('')
              setStatusFilter('')
            }}>
              {t('buttons.resetFilters')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 정비 기록 목록 */}
      <Card>
        <CardHeader>
          <CardTitle>{t('maintenanceList')}</CardTitle>
          <CardDescription>
            {t('tabs.listCount', { count: displayedMaintenances.length })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">{t('loading')}</div>
          ) : displayedMaintenances.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('noMaintenance')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">{t('list.vehicle')}</TableHead>
                    <TableHead className="whitespace-nowrap">{t('list.maintenanceDate')}</TableHead>
                    <TableHead className="whitespace-nowrap">{t('list.mileage')}</TableHead>
                    <TableHead className="whitespace-nowrap">{t('list.maintenanceType')}</TableHead>
                    <TableHead className="min-w-[10rem] whitespace-nowrap">{t('list.standardCategory')}</TableHead>
                    <TableHead className="whitespace-nowrap">{t('list.workSubcategory')}</TableHead>
                    <TableHead className="min-w-[8rem]">{t('list.description')}</TableHead>
                    <TableHead className="whitespace-nowrap text-right">{t('list.totalCost')}</TableHead>
                    <TableHead className="whitespace-nowrap">{t('list.serviceProvider')}</TableHead>
                    <TableHead className="whitespace-nowrap">{t('list.companyExpense')}</TableHead>
                    <TableHead className="whitespace-nowrap">{t('list.status')}</TableHead>
                    <TableHead className="whitespace-nowrap">{t('list.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedMaintenances.map((maintenance) => {
                    const row = maintenance as VehicleMaintenanceWithVehicle
                    return (
                    <TableRow key={maintenance.id}>
                      <TableCell>
                        {maintenanceVehicleLabel(row, vehicleById, t('tabs.unassigned'))}
                      </TableCell>
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
                      <TableCell className="text-sm align-top">
                        <span
                          className="line-clamp-2 font-medium"
                          title={formatCategoryLabel(maintenance.category)}
                        >
                          {formatCategoryLabel(maintenance.category)}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm align-top">
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
                      <TableCell className="font-medium">
                        {formatCurrency(parseFloat(maintenance.total_cost.toString()))}
                      </TableCell>
                      <TableCell>{maintenance.service_provider || '-'}</TableCell>
                      <TableCell>
                        {maintenance.company_expense_id ? (
                          linkedExpensePaymentMethod(row) ? (
                            <Badge variant="default" className="bg-green-100 text-green-800">
                              {t('list.linked')}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">
                              {t('list.paymentPending')}
                            </Badge>
                          )
                        ) : (
                          <Badge variant="outline" className="text-gray-500">
                            {t('list.notLinked')}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(maintenance.status ?? 'completed')}</TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(maintenance)}
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="outline">
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>정비 기록 삭제</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {t('messages.confirmDelete')}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>취소</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(maintenance.id)}
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
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
