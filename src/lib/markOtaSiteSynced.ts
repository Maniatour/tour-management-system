import type { SupabaseClient } from '@supabase/supabase-js'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import { operatorIdInsert } from '@/lib/operators/scopeQuery'
import {
  inferSaleStatus,
  resolveVehicleRemaining,
  type ChannelVariantListing,
  type OtaChannelInventoryRow,
} from '@/lib/otaPriceInventory'

export async function markOtaSiteSynced({
  supabase,
  activeOperatorId,
  productId,
  date,
  listing,
  existing,
  internalRemaining,
  isSaleAvailable = true,
  userEmail,
  updaterName,
}: {
  supabase: SupabaseClient
  activeOperatorId: string
  productId: string
  date: string
  listing: ChannelVariantListing
  existing?: OtaChannelInventoryRow | null
  internalRemaining?: number | null
  isSaleAvailable?: boolean
  userEmail?: string | null
  updaterName?: string | null
}): Promise<void> {
  const saleStatus = inferSaleStatus(existing || null, isSaleAvailable, internalRemaining)
  const currentRemaining = resolveVehicleRemaining(existing, internalRemaining)

  if (currentRemaining == null || !Number.isFinite(currentRemaining)) {
    throw new Error('Cannot sync OTA without remaining seat count')
  }

  const payload = {
    ...operatorIdInsert(activeOperatorId),
    product_id: productId,
    channel_id: listing.channelId,
    variant_key: listing.variantKey,
    inventory_date: date,
    antelope_x_seats: existing?.antelope_x_seats ?? null,
    antelope_l_seats: existing?.antelope_l_seats ?? null,
    vehicle_seats: existing?.vehicle_seats ?? null,
    ota_synced_vehicle_seats: currentRemaining,
    sale_status: saleStatus,
    notes: existing?.notes ?? null,
    updated_by_email: userEmail || null,
    updated_by_name: updaterName || null,
    updated_at: new Date().toISOString(),
  }

  const { error } = await fromUntypedTable(supabase, 'ota_channel_inventory').upsert(payload, {
    onConflict: 'product_id,channel_id,variant_key,inventory_date',
  })

  if (error) throw error
}
