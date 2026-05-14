import type { SupabaseClient } from '@supabase/supabase-js'
import type { MutableRefObject } from 'react'

export type PrefetchedResidentRow = { resident_status: string | null }

export type PrefetchedChoiceRow = {
  choice_id: string
  option_id: string
  quantity: number
  choice_options: {
    option_key: string
    option_name: string
    option_name_ko: string
    product_choices: { choice_group_ko: string }
  }
}

const CHUNK = 32
/** 순차 32개×N번 왕복 대신 묶음 병렬 — 로딩 문구가 길게 걸리는 것 완화 */
const CHUNK_WAVE = 5

/**
 * 예약 관리 목록: 카드 N장이 각각 reservation_customers / reservation_choices 를 치면
 * Chrome ERR_INSUFFICIENT_RESOURCES 가 난다. 목록 로드 직후 청크 단위로 묶어 캐시·맵을 채운다.
 */
export async function prefetchAdminReservationCardSideData(
  supabase: SupabaseClient,
  reservationIds: string[],
  choicesCacheRef: MutableRefObject<Map<string, PrefetchedChoiceRow[]>>
): Promise<Map<string, PrefetchedResidentRow[]>> {
  const unique = [...new Set(reservationIds.map((id) => String(id).trim()).filter(Boolean))]
  const out = new Map<string, PrefetchedResidentRow[]>()
  for (const id of unique) {
    out.set(id, [])
  }

  const processChunk = async (chunk: string[]) => {
    if (chunk.length === 0) return

    const { data: rcData, error: rcErr } = await supabase
      .from('reservation_customers')
      .select('reservation_id, resident_status')
      .in('reservation_id', chunk)

    if (!rcErr && rcData) {
      for (const row of rcData) {
        const rid = row.reservation_id
        if (!rid) continue
        const arr = out.get(rid) ?? []
        arr.push({ resident_status: row.resident_status ?? null })
        out.set(rid, arr)
      }
    }

    const { data: chData, error: chErr } = await supabase
      .from('reservation_choices')
      .select(
        `
        reservation_id,
        choice_id,
        option_id,
        quantity,
        choice_options!inner (
          option_key,
          option_name,
          option_name_ko
        ),
        product_choices!inner (
          choice_group_ko
        )
      `
      )
      .in('reservation_id', chunk)

    const byRid = new Map<string, PrefetchedChoiceRow[]>()
    for (const rid of chunk) {
      byRid.set(rid, [])
    }

    if (!chErr && chData) {
      for (const raw of chData as Array<{
        reservation_id?: string | null
        choice_id?: string | null
        option_id?: string | null
        quantity?: number | null
        choice_options?: {
          option_key?: string | null
          option_name?: string | null
          option_name_ko?: string | null
        }
        product_choices?: { choice_group_ko?: string | null }
      }>) {
        const rid = raw.reservation_id
        if (!rid) continue
        const co = raw.choice_options
        const pc = raw.product_choices
        const item: PrefetchedChoiceRow = {
          choice_id: raw.choice_id ?? '',
          option_id: raw.option_id ?? '',
          quantity: raw.quantity ?? 0,
          choice_options: {
            option_key: co?.option_key ?? '',
            option_name: co?.option_name ?? '',
            option_name_ko: co?.option_name_ko ?? '',
            product_choices: { choice_group_ko: pc?.choice_group_ko ?? '' },
          },
        }
        const arr = byRid.get(rid) ?? []
        arr.push(item)
        byRid.set(rid, arr)
      }
    }

    for (const rid of chunk) {
      choicesCacheRef.current.set(rid, byRid.get(rid) ?? [])
    }
  }

  for (let i = 0; i < unique.length; i += CHUNK * CHUNK_WAVE) {
    const wave: Promise<void>[] = []
    for (let w = 0; w < CHUNK_WAVE; w++) {
      const start = i + w * CHUNK
      if (start >= unique.length) break
      wave.push(processChunk(unique.slice(start, start + CHUNK)))
    }
    await Promise.all(wave)
  }

  return out
}
