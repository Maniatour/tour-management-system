import { supabase } from '@/lib/supabase'
import type { ProductChoiceForResidentFlow } from '@/utils/usResidentChoiceSync'

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/** product_id → 거주 follow-up 판별용 초이스 (options embed) */
export async function fetchProductChoicesByProductIds(
  productIds: string[]
): Promise<Map<string, ProductChoiceForResidentFlow[]>> {
  const unique = [...new Set(productIds.map((id) => String(id ?? '').trim()).filter(Boolean))]
  const map = new Map<string, ProductChoiceForResidentFlow[]>()
  if (unique.length === 0) return map

  for (const part of chunk(unique, 80)) {
    const { data, error } = await supabase
      .from('product_choices')
      .select(
        `
        product_id,
        choice_group,
        choice_group_ko,
        options:choice_options (
          option_key,
          option_name,
          option_name_ko,
          is_active
        )
      `
      )
      .in('product_id', part)

    if (error) throw error

    for (const row of data || []) {
      const r = row as {
        product_id?: string
        choice_group?: string | null
        choice_group_ko?: string | null
        options?: ProductChoiceForResidentFlow['options']
      }
      const pid = String(r.product_id ?? '').trim()
      if (!pid) continue
      const list = map.get(pid) ?? []
      list.push({
        choice_group: r.choice_group ?? null,
        choice_group_ko: r.choice_group_ko ?? null,
        options: r.options ?? null,
      })
      map.set(pid, list)
    }
  }

  for (const id of unique) {
    if (!map.has(id)) map.set(id, [])
  }

  return map
}
