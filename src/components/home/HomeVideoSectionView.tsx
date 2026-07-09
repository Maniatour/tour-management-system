'use client'

import { Play } from 'lucide-react'
import CustomerPageZone from '@/components/product/CustomerPageZone'

export type VideoStructureVariant = 'centered' | 'split-text' | 'full-width'

function VideoPlaceholder({ className = '' }: { className?: string }) {
  return (
    <div
      className={`relative rounded-2xl bg-gradient-to-br from-slate-800 to-slate-950 flex items-center justify-center aspect-video ${className}`}
    >
      <div className="absolute inset-0 bg-black/20 rounded-2xl" />
      <button
        type="button"
        className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-lg hover:scale-105 transition-transform"
        aria-label="Play video"
      >
        <Play className="h-6 w-6 ml-0.5 fill-current" />
      </button>
    </div>
  )
}

export default function HomeVideoSectionView({
  variant,
  t,
  zoneId,
  titleOverride,
}: {
  variant: VideoStructureVariant
  t: (key: string) => string
  zoneId: string
  titleOverride?: string
}) {
  const title = titleOverride?.trim() || t('videoSectionTitle')

  if (variant === 'split-text') {
    return (
      <CustomerPageZone zone={zoneId}>
        <div className="max-w-7xl mx-auto px-4 py-10 grid lg:grid-cols-2 gap-8 items-center">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">{title}</h2>
            <p className="cp-ui-muted mb-4">{t('videoSectionDesc')}</p>
            <p className="text-sm cp-ui-muted">{t('watchIntroVideo')}</p>
          </div>
          <VideoPlaceholder />
        </div>
      </CustomerPageZone>
    )
  }

  if (variant === 'full-width') {
    return (
      <CustomerPageZone zone={zoneId}>
        <div className="px-4 py-6">
          <VideoPlaceholder className="max-w-7xl mx-auto rounded-3xl" />
          <p className="text-center text-sm cp-ui-muted mt-4">{title}</p>
        </div>
      </CustomerPageZone>
    )
  }

  return (
    <CustomerPageZone zone={zoneId}>
      <div className="max-w-4xl mx-auto px-4 py-10 text-center">
        <h2 className="text-2xl font-bold mb-2">{title}</h2>
        <p className="cp-ui-muted mb-6">{t('videoSectionDesc')}</p>
        <VideoPlaceholder />
      </div>
    </CustomerPageZone>
  )
}
