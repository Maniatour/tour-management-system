'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Globe, Heart, Menu, ShoppingCart, User, X } from 'lucide-react'
import ReactCountryFlag from 'react-country-flag'
import { useLocale, useTranslations } from 'next-intl'
import { useContext, useState, type ReactNode } from 'react'
import { CartSidebar, useCart } from '@/components/cart/CartProvider'
import { AuthContext } from '@/contexts/AuthContext'
import CustomerSiteLogo from '@/components/customer/CustomerSiteLogo'

type CustomerSiteHeaderProps = {
  brandName: string
}

function UtilityIconButton({
  href,
  onClick,
  icon,
  label,
  light,
}: {
  href?: string
  onClick?: () => void
  icon: ReactNode
  label: string
  light?: boolean
}) {
  const className = `kv-header-icon-btn ${light ? 'kv-header-icon-btn--light' : ''}`

  if (href) {
    return (
      <Link href={href} className={className} aria-label={label}>
        {icon}
      </Link>
    )
  }

  return (
    <button type="button" onClick={onClick} className={className} aria-label={label}>
      {icon}
    </button>
  )
}

function HeaderCartButton({ onClick, label, light }: { onClick: () => void; label: string; light?: boolean }) {
  const { totalItems } = useCart()

  return (
    <button
      type="button"
      onClick={onClick}
      className={`kv-header-icon-btn relative ${light ? 'kv-header-icon-btn--light' : ''}`}
      aria-label={label}
    >
      <ShoppingCart className="h-5 w-5" strokeWidth={1.75} aria-hidden />
      {totalItems > 0 ? (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ff7e33] px-1 text-[10px] font-bold text-white">
          {totalItems}
        </span>
      ) : null}
    </button>
  )
}

function HeaderLocaleButton({
  locale,
  onSwitch,
  className = 'kv-header-locale',
  label,
}: {
  locale: string
  onSwitch: () => void
  className?: string
  label: string
}) {
  const countryCode = locale === 'ko' ? 'KR' : 'US'
  const displayLabel = locale === 'ko' ? 'KRW' : 'USD'

  return (
    <button type="button" onClick={onSwitch} className={className} aria-label={label}>
      <ReactCountryFlag countryCode={countryCode} svg aria-hidden className="kv-header-flag-icon" />
      <span>{displayLabel}</span>
    </button>
  )
}

