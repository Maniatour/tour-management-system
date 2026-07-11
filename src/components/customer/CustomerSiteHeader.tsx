'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown, Globe, Heart, Menu, ShoppingCart, User, X } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useContext, useState, type ReactNode } from 'react'
import { CartSidebar, useCart } from '@/components/cart/CartProvider'
import { AuthContext } from '@/contexts/AuthContext'

type CustomerSiteHeaderProps = {
  brandName: string
}

function GygUtilityItem({
  href,
  onClick,
  icon,
  label,
}: {
  href?: string
  onClick?: () => void
  icon: ReactNode
  label: string
}) {
  const className =
    'flex flex-col items-center gap-1 min-w-[52px] text-[11px] font-medium text-[#1a2b49] hover:text-[#ff5533] transition-colors'

  if (href) {
    return (
      <Link href={href} className={className}>
        {icon}
        <span>{label}</span>
      </Link>
    )
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {icon}
      <span>{label}</span>
    </button>
  )
}

function HeaderCartButton({ onClick, label }: { onClick: () => void; label: string }) {
  const { totalItems } = useCart()

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex flex-col items-center gap-1 min-w-[52px] text-[11px] font-medium text-[#1a2b49] hover:text-[#ff5533] transition-colors"
    >
      <ShoppingCart className="h-[22px] w-[22px]" strokeWidth={1.75} aria-hidden />
      {totalItems > 0 ? (
        <span className="absolute -right-1 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ff5533] px-1 text-[10px] font-bold text-white">
          {totalItems}
        </span>
      ) : null}
      <span>{label}</span>
    </button>
  )
}

export default function CustomerSiteHeader({ brandName }: CustomerSiteHeaderProps) {
  const t = useTranslations('common')
  const locale = useLocale()
  const pathname = usePathname()
  const context = useContext(AuthContext)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [showCart, setShowCart] = useState(false)

  const loading = context?.loading ?? true
  const currentUser = context?.authUser ?? null
  const currencyLabel = locale === 'en' ? 'EN/USD $' : 'KO/USD $'

  const isHome = pathname === `/${locale}` || pathname === `/${locale}/`

  const navLinks = [
    { href: `/${locale}/products/tags`, label: t('navPlacesToSee'), activeOnHome: true },
    { href: `/${locale}/products`, label: t('navThingsToDo'), activeOnHome: false },
    { href: `/${locale}/products/custom-tour`, label: t('navTripInspiration'), activeOnHome: false },
  ]

  const isLinkActive = (href: string, activeOnHome: boolean) =>
    pathname === href || pathname.startsWith(`${href}/`) || (isHome && activeOnHome)

  const toggleLocale = () => {
    const newLocale = locale === 'ko' ? 'en' : 'ko'
    const pathWithoutLocale = pathname.replace(`/${locale}`, '') || '/'
    window.location.href = `/${newLocale}${pathWithoutLocale}`
  }

  return (
    <>
      <header className="gyg-header">
        <div className="gyg-container flex h-[68px] items-center justify-between">
          <Link href={`/${locale}`} className="gyg-logo shrink-0" aria-label={brandName}>
            {brandName.split(' ').map((word) => (
              <span key={word}>{word}</span>
            ))}
          </Link>

          <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-7 lg:flex" aria-label="Main">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`gyg-nav-link ${isLinkActive(link.href, link.activeOnHome) ? 'gyg-nav-link-active' : ''}`}
              >
                {link.label}
                <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden />
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-1 md:flex">
            <GygUtilityItem
              href={`/${locale}/products`}
              icon={<Heart className="h-[22px] w-[22px]" strokeWidth={1.75} />}
              label={t('wishlist')}
            />
            <HeaderCartButton onClick={() => setShowCart(true)} label={locale === 'en' ? 'Cart' : '장바구니'} />
            <button type="button" onClick={toggleLocale} className="flex flex-col items-center gap-1 min-w-[52px] text-[11px] font-medium text-[#1a2b49] hover:text-[#ff5533] transition-colors">
              <Globe className="h-[22px] w-[22px]" strokeWidth={1.75} aria-hidden />
              <span>{currencyLabel}</span>
            </button>
            {!loading && currentUser ? (
              <GygUtilityItem
                href={`/${locale}/dashboard`}
                icon={<User className="h-[22px] w-[22px]" strokeWidth={1.75} />}
                label={t('profile')}
              />
            ) : (
              <GygUtilityItem
                href={`/${locale}/auth`}
                icon={<User className="h-[22px] w-[22px]" strokeWidth={1.75} />}
                label={t('profile')}
              />
            )}
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <HeaderCartButton onClick={() => setShowCart(true)} label="" />
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="rounded-lg p-2 text-[#1a2b49]"
              aria-label={isMobileMenuOpen ? t('close') : t('menu')}
            >
              {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {isMobileMenuOpen ? (
          <div className="border-t border-[#e5e7eb] bg-white px-4 py-4 md:hidden">
            <div className="gyg-container flex flex-col gap-2 !px-0">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-[#1a2b49] hover:bg-[#f9fafb]"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </header>

      <CartSidebar
        isOpen={showCart}
        onClose={() => setShowCart(false)}
        onCheckout={() => {
          setShowCart(false)
          if (pathname.includes('/products/')) {
            window.dispatchEvent(new CustomEvent('openCartCheckout'))
          }
        }}
      />
    </>
  )
}
