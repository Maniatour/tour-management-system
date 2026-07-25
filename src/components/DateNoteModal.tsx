'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { X } from 'lucide-react'

export type DateNoteSaveOptions = {
  highlightGuideSchedule: boolean
}

interface DateNoteModalProps {
  isOpen: boolean
  dateString: string | null
  initialNote: string
  initialHighlightGuideSchedule?: boolean
  onClose: () => void
  onSave: (note: string, options: DateNoteSaveOptions) => Promise<void>
  onDelete?: () => Promise<void>
}

export default function DateNoteModal({
  isOpen,
  dateString,
  initialNote,
  initialHighlightGuideSchedule = true,
  onClose,
  onSave,
  onDelete,
}: DateNoteModalProps) {
  const [noteText, setNoteText] = useState('')
  const [highlightGuideSchedule, setHighlightGuideSchedule] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const hasExistingNote = initialNote.trim().length > 0

  useEffect(() => {
    if (isOpen) {
      setNoteText(initialNote)
      setHighlightGuideSchedule(initialHighlightGuideSchedule)
    }
  }, [isOpen, initialNote, initialHighlightGuideSchedule])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNoteText(e.target.value)
  }, [])

  const handleSave = useCallback(async () => {
    if (saving) return
    setSaving(true)
    try {
      await onSave(noteText, { highlightGuideSchedule })
      setNoteText('')
      setHighlightGuideSchedule(true)
    } catch (error) {
      console.error('Error saving note:', error)
    } finally {
      setSaving(false)
    }
  }, [noteText, highlightGuideSchedule, onSave, saving])

  const handleCancel = useCallback(() => {
    setNoteText('')
    setHighlightGuideSchedule(true)
    onClose()
  }, [onClose])

  const handleDelete = useCallback(async () => {
    if (!onDelete || deleting || !hasExistingNote) return

    if (!confirm('정말로 이 날짜의 노트를 삭제하시겠습니까?')) {
      return
    }

    setDeleting(true)
    try {
      await onDelete()
      setNoteText('')
      setHighlightGuideSchedule(true)
    } catch (error) {
      console.error('Error deleting note:', error)
    } finally {
      setDeleting(false)
    }
  }, [onDelete, deleting, hasExistingNote])

  if (!isOpen || !dateString) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1100]">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-primary/10 text-primary">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">날짜 노트 - {dateString}</h3>
          </div>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">노트 내용</label>
          <textarea
            value={noteText}
            onChange={handleChange}
            rows={8}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent resize-none"
            placeholder="해당 날짜에 대한 노트를 입력하세요. 예: 성수기라 고려해야하는 것이 많아"
            autoFocus
          />
        </div>

        <label className="mb-6 flex cursor-pointer items-start gap-3 rounded-lg border border-border/60 bg-muted/30 px-3 py-3">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-400 text-primary focus:ring-primary"
            checked={highlightGuideSchedule}
            onChange={(e) => setHighlightGuideSchedule(e.target.checked)}
          />
          <span className="text-sm text-gray-700">
            <span className="font-medium text-gray-900">가이드 스케줄 영역 노란색 강조</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              체크 해제 시 노트는 유지되지만, 아래 가이드 스케줄 표의 해당 날짜 칸은 노란색으로 표시되지 않습니다.
            </span>
          </span>
        </label>

        <div className="flex justify-between items-center">
          <div>
            {hasExistingNote && onDelete && (
              <button
                onClick={handleDelete}
                disabled={saving || deleting}
                className="px-4 py-2 text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                {deleting ? '삭제 중...' : '삭제'}
              </button>
            )}
          </div>

          <div className="flex space-x-3">
            <button
              onClick={handleCancel}
              disabled={saving || deleting}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={saving || deleting}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
