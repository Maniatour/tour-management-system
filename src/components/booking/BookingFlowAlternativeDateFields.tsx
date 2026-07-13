'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Calendar, Plus, Trash2, X } from 'lucide-react'
import BookingFlowAlternateDatesMultiCalendar from '@/components/booking/BookingFlowAlternateDatesMultiCalendar'

type BookingFlowAlternativeDateFieldsProps = {
  productId: string
  primaryTourDate: string
  selectedDates: string[]
  onSelectedDatesChange: (dates: string[]) => void
  translate: (ko: string, en: string) => string
}

function normalizeRows(selectedDates: string[]): string[] {
  return selectedDates.length > 0 ? [...selectedDates, ''] : ['']
}

function commitDates(
  rows: string[],
  primaryTourDate: string,
  onSelectedDatesChange: (dates: string[]) => void
): string[] {
  const valid = rows.filter(
    (ymd) => ymd && ymd !== primaryTourDate && /^\d{4}-\d{2}-\d{2}$/.test(ymd)
  )
  const unique = [...new Set(valid)].sort()
  onSelectedDatesChange(unique)
  return unique
}

function rowsFromDates(dates: string[]): string[] {
  return dates.length > 0 ? [...dates, ''] : ['']
}

export default function BookingFlowAlternativeDateFields({
  productId,
  primaryTourDate,
  selectedDates,
  onSelectedDatesChange,
  translate,
}: BookingFlowAlternativeDateFieldsProps) {
  const [rows, setRows] = useState<string[]>(() => normalizeRows(selectedDates))
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [draftDates, setDraftDates] = useState<string[]>(selectedDates)

  useEffect(() => {
    if (!calendarOpen) return

    setDraftDates(selectedDates)

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setCalendarOpen(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [calendarOpen, selectedDates])

  const updateRow = (index: number, value: string) => {
    const nextRows = [...rows]
    nextRows[index] = value
    setRows(nextRows)
    commitDates(nextRows, primaryTourDate, onSelectedDatesChange)
  }

  const addRow = () => {
    setRows((prev) => [...prev, ''])
  }

  const removeRow = (index: number) => {
    const nextRows = rows.filter((_, rowIndex) => rowIndex !== index)
    const normalized = nextRows.length > 0 ? nextRows : ['']
    setRows(normalized)
    commitDates(normalized, primaryTourDate, onSelectedDatesChange)
  }

  const openCalendar = () => {
    setDraftDates(selectedDates)
    setCalendarOpen(true)
  }

  const applyCalendarSelection = () => {
    const filtered = draftDates
      .filter((ymd) => ymd && ymd !== primaryTourDate)
      .sort()
    const unique = [...new Set(filtered)]
    const nextRows = rowsFromDates(unique)
    setRows(nextRows)
    onSelectedDatesChange(unique)
    setCalendarOpen(false)
  }

  return (
    <div className="booking-alternate-date-fields space-y-2">
      {rows.map((value, index) => (
        <div key={`alternate-date-row-${index}`} className="flex items-center gap-2">
          <input
            type="date"
            value={value}
            min={new Date().toISOString().split('T')[0]}
            onChange={(event) => updateRow(index, event.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-foreground focus:border-transparent focus:ring-2 focus:ring-ring"
            aria-label={translate(
              `대체 출발일 ${index + 1}`,
              `Alternate departure date ${index + 1}`
            )}
          />
          <button
            type="button"
            onClick={openCalendar}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-card text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/60 hover:text-primary"
            aria-label={translate('달력에서 여러 날짜 선택', 'Pick multiple dates from calendar')}
          >
            <Calendar className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => removeRow(index)}
            disabled={rows.length === 1 && !value}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-card text-muted-foreground transition-colors hover:border-danger/40 hover:bg-danger/5 hover:text-danger disabled:cursor-not-allowed disabled:opacity-40"
            aria-label={translate('날짜 입력칸 제거', 'Remove date field')}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={addRow}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80"
      >
        <Plus className="h-4 w-4" aria-hidden />
        {translate('날짜 추가', 'Add another date')}
      </button>

      {calendarOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
              onClick={() => setCalendarOpen(false)}
              role="presentation"
            >
              <div
                className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-xl"
                onClick={(event) => event.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label={translate('날짜 선택', 'Select dates')}
              >
                <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-5 py-4">
                  <h3 className="text-lg font-semibold text-foreground">
                    {translate('대체 출발일 선택', 'Select alternate dates')}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setCalendarOpen(false)}
                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label="Close"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="overflow-y-auto px-5 py-4">
                  <BookingFlowAlternateDatesMultiCalendar
                    productId={productId}
                    primaryTourDate={primaryTourDate}
                    selectedDates={draftDates}
                    onSelectedDatesChange={setDraftDates}
                    translate={translate}
                  />
                </div>
                <div className="flex shrink-0 justify-end gap-2 border-t border-border/60 px-5 py-4">
                  <button
                    type="button"
                    onClick={() => setCalendarOpen(false)}
                    className="rounded-lg border border-border/60 px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
                  >
                    {translate('취소', 'Cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={applyCalendarSelection}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    {translate('적용', 'Apply')}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  )
}
