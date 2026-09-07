import type { SupabaseClient } from '@supabase/supabase-js'
import { tourReportRequiredDateRange } from '@/lib/tourReportExtras'

export type GuideUncompletedTourReportItem = {
  id: string
  tourDate: string
  name: string
}

function assignedToursOrFilter(email: string): string {
  const raw = email.trim().replace(/"/g, '')
  const lower = raw.toLowerCase()
  if (raw && raw !== lower) {
    return `tour_guide_id.eq."${raw}",assistant_id.eq."${raw}",tour_guide_id.eq."${lower}",assistant_id.eq."${lower}"`
  }
  return `tour_guide_id.eq."${lower}",assistant_id.eq."${lower}"`
}

export async function listUncompletedTourReportsForGuide(
  db: SupabaseClient,
  email: string,
  locale: string
): Promise<GuideUncompletedTourReportItem[]> {
  const emailRaw = email.trim()
  if (!emailRaw) return []

  const range = tourReportRequiredDateRange()
  if (!range) return []

  const { data: toursData, error } = await db
    .from('tours')
    .select('id, tour_date, product_id')
    .or(assignedToursOrFilter(emailRaw))
    .gte('tour_date', range.from)
    .lte('tour_date', range.to)
    .order('tour_date', { ascending: false })
    .limit(100)

  if (error) throw error
  const tours = toursData || []
  if (tours.length === 0) return []

  const tourIds = tours.map((row) => row.id)
  const { data: reportsData, error: reportsError } = await db
    .from('tour_reports')
    .select('tour_id, user_email')
    .in('tour_id', tourIds)

  if (reportsError) throw reportsError

  const emailLower = emailRaw.toLowerCase()
  const done = new Set(
    (reportsData || [])
      .filter((row) => String(row.user_email || '').trim().toLowerCase() === emailLower)
      .map((row) => row.tour_id)
  )
  const pending = tours.filter((row) => !done.has(row.id))
  if (pending.length === 0) return []

  const productIds = [
    ...new Set(pending.map((row) => row.product_id).filter((id): id is string => !!id)),
  ]
  let nameById = new Map<string, { ko: string; en: string }>()
  if (productIds.length > 0) {
    const { data: products } = await db
      .from('products')
      .select('id, name_ko, name_en, name')
      .in('id', productIds)
    nameById = new Map(
      (products || []).map((product) => [
        product.id,
        {
          ko: product.name_ko || product.name_en || product.name || product.id,
          en: product.name_en || product.name_ko || product.name || product.id,
        },
      ])
    )
  }

  const isEn = locale.startsWith('en')
  return pending.map((row) => {
    const names = row.product_id ? nameById.get(row.product_id) : undefined
    return {
      id: row.id,
      tourDate: row.tour_date,
      name: names ? (isEn ? names.en : names.ko) : row.product_id || row.id,
    }
  })
}
