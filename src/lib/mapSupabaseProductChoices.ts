/** Supabase product_choices + choice_options embed → 폼용 ProductChoice */
export type MappedProductChoice = {
  id: string
  choice_group: string
  choice_group_ko: string
  choice_type: 'single' | 'multiple' | 'quantity'
  pricing_unit?: 'per_person' | 'per_unit'
  is_required: boolean | null
  min_selections: number | null
  max_selections: number | null
  sort_order: number | null
  options: Array<{
    id: string
    option_key: string
    option_name?: string | null
    option_name_ko: string
    adult_price: number | null
    child_price?: number | null
    infant_price?: number | null
    capacity?: number | null
    is_default?: boolean | null
    is_active?: boolean | null
    sort_order?: number | null
    [key: string]: unknown
  }>
}

export function mapSupabaseProductChoices(data: unknown[] | null | undefined): MappedProductChoice[] {
  return (data ?? []).map((raw) => {
    const choice = raw as Record<string, unknown>
    const options = Array.isArray(choice.options) ? choice.options : []
    return {
      id: String(choice.id ?? ''),
      choice_group: String(choice.choice_group ?? ''),
      choice_group_ko: String(choice.choice_group_ko ?? ''),
      choice_type: choice.choice_type as MappedProductChoice['choice_type'],
      pricing_unit: choice.pricing_unit === 'per_unit' ? 'per_unit' : 'per_person',
      is_required: (choice.is_required as boolean | null) ?? null,
      min_selections: (choice.min_selections as number | null) ?? null,
      max_selections: (choice.max_selections as number | null) ?? null,
      sort_order: (choice.sort_order as number | null) ?? null,
      options: options.map((opt) => {
        const o = opt as Record<string, unknown>
        return {
          id: String(o.id ?? ''),
          option_key: String(o.option_key ?? ''),
          option_name: o.option_name != null ? String(o.option_name) : null,
          option_name_ko: String(o.option_name_ko ?? ''),
          adult_price: o.adult_price != null ? Number(o.adult_price) : null,
          child_price: o.child_price != null ? Number(o.child_price) : null,
          infant_price: o.infant_price != null ? Number(o.infant_price) : null,
          capacity: o.capacity != null ? Number(o.capacity) : null,
          is_default: (o.is_default as boolean | null) ?? null,
          is_active: (o.is_active as boolean | null) ?? null,
          sort_order: o.sort_order != null ? Number(o.sort_order) : null,
        }
      }),
    }
  })
}