export default function CustomerSiteHeader({ brandName }: CustomerSiteHeaderProps) {
  const t = useTranslations('common')
  const locale = useLocale()
  const pathname = usePathname()
  const router = useRouter()
  const context = useContext(AuthContext)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [showCart, setShowCart] = useState(false)

  const loading = context?.loading ?? true
  const currentUser = context?.authUser ?? null

  const isHome = pathname === `/${locale}` || pathname === `/${locale}/`

  const switchLocale = () => {
    const newLocale = locale === 'ko' ? 'en' : 'ko'
    const pathWithoutLocale = pathname.replace(new RegExp(`^/${locale}(?=/|$)`), '') || '/'
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000; SameSite=Lax`
    router.push(`/${newLocale}${pathWithoutLocale}`)
  }

  const navLinks = isHome
    ? [
        { href: `/${locale}/products`, label: t('navTours') },
        { href: `/${locale}/products/tags`, label: t('navDestinations') },
        { href: `/${locale}/products?tag=${encodeURIComponent('당일')}`, label: t('navTourStyles') },
        { href: `/${locale}/products/tags`, label: t('navTravelGuide') },
        { href: `/${locale}#home-reviews`, label: t('navReviews') },
        { href: `/${locale}/products`, label: t('navAboutUs') },
      ]
    : [
        { href: `/${locale}/products/tags`, label: t('navPlacesToSee') },
        { href: `/${locale}/products`, label: t('navThingsToDo') },
        { href: `/${locale}/products/custom-tour`, label: t('navTripInspiration') },
      ]

  if (isHome) {
    return (
      <>
        <header className="kv-header kv-header--solid">
          <div className="kv-container kv-header-inner">
            <CustomerSiteLogo brandName={brandName} href={`/${locale}`} className="kv-logo" />

            <nav className="kv-header-nav hidden lg:flex" aria-label="Main">
              {navLinks.map((link) => (
                <Link key={link.href + link.label} href={link.href} className="kv-header-nav-link">
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="kv-header-actions hidden md:flex">
              <HeaderLocaleButton locale={locale} onSwitch={switchLocale} label={t('language')} />
              <UtilityIconButton
                href={`/${locale}/products`}
                icon={<Heart className="h-5 w-5" strokeWidth={1.75} />}
                label={t('wishlist')}
              />
              {!loading && currentUser ? (
                <UtilityIconButton
                  href={`/${locale}/dashboard`}
                  icon={<User className="h-5 w-5" strokeWidth={1.75} />}
                  label={t('profile')}
                />
              ) : (
                <UtilityIconButton
                  href={`/${locale}/auth`}
                  icon={<User className="h-5 w-5" strokeWidth={1.75} />}
                  label={t('profile')}
                />
              )}
              <HeaderCartButton onClick={() => setShowCart(true)} label={locale === 'en' ? 'Cart' : '장바구니'} />
            </div>

            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="kv-header-icon-btn md:hidden"
              aria-label={isMobileMenuOpen ? t('close') : t('menu')}
            >
              {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>

          {isMobileMenuOpen ? (
            <div className="kv-header-mobile md:hidden">
              <div className="kv-container flex flex-col gap-2 py-4">
                {navLinks.map((link) => (
                  <Link
                    key={link.href + link.label}
                    href={link.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="rounded-lg px-3 py-2.5 text-sm font-medium text-[#1a1a1a] hover:bg-[#f7f8fa]"
                  >
                    {link.label}
                  </Link>
                ))}
                <HeaderLocaleButton
                  locale={locale}
                  onSwitch={() => {
                    setIsMobileMenuOpen(false)
                    switchLocale()
                  }}
                  className="kv-header-locale mt-2 w-fit"
                  label={t('language')}
                />
              </div>
            </div>
          ) : null}
        </header>

        <CartSidebar
          isOpen={showCart}
          onClose={() => setShowCart(false)}
          onCheckout={() => setShowCart(false)}
        />
      </>
    )
  }

  return (
    <>
      <header className="gyg-header">
        <div className="gyg-container flex h-[68px] items-center justify-between">
          <CustomerSiteLogo brandName={brandName} href={`/${locale}`} className="kv-logo shrink-0" />

          <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-7 lg:flex" aria-label="Main">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} className="gyg-nav-link">
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-1 md:flex">
            <UtilityIconButton
              href={`/${locale}/products`}
              icon={<Heart className="h-[22px] w-[22px]" strokeWidth={1.75} />}
              label={t('wishlist')}
            />
            <HeaderCartButton onClick={() => setShowCart(true)} label={locale === 'en' ? 'Cart' : '장바구니'} />
            <HeaderLocaleButton
              locale={locale}
              onSwitch={switchLocale}
              className="kv-header-locale hidden sm:inline-flex"
              label={t('language')}
            />
            <button type="button" onClick={switchLocale} className="kv-header-icon-btn sm:hidden" aria-label={t('language')}>
              <Globe className="h-[22px] w-[22px]" strokeWidth={1.75} aria-hidden />
            </button>
            {!loading && currentUser ? (
              <UtilityIconButton
                href={`/${locale}/dashboard`}
                icon={<User className="h-[22px] w-[22px]" strokeWidth={1.75} />}
                label={t('profile')}
              />
            ) : (
              <UtilityIconButton
                href={`/${locale}/auth`}
                icon={<User className="h-[22px] w-[22px]" strokeWidth={1.75} />}
                label={t('profile')}
              />
            )}
          </div>
        </div>
      </header>

      <CartSidebar
        isOpen={showCart}
        onClose={() => setShowCart(false)}
        onCheckout={() => setShowCart(false)}
      />
    </>
  )
}
