import { apiBearerAuthHeaders } from '@/lib/api-client-bearer'
import { unifiedStandardTriggerLabel } from '@/lib/companyExpenseStandardUnified'
import type { ExpenseStandardCategoryPickRow } from '@/lib/expenseStandardCategoryPaidFor'
import { catalogAppliesToVehicle } from '@/lib/vehicleMaintenanceApplicability'
import {
  CATALOG_GROUP_ORDER,
  catalogItemLabel,
  groupCatalogItems,
  resolveCatalogIntervalDisplay,
  type VehicleMaintenanceCatalogRow,
  type VehicleMaintenanceScheduleRow,
} from '@/lib/vehicleMaintenanceCatalog'
import {
  buildVehicleMaintenanceStandardGroups,
  VEHICLE_MAINTENANCE_DEFAULT_STANDARD_LEAF_ID,
} from '@/lib/vehicleMaintenanceStandardCategory'
import {
  formatEnCatalogInterval,
  openVehicleMaintenancePrintBatch,
  type VehicleMaintenancePrintInput,
  type VehicleMaintenancePrintWorkItem,
} from '@/lib/vehicleMaintenancePrint'
import { supabase } from '@/lib/supabase'

export type VehicleForMaintenancePrint = {
  id: string
  vehicle_number: string
  vehicle_type?: string | null
  vin?: string | null
  nick?: string | null
  engine_oil_change_cycle?: number | null
  maintenance_duty_preset?: string | null
  fuel_type?: string | null
  maintenance_vehicle_class?: string | null
}

export function vehicleMaintenanceDisplayLabel(vehicle: VehicleForMaintenancePrint): string {
  const nick = vehicle.nick?.trim()
  if (nick) return nick
  return vehicle.vehicle_number || vehicle.vehicle_type || vehicle.id
}

export function vehicleMaintenancePrintHeroName(vehicle: VehicleForMaintenancePrint): string {
  const nick = vehicle.nick?.trim()
  if (nick) return nick
  return vehicle.vehicle_number?.trim() || vehicle.vehicle_type?.trim() || 'Vehicle'
}

export function buildWorkItemsForVehiclePrint(params: {
  vehicle: VehicleForMaintenancePrint
  catalog: VehicleMaintenanceCatalogRow[]
  schedules: VehicleMaintenanceScheduleRow[]
  checkedCodes?: Set<string>
}): VehicleMaintenancePrintWorkItem[] {
  const { vehicle, catalog, schedules } = params
  const checked = params.checkedCodes ?? new Set<string>()
  const scheduleByCode = new Map(schedules.map((s) => [s.catalog_code, s]))
  const grouped = groupCatalogItems(
    catalog.filter((item) => catalogAppliesToVehicle(item, vehicle))
  )
  const workItems: VehicleMaintenancePrintWorkItem[] = []

  const append = (items: VehicleMaintenanceCatalogRow[]) => {
    for (const item of items) {
      const schedule = scheduleByCode.get(item.code) ?? null
      const { miles, months, isInspectionOnly } = resolveCatalogIntervalDisplay(
        item,
        schedule,
        vehicle.engine_oil_change_cycle,
        vehicle.maintenance_duty_preset ?? 'standard'
      )
      workItems.push({
        groupKey: item.category_group,
        label: catalogItemLabel(item, 'en'),
        interval: formatEnCatalogInterval(miles, months, isInspectionOnly),
        lastService: null,
        checked: checked.has(item.code),
      })
    }
  }

  for (const group of CATALOG_GROUP_ORDER) {
    const items = grouped.get(group)
    if (items?.length) append(items)
  }
  for (const [group, items] of grouped) {
    if ((CATALOG_GROUP_ORDER as readonly string[]).includes(group)) continue
    if (items.length) append(items)
  }

  return workItems
}

