'use client'

import CustomerPageZone from '@/components/product/CustomerPageZone'

export type NewsletterStructureVariant = 'centered' | 'split-image' | 'inline-bar'

function NewsletterForm({ t, compact }: { t: (key: string) => string; compact?: boolean }) {
  return (
    <form
      className={`flex ${compact ? 'flex-row gap-2' : 'flex-col sm:flex-row gap-3'} max-w-md ${compact ? '' : 'mx-auto'}`}
      onSubmit={(e) => e.preventDefault()}
    >
      <input
        type="email"
        placeholder={t('newsletterPlaceholder')}
        className="flex-1 rounded-xl border px-4 py-3 text-sm bg-white"
        aria-label={t('newsletterPlaceholder')}
      />
      <button type="submit" className="cp-ui-btn-primary px-6 py-3 rounded-xl font-semibold text-sm shrink-0">
        {t('newsletterCta')}
      </button>
    </form>
  )
}

export default function HomeNewsletterSectionView({
  variant,
  t,
  zoneId,
  titleOverride,
}: {
  variant: NewsletterStructureVariant
  t: (key: string) => string
  zoneId: string
  titleOverride?: string
}) {
  const title = titleOverride?.trim() || t('newsletterTitle')

  if (variant === 'inline-bar') {
    return (
      <CustomerPageZone zone={zoneId}>
        <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col sm:flex-row sm:items-center gap-4 border-t border-b">
          <div className="sm:flex-1">
            <h2 className="font-bold">{title}</h2>
            <p className="text-sm cp-ui-muted">{t('newsletterDesc')}</p>
          </div>
          <NewsletterForm t={t} compact />
        </div>
      </CustomerPageZone>
    )
  }

  if (variant === 'split-image') {
    return (
      <CustomerPageZone zone={zoneId}>
        <div className="max-w-7xl mx-auto px-4 py-10 grid lg:grid-cols-2 gap-8 items-center">
          <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-700 aspect-[4/3] lg:aspect-auto lg:min-h-64" />
          <div>
            <h2 className="text-2xl font-bold mb-2">{title}</h2>
            <p className="cp-ui-muted mb-6">{t('newsletterDesc')}</p>
            <NewsletterForm t={t} />
          </div>
        </div>
      </CustomerPageZone>
    )
  }

  return (
    <CustomerPageZone zone={zoneId}>
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <h2 className="text-2xl sm:text-3xl font-bold mb-2">{title}</h2>
        <p className="cp-ui-muted mb-6">{t('newsletterDesc')}</p>
        <NewsletterForm t={t} />
      </div>
    </CustomerPageZone>
  )
}
