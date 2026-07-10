import type { LegalPageSlug } from '@/lib/customerSiteRoutes'

export type LegalPageLabels = {
  backToHome: string
  lastUpdated: string
  relatedPolicies: string
  terms: string
  privacyPolicy: string
  smsTerms: string
  cancellationRefundPolicy: string
  cookiePolicy: string
}

export async function getLegalPageLabels(locale: string): Promise<LegalPageLabels> {
  const { getTranslations } = await import('next-intl/server')
  const t = await getTranslations({ locale, namespace: 'legalPages' })

  return {
    backToHome: t('backToHome'),
    lastUpdated: t('lastUpdated'),
    relatedPolicies: t('relatedPolicies'),
    terms: t('terms'),
    privacyPolicy: t('privacyPolicy'),
    smsTerms: t('smsTerms'),
    cancellationRefundPolicy: t('cancellationRefundPolicy'),
    cookiePolicy: t('cookiePolicy'),
  }
}

export const LEGAL_LABEL_KEYS: Record<
  LegalPageSlug,
  keyof LegalPageLabels
> = {
  terms: 'terms',
  'privacy-policy': 'privacyPolicy',
  'sms-terms': 'smsTerms',
  'cancellation-refund-policy': 'cancellationRefundPolicy',
  'cookie-policy': 'cookiePolicy',
}
