/**
 * Map booking selectedOptions → v2 offer code / id for a rate plan.
 */
import type { CommerceDb } from '@/lib/commerce/dualWritePricing'

export type OfferResolveResult = {
  offerId: string | null
  offerCode: string | null
  optionKeys: string[]
  candidateCodes: string[]
}

function uniqueSorted(parts: string[]): string {
  return [...parts].filter(Boolean).sort().join('+')
}

/**
 * Build candidate offer codes from selected choice_option ids.
 */
export async function resolveOfferFromSelection(
  db: CommerceDb,
  params: {
    productId: string
    ratePlanId: string
    selectedOptions: Record<string, string>
  }
): Promise<OfferResolveResult> {
  const optionIds = Object.values(params.selectedOptions).filter(Boolean)
  if (optionIds.length === 0) {
    return { offerId: null, offerCode: null, optionKeys: [], candidateCodes: [] }
  }

  const { data: options, error: optErr } = await db
    .from('choice_options')
    .select('id, option_key, choice_id')
    .in('id', optionIds)

  if (optErr) {
    console.warn('[resolveOfferFromSelection] choice_options:', optErr.message)
    return { offerId: null, offerCode: null, optionKeys: [], candidateCodes: [] }
  }

  const choiceIds = [...new Set((options || []).map((o) => o.choice_id).filter(Boolean))] as string[]
  const { data: groups } = await db
    .from('product_choices')
    .select('id, product_id, choice_group_key, sort_order')
    .in('id', choiceIds.length > 0 ? choiceIds : ['__none__'])

  const groupById = new Map((groups || []).map((g) => [g.id, g]))

  type Part = {
    optionKey: string
    groupKey: string
    sortOrder: number
  }

  const parts: Part[] = []
  for (const o of options || []) {
    if (!o.choice_id) continue
    const group = groupById.get(o.choice_id)
    if (!group || group.product_id !== params.productId) continue
    if (!o.option_key) continue
    parts.push({
      optionKey: String(o.option_key),
      groupKey: String(group.choice_group_key || ''),
      sortOrder: Number(group.sort_order ?? 0),
    })
  }

  parts.sort((a, b) => a.sortOrder - b.sortOrder || a.optionKey.localeCompare(b.optionKey))

  const optionKeys = parts.map((p) => p.optionKey)
  const byGroupOrder = optionKeys.join('+')
  const sortedKeys = uniqueSorted(optionKeys)
  const groupPlusOption = parts
    .map((p) => (p.groupKey ? `${p.groupKey}+${p.optionKey}` : p.optionKey))
    .join('+')
  const sortedGroupPlus = uniqueSorted(
    parts.map((p) => (p.groupKey ? `${p.groupKey}+${p.optionKey}` : p.optionKey))
  )

  const candidateCodes = [
    ...new Set([byGroupOrder, sortedKeys, groupPlusOption, sortedGroupPlus].filter(Boolean)),
  ]

  for (const code of candidateCodes) {
    const { data: offer } = await db
      .from('offers')
      .select('id, code')
      .eq('rate_plan_id', params.ratePlanId)
      .eq('code', code)
      .eq('is_active', true)
      .maybeSingle()
    if (offer?.id) {
      return {
        offerId: offer.id,
        offerCode: offer.code,
        optionKeys,
        candidateCodes,
      }
    }
  }

  const keySet = new Set(optionKeys)
  const { data: offers } = await db
    .from('offers')
    .select('id, code, offer_components(component_key)')
    .eq('rate_plan_id', params.ratePlanId)
    .eq('is_active', true)

  for (const offer of offers || []) {
    const comps = ((offer.offer_components as unknown as { component_key?: string }[] | null) || [])
      .map((c) => String(c.component_key || ''))
      .filter(Boolean)
    if (comps.length === 0) continue

    const normalized = comps.map((c) => {
      if (keySet.has(c)) return c
      const idx = c.lastIndexOf('+')
      if (idx > 0) {
        const maybeOpt = c.slice(idx + 1)
        if (keySet.has(maybeOpt)) return maybeOpt
      }
      return c
    })

    const compSet = new Set(normalized)
    if (compSet.size === keySet.size && [...keySet].every((k) => compSet.has(k))) {
      return {
        offerId: offer.id,
        offerCode: offer.code,
        optionKeys,
        candidateCodes,
      }
    }
  }

  return {
    offerId: null,
    offerCode: candidateCodes[0] || null,
    optionKeys,
    candidateCodes,
  }
}
