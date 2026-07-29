'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { normalizeReservationIds } from '@/utils/tourUtils'

const TourExpenseManager = dynamic(() => import('@/components/TourExpenseManager'), { ssr: false })

type TourSettlementExpenseModalProps = {
  expenseId: string | null
  locale: string
  onClose: () => void
  onUpdated?: () => void
}

type LoadedTour = {
  id: string
  tour_date: string
  product_id: string | null
  tour_status: string | null
  reservation_ids: unknown
}

export function TourSettlementExpenseModal({
  expenseId,
  locale,
  onClose,
  onUpdated,
}: TourSettlementExpenseModalProps) {
  const isKo = locale === 'ko'
  const { user, userRole } = useAuth()
  const [loading, setLoading] = useState(false)
  const [tour, setTour] = useState<LoadedTour | null>(null)
  const [portalReady, setPortalReady] = useState(false)

  useEffect(() => {
    setPortalReady(true)
  }, [])

  const loadTourForExpense = useCallback(async () => {
    if (!expenseId) {
      setTour(null)
      return
    }

    setLoading(true)
    try {
      const { data: expenseRow, error: expenseErr } = await supabase
        .from('tour_expenses')
        .select('tour_id')
        .eq('id', expenseId)
        .maybeSingle()

      if (expenseErr) throw expenseErr

      const tourId = String((expenseRow as { tour_id?: string | null } | null)?.tour_id || '').trim()
      if (!tourId) {
        setTour(null)
        return
      }

      const { data: tourRow, error: tourErr } = await supabase
        .from('tours')
        .select('id, tour_date, product_id, tour_status, reservation_ids, tour_guide_id')
        .eq('id', tourId)
        .maybeSingle()

      if (tourErr) throw tourErr
      if (!tourRow) {
        setTour(null)
        return
      }

      setTour({
        id: String((tourRow as { id: string }).id),
        tour_date: String((tourRow as { tour_date: string }).tour_date),
        product_id: (tourRow as { product_id?: string | null }).product_id ?? null,
        tour_status: (tourRow as { tour_status?: string | null }).tour_status ?? null,
        reservation_ids: (tourRow as { reservation_ids?: unknown }).reservation_ids,
      })
    } catch (e) {
      console.error('TourSettlementExpenseModal load', e)
      setTour(null)
    } finally {
      setLoading(false)
    }
  }, [expenseId])

  useEffect(() => {
    void loadTourForExpense()
  }, [loadTourForExpense])

  const reservationIds = useMemo(
    () => normalizeReservationIds(tour?.reservation_ids),
    [tour?.reservation_ids]
  )

  const handleEmbedClose = useCallback(() => {
    setTour(null)
    onClose()
  }, [onClose])

  const handleEmbedUpdated = useCallback(() => {
    onUpdated?.()
  }, [onUpdated])

  if (!expenseId || !portalReady) return null

  if (loading || !tour) {
    return createPortal(
      <div className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/50 p-4 pointer-events-auto">
        <div className="flex items-center gap-2 rounded-xl bg-white px-5 py-4 text-sm text-gray-600 shadow-xl">
          <Loader2 className="h-5 w-5 animate-spin text-violet-700" />
          {isKo ? '지출 불러오는 중…' : 'Loading expense…'}
        </div>
      </div>,
      document.body
    )
  }

  return (
    <TourExpenseManager
      key={`${tour.id}-${expenseId}`}
      tourId={tour.id}
      tourDate={tour.tour_date}
      productId={tour.product_id}
      submittedBy={user?.email || ''}
      reservationIds={reservationIds}
      userRole={userRole || 'admin'}
      tourStatus={tour.tour_status}
      embedSingleExpenseId={expenseId}
      onEmbedClose={handleEmbedClose}
      onEmbedUpdated={handleEmbedUpdated}
    />
  )
}
