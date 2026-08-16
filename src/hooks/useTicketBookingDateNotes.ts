'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { isAbortLikeError } from '@/lib/supabase'
import {
  calendarGridYmdRange,
  deleteTicketBookingDateNote,
  fetchTicketBookingDateNotes,
  upsertTicketBookingDateNote,
  type TicketBookingDateNoteEntry,
} from '@/lib/ticketBookingDateNotes'

type Params = {
  enabled: boolean
  monthDate: Date
  userEmail?: string | null | undefined
}

export function useTicketBookingDateNotes({ enabled, monthDate, userEmail }: Params) {
  const [dateNotes, setDateNotes] = useState<Record<string, TicketBookingDateNoteEntry>>({})
  const [selectedDateYmd, setSelectedDateYmd] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const fetchGenRef = useRef(0)

  useEffect(() => {
    if (!enabled) return
    const { startYmd, endYmd } = calendarGridYmdRange(monthDate)
    const gen = ++fetchGenRef.current
    void (async () => {
      try {
        const map = await fetchTicketBookingDateNotes(startYmd, endYmd)
        if (gen === fetchGenRef.current) setDateNotes(map)
      } catch (e) {
        if (isAbortLikeError(e)) return
        console.error('ticket booking date notes fetch failed', e)
      }
    })()
  }, [enabled, monthDate])

  const openDateNoteModal = useCallback((dateYmd: string) => {
    setSelectedDateYmd(dateYmd)
    setModalOpen(true)
  }, [])

  const closeDateNoteModal = useCallback(() => {
    if (saving || deleting) return
    setModalOpen(false)
    setSelectedDateYmd(null)
  }, [saving, deleting])

  const saveDateNote = useCallback(
    async (noteText: string) => {
      if (!selectedDateYmd || saving) return
      setSaving(true)
      try {
        const trimmed = noteText.trim()
        if (!trimmed) {
          await deleteTicketBookingDateNote(selectedDateYmd)
          setDateNotes((prev) => {
            const next = { ...prev }
            delete next[selectedDateYmd]
            return next
          })
        } else {
          const entry = await upsertTicketBookingDateNote({
            noteDate: selectedDateYmd,
            note: trimmed,
            createdBy: userEmail ?? null,
          })
          setDateNotes((prev) => ({ ...prev, [selectedDateYmd]: entry }))
        }
        setModalOpen(false)
        setSelectedDateYmd(null)
      } catch (e) {
        console.error('ticket booking date note save failed', e)
        const message = e instanceof Error ? e.message : String(e)
        window.alert(message || 'Failed to save date note')
        throw e
      } finally {
        setSaving(false)
      }
    },
    [selectedDateYmd, saving, userEmail]
  )

  const deleteDateNote = useCallback(async () => {
    if (!selectedDateYmd || deleting) return
    setDeleting(true)
    try {
      await deleteTicketBookingDateNote(selectedDateYmd)
      setDateNotes((prev) => {
        const next = { ...prev }
        delete next[selectedDateYmd]
        return next
      })
      setModalOpen(false)
      setSelectedDateYmd(null)
    } catch (e) {
      console.error('ticket booking date note delete failed', e)
      const message = e instanceof Error ? e.message : String(e)
      window.alert(message || 'Failed to delete date note')
      throw e
    } finally {
      setDeleting(false)
    }
  }, [selectedDateYmd, deleting])

  const selectedNote = selectedDateYmd ? dateNotes[selectedDateYmd]?.note ?? '' : ''

  return {
    dateNotes,
    modalOpen,
    selectedDateYmd,
    selectedNote,
    saving,
    deleting,
    openDateNoteModal,
    closeDateNoteModal,
    saveDateNote,
    deleteDateNote,
  }
}
