'use client'

import { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

const TourHotelBookingForm = dynamic(() => import('@/components/booking/TourHotelBookingForm'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  ),
})

type TourHotelPriceCheckEditModalProps = {
  bookingId: string | null
  locale: string
  onClose: () => void
  onSaved?: () => void
}

export function TourHotelPriceCheckEditModal({
  bookingId,
  locale,
  onClose,
  onSaved,
}: TourHotelPriceCheckEditModalProps) {
  const isKo = locale === 'ko'
  const [booking, setBooking] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(false)

  const loadBooking = useCallback(async () => {
    if (!bookingId) {
      setBooking(null)
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('tour_hotel_bookings')
        .select('*')
        .eq('id', bookingId)
        .maybeSingle()
      if (error) throw error
      setBooking((data as Record<string, unknown> | null) ?? null)
    } catch (e) {
      console.error('TourHotelPriceCheckEditModal load', e)
      setBooking(null)
    } finally {
      setLoading(false)
    }
  }, [bookingId])

  useEffect(() => {
    void loadBooking()
  }, [loadBooking])

  return (
    <Dialog open={Boolean(bookingId)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[min(92vh,900px)] max-w-4xl flex-col gap-0 overflow-hidden p-0">
        <div className="border-b border-border px-4 py-3">
          <DialogTitle className="text-sm font-semibold text-foreground">
            {isKo ? '투어 호텔 부킹 수정 · 재부킹' : 'Edit / rebook tour hotel'}
          </DialogTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {isKo
              ? '가격이 변경되었으면 금액을 수정하거나 새로 부킹하세요.'
              : 'Update price or rebook if the rate changed.'}
          </p>
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              {isKo ? '부킹 불러오는 중…' : 'Loading booking…'}
            </div>
          ) : booking ? (
            <TourHotelBookingForm
              key={bookingId!}
              booking={booking as never}
              {...(String(booking.tour_id || '')
                ? { tourId: String(booking.tour_id) }
                : {})}
              onSave={() => {
                onSaved?.()
                onClose()
              }}
              onCancel={onClose}
            />
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {isKo ? '부킹을 찾을 수 없습니다.' : 'Booking not found.'}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
