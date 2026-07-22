'use client'

import { useCallback, useState, type Dispatch, type SetStateAction } from 'react'
import { supabase } from '@/lib/supabase'
import type { ScheduleMessageModalType } from '@/hooks/useScheduleViewDialogs'

type ShowMessageFn = (title: string, message: string, type?: ScheduleMessageModalType) => void

type UseScheduleViewDateNotesParams = {
  dateNotes: Record<string, { note: string; created_by?: string }>
  setDateNotes: Dispatch<SetStateAction<Record<string, { note: string; created_by?: string }>>>
  userEmail?: string | null | undefined
  showMessage: ShowMessageFn
}

export function useScheduleViewDateNotes({
  dateNotes,
  setDateNotes,
  userEmail,
  showMessage,
}: UseScheduleViewDateNotesParams) {
  const [showDateNoteModal, setShowDateNoteModal] = useState(false)
  const [selectedDateForNote, setSelectedDateForNote] = useState<string | null>(null)

  const openDateNoteModal = useCallback((dateString: string) => {
    setSelectedDateForNote(dateString)
    setShowDateNoteModal(true)
  }, [])

  const closeDateNoteModal = useCallback(() => {
    setShowDateNoteModal(false)
    setSelectedDateForNote(null)
  }, [])

  const saveDateNote = useCallback(
    async (noteText: string) => {
      if (!selectedDateForNote) return

      try {
        const noteData = {
          note_date: selectedDateForNote,
          note: noteText.trim() || null,
          created_by: userEmail || null,
        }

        if (!noteText.trim()) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error } = await (supabase as any)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .from('date_notes' as any)
            .delete()
            .eq('note_date', selectedDateForNote)

          if (error) throw error

          setDateNotes((prev) => {
            const newNotes = { ...prev }
            delete newNotes[selectedDateForNote]
            return newNotes
          })
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error } = await (supabase as any)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .from('date_notes' as any)
            .upsert(noteData, { onConflict: 'note_date' })

          if (error) throw error

          setDateNotes((prev) => ({
            ...prev,
            [selectedDateForNote]: {
              note: noteText.trim(),
              ...(userEmail ? { created_by: userEmail } : {}),
            },
          }))
        }

        closeDateNoteModal()
        showMessage('저장 완료', '날짜 노트가 저장되었습니다.', 'success')
      } catch (error) {
        console.error('Error saving date note:', error)
        showMessage('저장 실패', '날짜 노트 저장 중 오류가 발생했습니다.', 'error')
        throw error
      }
    },
    [selectedDateForNote, userEmail, setDateNotes, closeDateNoteModal, showMessage],
  )

  const deleteDateNote = useCallback(async () => {
    if (!selectedDateForNote) return

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from('date_notes' as any)
        .delete()
        .eq('note_date', selectedDateForNote)

      if (error) throw error

      setDateNotes((prev) => {
        const newNotes = { ...prev }
        delete newNotes[selectedDateForNote]
        return newNotes
      })

      closeDateNoteModal()
      showMessage('삭제 완료', '날짜 노트가 삭제되었습니다.', 'success')
    } catch (error) {
      console.error('Error deleting date note:', error)
      showMessage('삭제 실패', '날짜 노트 삭제 중 오류가 발생했습니다.', 'error')
      throw error
    }
  }, [selectedDateForNote, setDateNotes, closeDateNoteModal, showMessage])

  const selectedDateNote = selectedDateForNote ? dateNotes[selectedDateForNote]?.note ?? '' : ''

  return {
    showDateNoteModal,
    selectedDateForNote,
    selectedDateNote,
    openDateNoteModal,
    closeDateNoteModal,
    saveDateNote,
    deleteDateNote,
  }
}
