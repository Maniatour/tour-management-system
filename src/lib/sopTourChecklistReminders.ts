import type { SupabaseClient } from '@supabase/supabase-js'
import {
  assignmentsForProduct,
  computeTourChecklistProgress,
  type SopProductChecklistAssignmentRow,
  type SopTourChecklistCompletionRow,
} from '@/lib/sopTourChecklist'
import { sendTourChecklistIncompleteReminderPush } from '@/lib/sendStaffSopPush'

type TourRow = {
  id: string
  tour_date: string
  product_id: string | null
  tour_guide_id: string | null
}

type ProductRow = {
  id: string
  name_ko: string | null
  name_en: string | null
  name: string
  product_code: string | null
}

export type IncompleteTourReminderTarget = {
  tourId: string
  tourDate: string
  guideEmail: string
  productLabel: string
  missingRequired: number
}

export async function findIncompleteTourChecklistTargets(
  admin: SupabaseClient,
  options: {
    dateFrom: string
    dateTo: string
    tourIds?: string[]
  }
): Promise<IncompleteTourReminderTarget[]> {
  const { data: assignData, error: assignErr } = await admin
    .from('sop_product_checklist_items')
    .select('id, product_id, sop_version_id, section_id, category_id, item_id, sort_order, is_required')

  if (assignErr) throw assignErr
  const allAssignments = (assignData || []) as SopProductChecklistAssignmentRow[]
  const productIds = [...new Set(allAssignments.map((a) => a.product_id).filter(Boolean))]
  if (productIds.length === 0) return []

  let tourQuery = admin
    .from('tours')
    .select('id, tour_date, product_id, tour_guide_id')
    .in('product_id', productIds)
    .gte('tour_date', options.dateFrom)
    .lte('tour_date', options.dateTo)
    .order('tour_date', { ascending: false })
    .limit(400)

  if (options.tourIds?.length) {
    tourQuery = tourQuery.in('id', options.tourIds)
  }

  const { data: tourData, error: tourErr } = await tourQuery
  if (tourErr) throw tourErr
  const tours = (tourData || []) as TourRow[]
  if (tours.length === 0) return []

  const tourIds = tours.map((t) => t.id)
  const tourProductIds = [...new Set(tours.map((t) => t.product_id).filter(Boolean))] as string[]

  const [{ data: productData }, { data: compData, error: compErr }] = await Promise.all([
    admin.from('products').select('id, name_ko, name_en, name, product_code').in('id', tourProductIds),
    admin
      .from('sop_tour_checklist_completions')
      .select('id, tour_id, item_id, completed_at, completed_by, completed_by_email')
      .in('tour_id', tourIds),
  ])

  if (compErr) throw compErr

  const productMap = new Map(((productData || []) as ProductRow[]).map((p) => [p.id, p]))
  const completionsByTour = new Map<string, Set<string>>()
  for (const c of (compData || []) as SopTourChecklistCompletionRow[]) {
    const set = completionsByTour.get(c.tour_id) ?? new Set<string>()
    set.add(c.item_id)
    completionsByTour.set(c.tour_id, set)
  }

  const targets: IncompleteTourReminderTarget[] = []
  for (const tour of tours) {
    if (!tour.product_id || !tour.tour_guide_id?.trim()) continue
    const productAssignments = assignmentsForProduct(allAssignments, tour.product_id)
    if (productAssignments.length === 0) continue

    const completed = completionsByTour.get(tour.id) ?? new Set<string>()
    const progress = computeTourChecklistProgress(productAssignments, completed)
    if (progress.isComplete || progress.missingRequired <= 0) continue

    const product = productMap.get(tour.product_id)
    const productName = product?.name_ko || product?.name_en || product?.name || tour.product_id
    const productLabel = product?.product_code ? `${productName} (${product.product_code})` : productName

    targets.push({
      tourId: tour.id,
      tourDate: tour.tour_date,
      guideEmail: tour.tour_guide_id.trim(),
      productLabel,
      missingRequired: progress.missingRequired,
    })
  }

  return targets
}

export async function sendIncompleteTourChecklistReminders(
  admin: SupabaseClient,
  options: {
    dateFrom: string
    dateTo: string
    tourIds?: string[]
    locale?: string
  }
): Promise<{
  targets: number
  sent: number
  failed: number
  skippedNoVapid: boolean
  noSubscriptions: number
}> {
  const targets = await findIncompleteTourChecklistTargets(admin, options)
  if (targets.length === 0) {
    return { targets: 0, sent: 0, failed: 0, skippedNoVapid: false, noSubscriptions: 0 }
  }

  const locale = options.locale === 'en' ? 'en' : 'ko'
  let sent = 0
  let failed = 0
  let skippedNoVapid = false
  let noSubscriptions = 0

  for (const target of targets) {
    const result = await sendTourChecklistIncompleteReminderPush(admin, {
      tourId: target.tourId,
      tourDate: target.tourDate,
      productLabel: target.productLabel,
      missingRequired: target.missingRequired,
      targetEmail: target.guideEmail,
      locale,
    })
    sent += result.sent
    failed += result.failed
    if (result.skippedNoVapid) skippedNoVapid = true
    noSubscriptions += result.noSubscriptions
  }

  return { targets: targets.length, sent, failed, skippedNoVapid, noSubscriptions }
}
