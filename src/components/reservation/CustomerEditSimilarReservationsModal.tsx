'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Users } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { Database } from '@/lib/supabase'
import { createClientSupabase } from '@/lib/supabase'
import CustomerForm from '@/components/CustomerForm'
import type { Customer, Reservation } from '@/types/reservation'
import {
  fetchReservationsForCustomerIds,
  fetchSimilarCustomersFromDb,
  findSimilarCustomersForAnchor,
  mergeCustomerLists,
  resolveSimilarCustomerMatchReason,
  type SimilarCustomerMatchReason,
} from '@/lib/similarCustomerReservations'

type CustomerInsert = Database['public']['Tables']['customers']['Insert']

export type CustomerEditSimilarReservationsModalProps = {
  customer: Customer
  allCustomers: Customer[]
  channels: Array<{ id: string; name: string; type: string | null }>
  productMap: Map<string, string>
  operatorId?: string | null
  locale: string
  onSubmit: (customerData: CustomerInsert) => void | Promise<void>
  onCancel: () => void
  onDelete?: () => void | Promise<void>
  onCustomerClick: (customer: Customer) => void
  onReservationsLoaded?: (reservations: Reservation[]) => void
  onSimilarCustomersLoaded?: (customers: Customer[]) => void
  renderReservationCard: (reservation: Reservation) => React.ReactNode
}

function matchReasonLabelKey(reason: SimilarCustomerMatchReason): string {
  switch (reason) {
    case 'self':
      return 'matchSelf'
    case 'name_exact':
      return 'matchNameExact'
    case 'name_similar':
      return 'matchNameSimilar'
    case 'email':
      return 'matchEmail'
    case 'phone':
      return 'matchPhone'
    default:
      return 'matchNameSimilar'
  }
}

