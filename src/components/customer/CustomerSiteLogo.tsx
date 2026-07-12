'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useCustomerSiteBranding } from '@/contexts/CustomerSiteBrandingContext'
import { FALLBACK_SITE_LOGO_URL } from '@/lib/customerSiteBranding'

const WIDE_LOGO_ASPECT_RATIO = 1.35

type CustomerSiteLogoProps = {
  brandName: string
  href: string
  className?: string
  variant?: 'header' | 'footer' | 'dark'
  /** 모바일 헤더 — 파비콘 + 워드마크 고정 */
  compact?: boolean
}

function formatBrandWordmark(brandName: string) {
  const normalized = brandName.replace(/\s+/g, '').toUpperCase()
  return normalized || 'MANIATOUR'
}

export default function CustomerSiteLogo({
  brandName,
  href,
  className,
  variant = 'header',
  compact = false,
}: CustomerSiteLogoProps) {
  const { logoUrl, hasCustomLogo } = useCustomerSiteBranding()
  const [imageFailed, setImageFailed] = useState(false)
  const [logoShape, setLogoShape] = useState<'wide' | 'square' | null>(null)

  const wordmark = formatBrandWordmark(brandName)
  const useFallback = !hasCustomLogo || imageFailed
  const iconUrl = imageFailed ? FALLBACK_SITE_LOGO_URL : logoUrl
  const showWordmark = compact || useFallback || logoShape !== 'wide'
  const imageClassName = compact || showWordmark ? 'kv-logo-favicon' : 'kv-logo-brand'
  const wordmarkClassName =
    variant === 'footer' || variant === 'dark'
      ? 'kv-logo-wordmark kv-logo-wordmark--light'
      : 'kv-logo-wordmark'

  const handleImageLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = event.currentTarget
    if (!naturalWidth || !naturalHeight) {
      setLogoShape('square')
      return
    }

    setLogoShape(naturalWidth / naturalHeight > WIDE_LOGO_ASPECT_RATIO ? 'wide' : 'square')
  }

  return (
    <Link href={href} className={className} aria-label={brandName}>
      <img
        src={iconUrl}
        alt={showWordmark ? '' : brandName}
        aria-hidden={showWordmark || undefined}
        className={
          variant === 'footer' && !showWordmark
            ? `${imageClassName} kv-footer-logo-image`
            : variant === 'footer' && showWordmark
              ? `${imageClassName} kv-logo-favicon--footer`
              : imageClassName
        }
        onError={() => {
          setImageFailed(true)
          setLogoShape('square')
        }}
        onLoad={hasCustomLogo && !imageFailed ? handleImageLoad : undefined}
      />
      {showWordmark ? <span className={wordmarkClassName}>{wordmark}</span> : null}
    </Link>
  )
}
