'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Bell, ExternalLink } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import {
  assignmentsForProduct,
  computeTourChecklistProgress,
  type SopProductChecklistAssignmentRow,
  type SopTourChecklistCompletionRow,
} from '@/lib/sopTourChecklist'
import { cn } from '@/lib/utils'

type TourRow = {
  id: string
  tour_date: string
  product_id: string | null
  tour_guide_id: string | null
  tour_status: string | null
}

type ProductRow = { id: string; name_ko: string | null; name_en: string | null; name: string; product_code: string | null }
type TeamRow = { email: string; name_ko: string | null; name_en: string | null }

type ComplianceRow = {
  tour: TourRow
  productLabel: string
  guideLabel: string
  guideEmail: string | null
  progress: ReturnType<typeof computeTourChecklistProgress>
}

function dateInputValue(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function progressBarClass(isComplete: boolean): string {
  return isComplete ? 'bg-green-500' : 'bg-amber-500'
}

export default function CompanySopTourChecklistCompliancePanel({
  uiLocaleEn,
  locale,
}: {
  uiLocaleEn: boolean
  locale: string
}) {
  const today = useMemo(() => new Date(), [])
  const defaultFrom = useMemo(() => {
    const d = new Date(today)
    d.setDate(d.getDate() - 14)
    return dateInputValue(d)
  }, [today])
  const defaultTo = useMemo(() => {
    const d = new Date(today)
    d.setDate(d.getDate() + 7)
    return dateInputValue(d)
  }, [today])

  const [fromDate, setFromDate] = useState(defaultFrom)
  const [toDate, setToDate] = useState(defaultTo)
  const [filter, setFilter] = useState<'all' | 'incomplete'>('incomplete')
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [rows, setRows] = useState<ComplianceRow[]>([])
  const [remindBusy, setRemindBusy] = useState(false)
  const [remindTourId, setRemindTourId] = useState<string | null>(null)
  const [remindMsg, setRemindMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErrorMsg(null)
    try {
      const { data: assignData, error: assignErr } = await supabase
        .from('sop_product_checklist_items')
        .select('id, product_id, sop_version_id, section_id, category_id, item_id, sort_order, is_required')

      if (assignErr) throw assignErr
      const allAssignments = (assignData || []) as SopProductChecklistAssignmentRow[]
      const productIds = [...new Set(allAssignments.map((a) => a.product_id).filter(Boolean))]

      if (productIds.length === 0) {
        setRows([])
        return
      }

      const { data: tourData, error: tourErr } = await supabase
        .from('tours')
        .select('id, tour_date, product_id, tour_guide_id, tour_status')
        .in('product_id', productIds)
        .gte('tour_date', fromDate)
        .lte('tour_date', toDate)
        .order('tour_date', { ascending: false })
        .limit(250)

      if (tourErr) throw tourErr
      const tours = (tourData || []) as TourRow[]
      if (tours.length === 0) {
        setRows([])
        return
      }

      const tourIds = tours.map((t) => t.id)
      const tourProductIds = [...new Set(tours.map((t) => t.product_id).filter(Boolean))] as string[]
      const guideEmails = [...new Set(tours.map((t) => t.tour_guide_id).filter(Boolean))] as string[]

      const [{ data: productData }, { data: teamData }, { data: compData, error: compErr }] = await Promise.all([
        supabase
          .from('products')
          .select('id, name_ko, name_en, name, product_code')
          .in('id', tourProductIds),
        guideEmails.length > 0
          ? supabase.from('team').select('email, name_ko, name_en').in('email', guideEmails)
          : Promise.resolve({ data: [] as TeamRow[], error: null }),
        supabase
          .from('sop_tour_checklist_completions')
          .select('id, tour_id, item_id, completed_at, completed_by, completed_by_email')
          .in('tour_id', tourIds),
      ])

      if (compErr) throw compErr

      const productMap = new Map(((productData || []) as ProductRow[]).map((p) => [p.id, p]))
      const teamMap = new Map(((teamData || []) as TeamRow[]).map((t) => [t.email.trim().toLowerCase(), t]))

      const completionsByTour = new Map<string, Set<string>>()
      for (const c of (compData || []) as SopTourChecklistCompletionRow[]) {
        const set = completionsByTour.get(c.tour_id) ?? new Set<string>()
        set.add(c.item_id)
        completionsByTour.set(c.tour_id, set)
      }

      const built: ComplianceRow[] = []
      for (const tour of tours) {
        if (!tour.product_id) continue
        const productAssignments = assignmentsForProduct(allAssignments, tour.product_id)
        if (productAssignments.length === 0) continue

        const completed = completionsByTour.get(tour.id) ?? new Set<string>()
        const progress = computeTourChecklistProgress(productAssignments, completed)

        const product = productMap.get(tour.product_id)
        const productName = product
          ? uiLocaleEn
            ? product.name_en || product.name_ko || product.name
            : product.name_ko || product.name_en || product.name
          : tour.product_id
        const productLabel = product?.product_code ? `${productName} (${product.product_code})` : productName

        const guideEmail = tour.tour_guide_id?.trim() || null
        const guide = guideEmail ? teamMap.get(guideEmail.toLowerCase()) : null
        const guideLabel = guide
          ? uiLocaleEn
            ? guide.name_en || guide.name_ko || guideEmail || '—'
            : guide.name_ko || guide.name_en || guideEmail || '—'
          : guideEmail || '—'

        built.push({ tour, productLabel, guideLabel, guideEmail, progress })
      }

      setRows(built)
    } catch (e) {
      console.warn('sop tour checklist compliance:', e)
      setErrorMsg(uiLocaleEn ? 'Could not load tour compliance.' : '투어 이행 현황을 불러오지 못했습니다.')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [fromDate, toDate, uiLocaleEn])

  useEffect(() => {
    void load()
  }, [load])

  const visibleRows = useMemo(() => {
    if (filter === 'incomplete') {
      return rows.filter((r) => r.progress.total > 0 && !r.progress.isComplete)
    }
    return rows
  }, [rows, filter])

  const summary = useMemo(() => {
    const withTemplate = rows.length
    const incomplete = rows.filter((r) => !r.progress.isComplete).length
    const complete = rows.filter((r) => r.progress.isComplete).length
    return { withTemplate, incomplete, complete }
  }, [rows])

  const sendRemind = async (tourIds?: string[]) => {
    setRemindBusy(true)
    setRemindMsg(null)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) throw new Error(uiLocaleEn ? 'Sign in required.' : '로그인이 필요합니다.')

      const res = await fetch('/api/sop/remind-tour-checklists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          locale,
          dateFrom: fromDate,
          dateTo: toDate,
          tourIds,
        }),
      })
      const json = (await res.json()) as {
        error?: string
        targets?: number
        sent?: number
        failed?: number
        skippedNoVapid?: boolean
        noSubscriptions?: number
      }
      if (!res.ok) throw new Error(json.error || (uiLocaleEn ? 'Push failed.' : '푸시 발송에 실패했습니다.'))

      if (json.skippedNoVapid) {
        setRemindMsg(uiLocaleEn ? 'Push is not configured (VAPID).' : '푸시(VAPID)가 설정되지 않았습니다.')
      } else if ((json.targets ?? 0) === 0) {
        setRemindMsg(uiLocaleEn ? 'No incomplete tours to remind.' : '알림 보낼 미완료 투어가 없습니다.')
      } else {
        setRemindMsg(
          uiLocaleEn
            ? `Sent ${json.sent ?? 0} · failed ${json.failed ?? 0} · no subscription ${json.noSubscriptions ?? 0} (${json.targets} tour(s))`
            : `발송 ${json.sent ?? 0} · 실패 ${json.failed ?? 0} · 구독 없음 ${json.noSubscriptions ?? 0} (대상 ${json.targets}건)`
        )
      }
    } catch (e) {
      setRemindMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setRemindBusy(false)
      setRemindTourId(null)
      window.setTimeout(() => setRemindMsg(null), 5000)
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            {uiLocaleEn ? 'Tours with checklist' : '체크리스트 투어'}
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900">{summary.withTemplate}</p>
        </div>
        <div className="rounded-xl border border-green-200 bg-green-50/60 p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-green-700">
            {uiLocaleEn ? 'Complete' : '완료'}
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-green-800">{summary.complete}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-800">
            {uiLocaleEn ? 'Incomplete' : '미완료'}
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-amber-900">{summary.incomplete}</p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              {uiLocaleEn ? 'From' : '시작일'}
            </label>
            <input
              type="date"
              className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              {uiLocaleEn ? 'To' : '종료일'}
            </label>
            <input
              type="date"
              className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
          <Button type="button" size="sm" variant="outline" disabled={loading} onClick={() => void load()}>
            {loading ? (uiLocaleEn ? 'Loading…' : '불러오는 중…') : uiLocaleEn ? 'Refresh' : '새로고침'}
          </Button>
          <div className="flex gap-1">
            <Button
              type="button"
              size="sm"
              variant={filter === 'incomplete' ? 'default' : 'outline'}
              onClick={() => setFilter('incomplete')}
            >
              {uiLocaleEn ? 'Incomplete' : '미완료'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={filter === 'all' ? 'default' : 'outline'}
              onClick={() => setFilter('all')}
            >
              {uiLocaleEn ? 'All' : '전체'}
            </Button>
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={remindBusy || summary.incomplete === 0}
            className="ml-auto gap-1.5"
            onClick={() => void sendRemind()}
          >
            <Bell className="h-3.5 w-3.5" />
            {remindBusy
              ? uiLocaleEn
                ? 'Sending…'
                : '발송 중…'
              : uiLocaleEn
                ? 'Remind all incomplete'
                : '미완료 전체 푸시'}
          </Button>
        </div>
      </div>

      {remindMsg ? <p className="text-sm text-gray-700">{remindMsg}</p> : null}
      {errorMsg ? <p className="text-sm text-red-600">{errorMsg}</p> : null}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-600">
              <tr>
                <th className="px-4 py-3">{uiLocaleEn ? 'Date' : '투어일'}</th>
                <th className="px-4 py-3">{uiLocaleEn ? 'Product' : '상품'}</th>
                <th className="px-4 py-3">{uiLocaleEn ? 'Guide' : '가이드'}</th>
                <th className="min-w-[8rem] px-4 py-3">{uiLocaleEn ? 'Progress' : '진행'}</th>
                <th className="px-4 py-3">{uiLocaleEn ? 'Status' : '상태'}</th>
                <th className="px-4 py-3">{uiLocaleEn ? 'Actions' : '작업'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                    {uiLocaleEn ? 'Loading…' : '불러오는 중…'}
                  </td>
                </tr>
              ) : visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                    {filter === 'incomplete'
                      ? uiLocaleEn
                        ? 'No incomplete tours in this range.'
                        : '해당 기간에 미완료 투어가 없습니다.'
                      : uiLocaleEn
                        ? 'No tours with checklist templates in this range.'
                        : '해당 기간에 체크리스트가 있는 투어가 없습니다.'}
                  </td>
                </tr>
              ) : (
                visibleRows.map(({ tour, productLabel, guideLabel, guideEmail, progress }) => {
                  const pct =
                    progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0
                  const canRemind = !progress.isComplete && !!guideEmail
                  return (
                    <tr key={tour.id} className="hover:bg-gray-50/80">
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900">{tour.tour_date}</td>
                      <td className="max-w-[10rem] truncate px-4 py-3 text-gray-700" title={productLabel}>
                        {productLabel}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{guideLabel}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 min-w-[4rem] flex-1 overflow-hidden rounded-full bg-gray-200">
                            <div
                              className={cn('h-full rounded-full', progressBarClass(progress.isComplete))}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="shrink-0 tabular-nums text-xs text-gray-600">
                            {progress.done}/{progress.total}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                            progress.isComplete ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-900'
                          )}
                        >
                          {progress.isComplete
                            ? uiLocaleEn
                              ? 'Complete'
                              : '완료'
                            : uiLocaleEn
                              ? `${progress.missingRequired} req left`
                              : `필수 ${progress.missingRequired}개`}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
                            href={`/${locale}/admin/tours/${tour.id}`}
                          >
                            <ExternalLink className="h-3 w-3" />
                            {uiLocaleEn ? 'Open' : '열기'}
                          </Link>
                          {canRemind ? (
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-gray-900 disabled:opacity-50"
                              disabled={remindBusy}
                              onClick={() => {
                                setRemindTourId(tour.id)
                                void sendRemind([tour.id])
                              }}
                            >
                              <Bell className="h-3 w-3" />
                              {remindTourId === tour.id && remindBusy
                                ? uiLocaleEn
                                  ? '…'
                                  : '…'
                                : uiLocaleEn
                                  ? 'Push'
                                  : '푸시'}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
