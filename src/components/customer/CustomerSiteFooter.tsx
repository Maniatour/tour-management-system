'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Mail, MapPin, Phone, ShieldCheck } from 'lucide-react'
import {
  LEGAL_PAGE_SLUGS,
  buildLegalPageHref,
  isCustomerFacingPath,
} from '@/lib/customerSiteRoutes'
import { LEGAL_LABEL_KEYS } from '@/lib/legalPageLabels'
import CustomerSiteLogo from '@/components/customer/CustomerSiteLogo'

type CustomerSiteFooterProps = {
  locale: string
  /** 레이아웃 등 pathname 판별 없이 항상 표시 */
  forceShow?: boolean
}

export default function CustomerSiteFooter({ locale, forceShow = false }: CustomerSiteFooterProps) {
  const pathname = usePathname()
  const t = useTranslations('customerSiteFooter')

  if (!forceShow && !isCustomerFacingPath(pathname)) {
    return null
  }

  return (
    <footer className="border-t border-slate-200 bg-slate-950 text-slate-300 pb-[calc(var(--footer-height)+env(safe-area-inset-bottom,0px))] lg:pb-0">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <CustomerSiteLogo
              brandName={t('brandName')}
              href={`/${locale}`}
              className="inline-flex items-center gap-2"
              variant="dark"
            />
            <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-400">
              {t('brandDescription')}
            </p>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300">
              <ShieldCheck className="h-4 w-4 text-[#FFB800]" aria-hidden />
              {t('trustBadge')}
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-white">
              {t('explore')}
            </h2>
            <ul className="mt-4 space-y-3 text-sm">
              <li>
                <Link href={`/${locale}`} className="transition-colors hover:text-white">
                  {t('home')}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/products`} className="transition-colors hover:text-white">
                  {t('tours')}
                </Link>
              </li>
              <li>
                <Link
                  href={`/${locale}/reservation-check`}
                  className="transition-colors hover:text-white"
                >
                  {t('reservationCheck')}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-white">
              {t('legal')}
            </h2>
            <ul className="mt-4 space-y-3 text-sm">
              {LEGAL_PAGE_SLUGS.map((slug) => (
                <li key={slug}>
                  <Link
                    href={buildLegalPageHref(locale, slug)}
                    className="transition-colors hover:text-white"
                  >
                    {t(LEGAL_LABEL_KEYS[slug])}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 grid gap-4 border-t border-slate-800 pt-8 text-sm text-slate-400 sm:grid-cols-3">
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-booking" aria-hidden />
            <span>{t('address')}</span>
          </div>
          <div className="flex items-start gap-3">
            <Phone className="mt-0.5 h-4 w-4 shrink-0 text-booking" aria-hidden />
            <a href={`tel:${t('phoneValue')}`} className="transition-colors hover:text-white">
              {t('phoneDisplay')}
            </a>
          </div>
          <div className="flex items-start gap-3">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-booking" aria-hidden />
            <a href={`mailto:${t('emailValue')}`} className="transition-colors hover:text-white">
              {t('emailDisplay')}
            </a>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 border-t border-slate-800 pt-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>{t('copyright', { year: new Date().getFullYear() })}</p>
          <p>{t('disclaimer')}</p>
        </div>
      </div>
    </footer>
  )
}
