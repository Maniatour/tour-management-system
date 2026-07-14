'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import { Calendar, Users, MapPin, Clock, CreditCard, CheckCircle, AlertCircle, Search, ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import CustomerPageZone from '@/components/product/CustomerPageZone'
import CustomerPagePreviewHighlightEffect from '@/components/product/CustomerPagePreviewHighlightEffect'
import { useCustomerPageEditMode } from '@/components/product/CustomerPageEditModeProvider'
import CustomerPageZoneLayoutRenderer from '@/components/product/CustomerPageZoneLayoutRenderer'
import CustomerPageShell from '@/components/customer/CustomerPageShell'

interface Reservation {
  id: string
  customer_name: string
  customer_email: string
  customer_phone: string
  tour_date: string
  departure_time: string | null
  adults: number
  children: number
  infants: number
  total_price: number
  special_requests: string | null
  nationality: string | null
  status: string
  created_at: string
  product: {
    id: string
    name: string
    name_ko: string | null
    customer_name_ko: string
    base_price: number
    duration: string | null
    max_participants: number | null
    departure_city: string | null
    arrival_city: string | null
    departure_country: string | null
    arrival_country: string | null
  }
  reservation_options: Array<{
    choice_id: string
    option_id: string
    choice: {
      choice_name: string
      choice_name_ko: string | null
      choice_type: string
    }
    option: {
      option_name: string
      option_name_ko: string | null
      option_price: number | null
    }
  }>
  payment_records: Array<{
    id: string
    payment_status: string
    amount: number
    payment_method: string
    submit_on: string
    confirmed_on: string | null
  }>
  can_self_cancel?: boolean
  has_stripe_payment?: boolean
}

export default function ReservationCheckPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-500">…</div>}>
      <ReservationCheckPageInner />
    </Suspense>
  )
}

