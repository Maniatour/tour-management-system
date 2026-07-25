'use client'

import { useCallback, useState, type Dispatch, type SetStateAction } from 'react'
import type { ScheduleDateNoteEntry } from '@/lib/scheduleDateNotes'
import { supabase } from '@/lib/supabase'
import type { ScheduleMessageModalType } from '@/hooks/useScheduleViewDialogs'

type ShowMessageFn = (title: string, message: string, type?: ScheduleMessageModalType) => void

export type SaveDateNoteOptions = {
  highlightGuideSchedule: boolean
}

type UseScheduleViewDateNotesParams = {
  dateNotes: Record<string, ScheduleDateNoteEntry>
  setDateNotes: Dispatch<SetStateAction<Record<string, ScheduleDateNoteEntry>>>
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
    async (noteText: string, options: SaveDateNoteOptions) => {
      if (!selectedDateForNote) return

      try {
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
          const noteData = {
            note_date: selectedDateForNote,
            note: noteText.trim(),
            created_by: userEmail || null,
            highlight_guide_schedule: options.highlightGuideSchedule,
          }

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
              highlight_guide_schedule: options.highlightGuideSchedule,
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
  const selectedHighlightGuideSchedule = selectedDateForNote
    ? dateNotes[selectedDateForNote]?.highlight_guide_schedule !== false
    : true

  return {
    showDateNoteModal,
    selectedDateForNote,
    selectedDateNote,
    selectedHighlightGuideSchedule,
    openDateNoteModal,
    closeDateNoteModal,
    saveDateNote,
    deleteDateNote,
  }
}
