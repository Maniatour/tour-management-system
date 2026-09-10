import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { AlertCircle, CheckCircle2, CreditCard } from 'lucide-react'
import { supabaseAdmin } from '@/lib/supabase'
import { getStripeClient } from '@/lib/customerBookingCheckout'
import {
  isTipOpenAmountInvoiceItems,
  markInvoicePaidFromCheckoutSession,
} from '@/lib/payableInvoice'
import CustomerPageShell from '@/components/customer/CustomerPageShell'
import InvoicePayWithTipForm from '@/components/customer/InvoicePayWithTipForm'
import { normalizeSiteLocale } from '@/lib/siteLocales'

type PageProps = {
  params: Promise<{ locale: string; token: string }>
  searchParams: Promise<{ paid?: string; canceled?: string; session_id?: string }>
}

function descriptionFromItems(items: unknown): string {
  if (!Array.isArray(items) || items.length === 0) return ''
  const first = items[0] as { description?: string | null; productName?: string | null }
  return (first.description || first.productName || '').trim()
}

export default async function PayInvoicePage({ params, searchParams }: PageProps) {
  const { locale: rawLocale, token } = await params
  const query = await searchParams
  const locale = normalizeSiteLocale(rawLocale, 'en')
  const t = await getTranslations({ locale, namespace: 'invoicePay' })
  const canceled = query.canceled === '1'
  const sessionId = typeof query.session_id === 'string' ? query.session_id.trim() : ''

  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) {
    return (
      <CustomerPageShell locale={locale}>
        <PayState
          locale={locale}
          kind="error"
          title={t('invalidLinkTitle')}
          body={t('invalidLinkBody')}
          backHomeLabel={t('backHome')}
        />
      </CustomerPageShell>
    )
  }

  if (!supabaseAdmin) {
    return (
      <CustomerPageShell locale={locale}>
        <PayState
          locale={locale}
          kind="error"
          title={t('tempErrorTitle')}
          body={t('tempErrorBody')}
          backHomeLabel={t('backHome')}
        />
      </CustomerPageShell>
    )
  }

  const { data: invoice } = await supabaseAdmin
    .from('invoices')
    .select('id, status, hosted_invoice_url, stripe_invoice_status, invoice_number, total, items')
    .eq('payment_token', token)
    .maybeSingle()

  if (!invoice) {
    return (
      <CustomerPageShell locale={locale}>
        <PayState
          locale={locale}
          kind="error"
          title={t('notFoundTitle')}
          body={t('notFoundBody')}
          backHomeLabel={t('backHome')}
        />
      </CustomerPageShell>
    )
  }

  if (sessionId.startsWith('cs_')) {
    try {
      const stripe = getStripeClient()
      const session = await stripe.checkout.sessions.retrieve(sessionId)
      if (session.metadata?.invoice_id === invoice.id) {
        await markInvoicePaidFromCheckoutSession(supabaseAdmin, session)
      }
    } catch (err) {
      console.warn('[pay/invoice] checkout session finalize', err)
    }
  }

  const { data: latestInvoice } = sessionId.startsWith('cs_')
    ? await supabaseAdmin
        .from('invoices')
        .select('id, status, hosted_invoice_url, stripe_invoice_status, invoice_number, total, items')
        .eq('id', invoice.id)
        .maybeSingle()
    : { data: invoice }

  const current = latestInvoice || invoice

  if (current.status === 'paid' || current.stripe_invoice_status === 'paid') {
    return (
      <CustomerPageShell locale={locale}>
        <PayState
          locale={locale}
          kind="success"
          title={t('paidTitle')}
          body={t('paidBody', { number: current.invoice_number })}
          backHomeLabel={t('backHome')}
        />
      </CustomerPageShell>
    )
  }

  if (current.status === 'cancelled') {
    return (
      <CustomerPageShell locale={locale}>
        <PayState
          locale={locale}
          kind="error"
          title={t('cancelledTitle')}
          body={t('cancelledBody')}
          backHomeLabel={t('backHome')}
        />
      </CustomerPageShell>
    )
  }

  const isOpenAmount = isTipOpenAmountInvoiceItems(current.items)
  const amountDueUsd = Math.round((Number(current.total) || 0) * 100) / 100

  if (!isOpenAmount && amountDueUsd <= 0 && !current.hosted_invoice_url) {
    return (
      <CustomerPageShell locale={locale}>
        <PayState
          locale={locale}
          kind="pending"
          title={t('pendingTitle')}
          body={t('pendingBody')}
          invoiceNumber={current.invoice_number}
          invoiceNumberLabel={t('invoiceNumberLabel')}
          backHomeLabel={t('backHome')}
        />
      </CustomerPageShell>
    )
  }

  return (
    <CustomerPageShell locale={locale}>
      <InvoicePayWithTipForm
        locale={locale}
        token={token}
        invoiceNumber={current.invoice_number}
        description={descriptionFromItems(current.items)}
        amountDueUsd={amountDueUsd}
        isOpenAmount={isOpenAmount}
        canceled={canceled}
      />
    </CustomerPageShell>
  )
}

function PayState({
  locale,
  kind,
  title,
  body,
  invoiceNumber,
  invoiceNumberLabel,
  backHomeLabel,
}: {
  locale: string
  kind: 'success' | 'error' | 'pending'
  title: string
  body: string
  invoiceNumber?: string
  invoiceNumberLabel?: string
  backHomeLabel: string
}) {
  const homeHref = `/${locale}`
  return (
    <div className="min-h-[70vh] bg-muted/30 py-16 md:py-24">
      <div className="mx-auto max-w-lg px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-border/60 bg-card p-8 text-center shadow-sm md:p-10">
          <div
            className={
              kind === 'success'
                ? 'mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600'
                : kind === 'pending'
                  ? 'mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600'
                  : 'mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600'
            }
          >
            {kind === 'success' ? (
              <CheckCircle2 className="h-8 w-8" aria-hidden />
            ) : kind === 'pending' ? (
              <CreditCard className="h-8 w-8" aria-hidden />
            ) : (
              <AlertCircle className="h-8 w-8" aria-hidden />
            )}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">{title}</h1>
          <p className="mt-3 text-base leading-7 text-muted-foreground">{body}</p>
          {invoiceNumber ? (
            <p className="mt-4 text-sm text-muted-foreground">
              {invoiceNumberLabel}: {invoiceNumber}
            </p>
          ) : null}
          <Link
            href={homeHref}
            className="mt-8 inline-flex h-11 items-center justify-center rounded-xl bg-primary px-6 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
          >
            {backHomeLabel}
          </Link>
        </div>
      </div>
    </div>
  )
}