function ReservationCheckPageInner() {
  const t = useTranslations('reservationCheck')
  const locale = useLocale()
  const searchParams = useSearchParams()
  const dateLocale = locale === 'en' ? 'en-US' : 'ko-KR'
  const { isPreview, isEditMode } = useCustomerPageEditMode()
  const contentEditMode = isPreview && isEditMode

  const [reservationId, setReservationId] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [reservation, setReservation] = useState<Reservation | null>(null)
  const [loading, setLoading] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [paymentMethodMap, setPaymentMethodMap] = useState<Record<string, string>>({})

  useEffect(() => {
    const loadPaymentMethods = async () => {
      try {
        const { data, error } = await supabase.from('payment_methods').select('id, method')
        if (error) throw error

        const methodMap: Record<string, string> = {}
        data?.forEach((pm) => {
          methodMap[pm.id] = pm.method
          methodMap[pm.method] = pm.method
        })
        setPaymentMethodMap(methodMap)
      } catch (err) {
        console.error('Failed to load payment methods:', err)
      }
    }

    loadPaymentMethods()
  }, [])

  const handleSearch = useCallback(async (idOverride?: string, emailOverride?: string) => {
    const id = (idOverride ?? reservationId).trim()
    const email = (emailOverride ?? customerEmail).trim()
    if (!id || !email) {
      setError(t('missingFields'))
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/reservations/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reservation_id: id,
          customer_email: email,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || t('notFound'))
      }

      setReservation(data.reservation)
    } catch (err) {
      console.error('Reservation check error:', err)
      setError(err instanceof Error ? err.message : t('searchError'))
    } finally {
      setLoading(false)
    }
  }, [reservationId, customerEmail, t])

  useEffect(() => {
    const id = searchParams.get('id') || searchParams.get('reservationId') || ''
    const email = searchParams.get('email') || ''
    if (id) setReservationId(id)
    if (email) setCustomerEmail(email)
    if (id && email) {
      void handleSearch(id, email)
    }
    // URL 프리필은 최초 1회
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCancel = async () => {
    if (!reservation) return
    if (!confirm(t('cancelConfirm'))) return

    setCancelling(true)
    setError(null)
    try {
      const response = await fetch('/api/booking/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reservationId: reservation.id,
          email: customerEmail || reservation.customer_email,
          confirm: true,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || t('cancelError'))
      }

      if (data.refunded && data.refundAmountUsd != null) {
        alert(t('cancelRefundSuccess', { amount: Number(data.refundAmountUsd).toFixed(2) }))
      } else {
        alert(t('cancelSuccess'))
      }
      await handleSearch(reservation.id, customerEmail || reservation.customer_email)
    } catch (err) {
      console.error('Cancel error:', err)
      setError(err instanceof Error ? err.message : t('cancelError'))
    } finally {
      setCancelling(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800'
      case 'inquiry':
        return 'bg-sky-100 text-sky-900'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      case 'completed':
        return 'bg-primary/10 text-primary'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'confirmed':
        return t('statusConfirmed')
      case 'inquiry':
        return t('statusInquiry')
      case 'pending':
        return t('statusPending')
      case 'cancelled':
        return t('statusCancelled')
      case 'completed':
        return t('statusCompleted')
      default:
        return status
    }
  }

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'rejected':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getPaymentStatusLabel = (status: string) => {
    switch (status) {
      case 'confirmed':
        return t('paymentConfirmed')
      case 'pending':
        return t('paymentPending')
      case 'rejected':
        return t('paymentRejected')
      default:
        return status
    }
  }

  const formatPaymentMethod = (method: string) => {
    if (paymentMethodMap[method]) return paymentMethodMap[method]
    if (method === 'card') return t('paymentCard')
    if (method === 'bank_transfer') return t('paymentBank')
    if (method === 'cash') return t('paymentCash')
    return method
  }

  const formatParticipants = (r: Reservation) => {
    const parts = [t('adults', { count: r.adults })]
    if (r.children > 0) parts.push(t('children', { count: r.children }))
    if (r.infants > 0) parts.push(t('infants', { count: r.infants }))
    return parts.join(', ')
  }

  return (
    <CustomerPageShell locale={locale}>
      <div className={`min-h-screen bg-muted/30 ${contentEditMode ? 'pb-20' : ''}`}>
        <CustomerPagePreviewHighlightEffect />
      <CustomerPageZoneLayoutRenderer
        pageId="reservation-check"
        layoutEditMode={false}
        renderBlock={(zoneId) => {
          if (zoneId === 'reservation-check-header') {
            return (
              <CustomerPageZone zone="reservation-check-header" className="shadow-sm border-b cp-ui-panel-surface">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                  <div className="flex items-center space-x-4">
                    <Link href={`/${locale}`} className="cp-ui-muted hover:opacity-80">
                      <ArrowLeft size={24} />
                    </Link>
                    <div>
                      <h1 className="text-2xl font-bold">{t('title')}</h1>
                      <p className="cp-ui-muted">{t('subtitle')}</p>
                    </div>
                  </div>
                </div>
              </CustomerPageZone>
            )
          }

          if (zoneId === 'reservation-check-form') {
            return (
              <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <CustomerPageZone zone="reservation-check-form" className="cp-ui-panel-surface rounded-card border border-border/60 p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">{t('formTitle')}</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium cp-ui-muted mb-1">
                {t('reservationIdLabel')}
              </label>
              <input
                type="text"
                value={reservationId}
                onChange={(e) => setReservationId(e.target.value)}
                placeholder={t('reservationIdPlaceholder')}
                className="w-full rounded-lg border border-input px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm font-medium cp-ui-muted mb-1">{t('emailLabel')}</label>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder={t('emailPlaceholder')}
                className="w-full rounded-lg border border-input px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-ring"
              />
            </div>
            <button
              onClick={() => void handleSearch()}
              disabled={loading}
              className="cp-ui-btn-primary w-full py-3 px-4 rounded-lg transition-colors font-medium flex items-center justify-center disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  {t('searching')}
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  {t('searchButton')}
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                <span className="text-red-700">{error}</span>
              </div>
            </div>
          )}
        </CustomerPageZone>

        {reservation && (
          <div className="overflow-hidden rounded-card border border-border/60 bg-card">
            <div className="border-b border-border/60 bg-primary px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-primary-foreground">{reservation.product.customer_name_ko}</h2>
                  <p className="text-primary-foreground/80">
                    {t('reservationId')}: {reservation.id}
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${getStatusColor(reservation.status)}`}
                  >
                    {getStatusLabel(reservation.status)}
                  </span>
                  <div className="mt-1 text-lg font-semibold text-primary-foreground">${reservation.total_price}</div>
                </div>
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('tourInfo')}</h3>
                  <div className="space-y-3">
                    <div className="flex items-center">
                      <Calendar className="mr-3 h-5 w-5 text-booking" />
                      <div>
                        <span className="text-sm text-gray-600">{t('tourDate')}</span>
                        <p className="font-medium">{reservation.tour_date}</p>
                      </div>
                    </div>
                    {reservation.departure_time && (
                      <div className="flex items-center">
                        <Clock className="h-5 w-5 text-green-500 mr-3" />
                        <div>
                          <span className="text-sm text-gray-600">{t('departureTime')}</span>
                          <p className="font-medium">{reservation.departure_time}</p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center">
                      <Users className="h-5 w-5 text-purple-500 mr-3" />
                      <div>
                        <span className="text-sm text-gray-600">{t('participants')}</span>
                        <p className="font-medium">{formatParticipants(reservation)}</p>
                      </div>
                    </div>
                    {(reservation.product.departure_city || reservation.product.arrival_city) && (
                      <div className="flex items-center">
                        <MapPin className="h-5 w-5 text-red-500 mr-3" />
                        <div>
                          <span className="text-sm text-gray-600">{t('route')}</span>
                          <p className="font-medium">
                            {reservation.product.departure_city && reservation.product.arrival_city
                              ? `${reservation.product.departure_city} → ${reservation.product.arrival_city}`
                              : reservation.product.departure_city || reservation.product.arrival_city}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('customerInfo')}</h3>
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm text-gray-600">{t('name')}</span>
                      <p className="font-medium">{reservation.customer_name}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">{t('email')}</span>
                      <p className="font-medium">{reservation.customer_email}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">{t('phone')}</span>
                      <p className="font-medium">{reservation.customer_phone}</p>
                    </div>
                    {reservation.nationality && (
                      <div>
                        <span className="text-sm text-gray-600">{t('nationality')}</span>
                        <p className="font-medium">{reservation.nationality}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {reservation.reservation_options?.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('selectedOptions')}</h3>
                  <div className="space-y-3">
                    {reservation.reservation_options.map((option, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div>
                          <span className="font-medium text-gray-900">
                            {option.choice.choice_name_ko || option.choice.choice_name}
                          </span>
                          <p className="text-sm text-gray-600">
                            {option.option.option_name_ko || option.option.option_name}
                          </p>
                        </div>
                        {option.option.option_price && (
                          <span className="font-semibold text-booking">+${option.option.option_price}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {reservation.payment_records?.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('paymentInfo')}</h3>
                  <div className="space-y-3">
                    {reservation.payment_records.map((payment, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center">
                          <CreditCard className="h-5 w-5 text-gray-500 mr-3" />
                          <div>
                            <span className="font-medium text-gray-900">
                              {formatPaymentMethod(payment.payment_method)}
                            </span>
                            <p className="text-sm text-gray-600">
                              {new Date(payment.submit_on).toLocaleDateString(dateLocale)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-semibold text-gray-900">${payment.amount}</span>
                          <span
                            className={`ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getPaymentStatusColor(payment.payment_status)}`}
                          >
                            {getPaymentStatusLabel(payment.payment_status)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {reservation.special_requests && (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('specialRequests')}</h3>
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-gray-700 whitespace-pre-wrap">{reservation.special_requests}</p>
                  </div>
                </div>
              )}

              {reservation.can_self_cancel ? (
                <div className="mb-8 rounded-xl border border-border/60 bg-muted/40 p-4">
                  <p className="text-sm text-muted-foreground">{t('unpaidCancelNote')}</p>
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                    <button
                      type="button"
                      onClick={() => void handleCancel()}
                      disabled={cancelling}
                      className="inline-flex h-11 items-center justify-center rounded-xl border border-red-200 bg-red-50 px-5 text-sm font-semibold text-red-800 transition hover:bg-red-100 disabled:opacity-50"
                    >
                      {cancelling ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {t('cancelling')}
                        </>
                      ) : (
                        t('cancelButton')
                      )}
                    </button>
                    <Link
                      href={`/${locale}/cancellation-refund-policy`}
                      className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                    >
                      {t('policyLink')}
                    </Link>
                  </div>
                </div>
              ) : reservation.has_stripe_payment &&
                ['confirmed', 'pending', 'inquiry'].includes(
                  (reservation.status || '').toLowerCase()
                ) ? (
                <div className="mb-8 rounded-xl border border-border/60 bg-muted/40 p-4">
                  <p className="text-sm text-muted-foreground">{t('paidCancelContactNote')}</p>
                  <div className="mt-3">
                    <Link
                      href={`/${locale}/cancellation-refund-policy`}
                      className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                    >
                      {t('policyLink')}
                    </Link>
                  </div>
                </div>
              ) : null}

              <div className="border-t pt-6">
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>
                    {t('createdAt')}: {new Date(reservation.created_at).toLocaleDateString(dateLocale)}
                  </span>
                  <div className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
                    <span>{t('verified')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
              </div>
            )
          }

          return null
        }}
      />
      </div>
    </CustomerPageShell>
  )
}
