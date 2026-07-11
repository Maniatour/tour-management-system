export type ReviewItem = {
  name: string
  country: string
  rating: number
  quote: string
}

export type FaqItem = { question: string; answer: string }

export function getDemoReviews(t: (key: string) => string): ReviewItem[] {
  return [
    {
      name: t('reviewGuest1Name'),
      country: t('reviewGuest1Country'),
      rating: 5,
      quote: t('reviewGuest1Quote'),
    },
    {
      name: t('reviewGuest2Name'),
      country: t('reviewGuest2Country'),
      rating: 5,
      quote: t('reviewGuest2Quote'),
    },
    {
      name: t('reviewGuest3Name'),
      country: t('reviewGuest3Country'),
      rating: 5,
      quote: t('reviewGuest3Quote'),
    },
  ]
}

export function getDemoFaq(t: (key: string) => string): FaqItem[] {
  return [
    { question: t('faqQ1'), answer: t('faqA1') },
    { question: t('faqQ2'), answer: t('faqA2') },
    { question: t('faqQ3'), answer: t('faqA3') },
    { question: t('faqQ4'), answer: t('faqA4') },
    { question: t('faqQ5'), answer: t('faqA5') },
  ]
}

/** Neutral editorial placeholders when CMS has no gallery images yet */
export const GALLERY_PLACEHOLDER_CLASSES = [
  'bg-muted/50 border border-border/60',
  'bg-muted/40 border border-border/50',
  'bg-muted/60 border border-border/60',
  'bg-muted/45 border border-border/55',
  'bg-muted/55 border border-border/60',
  'bg-muted/50 border border-border/50',
] as const

/** @deprecated Use GALLERY_PLACEHOLDER_CLASSES */
export const GALLERY_GRADIENTS = GALLERY_PLACEHOLDER_CLASSES

