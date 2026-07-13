'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Heart, Menu, ShoppingCart, User, X } from 'lucide-react'
import ReactCountryFlag from 'react-country-flag'
import { useLocale, useTranslations } from 'next-intl'
import { useContext, useEffect, useState, type ReactNode } from 'react'
import { CartSidebar, useCart } from '@/components/cart/CartProvider'
import CartCheckout from '@/components/cart/CartCheckout'
import { AuthContext } from '@/contexts/AuthContext'
import CustomerSiteLogo from '@/components/customer/CustomerSiteLogo'
import type { AuthUser } from '@/lib/auth'

type CustomerSiteHeaderProps = {
  brandName: string
}

function UtilityIconButton({
  href,
  onClick,
  icon,
  label,
  light,
  className = '',
}: {
  href?: string
  onClick?: () => void
  icon: ReactNode
  label: string
  light?: boolean
  className?: string
}) {
  const buttonClass = `kv-header-icon-btn ${light ? 'kv-header-icon-btn--light' : ''} ${className}`.trim()

  if (href) {
    return (
      <Link href={href} className={buttonClass} aria-label={label}>
        {icon}
      </Link>
    )
  }

  return (
    <button type="button" onClick={onClick} className={buttonClass} aria-label={label}>
      {icon}
    </button>
  )
}

function HeaderCartButton({
  onClick,
  label,
  light,
  className = '',
}: {
  onClick: () => void
  label: string
  light?: boolean
  className?: string
}) {
  const { totalItems } = useCart()

  return (
    <button
      type="button"
      onClick={onClick}
      className={`kv-header-icon-btn relative ${light ? 'kv-header-icon-btn--light' : ''} ${className}`.trim()}
      aria-label={label}
    >
      <ShoppingCart className="h-5 w-5" strokeWidth={1.75} aria-hidden />
      {totalItems > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ff7e33] px-1 text-[10px] font-bold text-white">
          {totalItems}
        </span>
      ) : null}
    </button>
  )
}

function getAuthUserInitial(user: AuthUser): string {
  const name =
    user.name ||
    user.user_metadata?.name ||
    user.user_metadata?.full_name ||
    user.email?.split('@')[0] ||
    'U'

  return name.charAt(0).toUpperCase()
}

function HeaderLocaleButton({
  locale,
  onSwitch,
  className = 'kv-header-icon-btn',
  label,
}: {
  locale: string
  onSwitch: () => void
  className?: string
  label: string
}) {
  const countryCode = locale === 'ko' ? 'KR' : 'US'

  return (
    <button type="button" onClick={onSwitch} className={className} aria-label={label}>
      <ReactCountryFlag countryCode={countryCode} svg aria-hidden className="kv-header-flag-icon" />
    </button>
  )
}

function HeaderAccountButton({
  href,
  user,
  loading,
  label,
}: {
  href: string
  user: AuthUser | null
  loading: boolean
  label: string
}) {
  return (
    <Link href={href} className="kv-header-icon-btn" aria-label={label}>
      {!loading && user ? (
        <span className="kv-header-account-initial" aria-hidden>
          {getAuthUserInitial(user)}
        </span>
      ) : (
        <User className="h-5 w-5" strokeWidth={1.75} aria-hidden />
      )}
    </Link>
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
  const [showCheckout, setShowCheckout] = useState(false)

  const loading = context?.loading ?? true
  const currentUser = context?.authUser ?? null

  const isHome = pathname === `/${locale}` || pathname === `/${locale}/`
  const profileHref = !loading && currentUser ? `/${locale}/dashboard` : `/${locale}/auth`
  const cartLabel = locale === 'en' ? 'Cart' : '장바구니'
  const accountLabel = !loading && currentUser ? t('profile') : t('login')

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

  const closeMobileMenu = () => setIsMobileMenuOpen(false)

  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!isMobileMenuOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isMobileMenuOpen])

  const navLinkClass = isHome ? 'kv-header-nav-link' : 'gyg-nav-link'

  return (
    <>
      <header className={`kv-header kv-header--solid ${isHome ? '' : 'gyg-header'}`}>
        <div className="kv-container kv-header-inner">
          <div className="kv-header-logo-wrap--mobile">
            <CustomerSiteLogo brandName={brandName} href={`/${locale}`} className="kv-logo" compact />
          </div>
          <div className="kv-header-logo-wrap--desktop">
            <CustomerSiteLogo brandName={brandName} href={`/${locale}`} className="kv-logo" />
          </div>

          <nav
            className={`kv-header-nav ${isHome ? '' : 'kv-header-nav--centered'}`}
            aria-label="Main"
          >
            {navLinks.map((link) => (
              <Link key={link.href + link.label} href={link.href} className={navLinkClass}>
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="kv-header-actions">
            <HeaderLocaleButton locale={locale} onSwitch={switchLocale} label={t('language')} />
            <UtilityIconButton
              href={`/${locale}/products`}
              icon={<Heart className="h-5 w-5" strokeWidth={1.75} />}
              label={t('wishlist')}
            />
            <HeaderAccountButton
              href={profileHref}
              user={currentUser}
              loading={loading}
              label={accountLabel}
            />
            <HeaderCartButton onClick={() => setShowCart(true)} label={cartLabel} />
          </div>

          <div className="kv-header-mobile-bar">
            <HeaderLocaleButton locale={locale} onSwitch={switchLocale} label={t('language')} />
            <HeaderAccountButton
              href={profileHref}
              user={currentUser}
              loading={loading}
              label={accountLabel}
            />
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen((open) => !open)}
              className="kv-header-icon-btn"
              aria-expanded={isMobileMenuOpen}
              aria-controls="customer-site-mobile-nav"
              aria-label={isMobileMenuOpen ? t('close') : t('menu')}
            >
              {isMobileMenuOpen ? <X className="h-6 w-6" aria-hidden /> : <Menu className="h-6 w-6" aria-hidden />}
            </button>
          </div>
        </div>

        {isMobileMenuOpen ? (
          <div id="customer-site-mobile-nav" className="kv-header-mobile">
            <div className="kv-container kv-header-mobile-panel">
              <nav className="kv-header-mobile-nav" aria-label="Mobile">
                {navLinks.map((link) => (
                  <Link
                    key={link.href + link.label}
                    href={link.href}
                    onClick={closeMobileMenu}
                    className="kv-header-mobile-link"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>

              <div className="kv-header-mobile-actions">
                <Link href={`/${locale}/products`} onClick={closeMobileMenu} className="kv-header-mobile-action">
                  <Heart className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                  <span>{t('wishlist')}</span>
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    closeMobileMenu()
                    setShowCart(true)
                  }}
                  className="kv-header-mobile-action"
                >
                  <ShoppingCart className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                  <span>{cartLabel}</span>
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </header>

      <CartSidebar
        isOpen={showCart}
        onClose={() => setShowCart(false)}
        onCheckout={() => {
          setShowCart(false)
          setShowCheckout(true)
        }}
      />

      <CartCheckout
        isOpen={showCheckout}
        onClose={() => setShowCheckout(false)}
        onSuccess={() => setShowCheckout(false)}
      />
    </>
  )
}
