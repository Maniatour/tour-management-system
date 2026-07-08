'use client'

import { BadgeCheck, Shield, Users, Zap } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { TrustBadgeItem } from '@/components/product/ui/TrustBadgeRow'

export function useProductDetailTrustBadges(): TrustBadgeItem[] {
  const t = useTranslations('productDetail')

  return [
    { icon: Shield, label: t('trustFreeCancellation') },
    { icon: Zap, label: t('trustInstantConfirmation') },
    { icon: Users, label: t('trustSmallGroup') },
    { icon: BadgeCheck, label: t('trustLicensedOperator') },
  ]
}
