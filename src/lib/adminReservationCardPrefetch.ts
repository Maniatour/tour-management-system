import type { SupabaseClient } from '@supabase/supabase-js'
import type { MutableRefObject } from 'react'
import type { ResolvedChoiceRow } from '@/lib/resolveReservationChoices'

export type PrefetchedResidentRow = { resident_status: string | null }

export type PrefetchedChoiceRow = {
  choice_id: string
  option_id: string
  quantity: number
  choice_options: {
    option_key: string
    option_name: string
    option_name_ko: string
    internal_name?: string
    badge_icon_url?: string
    product_choices: { choice_group_ko: string }
  }
}

const CHUNK = 80
const CHUNK_WAVE = 2

function toPrefetched(row: ResolvedChoiceRow): PrefetchedChoiceRow {
  return {
    choice_id: row.choice_id,
    option_id: row.option_id,
    quantity: row.quantity,
    choice_options: {
      option_key: row.choice_options?.option_key ?? row.option_key ?? '',
      option_name: row.choice_options?.option_name ?? '',
      option_name_ko: row.choice_options?.option_name_ko ?? '',
      internal_name: row.choice_options?.internal_name ?? '',
      badge_icon_url: row.choice_options?.badge_icon_url ?? '',
      product_choices: {
        choice_group_ko: row.product_choices?.choice_group_ko ?? '',
      },
    },
  }
}

type BatchFetchFn = (ids: string[]) => Promise<Map<string, PrefetchedChoiceRow[]>>

/**
 * 인증된 배치 API로 초이스를 묶어 가져온다 (카드별 N+1 방지).
 */
export function createChoicesBatchFetcher(
  fetchApi: (url: string, init?: RequestInit) => Promise<Response>
): BatchFetchFn {
  return async (ids: string[]) => {
    const out = new Map<string, PrefetchedChoiceRow[]>()
    for (const id of ids) out.set(id, [])
    if (ids.length === 0) return out

    const response = await fetchApi('/api/reservations/choices/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
      cache: 'no-store',
    })
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { error?: string } | null
      throw new Error(body?.error || `초이스 배치 조회 실패 (${response.status})`)
    }
    const body = (await response.json()) as {
      choicesByReservationId?: Record<string, ResolvedChoiceRow[]>
    }
    const byId = body.choicesByReservationId ?? {}
    for (const id of ids) {
      const rows = Array.isArray(byId[id]) ? byId[id] : []
      out.set(id, rows.map(toPrefetched))
    }
    return out
  }
}

/**
 * 예약 관리 목록: 카드 N장이 각각 reservation_customers / choices API 를 치면
 * Chrome ERR_INSUFFICIENT_RESOURCES · 터미널 로그 폭주가 난다.
 * 목록 로드 직후(화면 paint 전) 청크 단위로 캐시를 채운다.
 */
export async function prefetchAdminReservationCardSideData(
  supabase: SupabaseClient,
  reservationIds: string[],
  choicesCacheRef: MutableRefObject<Map<string, PrefetchedChoiceRow[]>>,
  fetchChoicesBatch?: BatchFetchFn
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

    if (fetchChoicesBatch) {
      // 이미 캐시된(=조회 완료) 예약은 다시 요청하지 않음 — 청크 중복/재렌더로 인한 폭주 방지
      const missing = chunk.filter((rid) => !choicesCacheRef.current.has(rid))
      if (missing.length === 0) return
      const resolved = await fetchChoicesBatch(missing)
      for (const rid of missing) {
        // 빈 배열도 캐시 — "조회 완료" 표시로 카드별 API 재호출을 막음
        choicesCacheRef.current.set(rid, resolved.get(rid) ?? [])
      }
      return
    }

    // 폴백: 배치 fetcher 없으면 캐시만 비워 두고 개별 API에 맡김 (권장 경로 아님)
    for (const rid of chunk) {
      if (!choicesCacheRef.current.has(rid)) {
        choicesCacheRef.current.delete(rid)
      }
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
