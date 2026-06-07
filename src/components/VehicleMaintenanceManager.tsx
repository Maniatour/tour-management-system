'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Database } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'
import { fetchUploadApi } from '@/lib/uploadClient'
import { apiBearerAuthHeaders } from '@/lib/api-client-bearer'
import { isInactiveVehicleStatus } from '@/lib/vehicleStatus'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
  DialogTrigger,
} from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import Link from 'next/link'
import { Plus, Search, Filter, Edit, Trash2, Calendar, Wrench, DollarSign, AlertTriangle, Settings2, Printer } from 'lucide-react'
import VehicleMaintenanceSchedulePanel from '@/components/VehicleMaintenanceSchedulePanel'
import {
  catalogGroupBilingualLabel,
  catalogItemBilingualLabel,
  catalogItemLabel,
  catalogItemMatchesSearch,
  CATALOG_GROUP_ORDER,
  groupCatalogItems,
  normalizeSubcategoriesToCatalogCodes,
  resolveCatalogIntervalDisplay,
  resolveCatalogLabelForSubcategoryKey,
  resolveLastServiceDateForCatalog,
  type VehicleMaintenanceCatalogRow,
  type VehicleMaintenanceScheduleRow,
} from '@/lib/vehicleMaintenanceCatalog'
import { catalogAppliesToVehicle } from '@/lib/vehicleMaintenanceApplicability'
import {
  inferMaintenanceTypeFromCatalogCodes,
  normalizeMaintenanceTypeBucket,
} from '@/lib/vehicleMaintenanceType'
import { toast } from 'sonner'
import { UnifiedStandardLeafPicker } from '@/components/company-expense/UnifiedStandardLeafPicker'
import type { ExpenseStandardCategoryPickRow } from '@/lib/expenseStandardCategoryPaidFor'
import { Checkbox } from '@/components/ui/checkbox'
import { PaymentMethodAutocomplete } from '@/components/expense/PaymentMethodAutocomplete'
import { usePaymentMethodOptions, type PaymentMethodOption } from '@/hooks/usePaymentMethodOptions'
import { resolvePaymentMethodTarget } from '@/lib/expensePaymentMethodNormalize'
import enMessages from '@/i18n/locales/en.json'
import {
  printBlankMaintenanceFormForVehicle,
  printBlankMaintenanceFormsForVehicles,
  type VehicleForMaintenancePrint,
} from '@/lib/buildVehicleMaintenancePrintData'
import {
  buildVehicleMaintenanceStandardGroups,
  categoryValueForMaintenanceForm,
  parseVehicleMaintenanceSubcategories,
  resolveVehicleMaintenanceCategoryDisplay,
  resolveVehicleMaintenanceWorkSubcategoryLabels,
  serializeVehicleMaintenanceSubcategories,
  isVehicleMaintenanceWorkSubcategoryKey,
  vehicleMaintenanceCategoryFilterOptions,
  VEHICLE_MAINTENANCE_DEFAULT_STANDARD_LEAF_ID,
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

function extractLinkedExpensePaymentMethod(maintenance: VehicleMaintenanceWithVehicle): string {
  const linked = maintenance.company_expenses
  if (!linked) return ''
  if (Array.isArray(linked)) return linked[0]?.payment_method ?? ''
  return linked.payment_method ?? ''
}

const WORK_SUBCATEGORY_KEYS = [
  'oil_change',
  'tire_rotation',
  'brake_pad',
  'battery',
  'filter',
  'belt',
  'spark_plug',
  'alignment',
  'car_wash',
  'windshield_wiper',
  'other',
] as const

const WORK_SUBCATEGORY_LABELS_EN = enMessages.vehicleMaintenance.subcategories as Record<string, string>

const LEGACY_PAYMENT_LABEL_TO_METHOD: Record<string, string> = {
  현금: 'cash',
  카드: 'card',
  계좌이체: 'bank_transfer',
  수표: 'check',
  기타: 'other',
}

function resolveStoredPaymentMethodId(
  raw: string | null | undefined,
  options: PaymentMethodOption[]
): string {
  const trimmed = (raw ?? '').trim()
  if (!trimmed) return ''
  if (options.some((o) => o.id === trimmed)) return trimmed

  const normalized = LEGACY_PAYMENT_LABEL_TO_METHOD[trimmed] ?? trimmed
  const pmRows = options.map((o) => ({
    id: o.id,
    method: o.method,
    display_name: o.name,
    card_holder_name: null as string | null,
  }))
  const resolved = resolvePaymentMethodTarget(normalized, pmRows)
  return resolved.suggestedTargetId ?? ''
}

type CompanyVehicleTab = 'all' | 'unassigned' | string

function isCompanyVehicle(vehicle: Pick<Vehicle, 'vehicle_category'>): boolean {
  return vehicle.vehicle_category === 'company' || !vehicle.vehicle_category
}

type VehicleLabelFields = {
  id: string
  vehicle_number?: string | null
  vehicle_type?: string | null
  nick?: string | null
}

function vehicleDisplayLabel(vehicle: VehicleLabelFields): string {
  const nick = vehicle.nick?.trim()
  if (nick) return nick
  return vehicle.vehicle_number || vehicle.vehicle_type || vehicle.id
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
    return vehicleDisplayLabel(vehicle as VehicleLabelFields)
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

interface VehicleMaintenanceFormData {
  vehicle_id: string
  maintenance_date: string
  mileage: string
  category: string
  subcategories: string[]
  description: string
  total_cost: string
  labor_cost: string
  parts_cost: string
  other_cost: string
  service_provider: string
  service_provider_contact: string
  service_provider_address: string
  warranty_period: string
  warranty_notes: string
  is_scheduled_maintenance: boolean
  next_maintenance_date: string
  next_maintenance_mileage: string
  maintenance_interval: string
  mileage_interval: string
  parts_replaced: string[]
  quality_rating: string
  satisfaction_rating: string
  issues_found: string[]
  recommendations: string[]
  photos: string[]
  receipts: string[]
  documents: string[]
  notes: string
  technician_notes: string
  status: string
  payment_method: string
  uploaded_files: File[]
}

export default function VehicleMaintenanceManager() {
  const t = useTranslations('vehicleMaintenance')
  const tCompanyExpense = useTranslations('companyExpense')
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
  const [saving, setSaving] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingMaintenance, setEditingMaintenance] = useState<VehicleMaintenance | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeVehicleTab, setActiveVehicleTab] = useState<CompanyVehicleTab>('all')
  const [showInactiveVehicles, setShowInactiveVehicles] = useState(false)
  const [maintenanceTypeFilter, setMaintenanceTypeFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [isDragOver, setIsDragOver] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [maintenanceCatalog, setMaintenanceCatalog] = useState<VehicleMaintenanceCatalogRow[]>([])
  const [formVehicleSchedules, setFormVehicleSchedules] = useState<VehicleMaintenanceScheduleRow[]>([])
  const [workTypeSearch, setWorkTypeSearch] = useState('')
  const [printingMaintenanceForms, setPrintingMaintenanceForms] = useState(false)
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false)
  const [printSelectedVehicleIds, setPrintSelectedVehicleIds] = useState<string[]>([])
  const editPaymentMethodRawRef = useRef('')
  
  const [formData, setFormData] = useState<VehicleMaintenanceFormData>({
    vehicle_id: '',
    maintenance_date: new Date().toISOString().split('T')[0],
    mileage: '',
    category: VEHICLE_MAINTENANCE_DEFAULT_STANDARD_LEAF_ID,
    subcategories: [],
    description: '',
    total_cost: '',
    labor_cost: '',
    parts_cost: '',
    other_cost: '',
    service_provider: '',
    service_provider_contact: '',
    service_provider_address: '',
    warranty_period: '',
    warranty_notes: '',
    is_scheduled_maintenance: false,
    next_maintenance_date: '',
    next_maintenance_mileage: '',
    maintenance_interval: '',
    mileage_interval: '',
    parts_replaced: [],
    quality_rating: '',
    satisfaction_rating: '',
    issues_found: [],
    recommendations: [],
    photos: [],
    receipts: [],
    documents: [],
    notes: '',
    technician_notes: '',
    status: 'completed',
    payment_method: '',
    uploaded_files: []
  })

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

  useEffect(() => {
    if (!isDialogOpen || !editPaymentMethodRawRef.current || paymentMethodOptions.length === 0) return
    const resolved = resolveStoredPaymentMethodId(editPaymentMethodRawRef.current, paymentMethodOptions)
    if (!resolved) return
    setFormData((prev) => (prev.payment_method === resolved ? prev : { ...prev, payment_method: resolved }))
  }, [isDialogOpen, paymentMethodOptions])

  useEffect(() => {
    if (!isDialogOpen || !formData.vehicle_id) {
      setFormVehicleSchedules([])
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(
          `/api/vehicle-maintenance/schedules?vehicle_id=${encodeURIComponent(formData.vehicle_id)}`,
          { headers: apiBearerAuthHeaders() }
        )
        const json = await res.json()
        if (!cancelled && res.ok) {
          setFormVehicleSchedules((json.data ?? []) as VehicleMaintenanceScheduleRow[])
        }
      } catch {
        if (!cancelled) setFormVehicleSchedules([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isDialogOpen, formData.vehicle_id])

  useEffect(() => {
    if (!isDialogOpen || !formData.vehicle_id || maintenanceCatalog.length === 0) return
    const vehicle = vehicleById.get(formData.vehicle_id)
    if (!vehicle) return
    setFormData((prev) => {
      const valid = prev.subcategories.filter((code) => {
        const item = maintenanceCatalog.find((c) => c.code === code)
        return item != null && catalogAppliesToVehicle(item, vehicle)
      })
      if (valid.length === prev.subcategories.length) return prev
      return { ...prev, subcategories: valid }
    })
  }, [isDialogOpen, formData.vehicle_id, maintenanceCatalog, vehicleById])

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const mileageValue = parseInt(formData.mileage, 10)
    if (
      !formData.vehicle_id ||
      !formData.maintenance_date ||
      !formData.category ||
      !formData.description ||
      !formData.total_cost ||
      !Number.isFinite(mileageValue) ||
      mileageValue <= 0
    ) {
      toast.error('필수 필드를 모두 입력해주세요.')
      return
    }

    try {
      setSaving(true)
      
           // 파일 업로드 처리
           let uploadedFileUrls: string[] = []
           if (formData.uploaded_files.length > 0) {
             setIsUploading(true)
             try {
               const uploadFormData = new FormData()
               uploadFormData.append('bucketType', 'maintenance')
               formData.uploaded_files.forEach(file => {
                 uploadFormData.append('files', file)
               })
               
               const uploadResponse = await fetchUploadApi(uploadFormData)
          
          if (uploadResponse.ok) {
            const uploadResult = await uploadResponse.json()
            uploadedFileUrls = uploadResult.urls
            toast.success(`${uploadedFileUrls.length}개 파일이 업로드되었습니다.`)
          } else {
            console.error('파일 업로드 실패')
            toast.error('파일 업로드에 실패했습니다.')
          }
        } finally {
          setIsUploading(false)
        }
      }
      
      // 정비 데이터 준비
      const { subcategories, uploaded_files: _uploadedFiles, ...formRest } = formData
      const maintenance_type = inferMaintenanceTypeFromCatalogCodes(
        subcategories,
        maintenanceCatalog
      )
      const submitData = {
        ...formRest,
        maintenance_type,
        subcategory: serializeVehicleMaintenanceSubcategories(subcategories),
        photos: [...formData.photos, ...uploadedFileUrls],
        receipts: [...formData.receipts, ...uploadedFileUrls], // 인보이스/영수증으로 분류
        uploaded_files: undefined // 서버로 전송하지 않음
      }
      
      const url = editingMaintenance ? `/api/vehicle-maintenance/${editingMaintenance.id}` : '/api/vehicle-maintenance'
      const method = editingMaintenance ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: {
          ...apiBearerAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData)
      })
      
      const result = await response.json()
      
      if (response.ok) {
        toast.success(editingMaintenance ? t('messages.maintenanceUpdated') : t('messages.maintenanceAdded'))
        
        // 연동된 회사 지출 정보 표시
        if (result.companyExpenseId) {
          toast.success('회사 지출도 자동으로 생성되었습니다.')
        }
        
        setIsDialogOpen(false)
        setEditingMaintenance(null)
        resetForm()
        loadMaintenances()
      } else {
        toast.error(result.error || '정비 기록 저장 중 오류가 발생했습니다.')
      }
    } catch (error) {
      console.error('정비 기록 저장 오류:', error)
      toast.error('정비 기록 저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = async (maintenance: VehicleMaintenanceWithVehicle) => {
    setEditingMaintenance(maintenance)

    let storedPaymentMethod = extractLinkedExpensePaymentMethod(maintenance)
    if (!storedPaymentMethod && maintenance.company_expense_id) {
      try {
        const { data } = await supabase
          .from('company_expenses')
          .select('payment_method')
          .eq('id', maintenance.company_expense_id)
          .maybeSingle()
        storedPaymentMethod = data?.payment_method ?? ''
      } catch {
        storedPaymentMethod = ''
      }
    }

    editPaymentMethodRawRef.current = storedPaymentMethod

    setFormData({
      vehicle_id: maintenance.vehicle_id ?? '',
      maintenance_date: maintenance.maintenance_date,
      mileage: maintenance.mileage?.toString() || '',
      category: categoryValueForMaintenanceForm(maintenance.category, expenseStandardCategories),
      subcategories:
        maintenanceCatalog.length > 0
          ? normalizeSubcategoriesToCatalogCodes(maintenance.subcategory, maintenanceCatalog)
          : parseVehicleMaintenanceSubcategories(maintenance.subcategory),
      description: maintenance.description,
      total_cost: maintenance.total_cost.toString(),
      labor_cost: maintenance.labor_cost?.toString() || '',
      parts_cost: maintenance.parts_cost?.toString() || '',
      other_cost: maintenance.other_cost?.toString() || '',
      service_provider: maintenance.service_provider || '',
      service_provider_contact: maintenance.service_provider_contact || '',
      service_provider_address: maintenance.service_provider_address || '',
      warranty_period: maintenance.warranty_period?.toString() || '',
      warranty_notes: maintenance.warranty_notes || '',
      is_scheduled_maintenance: maintenance.is_scheduled_maintenance ?? false,
      next_maintenance_date: maintenance.next_maintenance_date || '',
      next_maintenance_mileage: maintenance.next_maintenance_mileage?.toString() || '',
      maintenance_interval: maintenance.maintenance_interval?.toString() || '',
      mileage_interval: maintenance.mileage_interval?.toString() || '',
      parts_replaced: maintenance.parts_replaced || [],
      quality_rating: maintenance.quality_rating?.toString() || '',
      satisfaction_rating: maintenance.satisfaction_rating?.toString() || '',
      issues_found: maintenance.issues_found || [],
      recommendations: maintenance.recommendations || [],
      photos: maintenance.photos || [],
      receipts: maintenance.receipts || [],
      documents: maintenance.documents || [],
      notes: maintenance.notes || '',
      technician_notes: maintenance.technician_notes || '',
      status: maintenance.status ?? 'completed',
      payment_method: resolveStoredPaymentMethodId(storedPaymentMethod, paymentMethodOptions),
      uploaded_files: []
    })
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

  const resetForm = () => {
    editPaymentMethodRawRef.current = ''
    setWorkTypeSearch('')
    setFormData({
      vehicle_id: '',
      maintenance_date: new Date().toISOString().split('T')[0],
      mileage: '',
      category: VEHICLE_MAINTENANCE_DEFAULT_STANDARD_LEAF_ID,
      subcategories: [],
      description: '',
      total_cost: '',
      labor_cost: '',
      parts_cost: '',
      other_cost: '',
      service_provider: '',
      service_provider_contact: '',
      service_provider_address: '',
      warranty_period: '',
      warranty_notes: '',
      is_scheduled_maintenance: false,
      next_maintenance_date: '',
      next_maintenance_mileage: '',
      maintenance_interval: '',
      mileage_interval: '',
      parts_replaced: [],
      quality_rating: '',
      satisfaction_rating: '',
      issues_found: [],
      recommendations: [],
      photos: [],
      receipts: [],
      documents: [],
      notes: '',
      technician_notes: '',
      status: 'completed',
      payment_method: '',
      uploaded_files: []
    })
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

  const formSelectedVehicle = useMemo(
    () => (formData.vehicle_id ? vehicleById.get(formData.vehicle_id) : undefined),
    [formData.vehicle_id, vehicleById]
  )

  const formScheduleByCode = useMemo(
    () => new Map(formVehicleSchedules.map((s) => [s.catalog_code, s])),
    [formVehicleSchedules]
  )

  const catalogGroupedForForm = useMemo(() => {
    if (!formSelectedVehicle) return new Map<string, VehicleMaintenanceCatalogRow[]>()
    const applicable = maintenanceCatalog.filter((item) =>
      catalogAppliesToVehicle(item, formSelectedVehicle)
    )
    return groupCatalogItems(applicable)
  }, [maintenanceCatalog, formSelectedVehicle])

  const catalogGroupLabels = useCallback(
    (group: string) => {
      const ko = t(`catalogGroups.${group}`)
      const en =
        (enMessages.vehicleMaintenance.catalogGroups as Record<string, string>)[group] ?? null
      return catalogGroupBilingualLabel(ko, en)
    },
    [t]
  )

  const catalogGroupedForFormFiltered = useMemo(() => {
    const q = workTypeSearch.trim()
    if (!q) return catalogGroupedForForm
    const result = new Map<string, VehicleMaintenanceCatalogRow[]>()
    for (const [group, items] of catalogGroupedForForm) {
      const { ko, en } = catalogGroupLabels(group)
      const groupLabel = [ko, en].filter(Boolean).join(' ')
      const filtered = items.filter((item) =>
        catalogItemMatchesSearch(item, q, groupLabel)
      )
      if (filtered.length > 0) result.set(group, filtered)
    }
    return result
  }, [catalogGroupedForForm, workTypeSearch, catalogGroupLabels])

  const formLastServiceByCode = useMemo(() => {
    if (!formData.vehicle_id || maintenanceCatalog.length === 0) {
      return new Map<string, string>()
    }
    const map = new Map<string, string>()
    for (const item of maintenanceCatalog) {
      if (formSelectedVehicle && !catalogAppliesToVehicle(item, formSelectedVehicle)) continue
      const lastDate = resolveLastServiceDateForCatalog({
        catalogCode: item.code,
        catalog: maintenanceCatalog,
        vehicleId: formData.vehicle_id,
        maintenances,
        schedule: formScheduleByCode.get(item.code) ?? null,
      })
      if (lastDate) map.set(item.code, lastDate)
    }
    return map
  }, [
    formData.vehicle_id,
    maintenanceCatalog,
    maintenances,
    formScheduleByCode,
    formSelectedVehicle,
  ])

  const formatWorkTypeMileageColumn = useCallback(
    (item: VehicleMaintenanceCatalogRow) => {
      const schedule = formScheduleByCode.get(item.code) ?? null
      const { miles, months, isInspectionOnly } = resolveCatalogIntervalDisplay(
        item,
        schedule,
        formSelectedVehicle?.engine_oil_change_cycle,
        formSelectedVehicle?.maintenance_duty_preset ?? 'standard'
      )
      return {
        miles:
          miles != null
            ? t('schedule.intervalMiles', { miles: miles.toLocaleString() })
            : null,
        months:
          months != null ? t('schedule.intervalMonths', { months }) : null,
        inspectionOnly: isInspectionOnly,
      }
    },
    [formScheduleByCode, formSelectedVehicle, t]
  )

  const workSubcategoryOptions = useMemo(() => {
    if (maintenanceCatalog.length > 0) {
      return maintenanceCatalog.map((item) => ({
        value: item.code,
        label: catalogItemLabel(item, locale),
        group: item.category_group,
      }))
    }
    return WORK_SUBCATEGORY_KEYS.map((value) => ({
      value,
      label: WORK_SUBCATEGORY_LABELS_EN[value] ?? value,
      group: 'legacy',
    }))
  }, [maintenanceCatalog, locale])

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

  // 파일 업로드 핸들러
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    setFormData(prev => ({
      ...prev,
      uploaded_files: [...prev.uploaded_files, ...files]
    }))
  }

  // 파일 제거 핸들러
  const removeFile = (index: number) => {
    setFormData(prev => ({
      ...prev,
      uploaded_files: prev.uploaded_files.filter((_, i) => i !== index)
    }))
  }

  // 드래그 앤 드롭 핸들러
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    
    const files = Array.from(e.dataTransfer.files)
    const validFiles = files.filter(file => {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
      return allowedTypes.includes(file.type) && file.size <= 10 * 1024 * 1024
    })
    
    if (validFiles.length !== files.length) {
      toast.error('일부 파일이 지원되지 않는 형식이거나 크기가 너무 큽니다.')
    }
    
    if (validFiles.length > 0) {
      setFormData(prev => ({
        ...prev,
        uploaded_files: [...prev.uploaded_files, ...validFiles]
      }))
      toast.success(`${validFiles.length}개 파일이 추가되었습니다.`)
    }
  }

  // 클립보드 붙여넣기 핸들러
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items)
    const files: File[] = []
    
    items.forEach(item => {
      if (item.kind === 'file') {
        const file = item.getAsFile()
        if (file) {
          const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf']
          if (allowedTypes.includes(file.type) && file.size <= 10 * 1024 * 1024) {
            files.push(file)
          }
        }
      }
    })
    
    if (files.length > 0) {
      setFormData(prev => ({
        ...prev,
        uploaded_files: [...prev.uploaded_files, ...files]
      }))
      toast.success(`${files.length}개 파일이 붙여넣기되었습니다.`)
    }
  }

  const subcategories = workSubcategoryOptions

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
          <Dialog
            open={isDialogOpen}
            onOpenChange={(open) => {
              setIsDialogOpen(open)
              if (!open) setWorkTypeSearch('')
            }}
          >
          <DialogTrigger asChild>
            <Button onClick={() => {
              resetForm()
              setEditingMaintenance(null)
            }}>
              <Plus className="w-4 h-4 mr-2" />
              {t('addMaintenance')}
            </Button>
          </DialogTrigger>
          
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col gap-0 p-0">
            <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
              <DialogTitle>
                {editingMaintenance ? t('buttons.edit') : t('addMaintenance')}
              </DialogTitle>
              <DialogDescription>
                {editingMaintenance ? '정비 기록을 수정하세요.' : '새로운 정비 기록을 등록하세요.'}
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 border-t">
              <div className="px-6 py-3 border-b shrink-0 grid grid-cols-1 sm:grid-cols-[minmax(0,11rem)_1fr] gap-4 items-end">
                <div className="w-full max-w-[11rem]">
                  <Label htmlFor="vehicle_id">{t('form.vehicleId')} *</Label>
                  <Select
                    value={formData.vehicle_id}
                    onValueChange={(value) => setFormData({ ...formData, vehicle_id: value })}
                  >
                    <SelectTrigger id="vehicle_id" className="mt-1 h-9 text-sm">
                      <SelectValue placeholder="차량 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeCompanyVehicles.map((vehicle) => (
                        <SelectItem key={vehicle.id} value={vehicle.id}>
                          {vehicleDisplayLabel(vehicle)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-0">
                  <Label htmlFor="category">{t('form.category')} *</Label>
                  <UnifiedStandardLeafPicker
                    groups={vehicleStandardGroups}
                    value={formData.category}
                    onPick={(leafId) =>
                      setFormData({
                        ...formData,
                        category: leafId || VEHICLE_MAINTENANCE_DEFAULT_STANDARD_LEAF_ID,
                      })
                    }
                    allowClear={false}
                    compact
                    placeholderWhenEmpty={t('form.standardCategoryPlaceholder')}
                    parentOpen={isDialogOpen}
                    disabled={vehicleStandardGroups.length === 0}
                    className="mt-1 space-y-0"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-[minmax(400px,480px)_1fr] flex-1 min-h-0">
                <aside className="flex flex-col border-b lg:border-b-0 lg:border-r bg-muted/20 min-h-0 max-h-[min(65vh,680px)]">
                  <div className="px-3 py-3 border-b shrink-0 space-y-2">
                    <div className="space-y-1">
                      <Label className="text-sm font-semibold">{t('form.subcategory')}</Label>
                      {!formSelectedVehicle ? (
                        <p className="text-xs text-amber-700">{t('form.workTypeSelectVehicle')}</p>
                      ) : formData.subcategories.length > 0 ? (
                        <p className="text-xs text-muted-foreground">
                          {formData.subcategories.length}개 선택
                        </p>
                      ) : null}
                    </div>
                    {formSelectedVehicle && (
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                        <Input
                          type="search"
                          value={workTypeSearch}
                          onChange={(e) => setWorkTypeSearch(e.target.value)}
                          placeholder={t('form.workTypeSearchPlaceholder')}
                          className="h-8 pl-8 pr-8 text-xs"
                        />
                        {workTypeSearch.trim() && (
                          <button
                            type="button"
                            onClick={() => setWorkTypeSearch('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                            aria-label={t('buttons.resetFilters')}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {formSelectedVehicle && maintenanceCatalog.length > 0 && (
                    <div className="grid grid-cols-[auto_1fr_4.75rem_4.75rem] gap-x-2 gap-y-0 px-2 py-1.5 border-b text-[10px] font-medium text-muted-foreground shrink-0">
                      <span />
                      <span>{t('form.subcategory')}</span>
                      <span className="text-right">{t('form.workTypeMileage')}</span>
                      <span className="text-right">{t('form.workTypeLastService')}</span>
                    </div>
                  )}
                  <div className="flex-1 overflow-y-auto px-2 py-2 space-y-4">
                    {!formSelectedVehicle ? (
                      <p className="text-sm text-muted-foreground px-2 py-6 text-center">
                        {t('form.workTypeSelectVehicle')}
                      </p>
                    ) : maintenanceCatalog.length > 0 ? (
                      catalogGroupedForFormFiltered.size === 0 ? (
                        <p className="text-sm text-muted-foreground px-2 py-6 text-center">
                          {t('form.workTypeSearchNoResults')}
                        </p>
                      ) : (
                      [...catalogGroupedForFormFiltered.entries()].map(([group, items]) => {
                        const groupLabels = catalogGroupLabels(group)
                        return (
                        <div key={group}>
                          <div className="sticky top-0 z-10 bg-muted/95 backdrop-blur-sm px-2 py-1.5 text-xs font-semibold text-muted-foreground border-b border-border/60">
                            <div>{groupLabels.ko}</div>
                            {groupLabels.en && (
                              <div className="text-[10px] font-normal opacity-80 mt-0.5">
                                {groupLabels.en}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col gap-0.5 py-1">
                            {items.map((item) => {
                              const checked = formData.subcategories.includes(item.code)
                              const { ko, en } = catalogItemBilingualLabel(item)
                              const intervalCols = formatWorkTypeMileageColumn(item)
                              const lastServiceDate = checked
                                ? formLastServiceByCode.get(item.code) ?? null
                                : null
                              return (
                                <label
                                  key={item.code}
                                  className={`grid grid-cols-[auto_1fr_4.75rem_4.75rem] gap-x-2 items-start rounded-md px-2 py-1.5 w-full cursor-pointer transition-colors ${
                                    checked ? 'bg-primary/10' : 'hover:bg-muted/80'
                                  }`}
                                >
                                  <Checkbox
                                    className="mt-0.5 shrink-0"
                                    checked={checked}
                                    onCheckedChange={(isChecked) => {
                                      setFormData((prev) => ({
                                        ...prev,
                                        subcategories:
                                          isChecked === true
                                            ? [...prev.subcategories, item.code]
                                            : prev.subcategories.filter((value) => value !== item.code),
                                      }))
                                    }}
                                  />
                                  <div className="min-w-0 pr-1">
                                    <span className="text-sm leading-snug block">{ko}</span>
                                    {en && (
                                      <span className="text-[11px] text-muted-foreground leading-snug block">
                                        {en}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-right text-[11px] text-muted-foreground tabular-nums leading-snug">
                                    {intervalCols.miles ? (
                                      <div>{intervalCols.miles}</div>
                                    ) : intervalCols.inspectionOnly ? (
                                      <div>{t('schedule.intervalInspection')}</div>
                                    ) : null}
                                    {intervalCols.months && (
                                      <div className={intervalCols.miles ? 'mt-0.5' : ''}>
                                        {intervalCols.months}
                                      </div>
                                    )}
                                    {!intervalCols.miles &&
                                      !intervalCols.months &&
                                      !intervalCols.inspectionOnly && (
                                        <span>—</span>
                                      )}
                                  </div>
                                  <div className="text-right text-[11px] tabular-nums leading-snug">
                                    {checked ? (
                                      lastServiceDate ? (
                                        <span className="text-foreground">
                                          {formatStatsDate(lastServiceDate)}
                                        </span>
                                      ) : (
                                        <span className="text-muted-foreground">
                                          {t('schedule.statusNoRecord')}
                                        </span>
                                      )
                                    ) : (
                                      <span className="text-muted-foreground/40">—</span>
                                    )}
                                  </div>
                                </label>
                              )
                            })}
                          </div>
                        </div>
                        )
                      })
                      )
                    ) : (
                      <div className="flex flex-col gap-0.5">
                        {subcategories.map((option) => {
                          const checked = formData.subcategories.includes(option.value)
                          return (
                            <label
                              key={option.value}
                              className={`flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 w-full transition-colors ${
                                checked ? 'bg-primary/10' : 'hover:bg-muted/80'
                              }`}
                            >
                              <Checkbox
                                className="mt-0.5 shrink-0"
                                checked={checked}
                                onCheckedChange={(isChecked) => {
                                  setFormData((prev) => ({
                                    ...prev,
                                    subcategories:
                                      isChecked === true
                                        ? [...prev.subcategories, option.value]
                                        : prev.subcategories.filter((value) => value !== option.value),
                                  }))
                                }}
                              />
                              <span className="text-sm leading-snug">{option.label}</span>
                            </label>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </aside>

                <div className="overflow-y-auto px-6 py-4 space-y-4 min-h-0 max-h-[min(65vh,680px)]">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="maintenance_date">{t('form.maintenanceDate')} *</Label>
                  <Input
                    id="maintenance_date"
                    type="date"
                    value={formData.maintenance_date}
                    onChange={(e) => setFormData({ ...formData, maintenance_date: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="mileage">{t('form.mileage')} *</Label>
                  <Input
                    id="mileage"
                    type="number"
                    min={1}
                    step={1}
                    value={formData.mileage}
                    onChange={(e) => setFormData({ ...formData, mileage: e.target.value })}
                    required
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="description">{t('form.description')} *</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                />
              </div>
              
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="total_cost">{t('form.totalCost')} *</Label>
                  <Input
                    id="total_cost"
                    type="number"
                    step="0.01"
                    value={formData.total_cost}
                    onChange={(e) => setFormData({ ...formData, total_cost: e.target.value })}
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="labor_cost">{t('form.laborCost')}</Label>
                  <Input
                    id="labor_cost"
                    type="number"
                    step="0.01"
                    value={formData.labor_cost}
                    onChange={(e) => setFormData({ ...formData, labor_cost: e.target.value })}
                  />
                </div>
                
                <div>
                  <Label htmlFor="parts_cost">{t('form.partsCost')}</Label>
                  <Input
                    id="parts_cost"
                    type="number"
                    step="0.01"
                    value={formData.parts_cost}
                    onChange={(e) => setFormData({ ...formData, parts_cost: e.target.value })}
                  />
                </div>
                
                <div>
                  <Label htmlFor="other_cost">{t('form.otherCost')}</Label>
                  <Input
                    id="other_cost"
                    type="number"
                    step="0.01"
                    value={formData.other_cost}
                    onChange={(e) => setFormData({ ...formData, other_cost: e.target.value })}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="payment_method">{tCompanyExpense('form.paymentMethod')} *</Label>
                  <PaymentMethodAutocomplete
                    options={paymentMethodOptions}
                    valueId={formData.payment_method || ''}
                    onChange={(id) => setFormData({ ...formData, payment_method: id })}
                    disabled={saving}
                    pleaseSelectLabel={tCompanyExpense('form.selectPaymentMethodPlaceholder')}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
                
                <div>
                  <Label htmlFor="service_provider">{t('form.serviceProvider')}</Label>
                  <Input
                    id="service_provider"
                    value={formData.service_provider}
                    onChange={(e) => setFormData({ ...formData, service_provider: e.target.value })}
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="service_provider_address">{t('form.serviceProviderAddress')}</Label>
                <Textarea
                  id="service_provider_address"
                  value={formData.service_provider_address}
                  onChange={(e) => setFormData({ ...formData, service_provider_address: e.target.value })}
                />
              </div>
              
              {/* 파일 업로드 섹션 */}
              <div>
                <Label htmlFor="file_upload">인보이스/영수증 첨부</Label>
                <div 
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200 ${
                    isUploading 
                      ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-50' 
                      : isDragOver 
                        ? 'border-blue-500 bg-blue-100 scale-105 cursor-pointer' 
                        : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50 cursor-pointer'
                  }`}
                  onDragOver={!isUploading ? handleDragOver : undefined}
                  onDragEnter={!isUploading ? handleDragEnter : undefined}
                  onDragLeave={!isUploading ? handleDragLeave : undefined}
                  onDrop={!isUploading ? handleDrop : undefined}
                  onPaste={!isUploading ? handlePaste : undefined}
                  tabIndex={!isUploading ? 0 : -1}
                  onClick={!isUploading ? () => document.getElementById('file_upload')?.click() : undefined}
                >
                  <div className="flex flex-col items-center space-y-2">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                      isUploading 
                        ? 'bg-blue-100' 
                        : isDragOver 
                          ? 'bg-blue-200' 
                          : 'bg-gray-100'
                    }`}>
                      {isUploading ? (
                        <div className="animate-spin">
                          <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </div>
                      ) : isDragOver ? (
                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      ) : (
                        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <p className={`text-sm font-medium transition-colors ${
                        isDragOver ? 'text-blue-900' : 'text-gray-900'
                      }`}>
                        {isUploading 
                          ? '파일 업로드 중...' 
                          : isDragOver 
                            ? '파일을 여기에 놓으세요' 
                            : '파일을 드래그하여 놓거나 클릭하여 선택하세요'
                        }
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        또는 클립보드에서 붙여넣기 (Ctrl+V)
                      </p>
                    </div>
                    <div className="text-xs text-gray-400">
                      지원 형식: JPG, PNG, GIF, PDF, DOC, DOCX (최대 10MB)
                    </div>
                  </div>
                  
                  <input
                    id="file_upload"
                    type="file"
                    multiple
                    accept="image/*,.pdf,.doc,.docx"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  
                  {/* 업로드된 파일 목록 */}
                  {formData.uploaded_files.length > 0 && (
                    <div className="mt-6 pt-4 border-t border-gray-200">
                      <h4 className="text-sm font-medium mb-3 text-gray-900">업로드된 파일 ({formData.uploaded_files.length}개)</h4>
                      <div className="space-y-2">
                        {formData.uploaded_files.map((file, index) => (
                          <div key={index} className="flex items-center justify-between bg-white border border-gray-200 p-3 rounded-lg hover:bg-gray-50">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                                {file.type.startsWith('image/') ? (
                                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                ) : (
                                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                )}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900">{file.name}</p>
                                <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                              </div>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation()
                                removeFile(index)
                              }}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="warranty_period">{t('form.warrantyPeriod')}</Label>
                  <Input
                    id="warranty_period"
                    type="number"
                    value={formData.warranty_period}
                    onChange={(e) => setFormData({ ...formData, warranty_period: e.target.value })}
                  />
                </div>
                
                <div>
                  <Label htmlFor="next_maintenance_date">{t('form.nextMaintenanceDate')}</Label>
                  <Input
                    id="next_maintenance_date"
                    type="date"
                    value={formData.next_maintenance_date}
                    onChange={(e) => setFormData({ ...formData, next_maintenance_date: e.target.value })}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="quality_rating">{t('form.qualityRating')}</Label>
                  <Select value={formData.quality_rating} onValueChange={(value) => setFormData({ ...formData, quality_rating: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="품질 평가" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 - 매우 나쁨</SelectItem>
                      <SelectItem value="2">2 - 나쁨</SelectItem>
                      <SelectItem value="3">3 - 보통</SelectItem>
                      <SelectItem value="4">4 - 좋음</SelectItem>
                      <SelectItem value="5">5 - 매우 좋음</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="satisfaction_rating">{t('form.satisfactionRating')}</Label>
                  <Select value={formData.satisfaction_rating} onValueChange={(value) => setFormData({ ...formData, satisfaction_rating: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="만족도 평가" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 - 매우 불만족</SelectItem>
                      <SelectItem value="2">2 - 불만족</SelectItem>
                      <SelectItem value="3">3 - 보통</SelectItem>
                      <SelectItem value="4">4 - 만족</SelectItem>
                      <SelectItem value="5">5 - 매우 만족</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <Label htmlFor="notes">{t('form.notes')}</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>
              
              <div>
                <Label htmlFor="technician_notes">{t('form.technicianNotes')}</Label>
                <Textarea
                  id="technician_notes"
                  value={formData.technician_notes}
                  onChange={(e) => setFormData({ ...formData, technician_notes: e.target.value })}
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is_scheduled_maintenance"
                  checked={formData.is_scheduled_maintenance}
                  onChange={(e) => setFormData({ ...formData, is_scheduled_maintenance: e.target.checked })}
                />
                <Label htmlFor="is_scheduled_maintenance">{t('form.isScheduledMaintenance')}</Label>
              </div>
              
              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  {t('buttons.cancel')}
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? '저장 중...' : t('buttons.save')}
                </Button>
              </div>
                </div>
              </div>
            </form>
          </DialogContent>
        </Dialog>
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
                          <Badge variant="default" className="bg-green-100 text-green-800">
                            {t('list.linked')}
                          </Badge>
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
