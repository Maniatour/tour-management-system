'use client'

import { useEffect, useState } from 'react'
import { CalendarRange, Loader2, Route, X } from 'lucide-react'
import { OpTodoProductSelect } from '@/components/admin/todo/OpTodoProductSelect'
import type { PendingCustomerResolutionKind } from '@/lib/pendingCustomerManagementWorkflow'
import { pendingCustomerManagementCardCopy } from '@/lib/pendingCustomerManagementCardCopy'
import { updateReservationTourSlot } from '@/lib/reservationUpdate'
import { supabase } from '@/lib/supabase'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import { getProductInternalName } from '@/utils/reservationUtils'

type PendingCustomerResolutionModalProps = {
  isOpen: boolean
  kind: Exclude<PendingCustomerResolutionKind, 'cancel'>
  locale: string
  reservationId: string
  currentTourDate: string | null | undefined
  currentProductId: string
  products: Array<{
    id: string
    name?: string | null
    name_ko?: string | null
    name_en?: string | null
    customer_name_ko?: string | null
    customer_name_en?: string | null
  }>
  userEmail: string | null
  saving?: boolean
  onClose: () => void
  onSaved: (kind: Exclude<PendingCustomerResolutionKind, 'cancel'>) => void | Promise<void>
}

function normalizeTourDateInput(value: string | null | undefined): string {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  return raw.includes('T') ? raw.split('T')[0]! : raw.slice(0, 10)
}

export function PendingCustomerResolutionModal({
  isOpen,
  kind,
  locale,
  reservationId,
  currentTourDate,
  currentProductId,
  products,
  userEmail,
  saving: savingProp = false,
  onClose,
  onSaved,
}: PendingCustomerResolutionModalProps) {
  const copy = pendingCustomerManagementCardCopy(locale)
  const isKo = locale === 'ko'
  const [tourDateDraft, setTourDateDraft] = useState('')
  const [productIdDraft, setProductIdDraft] = useState<string | undefined>(undefined)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const currentDateLabel = normalizeTourDateInput(currentTourDate)
  const currentProductLabel = getProductInternalName(currentProductId, products)

  useEffect(() => {
    if (!isOpen) return
    setTourDateDraft(currentDateLabel)
    setProductIdDraft(currentProductId || undefined)
    setNote('')
  }, [isOpen, currentDateLabel, currentProductId])

  if (!isOpen) return null

  const busy = saving || savingProp

  const savePendingResolutionNote = async (resolutionKind: typeof kind, trimmedNote: string) => {
    if (!trimmedNote || !userEmail) return
    const { error } = await fromUntypedTable(supabase, 'reservation_follow_ups').insert({
      reservation_id: reservationId,
      type: 'pending_resolution',
      content: `[${resolutionKind}]\n${trimmedNote}`,
      created_by: userEmail,
    })
    if (error) throw error
  }

  const handleSave = async () => {
    if (kind === 'date_change') {
      const nextDate = normalizeTourDateInput(tourDateDraft)
      if (!nextDate) {
        alert(isKo ? '투어 날짜를 선택해 주세요.' : 'Select a tour date.')
        return
      }
      if (nextDate === currentDateLabel) {
        alert(isKo ? '현재와 다른 투어 날짜를 선택해 주세요.' : 'Choose a different tour date.')
        return
      }

      setSaving(true)
      try {
        const result = await updateReservationTourSlot(reservationId, { tourDate: nextDate })
        if (!result.success) {
          throw new Error(result.error || copy.resolutionSaveFailed)
        }
        await savePendingResolutionNote('date_change', note.trim())
        await onSaved('date_change')
        onClose()
      } catch (e) {
        console.error(e)
        alert(e instanceof Error ? e.message : copy.resolutionSaveFailed)
      } finally {
        setSaving(false)
      }
      return
    }

    const nextProductId = String(productIdDraft ?? '').trim()
    if (!nextProductId) {
      alert(isKo ? '변경할 상품을 선택해 주세요.' : 'Select a product.')
      return
    }
    if (nextProductId === String(currentProductId ?? '').trim()) {
      alert(isKo ? '현재와 다른 상품을 선택해 주세요.' : 'Choose a different product.')
      return
    }

    setSaving(true)
    try {
      const result = await updateReservationTourSlot(reservationId, { productId: nextProductId })
      if (!result.success) {
        throw new Error(result.error || copy.resolutionSaveFailed)
      }
      await savePendingResolutionNote('tour_change', note.trim())
      await onSaved('tour_change')
      onClose()
    } catch (e) {
      console.error(e)
      alert(e instanceof Error ? e.message : copy.resolutionSaveFailed)
    } finally {
      setSaving(false)
    }
  }

  const title =
    kind === 'date_change'
      ? isKo
        ? '투어 날짜 변경'
        : 'Change tour date'
      : isKo
        ? '예약 상품 변경'
        : 'Change product'

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            {kind === 'date_change' ? (
              <CalendarRange className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            ) : (
              <Route className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            )}
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-50"
            aria-label={isKo ? '닫기' : 'Close'}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 p-4">
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
            <p>
              <span className="font-medium text-gray-800">{isKo ? '현재 투어일' : 'Current date'}:</span>{' '}
              {currentDateLabel || '—'}
            </p>
            <p className="mt-1">
              <span className="font-medium text-gray-800">{isKo ? '현재 상품' : 'Current product'}:</span>{' '}
              {currentProductLabel || '—'}
            </p>
          </div>

          {kind === 'date_change' ? (
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">
                {isKo ? '새 투어 날짜' : 'New tour date'}
              </label>
              <input
                type="date"
                value={tourDateDraft}
                onChange={(e) => setTourDateDraft(e.target.value)}
                disabled={busy}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-transparent focus:ring-2 focus:ring-ring"
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">
                {isKo ? '새 상품' : 'New product'}
              </label>
              <OpTodoProductSelect
                locale={locale}
                value={productIdDraft}
                onChange={setProductIdDraft}
                inputClass="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">
              {isKo ? '처리 메모' : 'Handling note'}{' '}
              <span className="font-normal text-gray-500">({isKo ? '선택' : 'optional'})</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              disabled={busy}
              placeholder={copy.resolutionNotePlaceholder}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none ring-primary/20 focus:ring-2"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {isKo ? '취소' : 'Cancel'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleSave()}
              className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {copy.resolutionSave}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
