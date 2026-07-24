/**
 * Admin product deep-copy: shell + choices/options + media + details + faqs +
 * schedules + product_options + tour-course links + dynamic_pricing (ID remap).
 * Does not copy channel_products, reservations, or Commerce v2 rows.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase'
import { operatorIdInsert, resolveOperatorId } from '@/lib/operators/scopeQuery'
import { deleteAdminProductCascade } from '@/lib/adminProductDelete'

type Db = SupabaseClient<Database>

export type AdminProductCloneResult = {
  newProductId: string
  counts: {
    choices: number
    choiceOptions: number
    media: number
    details: number
    faqs: number
    whyChoose: number
    tourAudience: number
    schedules: number
    productOptions: number
    tourCourses: number
    pricing: number
  }
}

function omitKeys<T extends Record<string, unknown>>(
  row: T,
  keys: string[]
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...row }
  for (const k of keys) delete out[k]
  return out
}

function remapJsonIds(
  raw: unknown,
  choiceIdMap: Map<string, string>,
  optionIdMap: Map<string, string>
): unknown {
  if (raw == null) return raw
  let parsed: unknown = raw
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed)
    } catch {
      return raw
    }
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return parsed
  }

  const src = parsed as Record<string, unknown>
  const next: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(src)) {
    const mappedKey =
      choiceIdMap.get(key) ?? optionIdMap.get(key) ?? key

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nested = value as Record<string, unknown>
      const looksLikePrices =
        'adult_price' in nested ||
        'child_price' in nested ||
        'ota_sale_price' in nested ||
        'is_sale_available' in nested

      if (looksLikePrices) {
        next[mappedKey] = nested
      } else {
        const nestedOut: Record<string, unknown> = {}
        for (const [nk, nv] of Object.entries(nested)) {
          nestedOut[optionIdMap.get(nk) ?? choiceIdMap.get(nk) ?? nk] = nv
        }
        next[mappedKey] = nestedOut
      }
    } else {
      next[mappedKey] = value
    }
  }

  return next
}

export async function cloneAdminProduct(
  db: Db,
  sourceProductId: string,
  operatorId?: string | null,
  locale: 'ko' | 'en' = 'ko'
): Promise<AdminProductCloneResult> {
  const opId = resolveOperatorId(operatorId)

  const { data: source, error: sourceError } = await db
    .from('products')
    .select('*')
    .eq('id', sourceProductId)
    .eq('operator_id', opId)
    .maybeSingle()

  if (sourceError) throw sourceError
  if (!source) throw new Error('Source product not found for active operator')

  const copySuffix = locale === 'en' ? ' (Copy)' : ' (복사본)'
  const productInsert = {
    ...omitKeys(source as Record<string, unknown>, [
      'id',
      'created_at',
      'updated_at',
      'is_favorite',
      'favorite_order',
      'is_published',
    ]),
    name: `${source.name || 'Product'}${copySuffix}`,
    name_en: source.name_en ? `${source.name_en} (Copy)` : null,
    product_code: source.product_code ? `${source.product_code}_COPY` : null,
    status: 'draft',
    is_published: false,
    is_favorite: false,
    favorite_order: null,
    ...operatorIdInsert(opId),
  }

  const { data: newProduct, error: insertError } = await db
    .from('products')
    .insert(productInsert as never)
    .select('id')
    .single()

  if (insertError) throw insertError
  if (!newProduct?.id) throw new Error('Product insert returned no id')

  const newProductId = String(newProduct.id)

  try {
    return await cloneAdminProductChildren(
      db,
      sourceProductId,
      newProductId,
      opId
    )
  } catch (err) {
    try {
      await deleteAdminProductCascade(db, newProductId, opId)
    } catch (rollbackErr) {
      console.error('[cloneAdminProduct] rollback failed', rollbackErr)
    }
    throw err
  }
}

async function cloneAdminProductChildren(
  db: Db,
  sourceProductId: string,
  newProductId: string,
  opId: string
): Promise<AdminProductCloneResult> {
  const counts = {
    choices: 0,
    choiceOptions: 0,
    media: 0,
    details: 0,
    faqs: 0,
    whyChoose: 0,
    tourAudience: 0,
    schedules: 0,
    productOptions: 0,
    tourCourses: 0,
    pricing: 0,
  }

  const choiceIdMap = new Map<string, string>()
  const optionIdMap = new Map<string, string>()

  // --- choices + options ---
  const { data: choices, error: choicesErr } = await db
    .from('product_choices')
    .select('*')
    .eq('product_id', sourceProductId)
    .order('sort_order', { ascending: true })

  if (choicesErr) throw choicesErr

  for (const choice of choices || []) {
    const oldChoiceId = String(choice.id)
    const choiceInsert = {
      ...omitKeys(choice as Record<string, unknown>, [
        'id',
        'created_at',
        'updated_at',
      ]),
      product_id: newProductId,
      ...operatorIdInsert(opId),
    }

    const { data: newChoice, error: choiceInsErr } = await db
      .from('product_choices')
      .insert(choiceInsert as never)
      .select('id')
      .single()

    if (choiceInsErr) throw choiceInsErr
    if (!newChoice?.id) throw new Error('choice insert failed')
    choiceIdMap.set(oldChoiceId, String(newChoice.id))
    counts.choices++

    const { data: options, error: optErr } = await db
      .from('choice_options')
      .select('*')
      .eq('choice_id', oldChoiceId)
      .order('sort_order', { ascending: true })

    if (optErr) throw optErr

    for (const option of options || []) {
      const oldOptId = String(option.id)
      const optInsert = {
        ...omitKeys(option as Record<string, unknown>, [
          'id',
          'created_at',
          'updated_at',
        ]),
        choice_id: newChoice.id,
      }

      const { data: newOpt, error: optInsErr } = await db
        .from('choice_options')
        .insert(optInsert as never)
        .select('id')
        .single()

      if (optInsErr) throw optInsErr
      if (newOpt?.id) {
        optionIdMap.set(oldOptId, String(newOpt.id))
        counts.choiceOptions++
      }
    }
  }

  // --- media ---
  const { data: mediaRows, error: mediaErr } = await db
    .from('product_media')
    .select('*')
    .eq('product_id', sourceProductId)

  if (mediaErr) throw mediaErr
  if (mediaRows && mediaRows.length > 0) {
    const mediaInserts = mediaRows.map((row) => ({
      ...omitKeys(row as Record<string, unknown>, [
        'id',
        'created_at',
        'updated_at',
      ]),
      product_id: newProductId,
    }))
    const { error } = await db.from('product_media').insert(mediaInserts as never)
    if (error) throw error
    counts.media = mediaInserts.length
  }

  // --- details multilingual ---
  const { data: detailRows, error: detailErr } = await db
    .from('product_details_multilingual')
    .select('*')
    .eq('product_id', sourceProductId)

  if (detailErr) throw detailErr
  if (detailRows && detailRows.length > 0) {
    const detailInserts = detailRows.map((row) => ({
      ...omitKeys(row as Record<string, unknown>, [
        'id',
        'created_at',
        'updated_at',
      ]),
      product_id: newProductId,
    }))
    const { error } = await db
      .from('product_details_multilingual')
      .insert(detailInserts as never)
    if (error) throw error
    counts.details = detailInserts.length
  }

  // --- faqs (reusable library links) ---
  const { data: faqLinks, error: faqErr } = await db
    .from('product_faq_links')
    .select('*')
    .eq('product_id', sourceProductId)

  if (faqErr) throw faqErr
  if (faqLinks && faqLinks.length > 0) {
    const faqInserts = faqLinks.map((row) => ({
      ...omitKeys(row as Record<string, unknown>, [
        'id',
        'created_at',
        'updated_at',
      ]),
      product_id: newProductId,
    }))
    const { error } = await db.from('product_faq_links').insert(faqInserts as never)
    if (error) throw error
    counts.faqs = faqInserts.length
  }

  // --- why choose links ---
  const { data: whyChooseLinks, error: whyChooseErr } = await db
    .from('product_why_choose_links')
    .select('*')
    .eq('product_id', sourceProductId)

  if (whyChooseErr) throw whyChooseErr
  if (whyChooseLinks && whyChooseLinks.length > 0) {
    const whyChooseInserts = whyChooseLinks.map((row) => ({
      ...omitKeys(row as Record<string, unknown>, [
        'id',
        'created_at',
        'updated_at',
      ]),
      product_id: newProductId,
    }))
    const { error } = await db.from('product_why_choose_links').insert(whyChooseInserts as never)
    if (error) throw error
    counts.whyChoose = whyChooseInserts.length
  }

  // --- tour audience links ---
  const { data: tourAudienceLinks, error: tourAudienceErr } = await db
    .from('product_tour_audience_links')
    .select('*')
    .eq('product_id', sourceProductId)

  if (tourAudienceErr) throw tourAudienceErr
  if (tourAudienceLinks && tourAudienceLinks.length > 0) {
    const tourAudienceInserts = tourAudienceLinks.map((row) => ({
      ...omitKeys(row as Record<string, unknown>, [
        'id',
        'created_at',
        'updated_at',
      ]),
      product_id: newProductId,
    }))
    const { error } = await db
      .from('product_tour_audience_links')
      .insert(tourAudienceInserts as never)
    if (error) throw error
    counts.tourAudience = tourAudienceInserts.length
  }

  // --- detail content library links ---
  const { data: detailLinks, error: detailLinkErr } = await db
    .from('product_detail_content_links')
    .select('*')
    .eq('product_id', sourceProductId)

  if (detailLinkErr) throw detailLinkErr
  if (detailLinks && detailLinks.length > 0) {
    const detailLinkInserts = detailLinks.map((row) => ({
      ...omitKeys(row as Record<string, unknown>, [
        'id',
        'created_at',
        'updated_at',
      ]),
      product_id: newProductId,
    }))
    const { error } = await db
      .from('product_detail_content_links')
      .insert(detailLinkInserts as never)
    if (error) throw error
  }

  // --- schedules ---
  const { data: scheduleRows, error: scheduleErr } = await db
    .from('product_schedules')
    .select('*')
    .eq('product_id', sourceProductId)

  if (scheduleErr) throw scheduleErr
  if (scheduleRows && scheduleRows.length > 0) {
    const scheduleInserts = scheduleRows.map((row) => ({
      ...omitKeys(row as Record<string, unknown>, [
        'id',
        'created_at',
        'updated_at',
      ]),
      product_id: newProductId,
    }))
    const { error } = await db
      .from('product_schedules')
      .insert(scheduleInserts as never)
    if (error) throw error
    counts.schedules = scheduleInserts.length
  }

  // --- legacy product_options ---
  const { data: poRows, error: poErr } = await db
    .from('product_options')
    .select('*')
    .eq('product_id', sourceProductId)

  if (poErr) throw poErr
  if (poRows && poRows.length > 0) {
    const poInserts = poRows.map((row) => ({
      ...omitKeys(row as Record<string, unknown>, [
        'id',
        'created_at',
        'updated_at',
      ]),
      product_id: newProductId,
    }))
    const { error } = await db.from('product_options').insert(poInserts as never)
    if (error) throw error
    counts.productOptions = poInserts.length
  }

  // --- tour course links (same course ids) ---
  const { data: courseLinks, error: courseErr } = await db
    .from('product_tour_courses')
    .select('*')
    .eq('product_id', sourceProductId)

  if (courseErr) throw courseErr
  if (courseLinks && courseLinks.length > 0) {
    const courseInserts = courseLinks.map((row) => ({
      ...omitKeys(row as Record<string, unknown>, [
        'id',
        'created_at',
        'updated_at',
      ]),
      product_id: newProductId,
    }))
    const { error } = await db
      .from('product_tour_courses')
      .insert(courseInserts as never)
    if (error) throw error
    counts.tourCourses = courseInserts.length
  }

  // --- dynamic_pricing (remap choice/option ids in JSON) ---
  const { data: pricingRows, error: pricingErr } = await db
    .from('dynamic_pricing')
    .select('*')
    .eq('product_id', sourceProductId)

  if (pricingErr) throw pricingErr
  if (pricingRows && pricingRows.length > 0) {
    const pricingInserts = pricingRows.map((row) => {
      const base = omitKeys(row as Record<string, unknown>, [
        'id',
        'created_at',
        'updated_at',
      ])
      return {
        ...base,
        product_id: newProductId,
        choices_pricing: remapJsonIds(
          base.choices_pricing,
          choiceIdMap,
          optionIdMap
        ),
        options_pricing: remapJsonIds(
          base.options_pricing,
          choiceIdMap,
          optionIdMap
        ),
        ...operatorIdInsert(opId),
      }
    })

    const chunkSize = 50
    for (let i = 0; i < pricingInserts.length; i += chunkSize) {
      const chunk = pricingInserts.slice(i, i + chunkSize)
      const { error } = await db.from('dynamic_pricing').insert(chunk as never)
      if (error) throw error
    }
    counts.pricing = pricingInserts.length
  }

  return { newProductId, counts }
}
