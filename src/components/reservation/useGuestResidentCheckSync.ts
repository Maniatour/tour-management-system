'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { saveResidentStatusWithPricing } from '@/lib/saveResidentStatusWithPricing'
import {
  assignedResidentPeopleFromForm,
  fetchLatestResidentCheckGuestRecord,
  guestResidentCountsToFormPatch,
  leftoverUndecidedResidentCount,
  residentStatusCountsFromGuestSubmission,
  type ResidentCheckGuestRecord,
} from '@/lib/residentCheckReservationSync'

type FormSlice = {
  usResidentCount?: number
  nonResidentCount?: number
  nonResidentUnder16Count?: number
  nonResidentWithPassCount?: number
  nonResidentPurchasePassCount?: number
  undecidedResidentCount?: number
  residentStatusAmounts?: Record<string, number>
  totalPeople: number
  productChoices?: unknown[]
}

export function useGuestResidentCheckSync(args: {
  reservationId?: string | null
  customerId?: string | null
  enabled: boolean
  productChoicesReady: boolean
  totalPeople: number
  applyResidentParticipantPatch: (patch: Record<string, unknown>) => void
  syncResidentChoicesFromCurrentCounts: () => void
  formDataRef: { current: FormSlice }
  onSynced?: () => void
}): ResidentCheckGuestRecord | null {
  const [record, setRecord] = useState<ResidentCheckGuestRecord | null>(null)
  const appliedRef = useRef(false)
  const {
    reservationId,
    customerId,
    enabled,
    productChoicesReady,
    totalPeople,
    applyResidentParticipantPatch,
    syncResidentChoicesFromCurrentCounts,
    formDataRef,
    onSynced,
  } = args

  useEffect(() => {
    if (!reservationId) {
      setRecord(null)
      appliedRef.current = false
      return
    }
    let cancelled = false
    ;(async () => {
      const next = await fetchLatestResidentCheckGuestRecord(supabase, reservationId)
      if (!cancelled) setRecord(next)
    })()
    return () => {
      cancelled = true
    }
  }, [reservationId])

  useEffect(() => {
    if (!enabled || !reservationId || !record || appliedRef.current) return
    if (!productChoicesReady) return

    const assigned = assignedResidentPeopleFromForm(formDataRef.current)

    if (assigned === 0) {
      if (totalPeople < 1) return
      const counts = residentStatusCountsFromGuestSubmission(record.submission, totalPeople)
      if (!counts) return
      appliedRef.current = true
      applyResidentParticipantPatch(guestResidentCountsToFormPatch(counts, totalPeople))
      void saveResidentStatusWithPricing(
        supabase,
        reservationId,
        customerId || null,
        totalPeople,
        counts
      ).then((result) => {
        if (!result.ok) {
          console.warn('guest resident-check reservation sync', result.error)
          return
        }
        onSynced?.()
      })
      return
    }

    const leftover = leftoverUndecidedResidentCount(totalPeople, assigned)
    const currentUndecided = formDataRef.current.undecidedResidentCount || 0
    appliedRef.current = true
    if (currentUndecided > leftover) {
      applyResidentParticipantPatch({ undecidedResidentCount: leftover })
    } else {
      syncResidentChoicesFromCurrentCounts()
    }
    const fd = formDataRef.current
    void saveResidentStatusWithPricing(
      supabase,
      reservationId,
      customerId || null,
      totalPeople,
      {
        usResident: fd.usResidentCount || 0,
        nonResident: fd.nonResidentCount || 0,
        nonResidentUnder16: fd.nonResidentUnder16Count || 0,
        nonResidentWithPass: fd.nonResidentWithPassCount || 0,
        residentStatusAmounts: fd.residentStatusAmounts || {},
      }
    ).then((result) => {
      if (!result.ok) {
        console.warn('guest resident-check leftover undecided sync', result.error)
        return
      }
      onSynced?.()
    })
  }, [
    enabled,
    reservationId,
    customerId,
    productChoicesReady,
    totalPeople,
    record,
    applyResidentParticipantPatch,
    syncResidentChoicesFromCurrentCounts,
    formDataRef,
    onSynced,
  ])

  return record
}
