import { resolvePaymentMethodTarget } from '@/lib/expensePaymentMethodNormalize'
import type { PaymentMethodOption } from '@/hooks/usePaymentMethodOptions'
import { VEHICLE_MAINTENANCE_DEFAULT_STANDARD_LEAF_ID } from '@/lib/vehicleMaintenanceStandardCategory'

const LEGACY_PAYMENT_LABEL_TO_METHOD: Record<string, string> = {
  현금: 'cash',
  카드: 'card',
  계좌이체: 'bank_transfer',
  수표: 'check',
  기타: 'other',
}

export function resolveStoredPaymentMethodId(
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

export type VehicleMaintenanceFormData = {
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

export function createEmptyMaintenanceFormData(): VehicleMaintenanceFormData {
  return {
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
    uploaded_files: [],
  }
}

export type VehicleLabelFields = {
  id: string
  vehicle_number?: string | null
  vehicle_type?: string | null
  nick?: string | null
}

export function vehicleDisplayLabel(vehicle: VehicleLabelFields): string {
  const nick = vehicle.nick?.trim()
  if (nick) return nick
  return vehicle.vehicle_number || vehicle.vehicle_type || vehicle.id
}

export function formatMaintenanceStatsDate(ymd: string | null): string {
  if (!ymd) return '—'
  const d = new Date(ymd)
  return Number.isNaN(d.getTime()) ? ymd : d.toLocaleDateString()
}
