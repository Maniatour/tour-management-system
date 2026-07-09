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

export const GALLERY_GRADIENTS = [
  'from-sky-400 to-blue-600',
  'from-amber-400 to-orange-600',
  'from-emerald-400 to-teal-600',
  'from-violet-400 to-purple-600',
  'from-rose-400 to-pink-600',
  'from-cyan-400 to-blue-500',
]

