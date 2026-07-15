import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, AlertCircle, CreditCard } from 'lucide-react'
import { supabaseAdmin } from '@/lib/supabase'
import CustomerPageShell from '@/components/customer/CustomerPageShell'

type PageProps = {
  params: Promise<{ locale: string; token: string }>
}

export default async function PayInvoicePage({ params }: PageProps) {
  const { locale: rawLocale, token } = await params
  const locale = rawLocale === 'en' ? 'en' : 'ko'
  const isKo = locale === 'ko'

  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) {
    return (
      <CustomerPageShell locale={locale}>
        <PayState
          locale={locale}
          kind="error"
          title={isKo ? '잘못된 결제 링크' : 'Invalid payment link'}
          body={isKo ? '링크가 올바르지 않습니다. 고객센터로 문의해 주세요.' : 'This payment link is invalid. Please contact support.'}
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
          title={isKo ? '일시적 오류' : 'Temporary error'}
          body={isKo ? '결제 서비스를 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.' : 'Payment service is unavailable. Please try again shortly.'}
        />
      </CustomerPageShell>
    )
  }

  const { data: invoice } = await supabaseAdmin
    .from('invoices')
    .select('id, status, hosted_invoice_url, stripe_invoice_status, invoice_number, total')
    .eq('payment_token', token)
    .maybeSingle()

  if (!invoice) {
    return (
      <CustomerPageShell locale={locale}>
        <PayState
          locale={locale}
          kind="error"
          title={isKo ? '인보이스를 찾을 수 없습니다' : 'Invoice not found'}
          body={isKo ? '만료되었거나 잘못된 링크일 수 있습니다.' : 'This link may be expired or incorrect.'}
        />
      </CustomerPageShell>
    )
  }

  if (invoice.status === 'paid' || invoice.stripe_invoice_status === 'paid') {
    return (
      <CustomerPageShell locale={locale}>
        <PayState
          locale={locale}
          kind="success"
          title={isKo ? '이미 결제 완료' : 'Already paid'}
          body={
            isKo
              ? `인보이스 ${invoice.invoice_number} 은(는) 이미 결제되었습니다. 감사합니다.`
              : `Invoice ${invoice.invoice_number} has already been paid. Thank you.`
          }
        />
      </CustomerPageShell>
    )
  }

  if (invoice.status === 'cancelled') {
    return (
      <CustomerPageShell locale={locale}>
        <PayState
          locale={locale}
          kind="error"
          title={isKo ? '취소된 인보이스' : 'Invoice cancelled'}
          body={isKo ? '이 인보이스는 취소되어 결제할 수 없습니다.' : 'This invoice was cancelled and cannot be paid.'}
        />
      </CustomerPageShell>
    )
  }

  if (invoice.hosted_invoice_url) {
    redirect(invoice.hosted_invoice_url)
  }

  return (
    <CustomerPageShell locale={locale}>
      <PayState
        locale={locale}
        kind="pending"
        title={isKo ? '결제 링크 준비 중' : 'Payment link not ready'}
        body={
          isKo
            ? '아직 결제 페이지가 연결되지 않았습니다. 발송 메일의 안내를 확인하거나 고객센터로 문의해 주세요.'
            : 'The payment page is not ready yet. Please check your invoice email or contact support.'
        }
        invoiceNumber={invoice.invoice_number}
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
}: {
  locale: string
  kind: 'success' | 'error' | 'pending'
  title: string
  body: string
  invoiceNumber?: string
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
              {locale === 'ko' ? '인보이스 번호' : 'Invoice #'}: {invoiceNumber}
            </p>
          ) : null}
          <Link
            href={homeHref}
            className="mt-8 inline-flex h-11 items-center justify-center rounded-xl bg-primary px-6 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
          >
            {locale === 'ko' ? '홈으로' : 'Back to home'}
          </Link>
        </div>
      </div>
    </div>
  )
}
