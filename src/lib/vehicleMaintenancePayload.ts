import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import {
  isLegacyMechanicalCategory,
  serializeVehicleMaintenanceSubcategories,
  VEHICLE_MAINTENANCE_DEFAULT_STANDARD_LEAF_ID,
} from '@/lib/vehicleMaintenanceStandardCategory'

type VehicleMaintenanceInsert = Database['public']['Tables']['vehicle_maintenance']['Insert']
type VehicleMaintenanceUpdate = Database['public']['Tables']['vehicle_maintenance']['Update']

function parseOptionalInt(value: unknown): number | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  const n = parseInt(String(value), 10)
  return Number.isFinite(n) ? n : null
}

function parseOptionalFloat(value: unknown): number | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  const n = parseFloat(String(value))
  return Number.isFinite(n) ? n : null
}

function parseOptionalString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  const s = String(value).trim()
  return s === '' ? null : s
}

function parseStringArray(value: unknown): string[] | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (!Array.isArray(value)) return null
  return value.map(String)
}

/** vehicle_maintenance PK (TEXT, DB default 없음) */
export function generateVehicleMaintenanceId(): string {
  return `MAINT-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

/** 폼/API body → vehicle_maintenance 저장 필드 (payment_method 등 비테이블 필드 제외) */
export function parseVehicleMaintenanceBody(body: Record<string, unknown>): {
  maintenance: VehicleMaintenanceInsert | VehicleMaintenanceUpdate
  payment_method: string | null
} {
  const payment_method = parseOptionalString(body.payment_method) ?? null

  const maintenance: VehicleMaintenanceUpdate = {}

  const vehicle_id = parseOptionalString(body.vehicle_id)
  if (vehicle_id !== undefined) maintenance.vehicle_id = vehicle_id

  const maintenance_date = parseOptionalString(body.maintenance_date)
  if (maintenance_date !== undefined && maintenance_date) maintenance.maintenance_date = maintenance_date

  const maintenance_type = parseOptionalString(body.maintenance_type)
  if (maintenance_type !== undefined && maintenance_type) maintenance.maintenance_type = maintenance_type

  const category = parseOptionalString(body.category)
  const subcategory = (() => {
    if (body.subcategories !== undefined) {
      if (body.subcategories === null) return null
      if (Array.isArray(body.subcategories)) {
        return serializeVehicleMaintenanceSubcategories(body.subcategories.map(String))
      }
    }
    if (body.subcategory !== undefined) {
      if (body.subcategory === null) return null
      if (Array.isArray(body.subcategory)) {
        return serializeVehicleMaintenanceSubcategories(body.subcategory.map(String))
      }
    }
    return parseOptionalString(body.subcategory)
  })()
  if (category !== undefined && category) {
    if (isLegacyMechanicalCategory(category)) {
      maintenance.category = VEHICLE_MAINTENANCE_DEFAULT_STANDARD_LEAF_ID
      if (subcategory !== undefined) {
        maintenance.subcategory = subcategory
      } else {
        maintenance.subcategory = category
      }
    } else {
      maintenance.category = category
      if (subcategory !== undefined) maintenance.subcategory = subcategory
    }
  } else if (subcategory !== undefined) {
    maintenance.subcategory = subcategory
  }

  const description = parseOptionalString(body.description)
  if (description !== undefined && description) maintenance.description = description

  const total_cost = parseOptionalFloat(body.total_cost)
  if (total_cost !== undefined && total_cost !== null) maintenance.total_cost = total_cost

  const labor_cost = parseOptionalFloat(body.labor_cost)
  if (labor_cost !== undefined) maintenance.labor_cost = labor_cost

  const parts_cost = parseOptionalFloat(body.parts_cost)
  if (parts_cost !== undefined) maintenance.parts_cost = parts_cost

  const other_cost = parseOptionalFloat(body.other_cost)
  if (other_cost !== undefined) maintenance.other_cost = other_cost

  const mileage = parseOptionalInt(body.mileage)
  if (mileage !== undefined) maintenance.mileage = mileage

  const warranty_period = parseOptionalInt(body.warranty_period)
  if (warranty_period !== undefined) maintenance.warranty_period = warranty_period

  const next_maintenance_mileage = parseOptionalInt(body.next_maintenance_mileage)
  if (next_maintenance_mileage !== undefined) maintenance.next_maintenance_mileage = next_maintenance_mileage

  const maintenance_interval = parseOptionalInt(body.maintenance_interval)
  if (maintenance_interval !== undefined) maintenance.maintenance_interval = maintenance_interval

  const mileage_interval = parseOptionalInt(body.mileage_interval)
  if (mileage_interval !== undefined) maintenance.mileage_interval = mileage_interval

  const quality_rating = parseOptionalInt(body.quality_rating)
  if (quality_rating !== undefined) maintenance.quality_rating = quality_rating

  const satisfaction_rating = parseOptionalInt(body.satisfaction_rating)
  if (satisfaction_rating !== undefined) maintenance.satisfaction_rating = satisfaction_rating

  const service_provider = parseOptionalString(body.service_provider)
  if (service_provider !== undefined) maintenance.service_provider = service_provider

  const service_provider_contact = parseOptionalString(body.service_provider_contact)
  if (service_provider_contact !== undefined) maintenance.service_provider_contact = service_provider_contact

  const service_provider_address = parseOptionalString(body.service_provider_address)
  if (service_provider_address !== undefined) maintenance.service_provider_address = service_provider_address

  const warranty_notes = parseOptionalString(body.warranty_notes)
  if (warranty_notes !== undefined) maintenance.warranty_notes = warranty_notes

  const next_maintenance_date = parseOptionalString(body.next_maintenance_date)
  if (next_maintenance_date !== undefined) maintenance.next_maintenance_date = next_maintenance_date

  const notes = parseOptionalString(body.notes)
  if (notes !== undefined) maintenance.notes = notes

  const technician_notes = parseOptionalString(body.technician_notes)
  if (technician_notes !== undefined) maintenance.technician_notes = technician_notes

  const status = parseOptionalString(body.status)
  if (status !== undefined && status) maintenance.status = status

  if (body.is_scheduled_maintenance !== undefined) {
    maintenance.is_scheduled_maintenance = Boolean(body.is_scheduled_maintenance)
  }

  const parts_replaced = parseStringArray(body.parts_replaced)
  if (parts_replaced !== undefined) maintenance.parts_replaced = parts_replaced

  const issues_found = parseStringArray(body.issues_found)
  if (issues_found !== undefined) maintenance.issues_found = issues_found

  const recommendations = parseStringArray(body.recommendations)
  if (recommendations !== undefined) maintenance.recommendations = recommendations

  const photos = parseStringArray(body.photos)
  if (photos !== undefined) maintenance.photos = photos

  const receipts = parseStringArray(body.receipts)
  if (receipts !== undefined) maintenance.receipts = receipts

  const documents = parseStringArray(body.documents)
  if (documents !== undefined) maintenance.documents = documents

  if (body.parts_cost_breakdown != null) {
    maintenance.parts_cost_breakdown = body.parts_cost_breakdown as NonNullable<
      VehicleMaintenanceUpdate['parts_cost_breakdown']
    >
  }

  return { maintenance, payment_method }
}

/** vehicle_id가 vehicles에 없으면 null (FK 위반 방지) */
export async function normalizeVehicleMaintenanceVehicleId(
  supabase: SupabaseClient<Database>,
  vehicleId: string | null | undefined
): Promise<string | null | undefined> {
  if (vehicleId === undefined) return undefined
  if (!vehicleId) return null
  const { data } = await supabase
    .from('vehicles')
    .select('id')
    .eq('id', vehicleId)
    .maybeSingle()
  return data?.id ?? null
}
