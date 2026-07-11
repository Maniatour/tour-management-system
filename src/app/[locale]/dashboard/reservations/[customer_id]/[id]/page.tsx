'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Calendar } from 'lucide-react'
import CustomerReservationListHeader from '@/components/customer/CustomerReservationListHeader'
import CustomerReservationCard from '@/components/customer/CustomerReservationCard'
import CustomerReservationMediaModal from '@/components/customer/CustomerReservationMediaModal'
import {
  CustomerReservationListLoadingState,
  CustomerReservationNoCustomerState,
  CustomerReservationSimulationEmptyState,
} from '@/components/customer/CustomerReservationListStates'
import type {
  CustomerListCustomer,
  CustomerReservationCardData,
  CustomerReservationChannel,
  ReservationDetails,
} from '@/components/customer/customerReservationTypes'
import { printCustomerReservation } from '@/lib/printCustomerReservation'
import {
  loadReservationBundleByCustomerId,
  loadReservationBundleByEmail,
  loadSimulatedReservationBundle,
} from '@/lib/fetchCustomerReservationList'
import { fetchReservationDetailBundle } from '@/lib/fetchReservationDetailSections'
import { fetchCustomerChannels } from '@/lib/fetchCustomerChannels'

export default function CustomerReservations() {
  const { user, authUser, simulatedUser, isSimulating, stopSimulation } = useAuth()
  const router = useRouter()
  const params = useParams()
  const locale = (params.locale as string) || 'ko'
  const customerIdFromUrl = params.customer_id as string
  const t = useTranslations('common')
  const [reservations, setReservations] = useState<CustomerReservationCardData[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [customer, setCustomer] = useState<CustomerListCustomer | null>(null)
  const [reservationDetails, setReservationDetails] = useState<Record<string, ReservationDetails>>({})
  const [selectedMedia, setSelectedMedia] = useState<string | null>(null)
  const [channels, setChannels] = useState<CustomerReservationChannel[]>([])

  const handlePrint = (reservation: CustomerReservationCardData) => {
    printCustomerReservation(reservation.id)
  }

  const loadChannels = useCallback(async () => {
    const data = await fetchCustomerChannels()
    setChannels(data)
  }, [])

  useEffect(() => {
    loadChannels()
  }, [loadChannels])

  const loadReservations = useCallback(async () => {
    if (!authUser?.email) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const bundle = await loadReservationBundleByEmail(authUser.email, {
        locale,
        noProductName: t('noProductName'),
      })
      setCustomer(bundle.customer as CustomerListCustomer | null)
      setReservations(bundle.reservations as unknown as CustomerReservationCardData[])
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error) {
        const err = error as { code?: string; message?: string }
        if (err.code === 'PGRST116' || err.code === 'PGRST301' || err.message?.includes('406')) {
          setCustomer(null)
          setReservations([])
          return
        }
      }
      console.error(t('dataLoadError'), error)
      setCustomer(null)
      setReservations([])
    } finally {
      setLoading(false)
    }
  }, [authUser?.email, locale, t])

  const loadCustomerReservationsById = useCallback(async (customerId: string) => {
    if (!customerId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const bundle = await loadReservationBundleByCustomerId(customerId, {
        locale,
        noProductName: t('noProductName'),
      })
      setCustomer(bundle.customer as CustomerListCustomer | null)
      setReservations(bundle.reservations as unknown as CustomerReservationCardData[])
    } catch (error) {
      console.error('고객 예약 정보 로드 오류:', error)
      setReservations([])
    } finally {
      setLoading(false)
    }
  }, [locale, t])

  const loadSimulatedReservations = useCallback(async () => {
    if (!simulatedUser) {
      setReservations([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const bundle = await loadSimulatedReservationBundle(simulatedUser, {
        locale,
        noProductName: t('noProductName'),
      })
      setCustomer(bundle.customer as CustomerListCustomer)
      setReservations(bundle.reservations as unknown as CustomerReservationCardData[])
    } catch (error) {
      console.error('시뮬레이션 예약 정보 로드 오류:', error)
      setReservations([])
    } finally {
      setLoading(false)
    }
  }, [simulatedUser, t, locale])

  useEffect(() => {
    if (customerIdFromUrl) {
      loadCustomerReservationsById(customerIdFromUrl)
      return
    }

    if (isSimulating && simulatedUser) {
      loadSimulatedReservations()
    } else if (!isSimulating && user && authUser?.email) {
      loadReservations()
    } else {
      setLoading(false)
    }
  }, [
    customerIdFromUrl,
    isSimulating,
    simulatedUser,
    user,
    authUser?.email,
    loadReservations,
    loadSimulatedReservations,
    loadCustomerReservationsById,
  ])

  const loadReservationDetails = useCallback(
    async (reservationId: string) => {
      if (!reservationDetails[reservationId]) {
        const reservation = reservations.find((r) => r.id === reservationId)
        if (reservation) {
          const bundle = await fetchReservationDetailBundle(
            reservationId,
            reservation.product_id,
            locale,
            reservation.channel_id
          )

          setReservationDetails((prev) => ({
            ...prev,
            [reservationId]: bundle,
          }))
        }
      }
    },
    [reservations, reservationDetails, locale]
  )

  useEffect(() => {
    if (reservations.length > 0) {
      reservations.forEach((reservation) => {
        loadReservationDetails(reservation.id)
      })
    }
  }, [reservations, loadReservationDetails])

  const handleStopSimulation = () => {
    try {
      stopSimulation()
      setTimeout(() => {
        router.push(`/${locale}/admin`)
      }, 100)
    } catch (error) {
      console.error('시뮬레이션 중지 중 오류:', error)
      router.push(`/${locale}/admin`)
    }
  }

  const filteredReservations = reservations.filter((reservation) => {
    if (filter === 'all') return true
    return reservation.status === filter
  })

  const getStatusText = (status: string) => {
    switch (status) {
      case 'inquiry': return t('inquiry')
      case 'pending': return t('pending')
      case 'confirmed': return t('confirmed')
      case 'completed': return t('completed')
      case 'cancelled': return t('cancelled')
      case 'no_show': return t('no_show')
      default: return status
    }
  }

  if (loading) {
    return <CustomerReservationListLoadingState />
  }

  if (!customer && !isSimulating) {
    return (
      <CustomerReservationNoCustomerState
        onGoProfile={() => router.push(`/${locale}/dashboard/profile`)}
      />
    )
  }

  if (!customer && isSimulating && !loading) {
    return (
      <CustomerReservationSimulationEmptyState
        onGoProfile={() => router.push(`/${locale}/dashboard/profile`)}
        onStopSimulation={handleStopSimulation}
      />
    )
  }

  return (
    <div className="min-h-screen app-page-bg">
      <div className="container mx-auto px-0 sm:px-4 py-0 sm:py-6">
        <CustomerReservationListHeader
          filter={filter}
          onFilterChange={setFilter}
          onBack={() => router.back()}
          isSimulating={isSimulating}
          simulatedUserName={simulatedUser?.name_ko}
          onGoDashboard={() => router.push(`/${locale}/dashboard`)}
          onGoProfile={() => router.push(`/${locale}/dashboard/profile`)}
          onStopSimulation={handleStopSimulation}
        />

        <div className="space-y-1 sm:space-y-6">
          {filteredReservations.length > 0 ? (
            filteredReservations.map((reservation) => (
              <CustomerReservationCard
                key={reservation.id}
                reservation={reservation}
                customer={customer}
                channels={channels}
                details={reservationDetails[reservation.id] ?? null}
                onPrint={() => handlePrint(reservation)}
                onSelectMedia={setSelectedMedia}
              />
            ))
          ) : (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
              <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">{t('noReservations')}</h3>
              <p className="text-gray-500 mb-6">
                {filter === 'all'
                  ? t('noToursReserved')
                  : t('noReservationsForStatus', { status: getStatusText(filter) })}
              </p>
              <button
                type="button"
                onClick={() => router.push(`/${locale}/products`)}
                className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90"
              >
                {t('viewTourProducts')}
              </button>
            </div>
          )}
        </div>
      </div>

      <CustomerReservationMediaModal
        mediaUrl={selectedMedia}
        onClose={() => setSelectedMedia(null)}
      />
    </div>
  )
}
