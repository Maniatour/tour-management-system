'use client'

import { Suspense, useMemo } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { CheckCircle2, XCircle, CalendarCheck, Search, Home, MessageCircle } from 'lucide-react'
import CustomerPageShell from '@/components/customer/CustomerPageShell'

export default function BookingConfirmationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">…</div>
      }
    >
      <BookingConfirmationInner />
    </Suspense>
  )
}

function BookingConfirmationInner() {
  const t = useTranslations('bookingConfirmation')
  const locale = useLocale()
  const searchParams = useSearchParams()

  const status = (searchParams.get('status') || 'success').toLowerCase()
  const reservationId = searchParams.get('id') || searchParams.get('reservationId') || ''
  const email = searchParams.get('email') || ''
  const isSuccess = status !== 'failed' && status !== 'error'

  const checkHref = useMemo(() => {
    const params = new URLSearchParams()
    if (reservationId) params.set('id', reservationId)
    if (email) params.set('email', email)
    const q = params.toString()
    return `/${locale}/reservation-check${q ? `?${q}` : ''}`
  }, [locale, reservationId, email])

  return (
    <CustomerPageShell locale={locale}>
      <div className="min-h-[70vh] bg-muted/30 py-16 md:py-24">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-border/60 bg-card p-8 shadow-sm md:p-10">
            <div className="flex flex-col items-center text-center">
              {isSuccess ? (
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <CheckCircle2 className="h-9 w-9" aria-hidden />
                </div>
              ) : (
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-600">
                  <XCircle className="h-9 w-9" aria-hidden />
                </div>
              )}

              <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
                {isSuccess ? t('successTitle') : t('failedTitle')}
              </h1>
              <p className="mt-3 max-w-md text-base leading-7 text-muted-foreground md:text-lg">
                {isSuccess ? t('successBody') : t('failedBody')}
              </p>

              {reservationId ? (
                <div className="mt-8 w-full rounded-xl border border-border/60 bg-muted/40 px-5 py-4 text-left">
                  <div className="flex items-start gap-3">
                    <CalendarCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t('reservationIdLabel')}</p>
                      <p className="mt-1 text-lg font-semibold tracking-tight text-foreground">
                        {reservationId}
                      </p>
                      {email ? (
                        <p className="mt-2 text-sm text-muted-foreground">
                          {t('emailSentHint', { email })}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
                {isSuccess && reservationId ? (
                  <Link
                    href={checkHref}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-base font-semibold text-primary-foreground transition hover:bg-primary/90"
                  >
                    <Search className="h-5 w-5" aria-hidden />
                    {t('viewReservation')}
                  </Link>
                ) : null}
                <Link
                  href={`/${locale}`}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-background px-6 text-base font-semibold text-foreground transition hover:bg-muted/50"
                >
                  <Home className="h-5 w-5" aria-hidden />
                  {t('backHome')}
                </Link>
              </div>

              <p className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
                <MessageCircle className="h-4 w-4" aria-hidden />
                {t('supportHint')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </CustomerPageShell>
  )
}
