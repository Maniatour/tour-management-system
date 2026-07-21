'use client'

import { getSiteLocaleMeta, type SiteLocale } from '@/lib/siteLocales'

type ContentLibraryLocaleBadgesProps = {
  locales: SiteLocale[]
  className?: string
}

export default function ContentLibraryLocaleBadges({
  locales,
  className = '',
}: ContentLibraryLocaleBadgesProps) {
  if (locales.length === 0) return null

  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {locales.map((code) => (
        <span
          key={code}
          className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
        >
          {getSiteLocaleMeta(code).countryCode}
        </span>
      ))}
    </div>
  )
}
