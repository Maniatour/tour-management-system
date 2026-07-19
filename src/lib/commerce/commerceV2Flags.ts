/**
 * Feature flags for Commerce Core v2.
 *
 * COMMERCE_V2_READ_PRODUCTS= / COMMERCE_V2_INVENTORY_PRODUCTS=
 *   - empty / unset → off
 *   - * → all products
 *   - MDGCFOO,MDGCBAR → listed product ids only
 */

function parseProductIdFlag(raw: string | undefined): { all: boolean; ids: Set<string> } {
  const value = (raw || '').trim()
  if (!value) return { all: false, ids: new Set() }
  if (value === '*') return { all: true, ids: new Set() }
  const ids = new Set(
    value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  )
  return { all: false, ids }
}

export function parseCommerceV2ReadProductIds(
  raw: string | undefined = process.env.COMMERCE_V2_READ_PRODUCTS
): { all: boolean; ids: Set<string> } {
  return parseProductIdFlag(raw)
}

export function isCommerceV2ReadEnabled(productId: string): boolean {
  const { all, ids } = parseCommerceV2ReadProductIds()
  if (all) return true
  return ids.has(productId)
}

export function parseCommerceV2InventoryProductIds(
  raw: string | undefined = process.env.COMMERCE_V2_INVENTORY_PRODUCTS
): { all: boolean; ids: Set<string> } {
  return parseProductIdFlag(raw)
}

/** Hold/commit inventory engine for matching product ids (default OFF). */
export function isCommerceV2InventoryEnabled(productId: string): boolean {
  const { all, ids } = parseCommerceV2InventoryProductIds()
  if (all) return true
  return ids.has(productId)
}

/**
 * OTA outbox enqueue after dual-write.
 * COMMERCE_V2_OTA_SYNC=1 → enable; unset/empty → off.
 * Process worker is staff-triggered; live HTTP needs COMMERCE_V2_OTA_LIVE + status=active.
 */
export function isCommerceV2OtaSyncEnabled(
  raw: string | undefined = process.env.COMMERCE_V2_OTA_SYNC
): boolean {
  const value = (raw || '').trim().toLowerCase()
  return value === '1' || value === 'true' || value === 'on'
}

/**
 * Live OTA HTTP adapters (Phase 4c).
 * COMMERCE_V2_OTA_LIVE=1 → allow active connections to call external APIs.
 * Default OFF — even status=active falls back to dry-run without this flag.
 */
export function isCommerceV2OtaLiveEnabled(
  raw: string | undefined = process.env.COMMERCE_V2_OTA_LIVE
): boolean {
  const value = (raw || '').trim().toLowerCase()
  return value === '1' || value === 'true' || value === 'on'
}

/**
 * Process inbound OTA webhooks into inquiry reservations (Phase 4d).
 * COMMERCE_V2_OTA_INBOUND=1 → allow process step to create inquiry when mapped.
 * Receive/store always works (inbox); default OFF skips auto reservation create.
 */
export function isCommerceV2OtaInboundEnabled(
  raw: string | undefined = process.env.COMMERCE_V2_OTA_INBOUND
): boolean {
  const value = (raw || '').trim().toLowerCase()
  return value === '1' || value === 'true' || value === 'on'
}
