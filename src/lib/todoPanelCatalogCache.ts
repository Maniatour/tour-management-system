/**
 * Todo 고정 패널에서 공통으로 쓰는 products / channels / tour id 목록 메모리 캐시.
 * PendingCustomer·CancelRebooking 등이 각각 전체 스캔하지 않도록 공유합니다.
 */

import { supabase } from '@/lib/supabase'

const CACHE_TTL_MS = 5 * 60 * 1000

export type TodoPanelCatalogProduct = {
  id: string
  name?: string | null
  name_ko?: string | null
  name_en?: string | null
  customer_name_ko?: string | null
  customer_name_en?: string | null
}

export type TodoPanelCatalogChannel = {
  id: string
  name?: string | null
  favicon_url?: string | null
}

type CatalogSnapshot = {
  products: TodoPanelCatalogProduct[]
  channels: TodoPanelCatalogChannel[]
  tourIdMap: Map<string, true>
}

let catalogEntry: { at: number; data: CatalogSnapshot } | null = null
let inflight: Promise<CatalogSnapshot> | null = null

function isFresh(at: number): boolean {
  return Date.now() - at < CACHE_TTL_MS
}

async function loadCatalogFromNetwork(): Promise<CatalogSnapshot> {
  const [{ data: productRows }, { data: channelRows }, { data: tourRows }] = await Promise.all([
    supabase
      .from('products')
      .select('id, name, name_ko, name_en, customer_name_ko, customer_name_en'),
    supabase.from('channels').select('id, name, favicon_url'),
    supabase.from('tours').select('id'),
  ])

  const snapshot: CatalogSnapshot = {
    products: (productRows || []) as TodoPanelCatalogProduct[],
    channels: (channelRows || []) as TodoPanelCatalogChannel[],
    tourIdMap: new Map((tourRows || []).map((t) => [String((t as { id: string }).id), true as const])),
  }

  catalogEntry = { at: Date.now(), data: snapshot }
  return snapshot
}

export async function fetchTodoPanelCatalog(options?: { force?: boolean }): Promise<CatalogSnapshot> {
  if (!options?.force && catalogEntry && isFresh(catalogEntry.at)) {
    return catalogEntry.data
  }

  if (!options?.force && inflight) {
    return inflight
  }

  inflight = loadCatalogFromNetwork().finally(() => {
    inflight = null
  })

  return inflight
}

export function invalidateTodoPanelCatalogCache(): void {
  catalogEntry = null
  inflight = null
}

export function buildTodoPanelProductNameMap(
  products: TodoPanelCatalogProduct[]
): Map<string, string> {
  return new Map(products.map((p) => [String(p.id), String(p.name ?? '')]))
}