export default function CustomerEditSimilarReservationsModal({
  customer,
  allCustomers,
  channels,
  productMap,
  operatorId,
  locale: _locale,
  onSubmit,
  onCancel,
  onDelete,
  onCustomerClick,
  onReservationsLoaded,
  onSimilarCustomersLoaded,
  renderReservationCard,
}: CustomerEditSimilarReservationsModalProps) {
  const t = useTranslations('reservations.customerEditSimilar')
  const supabase = createClientSupabase()

  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [similarCustomers, setSimilarCustomers] = useState<Customer[]>([customer])

  const customerRef = useRef(customer)
  const allCustomersRef = useRef(allCustomers)
  const productMapRef = useRef(productMap)
  const onReservationsLoadedRef = useRef(onReservationsLoaded)
  const onSimilarCustomersLoadedRef = useRef(onSimilarCustomersLoaded)
  const loadGenerationRef = useRef(0)
  customerRef.current = customer
  allCustomersRef.current = allCustomers
  productMapRef.current = productMap
  onReservationsLoadedRef.current = onReservationsLoaded
  onSimilarCustomersLoadedRef.current = onSimilarCustomersLoaded

  useEffect(() => {
    const generation = ++loadGenerationRef.current
    const anchor = customerRef.current

    setLoading(true)
    setLoadFailed(false)
    setSimilarCustomers([anchor])
    setReservations([])

    void (async () => {
      try {
        const fromDb = await fetchSimilarCustomersFromDb(supabase, anchor, operatorId)
        if (generation !== loadGenerationRef.current) return

        const merged = findSimilarCustomersForAnchor(
          mergeCustomerLists(allCustomersRef.current, fromDb),
          anchor
        )
        setSimilarCustomers(merged)

        const ids = merged.map((c) => c.id)
        const rows = await fetchReservationsForCustomerIds(
          supabase,
          ids,
          productMapRef.current,
          operatorId
        )
        if (generation !== loadGenerationRef.current) return

        setReservations(rows)
        setLoading(false)

        queueMicrotask(() => {
          if (generation !== loadGenerationRef.current) return
          onSimilarCustomersLoadedRef.current?.(merged)
          onReservationsLoadedRef.current?.(rows)
        })
      } catch (error) {
        console.error('CustomerEditSimilarReservationsModal load:', error)
        if (generation !== loadGenerationRef.current) return
        setLoadFailed(true)
        setLoading(false)
      }
    })()
  }, [customer.id, operatorId, supabase])

  const groupedSections = useMemo(() => {
    const anchor = customer
    const sortedCustomers = [...similarCustomers].sort((a, b) => {
      if (a.id === anchor.id) return -1
      if (b.id === anchor.id) return 1
      return (a.name ?? '').localeCompare(b.name ?? '', 'ko')
    })

    return sortedCustomers.map((c) => {
      const reason = resolveSimilarCustomerMatchReason(c, anchor)
      const items = reservations
        .filter((r) => r.customerId === c.id)
        .sort((a, b) => {
          const dateCmp = (b.tourDate || '').localeCompare(a.tourDate || '')
          if (dateCmp !== 0) return dateCmp
          return (b.addedTime || '').localeCompare(a.addedTime || '')
        })
      return { customer: c, reason, items }
    })
  }, [similarCustomers, customer, reservations])

  const totalReservationCount = reservations.length
  const similarOthersCount = Math.max(0, similarCustomers.length - 1)

  const modal = (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/50 p-2 sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-[min(96vw,900px)] flex-col overflow-hidden rounded-xl bg-white shadow-2xl lg:max-h-[90vh] lg:flex-row">
        <div className="flex w-full min-w-0 shrink-0 flex-col border-b border-gray-200 lg:w-[min(100%,480px)] lg:border-b-0 lg:border-r">
          <CustomerForm
            embedded
            customer={customer}
            channels={channels}
            onSubmit={onSubmit}
            onCancel={onCancel}
            {...(onDelete ? { onDelete } : {})}
          />
        </div>

        <div className="flex min-h-0 w-full shrink-0 flex-col bg-gray-50/80 lg:w-[372px]">
          <div className="flex items-start justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                <h3 className="text-base font-semibold text-gray-900">{t('panelTitle')}</h3>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-gray-600 sm:text-sm">
                {t('panelSubtitle', {
                  similarCount: similarCustomers.length,
                  reservationCount: totalReservationCount,
                  otherCount: similarOthersCount,
                })}
              </p>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="shrink-0 rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
              aria-label={t('close')}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
            {loading ? (
              <div className="flex min-h-[200px] items-center justify-center text-sm text-gray-500">
                {t('loading')}
              </div>
            ) : loadFailed ? (
              <div className="rounded-lg border border-dashed border-red-200 bg-red-50 px-4 py-8 text-center text-sm text-red-700">
                {t('loadError')}
              </div>
            ) : groupedSections.every((s) => s.items.length === 0) ? (
              <div className="rounded-lg border border-dashed border-gray-200 bg-white px-4 py-12 text-center text-sm text-gray-600">
                {t('empty')}
              </div>
            ) : (
              <div className="space-y-6">
                {groupedSections.map(({ customer: sectionCustomer, reason, items }) => {
                  if (items.length === 0) return null
                  const isActive = sectionCustomer.id === customer.id
                  return (
                    <section
                      key={sectionCustomer.id}
                      className={`rounded-xl border bg-white p-3 sm:p-4 ${
                        isActive ? 'border-primary/40 ring-1 ring-primary/20' : 'border-gray-200'
                      }`}
                    >
                      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => onCustomerClick(sectionCustomer)}
                            className={`text-left text-sm font-semibold hover:underline ${
                              isActive ? 'text-primary' : 'text-gray-900'
                            }`}
                          >
                            {sectionCustomer.name?.trim() || '—'}
                          </button>
                          <div className="mt-1 space-y-0.5 text-xs text-gray-600">
                            <p className="truncate">
                              <span className="font-medium text-gray-500">{t('emailLabel')}</span>{' '}
                              {sectionCustomer.email?.trim() || '—'}
                            </p>
                            <p className="truncate">
                              <span className="font-medium text-gray-500">{t('phoneLabel')}</span>{' '}
                              {sectionCustomer.phone?.trim() || '—'}
                            </p>
                            <p className="font-mono text-[10px] text-gray-400">ID: {sectionCustomer.id}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {reason ? (
                            <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                              {t(matchReasonLabelKey(reason))}
                            </span>
                          ) : null}
                          <span className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                            {t('reservationCount', { count: items.length })}
                          </span>
                        </div>
                      </div>
                      <div className="admin-reservations-card-grid admin-reservations-card-grid--simple admin-reservations-card-grid--single-column">
                        {items.map((reservation) => (
                          <React.Fragment key={reservation.id}>
                            {renderReservationCard(reservation)}
                          </React.Fragment>
                        ))}
                      </div>
                    </section>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return modal
  return createPortal(modal, document.body)
}
