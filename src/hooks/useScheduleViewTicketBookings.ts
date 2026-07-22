'use client'

import { useCallback, useState } from 'react'
import { supabase } from '@/lib/supabase'

type UseScheduleViewTicketBookingsParams = {
  locale: string
  userEmail?: string | null | undefined
  refreshScheduleData: () => Promise<void>
}

export function useScheduleViewTicketBookings({
  locale,
  userEmail,
  refreshScheduleData,
}: UseScheduleViewTicketBookingsParams) {
  const [scheduleTicketBookingFormOpen, setScheduleTicketBookingFormOpen] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [scheduleTicketBookingEdit, setScheduleTicketBookingEdit] = useState<any>(null)
  const [pickScheduleTicketBookingIds, setPickScheduleTicketBookingIds] = useState<string[] | null>(
    null,
  )

  const closeScheduleTicketBookingForm = useCallback(() => {
    setScheduleTicketBookingFormOpen(false)
    setScheduleTicketBookingEdit(null)
  }, [])

  const loadFullTicketBookingAndOpen = useCallback(
    async (id: string) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from('ticket_bookings')
          .select('*')
          .eq('id', id)
          .maybeSingle()
        if (error) throw error
        if (!data) {
          alert(locale === 'ko' ? '부킹을 불러오지 못했습니다.' : 'Failed to load booking.')
          return
        }
        if ((data as { deletion_requested_at?: string | null }).deletion_requested_at) {
          alert(
            locale === 'ko'
              ? '삭제 요청된 부킹은 목록에 표시되지 않습니다. SUPER 관리자가 입장권 부킹 메뉴에서 처리합니다.'
              : 'This booking is pending deletion and is hidden from the schedule. A super admin can process it from ticket bookings.',
          )
          return
        }
        setScheduleTicketBookingEdit(data)
        setScheduleTicketBookingFormOpen(true)
      } catch (e) {
        console.error(e)
        alert(locale === 'ko' ? '부킹을 불러오지 못했습니다.' : 'Failed to load booking.')
      }
    },
    [locale],
  )

  const onScheduleTicketBookingRowClick = useCallback(
    (bookingIds: string[]) => {
      const unique = [...new Set(bookingIds)].filter(Boolean)
      if (unique.length === 0) return
      if (unique.length === 1) {
        void loadFullTicketBookingAndOpen(unique[0])
        return
      }
      setPickScheduleTicketBookingIds(unique)
    },
    [loadFullTicketBookingAndOpen],
  )

  const handleScheduleTicketBookingSaved = useCallback(async () => {
    closeScheduleTicketBookingForm()
    await refreshScheduleData()
  }, [closeScheduleTicketBookingForm, refreshScheduleData])

  const handleRequestScheduleTicketBookingDelete = useCallback(
    async (id: string) => {
      try {
        const { error } = await supabase
          .from('ticket_bookings')
          .update({
            deletion_requested_at: new Date().toISOString(),
            deletion_requested_by: userEmail || null,
          })
          .eq('id', id)
        if (error) throw error
        alert(
          locale === 'ko'
            ? '삭제 요청되었습니다. SUPER 관리자가 확인 후 영구 삭제합니다.'
            : 'Deletion requested. A super admin will permanently delete after review.',
        )
        await handleScheduleTicketBookingSaved()
      } catch (e) {
        console.error(e)
        alert(locale === 'ko' ? '삭제 요청 처리 중 오류가 발생했습니다.' : 'Failed to request deletion.')
      }
    },
    [userEmail, locale, handleScheduleTicketBookingSaved],
  )

  return {
    scheduleTicketBookingFormOpen,
    scheduleTicketBookingEdit,
    pickScheduleTicketBookingIds,
    setPickScheduleTicketBookingIds,
    closeScheduleTicketBookingForm,
    loadFullTicketBookingAndOpen,
    onScheduleTicketBookingRowClick,
    handleScheduleTicketBookingSaved,
    handleRequestScheduleTicketBookingDelete,
  }
}