export function buildBlankVehicleMaintenancePrintInput(params: {
  vehicle: VehicleForMaintenancePrint
  catalog: VehicleMaintenanceCatalogRow[]
  schedules: VehicleMaintenanceScheduleRow[]
  categoryLabel: string
}): VehicleMaintenancePrintInput {
  const { vehicle, catalog, schedules, categoryLabel } = params
  return {
    vehicleLabel: vehicleMaintenanceDisplayLabel(vehicle),
    vehicleHeroName: vehicleMaintenancePrintHeroName(vehicle),
    vehicleNumber: vehicle.vehicle_number,
    vehicleType: vehicle.vehicle_type ?? null,
    vin: vehicle.vin ?? null,
    blankTemplate: true,
    categoryLabel,
    maintenanceDate: '',
    mileage: '',
    maintenanceTypeKey: 'repair',
    workItems: buildWorkItemsForVehiclePrint({
      vehicle,
      catalog,
      schedules,
      checkedCodes: new Set(),
    }),
    description: '',
    totalCost: '',
    laborCost: '',
    partsCost: '',
    otherCost: '',
    paymentMethodLabel: '',
    serviceProvider: '',
    serviceProviderAddress: '',
    warrantyPeriod: '',
    nextMaintenanceDate: '',
    qualityRating: '',
    satisfactionRating: '',
    notes: '',
    technicianNotes: '',
    isScheduledMaintenance: false,
  }
}

export async function fetchMaintenanceCatalogForPrint(): Promise<VehicleMaintenanceCatalogRow[]> {
  try {
    const res = await fetch('/api/vehicle-maintenance/catalog', {
      headers: apiBearerAuthHeaders(),
    })
    if (!res.ok) return []
    const json = await res.json()
    return Array.isArray(json.data) ? (json.data as VehicleMaintenanceCatalogRow[]) : []
  } catch {
    return []
  }
}

export async function fetchVehicleMaintenanceSchedulesForPrint(
  vehicleId: string
): Promise<VehicleMaintenanceScheduleRow[]> {
  try {
    const res = await fetch(
      `/api/vehicle-maintenance/schedules?vehicle_id=${encodeURIComponent(vehicleId)}`,
      { headers: apiBearerAuthHeaders() }
    )
    if (!res.ok) return []
    const json = await res.json()
    return Array.isArray(json.data) ? (json.data as VehicleMaintenanceScheduleRow[]) : []
  } catch {
    return []
  }
}

export async function fetchExpenseStandardCategoriesForPrint(): Promise<
  ExpenseStandardCategoryPickRow[]
> {
  try {
    const { data, error } = await supabase
      .from('expense_standard_categories')
      .select('id, name, name_ko, parent_id, tax_deductible, display_order, is_active')
      .order('display_order', { ascending: true })
    if (error) return []
    return (data as ExpenseStandardCategoryPickRow[]) || []
  } catch {
    return []
  }
}

function resolveDefaultCategoryLabel(categories: ExpenseStandardCategoryPickRow[]): string {
  const groupsEn = buildVehicleMaintenanceStandardGroups(categories, 'en')
  return (
    unifiedStandardTriggerLabel(groupsEn, VEHICLE_MAINTENANCE_DEFAULT_STANDARD_LEAF_ID) || '—'
  )
}

export async function printBlankMaintenanceFormsForVehicles(
  vehicles: VehicleForMaintenancePrint[]
): Promise<void> {
  if (vehicles.length === 0) return

  const [catalog, categories] = await Promise.all([
    fetchMaintenanceCatalogForPrint(),
    fetchExpenseStandardCategoriesForPrint(),
  ])
  const categoryLabel = resolveDefaultCategoryLabel(categories)

  const schedulesList = await Promise.all(
    vehicles.map(async (vehicle) => ({
      vehicleId: vehicle.id,
      schedules: await fetchVehicleMaintenanceSchedulesForPrint(vehicle.id),
    }))
  )
  const schedulesByVehicleId = new Map(
    schedulesList.map((row) => [row.vehicleId, row.schedules])
  )

  const sorted = [...vehicles].sort((a, b) =>
    vehicleMaintenanceDisplayLabel(a).localeCompare(
      vehicleMaintenanceDisplayLabel(b),
      'en'
    )
  )

  const inputs = sorted.map((vehicle) =>
    buildBlankVehicleMaintenancePrintInput({
      vehicle,
      catalog,
      schedules: schedulesByVehicleId.get(vehicle.id) ?? [],
      categoryLabel,
    })
  )

  openVehicleMaintenancePrintBatch(inputs)
}

export async function printBlankMaintenanceFormForVehicle(
  vehicle: VehicleForMaintenancePrint
): Promise<void> {
  await printBlankMaintenanceFormsForVehicles([vehicle])
}
