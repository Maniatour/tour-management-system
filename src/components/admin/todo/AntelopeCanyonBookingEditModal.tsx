'use client'

import { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

const TicketBookingForm = dynamic(() => import('@/components/booking/TicketBookingForm'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  ),
})



type AntelopeCanyonBookingEditModalProps = {

  bookingId: string | null

  locale: string

  onClose: () => void

  onSaved?: () => void

}



export function AntelopeCanyonBookingEditModal({

  bookingId,

  locale,

  onClose,

  onSaved,

}: AntelopeCanyonBookingEditModalProps) {

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

        .from('ticket_bookings')

        .select('*')

        .eq('id', bookingId)

        .maybeSingle()

      if (error) throw error

      setBooking((data as Record<string, unknown> | null) ?? null)

    } catch (e) {

      console.error('AntelopeCanyonBookingEditModal load', e)

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

            {isKo ? '앤텔롭캐년 티켓 부킹 수정' : 'Edit Antelope Canyon ticket booking'}

          </DialogTitle>

          <p className="mt-0.5 text-xs text-muted-foreground">

            {isKo

              ? '인원·시간·상태를 수정하거나 취소 요청을 보내세요.'

              : 'Update headcount, time, status, or send a cancellation request.'}

          </p>

        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">

          {loading ? (

            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">

              <Loader2 className="h-5 w-5 animate-spin" />

              {isKo ? '부킹 불러오는 중…' : 'Loading booking…'}

            </div>

          ) : booking ? (

            <TicketBookingForm

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


