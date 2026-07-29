'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  getTourExpenseSettlementIssues,
  getTourSettlementEndDateYmd,
  tourExpenseHasReceiptAttachment,
  tourExpenseNeedsSettlementReview,
  tourMatchesSettlementDateWindow,
  tourSettlementDateRange,
  tourSettlementFetchStartDate,
  tourSettlementProductExcludedFromNoReceiptCheck,
  type TourSettlementExpenseIssue,
  type TourSettlementExpenseLite,
} from '@/lib/tourSettlementTodo'
import { parseTourAssignmentEmails } from '@/utils/tourUtils'
import { isTourCancelled, isTourDeleted } from '@/utils/tourStatusUtils'

export type TourSettlementQueueExpense = TourSettlementExpenseLite & {
  issues: TourSettlementExpenseIssue[]
}

export type TourSettlementQueueRow = {
  id: string
  tour_date: string
  /** 정산 기준일 (숙박·멀티데이는 종료일) */
  settlement_end_date: string
  product_name: string
  guide_name: string | null
  expenses: TourSettlementQueueExpense[]
  expense_count: number
  /** 지출 없음 또는 영수증 첨부 없음 */
  missing_receipt: boolean
}

type TourRow = {
  id: string
  tour_date: string
  tour_end_datetime?: string | null
  product_id?: string | null
  tour_status?: string | null
  tour_guide_id?: string | null
  products?: { name?: string | null; name_ko?: string | null; name_en?: string | null } | null
}

type TeamMember = { email: string; name_ko: string | null; nick_name?: string | null }

function teamDisplayName(member: TeamMember | undefined): string | null {
  if (!member) return null
  return member.nick_name?.trim() || member.name_ko?.trim() || member.email || null
}

function productDisplayName(tour: TourRow): string {
  const p = tour.products
  return p?.name?.trim() || p?.name_ko?.trim() || p?.name_en?.trim() || tour.product_id || tour.id
}

export function useTourSettlementQueue(enabled = true) {
  const [rows, setRows] = useState<TourSettlementQueueRow[]>([])
  const [loading, setLoading] = useState(false)
  const dateRange = useMemo(() => tourSettlementDateRange(), [])

  const reload = useCallback(async () => {
    if (!enabled) {
      setRows([])
      return
    }

    setLoading(true)
    const { start, end } = dateRange
    const fetchStart = tourSettlementFetchStartDate(start)

    try {
      const { data: toursData, error: toursErr } = await supabase
        .from('tours')
        .select(
          'id, tour_date, tour_end_datetime, product_id, tour_status, tour_guide_id, products(name, name_ko, name_en)'
        )
        .gte('tour_date', fetchStart)
        .lte('tour_date', end)
        .order('tour_date', { ascending: true })
        .order('id', { ascending: true })

      if (toursErr) throw toursErr

      const activeTours = ((toursData || []) as TourRow[]).filter(
        (tour) =>
          !isTourDeleted(tour.tour_status) &&
          !isTourCancelled(tour.tour_status) &&
          tourMatchesSettlementDateWindow(tour, start, end)
      )

      if (!activeTours.length) {
        setRows([])
        return
      }

      const tourIds = activeTours.map((t) => t.id)
      const { data: expensesData, error: expensesErr } = await supabase
        .from('tour_expenses')
        .select(
          'id, tour_id, paid_for, paid_to, amount, payment_method, status, submitted_by, image_url, file_path'
        )
        .in('tour_id', tourIds)
        .order('created_at', { ascending: true })

      if (expensesErr) throw expensesErr

      const expensesByTourId = new Map<string, TourSettlementQueueExpense[]>()
      const tourIdsWithAnyExpense = new Set<string>()
      const tourIdsWithReceiptExpense = new Set<string>()

      for (const raw of (expensesData || []) as TourSettlementExpenseLite[]) {
        const tid = String(raw.tour_id || '').trim()
        if (!tid) continue
        tourIdsWithAnyExpense.add(tid)
        if (tourExpenseHasReceiptAttachment(raw)) {
          tourIdsWithReceiptExpense.add(tid)
        }
        if (!tourExpenseNeedsSettlementReview(raw)) continue
        const list = expensesByTourId.get(tid) || []
        list.push({
          ...raw,
          issues: getTourExpenseSettlementIssues(raw),
        })
        expensesByTourId.set(tid, list)
      }

      const guideEmails = [
        ...new Set(
          activeTours.flatMap((t) => parseTourAssignmentEmails(t.tour_guide_id)).filter(Boolean)
        ),
      ]

      const teamMap = new Map<string, TeamMember>()
      if (guideEmails.length > 0) {
        const { data: teamMembers } = await supabase
          .from('team')
          .select('email, name_ko, nick_name')
          .in('email', guideEmails)
        for (const member of (teamMembers || []) as TeamMember[]) {
          if (member.email) teamMap.set(member.email, member)
        }
      }

      const nextRows: TourSettlementQueueRow[] = []

      for (const tour of activeTours) {
        const expenses = expensesByTourId.get(tour.id) || []
        const settlementEndDate = getTourSettlementEndDateYmd(tour) || tour.tour_date
        const guideEmail = parseTourAssignmentEmails(tour.tour_guide_id)[0]
        const guideAssigned = Boolean(guideEmail)
        const productExcluded = tourSettlementProductExcludedFromNoReceiptCheck(tour.products)

        if (expenses.length > 0) {
          nextRows.push({
            id: tour.id,
            tour_date: tour.tour_date,
            settlement_end_date: settlementEndDate,
            product_name: productDisplayName(tour),
            guide_name: guideEmail ? teamDisplayName(teamMap.get(guideEmail)) : null,
            expenses,
            expense_count: expenses.length,
            missing_receipt: false,
          })
          continue
        }

        const hasAnyExpense = tourIdsWithAnyExpense.has(tour.id)
        const hasReceiptExpense = tourIdsWithReceiptExpense.has(tour.id)
        const missingReceipt = !hasAnyExpense || !hasReceiptExpense

        if (!missingReceipt || !guideAssigned || productExcluded) continue

        nextRows.push({
          id: tour.id,
          tour_date: tour.tour_date,
          settlement_end_date: settlementEndDate,
          product_name: productDisplayName(tour),
          guide_name: guideEmail ? teamDisplayName(teamMap.get(guideEmail)) : null,
          expenses: [],
          expense_count: 0,
          missing_receipt: true,
        })
      }

      nextRows.sort((a, b) => {
        const byEnd = a.settlement_end_date.localeCompare(b.settlement_end_date)
        if (byEnd !== 0) return byEnd
        return a.tour_date.localeCompare(b.tour_date) || a.id.localeCompare(b.id)
      })

      setRows(nextRows)
    } catch (e) {
      console.error('useTourSettlementQueue', e)
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [dateRange, enabled])

  useEffect(() => {
    void reload()
  }, [reload])

  return { rows, loading, reload, dateRange }
}
