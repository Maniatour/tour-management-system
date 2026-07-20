'use client'

import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { Facebook, Instagram, Mail, MapPin, Phone, Youtube } from 'lucide-react'
import { buildLegalPageHref, LEGAL_PAGE_SLUGS } from '@/lib/customerSiteRoutes'
import { LEGAL_LABEL_KEYS } from '@/lib/legalPageLabels'
import CustomerSiteLogo from '@/components/customer/CustomerSiteLogo'
import { getPublicInstagramProfileUrl } from '@/lib/instagramPublic'
import { DEFAULT_ROUTING_LOCALE, isSiteLocale } from '@/lib/siteLocales'

type Props = {
  locale: string
}

export default function CustomerSiteManiaTourFooter({ locale: localeProp }: Props) {
  const intlLocale = useLocale()
  const locale = isSiteLocale(localeProp)
    ? localeProp
    : isSiteLocale(intlLocale)
      ? intlLocale
      : DEFAULT_ROUTING_LOCALE
  const t = useTranslations('customerSiteFooter')
  const tCommon = useTranslations('common')
  const year = new Date().getFullYear()
  // Avoid ICU format when provider locale is invalid (e.g. literal "undefined").
  const copyrightText = isSiteLocale(intlLocale)
    ? t('copyright', { year })
    : String(t.raw('copyright')).replace(/\{year\}/g, String(year))

  const tourLinks = [
    { href: `/${locale}/products?tag=${encodeURIComponent('그랜드캐년')}`, label: t('footerGrandCanyon') },
    { href: `/${locale}/products?tag=${encodeURIComponent('앤텔롭')}`, label: t('footerAntelope') },
    { href: `/${locale}/products?tag=${encodeURIComponent('당일')}`, label: t('footerDayTours') },
    { href: `/${locale}/products?tag=${encodeURIComponent('일출')}`, label: t('footerSunrise') },
  ]

  const destinationLinks = [
    { href: `/${locale}/products?tag=${encodeURIComponent('시티')}`, label: tCommon('destLasVegas') },
    { href: `/${locale}/products?tag=${encodeURIComponent('그랜드캐년')}`, label: tCommon('destGrandCanyon') },
    { href: `/${locale}/products?tag=${encodeURIComponent('앤텔롭')}`, label: tCommon('destAntelopeCanyon') },
    { href: `/${locale}/products?tag=${encodeURIComponent('근교')}`, label: tCommon('destZion') },
  ]

  const companyLinks = LEGAL_PAGE_SLUGS.slice(0, 4).map((slug) => ({
    href: buildLegalPageHref(locale, slug),
    label: t(LEGAL_LABEL_KEYS[slug]),
  }))
  const instagramUrl = getPublicInstagramProfileUrl()

  return (
    <footer className="kv-footer">
      <div className="kv-container kv-footer-main">
        <div className="kv-footer-brand">
          <CustomerSiteLogo
            brandName={t('brandName')}
            href={`/${locale}`}
            className="kv-footer-logo"
            variant="footer"
          />
          <p className="kv-footer-desc">{t('brandDescription')}</p>
          <div className="kv-footer-social">
            <a href={instagramUrl} target="_blank" rel="noopener noreferrer" aria-label="Instagram">
              <Instagram className="h-5 w-5" />
            </a>
            <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
              <Facebook className="h-5 w-5" />
            </a>
            <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" aria-label="YouTube">
              <Youtube className="h-5 w-5" />
            </a>
          </div>
          <div className="kv-footer-newsletter">
            <h3 className="kv-footer-heading">{t('footerNewsletterHeading')}</h3>
            <p className="kv-footer-newsletter-desc">{t('footerNewsletterDesc')}</p>
            <form className="kv-footer-newsletter-form" onSubmit={(e) => e.preventDefault()}>
              <input type="email" placeholder={t('footerNewsletterPlaceholder')} aria-label={t('footerNewsletterPlaceholder')} />
              <button type="submit">{t('footerNewsletterButton')}</button>
            </form>
          </div>
        </div>

        <div className="kv-footer-col">
          <h3 className="kv-footer-heading">{t('footerToursHeading')}</h3>
          <ul className="kv-footer-links">
            {tourLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href}>{link.label}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="kv-footer-col">
          <h3 className="kv-footer-heading">{t('footerDestinationsHeading')}</h3>
          <ul className="kv-footer-links">
            {destinationLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href}>{link.label}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="kv-footer-col">
          <h3 className="kv-footer-heading">{t('footerCompanyHeading')}</h3>
          <ul className="kv-footer-links">
            {companyLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href}>{link.label}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="kv-footer-col">
          <h3 className="kv-footer-heading">{t('footerContactHeading')}</h3>
          <ul className="kv-footer-contact">
            <li>
              <Phone className="h-4 w-4 shrink-0" aria-hidden />
              <a href={`tel:${t('phoneEnValue')}`}>
                {t('phoneEnDisplay')} ({t('phoneEnBadge')})
              </a>
            </li>
            <li>
              <Phone className="h-4 w-4 shrink-0" aria-hidden />
              <a href={`tel:${t('phoneKrValue')}`}>
                {t('phoneKrDisplay')} ({t('phoneKrBadge')})
              </a>
            </li>
            <li>
              <Mail className="h-4 w-4 shrink-0" aria-hidden />
              <a href={`mailto:${t('emailValue')}`}>{t('emailDisplay')}</a>
            </li>
            <li>
              <MapPin className="h-4 w-4 shrink-0" aria-hidden />
              <span>{t('address')}</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="kv-footer-bottom">
        <div className="kv-container kv-footer-bottom-inner">
          <p>{copyrightText}</p>
          <div className="kv-footer-legal">
            <Link href={buildLegalPageHref(locale, 'terms')}>{t('terms')}</Link>
            <Link href={buildLegalPageHref(locale, 'privacy-policy')}>{t('privacyPolicy')}</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
