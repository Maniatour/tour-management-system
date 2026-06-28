import { supabase } from '@/lib/supabase'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import {
  enrichCustomerReservations,
  type RawCustomerReservation,
} from '@/lib/enrichCustomerReservation'

export type CustomerRecord = {
  id: string
  name: string
  email: string
  phone: string | null
  language: string | null
  created_at: string
}

type ReservationBundleOptions = {
  locale: string
  noProductName: string
}

type ReservationBundle = {
  customer: CustomerRecord | null
  reservations: RawCustomerReservation[]
}

type SimulatedUserRecord = {
  id?: string
  email?: string
  name_ko?: string
  name_en?: string
  phone?: string | null
  language?: string | null
  created_at?: string
}

function normalizeCustomer(data: Record<string, unknown>): CustomerRecord {
  return {
    id: String(data.id),
    name: String(data.name ?? ''),
    email: String(data.email ?? ''),
    phone: (data.phone as string | null) ?? null,
    language: (data.language as string | null) ?? null,
    created_at: String(data.created_at ?? ''),
  }
}

async function fetchRawReservationsByCustomerId(customerId: string): Promise<RawCustomerReservation[]> {
  const { data, error } = await supabase
    .from('reservations')
    .select('*')
    .eq('customer_id', customerId)
    .order('tour_date', { ascending: false })

  if (error || !data) return []
  return data as RawCustomerReservation[]
}

async function fetchRawReservationsByEmail(email: string): Promise<RawCustomerReservation[]> {
  const { data, error } = await fromUntypedTable(supabase, 'reservations')
    .select('*')
    .eq('customer_email', email)
    .order('tour_date', { ascending: false })

  if (error || !data) return []
  return data as RawCustomerReservation[]
}

async function enrichIfNeeded(
  raw: RawCustomerReservation[],
  options: ReservationBundleOptions
): Promise<RawCustomerReservation[]> {
  if (raw.length === 0) return []
  return enrichCustomerReservations(raw, options)
}

export async function loadReservationBundleByCustomerId(
  customerId: string,
  options: ReservationBundleOptions
): Promise<ReservationBundle> {
  const { data, error } = await supabase.from('customers').select('*').eq('id', customerId).single()

  if (error || !data) {
    return { customer: null, reservations: [] }
  }

  const customer = normalizeCustomer(data as Record<string, unknown>)
  const raw = await fetchRawReservationsByCustomerId(customerId)
  const reservations = await enrichIfNeeded(raw, options)

  return { customer, reservations }
}

export async function loadReservationBundleByEmail(
  email: string,
  options: ReservationBundleOptions
): Promise<ReservationBundle> {
  const { data: customerData, error: customerError } = await supabase
    .from('customers')
    .select('*')
    .eq('email', email)
    .single()

  if (customerError) {
    if (
      customerError.code === 'PGRST116' ||
      customerError.code === 'PGRST301' ||
      customerError.message?.includes('406')
    ) {
      return { customer: null, reservations: [] }
    }
    throw customerError
  }

  if (!customerData) {
    return { customer: null, reservations: [] }
  }

  const customer = normalizeCustomer(customerData as Record<string, unknown>)
  const raw = await fetchRawReservationsByCustomerId(customer.id)
  const reservations = await enrichIfNeeded(raw, options)

  return { customer, reservations }
}

export async function resolveSimulatedCustomer(
  simulatedUser: SimulatedUserRecord
): Promise<CustomerRecord> {
  if (simulatedUser.id) {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', simulatedUser.id)
      .maybeSingle()

    if (!error && data) {
      return normalizeCustomer(data as Record<string, unknown>)
    }
  }

  if (simulatedUser.email) {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('email', simulatedUser.email)
      .maybeSingle()

    if (!error && data) {
      return normalizeCustomer(data as Record<string, unknown>)
    }
  }

  return {
    id: simulatedUser.id ?? '',
    name: simulatedUser.name_ko || simulatedUser.name_en || '',
    email: simulatedUser.email ?? '',
    phone: simulatedUser.phone ?? null,
    language: simulatedUser.language ?? 'ko',
    created_at: simulatedUser.created_at ?? new Date().toISOString(),
  }
}

export async function loadSimulatedReservationBundle(
  simulatedUser: SimulatedUserRecord,
  options: ReservationBundleOptions
): Promise<ReservationBundle> {
  const customer = await resolveSimulatedCustomer(simulatedUser)

  let raw: RawCustomerReservation[] = []

  if (simulatedUser.id) {
    raw = await fetchRawReservationsByCustomerId(simulatedUser.id)
  }

  if (raw.length === 0 && simulatedUser.email) {
    const byEmail = await fetchRawReservationsByEmail(simulatedUser.email)
    const existingIds = new Set(raw.map((r) => r.id))
    raw = [...raw, ...byEmail.filter((r) => !existingIds.has(r.id))]
  }

  const reservations = await enrichIfNeeded(raw, options)
  return { customer, reservations }
}
